import { Platform, AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { api } from './api';

const APP_VERSION: string = (Constants.expoConfig?.version ?? Constants.manifest?.version ?? '1.0.0') as string;

function getDeviceInfo() {
  return {
    deviceModel: Device.modelName ?? Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: APP_VERSION,
  };
}

let currentScreen = 'unknown';
let sessionStart: number | null = null;
let screensVisited = 0;

export function setCurrentScreen(screen: string) {
  if (screen !== currentScreen) {
    screensVisited++;
    currentScreen = screen;
  }
}

export function getCurrentScreen() {
  return currentScreen;
}

export function trackEvent(eventName: string, screen?: string, metadata?: Record<string, any>) {
  const payload = {
    eventName,
    screen: screen ?? currentScreen,
    ...getDeviceInfo(),
    ...(metadata ? { metadata } : {}),
  };
  api.post('/api/analytics/event', payload).catch(() => {});
}

export function trackError(errorMessage: string, errorStack?: string, screen?: string) {
  const payload = {
    errorMessage: String(errorMessage).slice(0, 2000),
    errorStack: errorStack?.slice(0, 5000),
    screen: screen ?? currentScreen,
    ...getDeviceInfo(),
  };
  api.post('/api/analytics/error', payload).catch(() => {});
}

let sessionStarted = false;

function onAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'active' && !sessionStarted) {
    sessionStarted = true;
    sessionStart = Date.now();
    screensVisited = 0;
    trackEvent('session_start', currentScreen);
  } else if ((nextState === 'background' || nextState === 'inactive') && sessionStarted) {
    sessionStarted = false;
    const durationSeconds = sessionStart ? Math.round((Date.now() - sessionStart) / 1000) : 0;
    sessionStart = null;
    trackEvent('session_end', currentScreen, { durationSeconds, screensVisited });
    screensVisited = 0;
  }
}

let analyticsInitialized = false;

export function initAnalytics() {
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  AppState.addEventListener('change', onAppStateChange);

  if (AppState.currentState === 'active') {
    sessionStarted = true;
    sessionStart = Date.now();
    screensVisited = 0;
    trackEvent('session_start', currentScreen);
  }

  // Global JS error handler
  const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
  (global as any).ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
    try {
      trackError(error?.message ?? String(error), error?.stack, currentScreen);
    } catch (_) {}
    if (typeof originalHandler === 'function') originalHandler(error, isFatal);
  });

  // Unhandled Promise rejection — standard web-compat handler (RN polyfills this)
  const globalAny = global as any;
  const prevRejectionHandler = globalAny.onunhandledrejection;
  globalAny.onunhandledrejection = (event: any) => {
    try {
      const reason = event?.reason;
      const msg = reason?.message ?? String(reason ?? 'Unhandled promise rejection');
      trackError(`[Promise] ${msg}`, reason?.stack, currentScreen);
    } catch (_) {}
    if (typeof prevRejectionHandler === 'function') prevRejectionHandler(event);
  };

  // Hermes native promise rejection tracker (RN ≥ 0.65)
  try {
    const { HermesInternal } = global as any;
    if (HermesInternal) {
      HermesInternal.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id: number, reason: any) => {
          try {
            const msg = reason?.message ?? String(reason ?? 'Unhandled promise rejection');
            trackError(`[Promise] ${msg}`, reason?.stack, currentScreen);
          } catch (_) {}
        },
      });
    }
  } catch (_) {}
}
