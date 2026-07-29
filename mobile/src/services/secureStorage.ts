import * as SecureStore from 'expo-secure-store';

const KEYS = {
  PIN_HASH: 'yukbor_pin_hash',
  PIN_SALT: 'yukbor_pin_salt',
  BIOMETRICS_ENABLED: 'yukbor_biometrics_enabled',
  PIN_SETUP_COMPLETED: 'yukbor_pin_setup_completed',
  USER_TOKEN: 'yukbor_user_token',
  USER_ID: 'yukbor_user_id',
};

function generateRandomSalt(): string {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashWithWebCrypto(message: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.log('Web Crypto not available, using fallback');
  }
  
  let hash = 5381;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5) + hash) + message.charCodeAt(i);
    hash = hash >>> 0;
  }
  
  let hash2 = 0;
  for (let i = 0; i < message.length; i++) {
    hash2 = ((hash2 << 5) - hash2) + message.charCodeAt(i);
    hash2 = hash2 >>> 0;
  }
  
  return hash.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0');
}

async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  const combined = salt + pin + salt;
  const firstHash = await hashWithWebCrypto(combined);
  const secondHash = await hashWithWebCrypto(firstHash + salt);
  return secondHash;
}

export const secureStorage = {
  async savePin(pin: string): Promise<void> {
    const salt = generateRandomSalt();
    const hashedPin = await hashPinWithSalt(pin, salt);
    await SecureStore.setItemAsync(KEYS.PIN_SALT, salt);
    await SecureStore.setItemAsync(KEYS.PIN_HASH, hashedPin);
    await SecureStore.setItemAsync(KEYS.PIN_SETUP_COMPLETED, 'true');
  },

  async verifyPin(pin: string): Promise<boolean> {
    const storedSalt = await SecureStore.getItemAsync(KEYS.PIN_SALT);
    const storedHash = await SecureStore.getItemAsync(KEYS.PIN_HASH);
    
    if (!storedSalt || !storedHash) return false;
    
    const inputHash = await hashPinWithSalt(pin, storedSalt);
    return storedHash === inputHash;
  },

  async isPinSetup(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.PIN_SETUP_COMPLETED);
    return value === 'true';
  },

  async clearPin(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.PIN_HASH);
    await SecureStore.deleteItemAsync(KEYS.PIN_SALT);
    await SecureStore.deleteItemAsync(KEYS.PIN_SETUP_COMPLETED);
  },

  async setBiometricsEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
  },

  async isBiometricsEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(KEYS.BIOMETRICS_ENABLED);
    return value === 'true';
  },

  async saveUserToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER_TOKEN, token);
  },

  async getUserToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(KEYS.USER_TOKEN);
  },

  async saveUserId(userId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER_ID, userId);
  },

  async getUserId(): Promise<string | null> {
    return await SecureStore.getItemAsync(KEYS.USER_ID);
  },

  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.PIN_HASH);
    await SecureStore.deleteItemAsync(KEYS.PIN_SALT);
    await SecureStore.deleteItemAsync(KEYS.PIN_SETUP_COMPLETED);
    await SecureStore.deleteItemAsync(KEYS.BIOMETRICS_ENABLED);
    await SecureStore.deleteItemAsync(KEYS.USER_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.USER_ID);
  },

  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.USER_TOKEN);
  },
};
