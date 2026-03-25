import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';

export type AdsRuntimeConfig = {
  /** True once the Google Mobile Ads SDK has been initialized and we can safely request ads. */
  adsSdkReady: boolean;
  /** Whether GDPR applies to this device/user (best-effort). */
  gdprApplies: boolean | null;
};

let adsSdkInitPromise: Promise<void> | null = null;
const ADS_CONSENT_HANDLED_ACCOUNTS_STORAGE_KEY = 'keinti.ads.consent.handledAccounts.v1';

const safeBoolean = (value: unknown): boolean => Boolean(value);
const normalizeAccountKey = (value?: string | null) => String(value || '').trim().toLowerCase();

const loadHandledAccounts = async (): Promise<Record<string, true>> => {
  try {
    const raw = await AsyncStorage.getItem(ADS_CONSENT_HANDLED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.keys(parsed).reduce<Record<string, true>>((acc, key) => {
      const normalizedKey = normalizeAccountKey(key);
      if (normalizedKey && parsed[key]) {
        acc[normalizedKey] = true;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const hasHandledAdsConsentForAccount = async (accountKey?: string | null) => {
  const normalizedKey = normalizeAccountKey(accountKey);
  if (!normalizedKey) return true;

  const handledAccounts = await loadHandledAccounts();
  return handledAccounts[normalizedKey] === true;
};

const markAdsConsentHandledForAccount = async (accountKey?: string | null) => {
  const normalizedKey = normalizeAccountKey(accountKey);
  if (!normalizedKey) return;

  const handledAccounts = await loadHandledAccounts();
  if (handledAccounts[normalizedKey] === true) return;

  handledAccounts[normalizedKey] = true;
  await AsyncStorage.setItem(ADS_CONSENT_HANDLED_ACCOUNTS_STORAGE_KEY, JSON.stringify(handledAccounts));
};

const initializeAdsSdkIfNeeded = async (adsSdkReady: boolean) => {
  if (!adsSdkReady) return;

  if (!adsSdkInitPromise) {
    adsSdkInitPromise = mobileAds()
      .initialize()
      .then(() => undefined)
      .catch(() => undefined);
  }

  await adsSdkInitPromise;
};

export const getStoredAdsRuntimeConfig = async (): Promise<AdsRuntimeConfig> => {
  const consentInfo = await AdsConsent.getConsentInfo().catch(() => null as any);
  const adsSdkReady = safeBoolean(consentInfo?.canRequestAds);

  let gdprApplies: boolean | null = null;

  try {
    gdprApplies = await AdsConsent.getGdprApplies();
  } catch {
    gdprApplies = null;
  }

  if (__DEV__) {
    const choices = await AdsConsent.getUserChoices().catch(() => null);
    console.log('[AdsConsent] runtime config:', {
      canRequestAds: consentInfo?.canRequestAds,
      status: consentInfo?.status,
      gdprApplies,
      userChoices: choices,
    });
  }

  await initializeAdsSdkIfNeeded(adsSdkReady);

  return {
    adsSdkReady,
    gdprApplies,
  };
};

/**
 * Collects (or refreshes) consent information using Google UMP via AdsConsent.
 *
 * - Shows a consent form when required.
 * - Initializes the Google Mobile Ads SDK only when UMP indicates we can request ads.
 * - The SDK reads the TCF v2.0 consent string automatically for ad personalization.
 */
export const gatherConsentAndPrepareAds = async (): Promise<AdsRuntimeConfig> => {
  let consentInfo = await AdsConsent.getConsentInfo().catch(() => null as any);

  try {
    consentInfo = await AdsConsent.requestInfoUpdate();

    if (
      consentInfo?.isConsentFormAvailable &&
      (consentInfo?.status === AdsConsentStatus.UNKNOWN ||
        consentInfo?.status === AdsConsentStatus.REQUIRED)
    ) {
      consentInfo = await AdsConsent.showForm();
    }
  } catch (error) {
    // Non-fatal: UMP may fail due to network. We still attempt to use the previous session.
    if (__DEV__) {
      const msg = error instanceof Error ? error.message : String(error || 'unknown');
      console.log('[AdsConsent] consent refresh/show failed (non-fatal):', msg);
    }
  }

  if (!consentInfo) {
    consentInfo = await AdsConsent.getConsentInfo().catch(() => null as any);
  }

  return getStoredAdsRuntimeConfig();
};

export const ensureAdsConsentForAccount = async (accountKey?: string | null): Promise<AdsRuntimeConfig> => {
  const normalizedKey = normalizeAccountKey(accountKey);
  if (!normalizedKey) {
    return getStoredAdsRuntimeConfig();
  }

  const alreadyHandled = await hasHandledAdsConsentForAccount(normalizedKey);
  if (alreadyHandled) {
    return getStoredAdsRuntimeConfig();
  }

  let consentInfo = await AdsConsent.getConsentInfo().catch(() => null as any);
  let requestInfoUpdated = false;

  try {
    consentInfo = await AdsConsent.requestInfoUpdate();
    requestInfoUpdated = true;

    if (
      consentInfo?.isConsentFormAvailable &&
      (consentInfo?.status === AdsConsentStatus.UNKNOWN ||
        consentInfo?.status === AdsConsentStatus.REQUIRED)
    ) {
      consentInfo = await AdsConsent.showForm();
    }
  } catch (error) {
    if (__DEV__) {
      const msg = error instanceof Error ? error.message : String(error || 'unknown');
      console.log('[AdsConsent] account bootstrap failed (non-fatal):', msg);
    }
  }

  if (!consentInfo) {
    consentInfo = await AdsConsent.getConsentInfo().catch(() => null as any);
  }

  const shouldMarkHandled =
    requestInfoUpdated &&
    (consentInfo?.canRequestAds === true ||
      consentInfo?.isConsentFormAvailable === false ||
      (typeof consentInfo?.status === 'string' && consentInfo.status !== AdsConsentStatus.UNKNOWN));

  if (shouldMarkHandled) {
    await markAdsConsentHandledForAccount(normalizedKey).catch(() => {});
  }

  return getStoredAdsRuntimeConfig();
};
