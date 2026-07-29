import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { openStore } from '../hooks/useForceUpdate';

/** Latest version available in the store. Update this with each Play Store release. */
const LATEST_STORE_VERSION = '1.0.7';

function parseVersion(v: string): number[] {
  return (v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
}

function isOlderThan(installed: string, target: string): boolean {
  const a = parseVersion(installed);
  const b = parseVersion(target);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai < bi) return true;
    if (ai > bi) return false;
  }
  return false;
}

const DISMISS_KEY = `@store_update_dismissed_${LATEST_STORE_VERSION}`;

interface Props {
  language: string;
}

export function StoreUpdateBanner({ language }: Props) {
  const [visible, setVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(-80))[0];

  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const needsUpdate = isOlderThan(currentVersion, LATEST_STORE_VERSION);

  useEffect(() => {
    if (!needsUpdate) return;
    AsyncStorage.getItem(DISMISS_KEY).then(val => {
      if (val !== 'true') {
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      }
    });
  }, [needsUpdate]);

  if (!visible) return null;

  const uz = language === 'uz';

  function dismiss() {
    Animated.timing(slideAnim, {
      toValue: -80,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
    AsyncStorage.setItem(DISMISS_KEY, 'true');
  }

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.content} onPress={openStore} activeOpacity={0.85}>
        <Ionicons
          name={Platform.OS === 'android' ? 'logo-google-playstore' : 'logo-apple'}
          size={18}
          color="#fff"
          style={{ marginRight: 8 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {uz
              ? `Yangi versiya ${LATEST_STORE_VERSION} mavjud`
              : `Доступна новая версия ${LATEST_STORE_VERSION}`}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {uz ? 'Yangilash uchun bosing' : 'Нажмите чтобы обновить'}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 8,
    zIndex: 9000,
    elevation: 20,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 8,
  },
});
