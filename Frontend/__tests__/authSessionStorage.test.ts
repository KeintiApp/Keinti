import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  clearKeintiAuthSession,
  loadKeintiAuthSession,
  saveKeintiAuthSession,
} from '../src/services/authSessionStorage';

describe('authSessionStorage preferredLanguage persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (Keychain as any).__reset?.();
  });

  afterEach(async () => {
    await clearKeintiAuthSession();
  });

  test.each(['de', 'it'] as const)('persists %s across save and load', async (language) => {
    await saveKeintiAuthSession({
      token: 'token-123',
      user: {
        email: 'user@example.com',
        preferredLanguage: language,
      },
    });

    const stored = await loadKeintiAuthSession();

    expect(stored?.user.preferredLanguage).toBe(language);
  });
});
