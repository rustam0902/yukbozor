import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { Logo } from '../components/Logo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { TelegramAuthModal, type TelegramData } from '../components/TelegramAuthModal';

interface LoginScreenProps {
  navigation: any;
}

type LoginMode = 'password' | 'sms';

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { t, language, setLanguage } = useLanguage();
  const { login, sendLoginSms, loginWithSms } = useAuth();
  const colors = Colors.light;
  
  const [mode, setMode] = useState<LoginMode>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const normalizePhoneForSubmit = (value: string): string => {
    return '+998' + value.replace(/\D/g, '');
  };

  const handlePasswordLogin = async () => {
    if (!phone || !password) {
      setError(language === 'ru' ? 'Заполните все поля' : 'Barcha maydonlarni to\'ldiring');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await login(normalizePhoneForSubmit(phone), password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSms = async () => {
    if (!phone) {
      setError(language === 'ru' ? 'Введите номер телефона' : 'Telefon raqamini kiriting');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      await sendLoginSms(normalizePhoneForSubmit(phone));
      setSmsSent(true);
      setCountdown(60);
      setSuccessMessage(language === 'ru' ? 'Код отправлен на ваш номер' : 'Kod raqamingizga yuborildi');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSmsLogin = async () => {
    if (!phone || !smsCode) {
      setError(language === 'ru' ? 'Введите код из SMS' : 'SMSdan kodni kiriting');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await loginWithSms(normalizePhoneForSubmit(phone), smsCode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    await handleSendSms();
    setSuccessMessage(t.codeResent);
  };

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
    setSmsCode('');
    setSmsSent(false);
  };

  const handleTelegramNotRegistered = (telegramData: TelegramData) => {
    navigation.navigate('Register', { telegramData });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Logo size="lg" />
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              {t.tagline}
            </Text>
          </View>

          <View style={styles.languageToggle}>
            <TouchableOpacity
              style={[
                styles.langButton,
                language === 'ru' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setLanguage('ru')}
            >
              <Text style={[
                styles.langText,
                { color: language === 'ru' ? colors.primaryForeground : colors.foreground }
              ]}>
                RU
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langButton,
                language === 'uz' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setLanguage('uz')}
            >
              <Text style={[
                styles.langText,
                { color: language === 'uz' ? colors.primaryForeground : colors.foreground }
              ]}>
                UZ
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t.login}
            </Text>

            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'password' && { backgroundColor: colors.primary }
                ]}
                onPress={() => switchMode('password')}
              >
                <Text style={[
                  styles.modeText,
                  { color: mode === 'password' ? colors.primaryForeground : colors.foreground }
                ]}>
                  {t.loginWithPassword}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'sms' && { backgroundColor: colors.primary }
                ]}
                onPress={() => switchMode('sms')}
              >
                <Text style={[
                  styles.modeText,
                  { color: mode === 'sms' ? colors.primaryForeground : colors.foreground }
                ]}>
                  {t.loginWithSms}
                </Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + '20' }]}>
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={[styles.successBox, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.successText, { color: colors.success }]}>
                  {successMessage}
                </Text>
              </View>
            ) : null}

            <View style={styles.phoneContainer}>
              <Text style={[styles.phoneLabel, { color: colors.foreground }]}>{t.phone}</Text>
              <View style={[styles.phoneInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.phonePrefix, { color: colors.foreground }]}>+998</Text>
                <View style={[styles.phoneDivider, { backgroundColor: colors.border }]} />
                <TextInput
                  style={[styles.phoneTextInput, { color: colors.foreground }]}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
                  placeholder="XX XXX XX XX"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={9}
                />
              </View>
            </View>

            {mode === 'password' ? (
              <>
                <Input
                  label={t.password}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="********"
                  secureTextEntry
                />

                <Button
                  title={t.loginButton}
                  onPress={handlePasswordLogin}
                  loading={loading}
                  style={styles.button}
                />
              </>
            ) : (
              <>
                {!smsSent ? (
                  <Button
                    title={t.sendSmsCode}
                    onPress={handleSendSms}
                    loading={loading}
                    style={styles.button}
                  />
                ) : (
                  <>
                    <Input
                      label={t.smsCode}
                      value={smsCode}
                      onChangeText={setSmsCode}
                      placeholder="XXXXXX"
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                    />

                    <Button
                      title={t.loginButton}
                      onPress={handleSmsLogin}
                      loading={loading}
                      style={styles.button}
                    />

                    <TouchableOpacity
                      style={styles.resendContainer}
                      onPress={handleResendCode}
                      disabled={countdown > 0}
                    >
                      <Text style={[
                        styles.resendText,
                        { color: countdown > 0 ? colors.mutedForeground : colors.primary }
                      ]}>
                        {t.resendCode}
                        {countdown > 0 ? ` (${countdown}s)` : ''}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'или' : 'yoki'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Telegram auth button */}
            <TouchableOpacity
              style={[styles.telegramAuthButton, { backgroundColor: '#2CA5E0' }]}
              onPress={() => setShowTelegramModal(true)}
              testID="button-login-telegram"
            >
              <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.telegramAuthButtonText}>
                {language === 'ru' ? 'Войти через Telegram' : 'Telegram orqali kirish'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkContainer}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                {t.noAccount}{' '}
                <Text style={{ color: colors.primary }}>{t.registerButton}</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkContainer, { marginTop: 8 }]}
              onPress={() => navigation.navigate('GuestTabs')}
              testID="button-continue-guest"
            >
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Продолжить без входа' : 'Kirmasdan davom etish'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <TelegramAuthModal
        visible={showTelegramModal}
        language={language as 'ru' | 'uz'}
        onClose={() => setShowTelegramModal(false)}
        onNotRegistered={handleTelegramNotRegistered}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  tagline: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  languageToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  langButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  langText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  successBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
  },
  button: {
    marginTop: 8,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
  },
  telegramAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 12,
  },
  telegramAuthButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  phoneContainer: {
    marginBottom: 16,
  },
  phoneLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  phonePrefix: {
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  phoneDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 4,
  },
  phoneTextInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 6,
    paddingRight: 12,
    fontSize: 16,
  },
});
