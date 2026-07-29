import {
  View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export interface TelegramData {
  telegramId: string | null;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
}

interface TelegramAuthModalProps {
  visible: boolean;
  language: 'ru' | 'uz';
  onClose: () => void;
  onNotRegistered: (telegramData: TelegramData) => void;
}

type PollStatus = 'init' | 'waiting' | 'polling' | 'expired' | 'error';

export function TelegramAuthModal({
  visible,
  language,
  onClose,
  onNotRegistered,
}: TelegramAuthModalProps) {
  const { loginWithTelegramToken } = useAuth();
  const colors = Colors.light;
  const ru = language === 'ru';

  const [status, setStatus] = useState<PollStatus>('init');
  const [token, setToken] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [telegramOpened, setTelegramOpened] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = {
    title: ru ? 'Вход через Telegram' : 'Telegram orqali kirish',
    subtitle: ru
      ? 'Нажмите кнопку ниже, чтобы открыть Telegram.\nПосле подтверждения вы будете авторизованы автоматически.'
      : 'Telegram\'ni ochish uchun quyidagi tugmani bosing.\nTasdiqlangandan so\'ng avtomatik kiriladi.',
    openTelegram: ru ? 'Открыть Telegram' : 'Telegram\'ni ochish',
    waitingTitle: ru ? 'Ожидаем подтверждения...' : 'Tasdiq kutilmoqda...',
    waitingSubtitle: ru
      ? 'Подтвердите вход в Telegram-боте, затем вернитесь в приложение.'
      : 'Telegram botida tasdiqlang va ilovaga qayting.',
    expiredTitle: ru ? 'Ссылка устарела' : 'Havola muddati tugadi',
    expiredSubtitle: ru ? 'Попробуйте снова.' : 'Qaytadan urinib ko\'ring.',
    errorTitle: ru ? 'Ошибка соединения' : 'Ulanish xatosi',
    errorSubtitle: ru ? 'Проверьте интернет и попробуйте снова.' : 'Internetni tekshiring va qaytadan urinib ko\'ring.',
    tryAgain: ru ? 'Попробовать снова' : 'Qaytadan urinish',
    cancel: ru ? 'Отмена' : 'Bekor qilish',
    loading: ru ? 'Загрузка...' : 'Yuklanmoqda...',
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const reset = () => {
    stopPolling();
    setStatus('init');
    setToken(null);
    setBotUsername(null);
    setTelegramOpened(false);
  };

  useEffect(() => {
    if (visible) {
      initAuth();
    } else {
      reset();
    }
    return () => stopPolling();
  }, [visible]);

  const initAuth = async () => {
    setStatus('init');
    try {
      const response = await api.post('/api/auth/telegram/init');
      const { token: authToken, botUsername: botName } = response.data;
      setToken(authToken);
      setBotUsername(botName);
      setStatus('waiting');
      startPolling(authToken);
    } catch (err) {
      console.error('[TelegramAuth] Init error:', err);
      setStatus('error');
    }
  };

  const startPolling = (authToken: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/api/auth/telegram/poll/${authToken}`);
        const { status: pollStatus, token: jwt, user, telegramData } = response.data;

        if (pollStatus === 'completed' && jwt && user) {
          stopPolling();
          await loginWithTelegramToken(jwt, user);
          onClose();
        } else if (pollStatus === 'not_registered' && telegramData) {
          stopPolling();
          onClose();
          onNotRegistered(telegramData);
        } else if (pollStatus === 'expired') {
          stopPolling();
          setStatus('expired');
        }
      } catch (err) {
        console.error('[TelegramAuth] Poll error:', err);
      }
    }, 2000);
  };

  const handleOpenTelegram = async () => {
    if (!botUsername || !token) return;
    const deepLink = `tg://resolve?domain=${botUsername}&start=${token}`;
    const webLink = `https://t.me/${botUsername}?start=${token}`;

    try {
      const canOpen = await Linking.canOpenURL(deepLink);
      await Linking.openURL(canOpen ? deepLink : webLink);
      setTelegramOpened(true);
      setStatus('polling');
    } catch (err) {
      await Linking.openURL(webLink);
      setTelegramOpened(true);
      setStatus('polling');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTryAgain = () => {
    reset();
    initAuth();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.telegramIcon, { backgroundColor: '#2CA5E0' }]}>
              <Ionicons name="paper-plane" size={28} color="#fff" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{t.title}</Text>
          </View>

          {/* Content based on status */}
          {status === 'init' && (
            <View style={styles.body}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t.loading}</Text>
            </View>
          )}

          {status === 'waiting' && (
            <View style={styles.body}>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
                {t.subtitle}
              </Text>
              <TouchableOpacity
                style={[styles.telegramButton, { backgroundColor: '#2CA5E0' }]}
                onPress={handleOpenTelegram}
                testID="button-open-telegram"
              >
                <Ionicons name="paper-plane-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.telegramButtonText}>{t.openTelegram}</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'polling' && (
            <View style={styles.body}>
              <ActivityIndicator size="large" color="#2CA5E0" style={{ marginBottom: 16 }} />
              <Text style={[styles.boldText, { color: colors.foreground }]}>{t.waitingTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
                {t.waitingSubtitle}
              </Text>
              <TouchableOpacity
                style={[styles.telegramButton, { backgroundColor: '#2CA5E0', marginTop: 16 }]}
                onPress={handleOpenTelegram}
                testID="button-reopen-telegram"
              >
                <Ionicons name="paper-plane-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.telegramButtonText}>{t.openTelegram}</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'expired' && (
            <View style={styles.body}>
              <Ionicons name="time-outline" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.boldText, { color: colors.foreground }]}>{t.expiredTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
                {t.expiredSubtitle}
              </Text>
              <TouchableOpacity
                style={[styles.telegramButton, { backgroundColor: colors.primary }]}
                onPress={handleTryAgain}
                testID="button-telegram-retry"
              >
                <Text style={styles.telegramButtonText}>{t.tryAgain}</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.body}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} style={{ marginBottom: 12 }} />
              <Text style={[styles.boldText, { color: colors.foreground }]}>{t.errorTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>
                {t.errorSubtitle}
              </Text>
              <TouchableOpacity
                style={[styles.telegramButton, { backgroundColor: colors.primary }]}
                onPress={handleTryAgain}
                testID="button-telegram-retry-error"
              >
                <Text style={styles.telegramButtonText}>{t.tryAgain}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel button */}
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose} testID="button-telegram-cancel">
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  telegramIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  boldText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  telegramButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
  },
  telegramButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 14,
  },
});
