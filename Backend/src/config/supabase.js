const { createClient } = require('@supabase/supabase-js');

function requireEnv(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function isSupabaseConfigured() {
  return !!String(process.env.SUPABASE_URL || '').trim() && !!String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function isSupabaseAuthConfigured() {
  return !!String(process.env.SUPABASE_URL || '').trim() && !!String(process.env.SUPABASE_ANON_KEY || '').trim();
}

function getSupabaseAdminClient() {
  const url = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // Service role: server-only. Never expose to the mobile app.
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSupabaseAnonClient() {
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');

  // Anon key: safe to expose to the mobile app, but here we use it server-side
  // for password sign-in verification.
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSupabaseStorageBucket() {
  // Single bucket by default. You can split into multiple buckets later.
  return String(process.env.SUPABASE_STORAGE_BUCKET || 'keinti_media').trim();
}

module.exports = {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  getSupabaseStorageBucket,
  isSupabaseConfigured,
  isSupabaseAuthConfigured,
};
