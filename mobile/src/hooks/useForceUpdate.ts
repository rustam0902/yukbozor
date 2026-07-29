import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const PLAY_STORE_URL = 'market://details?id=uz.yukbozor.app';
const PLAY_STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=uz.yukbozor.app';
const APP_STORE_URL = 'itms-apps://itunes.apple.com/app/id6744022888';

/** Minimum required version — update this when releasing a breaking build. */
const MIN_REQUIRED_VERSION = '1.0.0';

function parseVersion(v: string): number[] {
  return (v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
}

/** Returns true if `installed` is older than `required`. */
function isOutdated(installed: string, required: string): boolean {
  const a = parseVersion(installed);
  const b = parseVersion(required);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai < bi) return true;
    if (ai > bi) return false;
  }
  return false;
}

export function getCurrentVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

export function isForceUpdateRequired(): boolean {
  const current = getCurrentVersion();
  return isOutdated(current, MIN_REQUIRED_VERSION);
}

export async function openStore(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(PLAY_STORE_URL);
    } catch {
      await Linking.openURL(PLAY_STORE_WEB_URL);
    }
  } else {
    await Linking.openURL(APP_STORE_URL);
  }
}
