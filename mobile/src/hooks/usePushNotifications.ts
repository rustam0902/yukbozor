import { useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

const PUSH_TOKEN_KEY = '@pushToken';
const PUSH_FILTERS_KEY = '@pushFilters';
const PUSH_ENABLED_KEY = '@pushEnabled';
const CARGO_FILTERS_KEY = '@cargoListFilters';

let _cachedToken: string | null = null;

async function setupAndroidChannel(Notifications: any): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cargo', {
      name: 'Новые грузы',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }
}

async function getOrRequestPermissions(Notifications: any): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  if (existing === 'denied') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Reads saved push filters from AsyncStorage.
 * Reads from @cargoListFilters first (single source of truth after UX unification).
 * Falls back to @pushFilters for backward compatibility.
 */
async function readSavedPushFilters(): Promise<Record<string, any>> {
  try {
    const cargoRaw = await AsyncStorage.getItem(CARGO_FILTERS_KEY);
    if (cargoRaw) return JSON.parse(cargoRaw);
    const pushRaw = await AsyncStorage.getItem(PUSH_FILTERS_KEY);
    return pushRaw ? JSON.parse(pushRaw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves push notification filter preferences to @pushFilters (mirror of @cargoListFilters).
 * Called automatically whenever the user applies cargo list filters, and on enable toggle.
 * Keeps @pushFilters in sync as a backup key; @cargoListFilters is the primary source of truth.
 */
export async function savePushFilters(filters: {
  originRegions?: string[];
  destinationRegions?: string[];
  transportTypes?: string[];
  excludeBot?: boolean;
}): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_FILTERS_KEY, JSON.stringify(filters));
  } catch {}
}

export async function registerPushTokenWithFilters(filters?: {
  originRegions?: string[];
  destinationRegions?: string[];
  transportTypes?: string[];
  excludeBot?: boolean;
}): Promise<void> {
  const enabledRaw = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
  if (enabledRaw === 'false') {
    console.log('[Push] Registration skipped — push disabled by user');
    return;
  }

  if (!_cachedToken) {
    _cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  }
  if (!_cachedToken) return;

  const savedFilters = filters ?? await readSavedPushFilters();

  const originRegions: string[] =
    Array.isArray(savedFilters?.originRegions) ? savedFilters.originRegions :
    savedFilters?.originRegion ? [savedFilters.originRegion] : [];

  const destinationRegions: string[] =
    Array.isArray(savedFilters?.destinationRegions) ? savedFilters.destinationRegions :
    savedFilters?.destinationRegion ? [savedFilters.destinationRegion] : [];

  const transportTypes: string[] =
    Array.isArray(savedFilters?.transportTypes) ? savedFilters.transportTypes :
    savedFilters?.transportType ? [savedFilters.transportType] : [];

  const excludeBot: boolean = savedFilters?.excludeBot === true;

  try {
    await api.post('/api/push/register', {
      expoToken: _cachedToken,
      originRegions,
      destinationRegions,
      transportTypes,
      excludeBot,
    });
    console.log('[Push] Token registered with server successfully');
  } catch (err: any) {
    console.warn('[Push] registerPushTokenWithFilters failed:', err?.message);
  }
}

/**
 * Sets up push notification permission + token registration.
 * Registers on cold start AND whenever the app returns to foreground (if push filters exist),
 * so a failed first-registration is automatically retried.
 *
 * Push filters use @cargoListFilters as the single source of truth (unified UX).
 * Changing the cargo list filter automatically re-registers push notifications with
 * the same filter values. The @pushFilters key is kept in sync as a mirror/backup.
 */
export function usePushNotifications(): void {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initPush = async () => {
      try {
        const Notifications = await import('expo-notifications');

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        await setupAndroidChannel(Notifications);

        const granted = await getOrRequestPermissions(Notifications);
        if (!granted) {
          console.log('[Push] Permission not granted');
          return;
        }

        const projectId = '7451932c-660d-4552-94ef-3810191bfc45';
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        console.log('[Push] Expo push token obtained:', token.slice(0, 40) + '...');

        _cachedToken = token;
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

        await registerPushTokenWithFilters();
      } catch (err: any) {
        if (__DEV__) {
          console.log('[Push] Init skipped (dev/emulator):', err?.message);
        } else {
          console.warn('[Push] Init failed:', err?.message);
        }
      }
    };

    initPush();

    // Re-register when app returns to foreground, but only if the user has non-empty filters.
    // Reads from @cargoListFilters (primary source of truth); @pushFilters is a mirror/backup.
    // Cargo list filter changes auto-sync push registration, so filters stay consistent.
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      readSavedPushFilters().then(saved => {
        const hasFilters =
          (Array.isArray(saved.originRegions) && saved.originRegions.length > 0) ||
          (Array.isArray(saved.destinationRegions) && saved.destinationRegions.length > 0) ||
          (Array.isArray(saved.transportTypes) && saved.transportTypes.length > 0) ||
          (saved.excludeBot === true);
        if (hasFilters) {
          registerPushTokenWithFilters().catch(() => {});
        }
      }).catch(() => {});
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}

/**
 * Registers a notification-tap listener that calls the provided callback.
 * Separate from usePushNotifications so the caller can supply auth-aware
 * navigation logic.
 */
export function usePushNotificationTapListener(
  onTap: (data: Record<string, unknown>) => void,
): void {
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  useEffect(() => {
    let listener: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = (lastResponse.notification.request.content.data ?? {}) as Record<string, unknown>;
          if (data.type === 'new_announcement') {
            setTimeout(() => onTapRef.current(data), 500);
          }
        }

        listener = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
          if (data.type === 'new_announcement') {
            onTapRef.current(data);
          }
        });
      } catch (err: any) {
        if (__DEV__) {
          console.log('[Push] Tap listener init skipped (dev/emulator):', err?.message);
        } else {
          console.warn('[Push] Tap listener init failed:', err?.message);
        }
      }
    })();

    return () => {
      listener?.remove();
    };
  }, []);
}
