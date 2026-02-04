export const POLICY_URLS = {
  privacyPolicy: 'https://legal.keintiapp.com/privacy-policy/',
  cookiesAdPolicy: 'https://legal.keintiapp.com/cookies-advertising-policy/',
  termsOfUse: 'https://legal.keintiapp.com/terms-of-use/',
  childSafetyStandards: 'https://legal.keintiapp.com/child-safety-standards/',
  accountDeletion: 'https://legal.keintiapp.com/account-deletion/',
} as const;

export type PolicyUrlKey = keyof typeof POLICY_URLS;
