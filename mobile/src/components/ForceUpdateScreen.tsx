import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openStore, getCurrentVersion } from '../hooks/useForceUpdate';

interface Props {
  language: string;
}

export function ForceUpdateScreen({ language }: Props) {
  const uz = language === 'uz';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-up-circle" size={64} color="#2563eb" />
        </View>

        <Text style={styles.title}>
          {uz ? 'Yangi versiya mavjud' : 'Доступна новая версия'}
        </Text>

        <Text style={styles.body}>
          {uz
            ? "Ilovaning yangi versiyasi chiqdi. Davom etish uchun Google Play orqali yangilang."
            : 'Вышла новая версия приложения. Для продолжения работы обновите через Google Play.'}
        </Text>

        <Text style={styles.versionHint}>
          {uz
            ? `Joriy versiya: ${getCurrentVersion()}`
            : `Текущая версия: ${getCurrentVersion()}`}
        </Text>

        <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.85}>
          <Ionicons
            name={Platform.OS === 'android' ? 'logo-google-playstore' : 'logo-apple'}
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.buttonText}>
            {Platform.OS === 'android'
              ? uz ? 'Google Play orqali yangilash' : 'Обновить через Google Play'
              : uz ? 'App Store orqali yangilash' : 'Обновить через App Store'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  versionHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 28,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
