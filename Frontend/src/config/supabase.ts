import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE:
// - `SUPABASE_ANON_KEY` is safe to ship in the mobile app (it's public).
// - Never put the `service_role` key in the mobile app.
//
// Fill these values from Supabase Dashboard -> Project Settings -> API.
export const SUPABASE_URL = 'https://ormthcbmonhxmclkqqae.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ybXRoY2Jtb25oeG1jbGtxcWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTQzNjcsImV4cCI6MjA4NDAzMDM2N30.KFzx14-kk2o_1tHmy6IUu-5y0WN2YnQEsBsQLV0z-ZU';

// Deep-link redirect used for OAuth.
// Make sure this scheme is registered in AndroidManifest.xml and Info.plist.
export const SUPABASE_REDIRECT_URL = 'keinti://auth-callback';

const supabaseUrl = String(SUPABASE_URL || '').trim();
const supabaseAnonKey = String(SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

if (__DEV__) {
  // Do not log keys. Length is enough for diagnostics.
  const host = supabaseUrl.replace(/^https?:\/\//, '').split('/')[0];
  // eslint-disable-next-line no-console
  console.log(`[supabase] configured=${isSupabaseConfigured()} host=${host} anonKeyLength=${supabaseAnonKey.length}`);
}

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;
