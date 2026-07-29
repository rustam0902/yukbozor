import { useState, useEffect, useCallback } from 'react';
import { eimzoService, EImzoKey, EImzoSignResult } from '@/lib/e-imzo';

interface SignForAuthResult {
  success: boolean;
  pkcs7?: string;
  error?: string;
}

interface UseEImzoResult {
  isInstalled: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  keys: EImzoKey[];
  selectedKey: EImzoKey | null;
  loadedKeyId: string | null;
  
  init: () => Promise<boolean>;
  loadKeys: () => Promise<void>;
  refreshKeys: () => Promise<void>;
  recheckInstallation: () => Promise<void>;
  selectKey: (key: EImzoKey) => void;
  loadKey: (key: EImzoKey) => Promise<string>;
  signDocument: (document: string, keyIdOverride?: string) => Promise<string>;
  signForAuth: (keySerialNumber: string) => Promise<SignForAuthResult>;
  clearError: () => void;
}

export function useEImzo(): UseEImzoResult {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<EImzoKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<EImzoKey | null>(null);
  const [loadedKeyId, setLoadedKeyId] = useState<string | null>(null);

  // Check for E-IMZO installation asynchronously (waits for e-imzo.js to load)
  useEffect(() => {
    let mounted = true;
    
    const checkInstallation = async () => {
      // First do a quick sync check
      if (eimzoService.isInstalled()) {
        if (mounted) setIsInstalled(true);
        return;
      }
      
      // If not immediately available, wait for async load (up to 3 seconds)
      const installed = await eimzoService.isInstalledAsync(3000);
      if (mounted) {
        setIsInstalled(installed);
        if (!installed) {
          console.log('E-IMZO: Программа не обнаружена. Убедитесь, что E-IMZO.exe запущен.');
        }
      }
    };
    
    checkInstallation();
    
    return () => { mounted = false; };
  }, []);

  const init = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await eimzoService.init();
      setIsInitialized(success);
      if (!success) {
        setError('Не удалось инициализировать E-IMZO. Убедитесь, что программа запущена.');
      }
      return success;
    } catch (err) {
      setError('Ошибка инициализации E-IMZO');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const keyList = await eimzoService.listKeys();
      setKeys(keyList);
    } catch (err: any) {
      setError(err.message || 'Не удалось получить список ключей');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectKey = useCallback((key: EImzoKey) => {
    setSelectedKey(key);
    setLoadedKeyId(null);
  }, []);

  const loadKey = useCallback(async (key: EImzoKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const keyId = await eimzoService.loadKey(key);
      setLoadedKeyId(keyId);
      return keyId;
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить ключ');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign document with PKCS7 and add timestamp via E-IMZO server
  // This is the correct flow for legally-valid document signatures
  // Pass keyId directly if calling immediately after loadKey (React setState is async)
  const signDocument = useCallback(async (document: string, keyIdOverride?: string) => {
    const keyIdToUse = keyIdOverride || loadedKeyId;
    if (!keyIdToUse) {
      throw new Error('Ключ не загружен');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      console.log('[E-IMZO] Signing document with timestamp, keyId:', keyIdToUse.substring(0, 20) + '...');
      const pkcs7WithTimestamp = await eimzoService.createPkcs7WithTimestamp(keyIdToUse, document);
      console.log('[E-IMZO] Document signed successfully, length:', pkcs7WithTimestamp?.length);
      return pkcs7WithTimestamp;
    } catch (err: any) {
      setError(err.message || 'Не удалось подписать документ');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadedKeyId]);

  // Alias for refreshKeys
  const loadKeys = refreshKeys;

  // Sign for authentication - complete flow: get challenge from E-IMZO server, find key, load it, sign challenge
  // According to E-IMZO docs: challenge comes from e-imzo-server and is validated by it during /backend/auth
  const signForAuth = useCallback(async (keySerialNumber: string): Promise<SignForAuthResult> => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[E-IMZO Auth] Starting authentication flow for key:', keySerialNumber);
      
      // Step 1: Get challenge from E-IMZO server via our backend
      const challengeResponse = await fetch('/api/auth/login-eimzo/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!challengeResponse.ok) {
        const errorData = await challengeResponse.json().catch(() => ({}));
        console.error('[E-IMZO Auth] Failed to get challenge:', errorData);
        return { success: false, error: errorData.error || 'Не удалось получить challenge от сервера' };
      }

      const { challenge } = await challengeResponse.json();
      console.log('[E-IMZO Auth] Got challenge from E-IMZO server, length:', challenge?.length);

      if (!challenge) {
        return { success: false, error: 'Сервер не вернул challenge' };
      }

      // Step 2: Find the key by serial number
      const key = keys.find(k => k.serialNumber === keySerialNumber);
      if (!key) {
        return { success: false, error: 'Ключ не найден' };
      }
      console.log('[E-IMZO Auth] Found key:', key.CN);

      // Step 3: Load the key (this will prompt for password)
      const keyId = await eimzoService.loadKey(key);
      if (!keyId) {
        return { success: false, error: 'Не удалось загрузить ключ' };
      }
      console.log('[E-IMZO Auth] Key loaded, keyId obtained');

      // Step 4: Sign the E-IMZO server-provided challenge
      const pkcs7 = await eimzoService.createPkcs7(keyId, challenge);
      console.log('[E-IMZO Auth] Challenge signed, PKCS7 length:', pkcs7?.length);
      
      return { success: true, pkcs7 };
    } catch (err: any) {
      const errorMessage = err.message || 'Ошибка при подписании';
      console.error('[E-IMZO Auth] Error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [keys]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Manual recheck installation (useful when user starts E-IMZO.exe after page load)
  const recheckInstallation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Quick sync check first
      if (eimzoService.isInstalled()) {
        setIsInstalled(true);
        setIsLoading(false);
        return;
      }
      
      // Wait for async check (up to 5 seconds)
      const installed = await eimzoService.isInstalledAsync(5000);
      setIsInstalled(installed);
      
      if (!installed) {
        setError('E-IMZO не обнаружен. Убедитесь, что E-IMZO.exe запущен и обновите страницу.');
      }
    } catch (err) {
      setError('Ошибка при проверке E-IMZO');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isInstalled,
    isInitialized,
    isLoading,
    error,
    keys,
    selectedKey,
    loadedKeyId,
    init,
    loadKeys,
    refreshKeys,
    recheckInstallation,
    selectKey,
    loadKey,
    signDocument,
    signForAuth,
    clearError
  };
}
