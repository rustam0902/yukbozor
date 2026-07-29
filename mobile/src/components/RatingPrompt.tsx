import { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';

const STORAGE_KEY_LAUNCH_COUNT = 'app_launch_count_v2';
const STORAGE_KEY_RATING_STATE = 'rating_prompt_state'; // 'done' | 'later' | null
const LAUNCH_THRESHOLD = 5;
const LATER_DELAY_LAUNCHES = 3; // show again after 3 more launches if tapped "later"

const PLAY_STORE_URL = 'market://details?id=uz.yukbor.app';
const PLAY_STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=uz.yukbor.app';

export async function incrementLaunchCount(): Promise<void> {
  try {
    const state = await AsyncStorage.getItem(STORAGE_KEY_RATING_STATE);
    if (state === 'done') return;
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LAUNCH_COUNT);
    const count = parseInt(raw ?? '0', 10);
    await AsyncStorage.setItem(STORAGE_KEY_LAUNCH_COUNT, String(count + 1));
  } catch {}
}

async function shouldShowPrompt(): Promise<boolean> {
  try {
    const state = await AsyncStorage.getItem(STORAGE_KEY_RATING_STATE);
    if (state === 'done') return false;

    const raw = await AsyncStorage.getItem(STORAGE_KEY_LAUNCH_COUNT);
    const count = parseInt(raw ?? '0', 10);

    if (state === null) {
      // First time: show after LAUNCH_THRESHOLD launches
      return count >= LAUNCH_THRESHOLD;
    }

    if (state.startsWith('later:')) {
      // "Later" was tapped — show again after LATER_DELAY_LAUNCHES more
      const laterAt = parseInt(state.split(':')[1], 10);
      return count >= laterAt + LATER_DELAY_LAUNCHES;
    }

    return false;
  } catch {
    return false;
  }
}

async function markDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_RATING_STATE, 'done');
  } catch {}
}

async function markLater(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LAUNCH_COUNT);
    const count = parseInt(raw ?? '0', 10);
    await AsyncStorage.setItem(STORAGE_KEY_RATING_STATE, `later:${count}`);
  } catch {}
}

export function RatingPrompt() {
  const [visible, setVisible] = useState(false);
  const { language } = useLanguage();
  const ru = language === 'ru';
  const colors = Colors.light;

  useEffect(() => {
    // Wait a bit for the app to fully load before checking
    const timer = setTimeout(async () => {
      const show = await shouldShowPrompt();
      if (show) setVisible(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleRate = async () => {
    await markDone();
    setVisible(false);
    try {
      const canReview = await StoreReview.isAvailableAsync();
      if (canReview) {
        await StoreReview.requestReview();
      } else {
        const supported = await Linking.canOpenURL(PLAY_STORE_URL);
        await Linking.openURL(supported ? PLAY_STORE_URL : PLAY_STORE_WEB_URL);
      }
    } catch {}
  };

  const handleLater = async () => {
    await markLater();
    setVisible(false);
  };

  const handleDismiss = async () => {
    await markDone();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => (
              <Ionicons key={i} name="star" size={32} color="#FBBF24" />
            ))}
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {ru ? 'Нравится приложение?' : 'Ilova yoqdimi?'}
          </Text>

          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {ru
              ? 'Оставьте оценку — это помогает нам развиваться!'
              : '5 yulduz baho bering — bu bizga rivojlanishga yordam beradi!'}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleRate}
            testID="button-rating-rate"
          >
            <Text style={styles.primaryBtnText}>
              {ru ? 'Оценить сейчас' : 'Hozir baholash'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterBtn}
            onPress={handleLater}
            testID="button-rating-later"
          >
            <Text style={[styles.laterBtnText, { color: colors.mutedForeground }]}>
              {ru ? 'Напомнить позже' : 'Keyinroq eslatish'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDismiss}
            testID="button-rating-dismiss"
          >
            <Text style={[styles.dismissBtnText, { color: colors.mutedForeground }]}>
              {ru ? 'Не показывать снова' : 'Boshqa ko\'rsatma'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterBtn: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  laterBtnText: {
    fontSize: 14,
  },
  dismissBtn: {
    paddingVertical: 6,
    width: '100%',
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 12,
  },
});
