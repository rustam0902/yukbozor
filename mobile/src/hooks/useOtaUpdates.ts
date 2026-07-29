import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LABEL = '[OTA]';
const APPLIED_KEY = '@ota_last_applied_id';

/**
 * Silent OTA updater — no dialog, no confusion about version numbers.
 * Strategy (two-pronged so it works on all devices):
 *  1. After download, tries reloadAsync() after a 2-second grace period.
 *     Works on most devices and gives the fastest possible update.
 *  2. If reloadAsync() fails (silently), the update is still staged.
 *     expo-updates will apply it automatically on the next true cold start
 *     (Force Stop + open, or OS process kill).
 */
export function useOtaUpdates(_language?: string): void {
  const checkingRef = useRef(false);
  const reloadScheduledRef = useRef(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;

    async function checkAndApply() {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        const manifest = result.manifest as any;
        const updateId: string = manifest?.id ?? manifest?.updateId ?? 'unknown';

        const lastApplied = await AsyncStorage.getItem(APPLIED_KEY);
        if (lastApplied === updateId) return;

        // Download the new bundle
        await Updates.fetchUpdateAsync();
        await AsyncStorage.setItem(APPLIED_KEY, updateId);

        if (__DEV__) console.log(LABEL, 'Update downloaded, reloading in 2s...');

        // Try to apply immediately with a grace period for assets to settle
        if (!reloadScheduledRef.current) {
          reloadScheduledRef.current = true;
          setTimeout(async () => {
            try {
              await Updates.reloadAsync();
            } catch (e) {
              // reloadAsync() failed on this device — update is still staged
              // and will be applied on the next cold start automatically
              if (__DEV__) console.warn(LABEL, 'reloadAsync failed (will apply on next cold start):', e instanceof Error ? e.message : String(e));
              reloadScheduledRef.current = false;
            }
          }, 2000);
        }
      } catch (e) {
        if (__DEV__) console.warn(LABEL, 'check/download error:', e instanceof Error ? e.message : String(e));
      } finally {
        checkingRef.current = false;
      }
    }

    // Check on mount
    checkAndApply();

    // Also check every time app comes to foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkAndApply();
    });

    return () => sub.remove();
  }, []);
}
