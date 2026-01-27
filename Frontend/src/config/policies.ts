export const POLICY_URLS = {
  privacyPolicy: 'https://legal.keintiapp.com/privacy-policy/',
  cookiesAdPolicy: 'https://legal.keintiapp.com/cookies-advertising-policy/',
  termsOfUse: 'https://legal.keintiapp.com/terms-of-use/',
} as const;

export type PolicyUrlKey = keyof typeof POLICY_URLS;
