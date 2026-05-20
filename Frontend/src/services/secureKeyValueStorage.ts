import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const KEYCHAIN_ACCOUNT = 'keinti';
const KEYCHAIN_SERVICE_PREFIX = 'keinti.secure';

const getServiceName = (key: string) => `${KEYCHAIN_SERVICE_PREFIX}.${String(key || '').trim()}`;

const logKeychainWarning = (action: string, key: string, error: unknown) => {
  if (__DEV__) {
    console.warn(`[secure-storage] ${action} failed for ${key}`, error);
  }
};

const readFromKeychain = async (key: string): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: getServiceName(key) });
    return credentials ? credentials.password : null;
  } catch (error) {
    logKeychainWarning('get', key, error);
    return null;
  }
};

const writeToKeychain = async (key: string, value: string): Promise<boolean> => {
  try {
    await Keychain.setGenericPassword(KEYCHAIN_ACCOUNT, value, {
      service: getServiceName(key),
    });
    return true;
  } catch (error) {
    logKeychainWarning('set', key, error);
    return false;
  }
};

const removeFromKeychain = async (key: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: getServiceName(key) });
  } catch (error) {
    logKeychainWarning('remove', key, error);
  }
};

export const secureKeyValueStorage = {
  async getItem(key: string): Promise<string | null> {
    const secureValue = await readFromKeychain(key);
    if (secureValue !== null) {
      return secureValue;
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) {
      return null;
    }

    const storedSecurely = await writeToKeychain(key, legacyValue);
    if (storedSecurely) {
      await AsyncStorage.removeItem(key).catch(() => {});
    }

    return legacyValue;
  },

  async setItem(key: string, value: string): Promise<void> {
    const normalizedValue = String(value ?? '');
    const storedSecurely = await writeToKeychain(key, normalizedValue);

    if (storedSecurely) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return;
    }

    await AsyncStorage.setItem(key, normalizedValue);
  },

  async removeItem(key: string): Promise<void> {
    await removeFromKeychain(key);
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};