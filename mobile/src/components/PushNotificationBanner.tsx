import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';

const BANNER_SHOWN_KEY = 'push_onboarding_shown';
const PUSH_TOKEN_KEY = '@pushToken';

interface PushNotificationBannerProps {
  hasActiveFilters: boolean;
}

export function PushNotificationBanner({ hasActiveFilters }: PushNotificationBannerProps) {
  const [visible, setVisible] = useState(false);
  const { language } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [shown, token] = await Promise.all([
          AsyncStorage.getItem(BANNER_SHOWN_KEY),
          AsyncStorage.getItem(PUSH_TOKEN_KEY),
        ]);
        if (!shown && token && !cancelled) {
          setVisible(true);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(BANNER_SHOWN_KEY, '1').catch(() => {});
  };

  if (!visible) return null;

  const title = ru
    ? 'Уведомления о новых грузах включены'
    : 'Yangi yuklar haqida bildirishnomalar yoqildi';

  const body = hasActiveFilters
    ? (ru
      ? 'Вы будете получать уведомления только по выбранным фильтрам.'
      : "Siz faqat tanlangan filtrlarga mos yuklar haqida xabar olasiz.")
    : (ru
      ? 'Настройте фильтры в разделе «Профиль → Push-уведомления», чтобы получать только нужные грузы.'
      : "Faqat kerakli yuklar haqida xabar olish uchun «Profil → Push-bildirishnomalar» bo'limida filtrlang.");

  return (
    <View style={[styles.banner, { backgroundColor: colors.primary }]}>
      <Ionicons name="notifications" size={20} color="#fff" style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  icon: {
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    marginTop: 1,
  },
});
