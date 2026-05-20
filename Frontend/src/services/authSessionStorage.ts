import { isSupportedLanguage, type Language } from '../i18n/translations';
import { secureKeyValueStorage } from './secureKeyValueStorage';

export type KeintiAuthSessionV1 = {
  version: 1;
  storedAt: string; // ISO
  token: string; // Backend bearer token
  user: {
    email: string;
    username?: string;
    profilePhotoUri?: string;
    socialNetworks?: Array<{ id: string; link: string }>;
    nationality?: string;
    preferredLanguage?: Language;
    accountVerified?: boolean;
  };
};

const STORAGE_KEY = 'keinti.auth.session.v1';

const safeJsonParse = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeOptionalLanguage = (input: unknown): Language | undefined => {
  const raw = String(input || '').trim().toLowerCase();
  return isSupportedLanguage(raw) ? raw : undefined;
};

export const loadKeintiAuthSession = async (): Promise<KeintiAuthSessionV1 | null> => {
  try {
    const raw = await secureKeyValueStorage.getItem(STORAGE_KEY);
    if (!raw) {return null;}
    const parsed = safeJsonParse(raw);
    if (!parsed || parsed.version !== 1) {return null;}

    const token = String(parsed?.token || '').trim();
    const email = String(parsed?.user?.email || '').trim();
    if (!token || !email) {return null;}

    return {
      version: 1,
      storedAt: String(parsed?.storedAt || '').trim() || new Date().toISOString(),
      token,
      user: {
        email,
        username: parsed?.user?.username ? String(parsed.user.username).trim() : undefined,
        profilePhotoUri: parsed?.user?.profilePhotoUri ? String(parsed.user.profilePhotoUri) : undefined,
        socialNetworks: Array.isArray(parsed?.user?.socialNetworks) ? parsed.user.socialNetworks : undefined,
        nationality: parsed?.user?.nationality ? String(parsed.user.nationality) : undefined,
        preferredLanguage: normalizeOptionalLanguage(parsed?.user?.preferredLanguage),
        accountVerified: typeof parsed?.user?.accountVerified === 'boolean' ? parsed.user.accountVerified : undefined,
      },
    };
  } catch {
    return null;
  }
};

export const saveKeintiAuthSession = async (session: Omit<KeintiAuthSessionV1, 'version' | 'storedAt'> & Partial<Pick<KeintiAuthSessionV1, 'storedAt'>>): Promise<void> => {
  const storedAt = session.storedAt ? String(session.storedAt) : new Date().toISOString();
  const payload: KeintiAuthSessionV1 = {
    version: 1,
    storedAt,
    token: String((session as any)?.token || '').trim(),
    user: {
      email: String((session as any)?.user?.email || '').trim(),
      username: (session as any)?.user?.username ? String((session as any).user.username).trim() : undefined,
      profilePhotoUri: (session as any)?.user?.profilePhotoUri ? String((session as any).user.profilePhotoUri) : undefined,
      socialNetworks: Array.isArray((session as any)?.user?.socialNetworks) ? (session as any).user.socialNetworks : undefined,
      nationality: (session as any)?.user?.nationality ? String((session as any).user.nationality) : undefined,
      preferredLanguage: normalizeOptionalLanguage((session as any)?.user?.preferredLanguage),
      accountVerified: typeof (session as any)?.user?.accountVerified === 'boolean' ? (session as any).user.accountVerified : undefined,
    },
  };

  if (!payload.token || !payload.user.email) {return;}

  await secureKeyValueStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const clearKeintiAuthSession = async (): Promise<void> => {
  try {
    await secureKeyValueStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
