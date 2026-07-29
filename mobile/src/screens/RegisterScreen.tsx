import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, TextInput,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { Logo } from '../components/Logo';
import { TelegramAuthModal, type TelegramData } from '../components/TelegramAuthModal';

interface RegisterScreenProps {
  navigation: any;
  route?: { params?: { telegramData?: TelegramData } };
}

type UserType = 'individual' | 'legal';

const TOTAL_STEPS = 3;

export function RegisterScreen({ navigation, route }: RegisterScreenProps) {
  const { language, setLanguage } = useLanguage();
  const { register, loginWithTelegramToken } = useAuth();
  const colors = Colors.light;
  const ru = language === 'ru';

  const telegramDataFromParams = route?.params?.telegramData;

  const [step, setStep] = useState(1);

  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [userType, setUserType] = useState<UserType | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);

  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill from Telegram data if navigated from LoginScreen with Telegram auth
  useEffect(() => {
    if (telegramDataFromParams) {
      if (telegramDataFromParams.telegramId) setTelegramId(telegramDataFromParams.telegramId);
      if (telegramDataFromParams.telegramFirstName) setFirstName(telegramDataFromParams.telegramFirstName);
      if (telegramDataFromParams.telegramLastName) setLastName(telegramDataFromParams.telegramLastName);
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const totalSteps = TOTAL_STEPS;

  const getStepNumber = () => step;

  const goBack = () => {
    setError('');
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(s => s - 1);
    }
  };

  const handleSendSms = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setError(ru ? 'Введите корректный номер' : 'To\'g\'ri raqam kiriting');
      return;
    }
    const normalizedPhone = '+998' + digits;
    setSmsLoading(true);
    setError('');
    try {
      await api.post('/api/sms/send-otp', { phone: normalizedPhone, purpose: 'registration' });
      setSmsSent(true);
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || (ru ? 'Ошибка отправки SMS' : 'SMS yuborishda xato'));
    } finally {
      setSmsLoading(false);
    }
  };

  const handleStep1Next = () => {
    setError('');
    // Telegram registration — skip SMS verification entirely
    if (telegramId) {
      setStep(2);
      return;
    }
    if (!smsSent) {
      setError(ru ? 'Получите SMS-код' : 'SMS-kodni oling');
      return;
    }
    if (smsCode.length < 6) {
      setError(ru ? 'Введите 6-значный код из SMS' : 'SMSdan 6 xonali kodni kiriting');
      return;
    }
    setStep(2);
  };

  const handleUserTypeSelect = (type: UserType) => {
    setUserType(type);
    setError('');
    setStep(3);
  };

  const handleRegister = async () => {
    setError('');
    // For Telegram registrations, phone is optional — use a placeholder if not provided
    const digits = phone.replace(/\D/g, '');
    const normalizedPhone = digits.length >= 9
      ? '+998' + digits
      : telegramId ? `tg_${telegramId}` : '+998' + digits;

    const isCompany = userType === 'legal';
    if (isCompany) {
      if (!companyName.trim()) {
        setError(ru ? 'Введите название' : 'Nomni kiriting');
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError(ru ? 'Введите имя и фамилию' : 'Ism va familiyani kiriting');
        return;
      }
    }

    setLoading(true);
    try {
      const displayName = isCompany
        ? companyName.trim()
        : `${firstName.trim()} ${lastName.trim()}`;

      await register({
        phone: normalizedPhone,
        password: '',
        userType: isCompany ? 'legal' : 'individual',
        defaultRole: 'customer',
        displayName,
        firstName: !isCompany ? firstName.trim() : undefined,
        lastName: !isCompany ? lastName.trim() : undefined,
        companyName: isCompany ? companyName.trim() : undefined,
        referralCode: referralCode.trim() || undefined,
        language,
        telegramId: telegramId || undefined,
      } as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: i < getStepNumber() ? colors.primary : colors.border }
          ]}
        />
      ))}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="button-back">
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        {renderProgressBar()}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity
          onPress={() => setLanguage('ru')}
          style={[styles.langBtn, language === 'ru' && { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: language === 'ru' ? '#fff' : colors.foreground, fontSize: 12, fontWeight: '600' }}>RU</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLanguage('uz')}
          style={[styles.langBtn, { marginLeft: 4 }, language === 'uz' && { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: language === 'uz' ? '#fff' : colors.foreground, fontSize: 12, fontWeight: '600' }}>UZ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderError = () =>
    error ? (
      <View style={[styles.errorBox, { backgroundColor: colors.destructive + '20' }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
      </View>
    ) : null;

  const renderStep1 = () => {
    // Telegram registration: show confirmation UI, no phone required
    if (telegramId) {
      return (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            {ru ? 'Личность подтверждена' : 'Shaxs tasdiqlandi'}
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            {ru
              ? 'Вы успешно подтвердили личность через Telegram. Телефон можно добавить позже в профиле.'
              : 'Siz Telegram orqali shaxsni muvaffaqiyatli tasdiqladingiz. Telefon raqamini keyinchalik profilga qo\'shish mumkin.'}
          </Text>

          {renderError()}

          {/* Telegram verified banner */}
          <View style={[styles.telegramVerifiedCard, { backgroundColor: '#2CA5E015', borderColor: '#2CA5E050' }]}>
            <View style={styles.telegramVerifiedRow}>
              <Ionicons name="logo-telegram" size={28} color="#2CA5E0" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#2CA5E0', fontWeight: '700', fontSize: 15 }}>Telegram</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                  {ru ? 'Аккаунт подтверждён' : 'Akkaunt tasdiqlandi'}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#2CA5E0" />
            </View>
          </View>

          <Button
            title={ru ? 'Продолжить' : 'Davom etish'}
            onPress={handleStep1Next}
            style={[styles.btn, { marginTop: 24 }]}
            testID="button-next-step1"
          />

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              {ru ? 'Уже есть аккаунт? ' : 'Akkauntingiz bormi? '}
              <Text style={{ color: colors.primary }}>{ru ? 'Войти' : 'Kirish'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        {ru ? 'Ваш номер телефона' : 'Telefon raqamingiz'}
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
        {ru ? 'Введите номер и получите SMS-код для подтверждения' : 'Raqamni kiriting va tasdiqlash uchun SMS oling'}
      </Text>

      {renderError()}

      <View style={styles.phoneContainer}>
        <Text style={[styles.phoneLabel, { color: colors.foreground }]}>
          {ru ? 'Номер телефона' : 'Telefon raqami'}
        </Text>
        <View style={[styles.phoneInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.phonePrefix, { color: colors.foreground }]}>+998</Text>
          <View style={[styles.phoneDivider, { backgroundColor: colors.border }]} />
          <TextInput
            style={[styles.phoneTextInput, { color: colors.foreground }]}
            value={phone}
            onChangeText={(v) => { setPhone(v.replace(/\D/g, '').slice(0, 9)); setError(''); }}
            placeholder="XX XXX XX XX"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={9}
            testID="input-phone"
          />
        </View>
      </View>

      {!smsSent ? (
        <Button
          title={smsLoading ? (ru ? 'Отправка...' : 'Yuborilmoqda...') : (ru ? 'Получить SMS-код' : 'SMS-kod olish')}
          onPress={handleSendSms}
          loading={smsLoading}
          style={styles.btn}
          testID="button-send-sms"
        />
      ) : (
        <>
          <Input
            label={ru ? 'Код из SMS' : 'SMS kodi'}
            value={smsCode}
            onChangeText={(v) => { setSmsCode(v); setError(''); }}
            placeholder="XXXXXX"
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            testID="input-sms-code"
          />
          <View style={styles.resendRow}>
            <TouchableOpacity onPress={handleSendSms} disabled={countdown > 0 || smsLoading}>
              <Text style={{ color: countdown > 0 ? colors.mutedForeground : colors.primary, fontSize: 14 }}>
                {ru ? 'Отправить повторно' : 'Qayta yuborish'}
                {countdown > 0 ? ` (${countdown}s)` : ''}
              </Text>
            </TouchableOpacity>
          </View>
          <Button
            title={ru ? 'Далее' : 'Keyingi'}
            onPress={handleStep1Next}
            style={styles.btn}
            testID="button-next-step1"
          />
        </>
      )}

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
          {ru ? 'или' : 'yoki'}
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Telegram registration button */}
      {telegramId ? (
        <View style={[styles.telegramLinkedBanner, { backgroundColor: '#2CA5E020', borderColor: '#2CA5E0' }]}>
          <Ionicons name="checkmark-circle" size={16} color="#2CA5E0" style={{ marginRight: 6 }} />
          <Text style={{ color: '#2CA5E0', fontSize: 13, flex: 1 }}>
            {ru ? 'Данные получены из Telegram' : 'Ma\'lumotlar Telegram\'dan olindi'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.telegramAuthButton, { backgroundColor: '#2CA5E0' }]}
          onPress={() => setShowTelegramModal(true)}
          testID="button-register-telegram"
        >
          <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.telegramAuthButtonText}>
            {ru ? 'Зарегистрироваться через Telegram' : 'Telegram orqali ro\'yxatdan o\'tish'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
          {ru ? 'Уже есть аккаунт? ' : 'Akkauntingiz bormi? '}
          <Text style={{ color: colors.primary }}>{ru ? 'Войти' : 'Kirish'}</Text>
        </Text>
      </TouchableOpacity>
    </View>
    );
  };

  const renderStep2UserType = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        {ru ? 'Кто вы?' : 'Siz kimsiz?'}
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
        {ru ? 'Это влияет на доступные функции' : 'Bu mavjud imkoniyatlarga ta\'sir qiladi'}
      </Text>

      <TouchableOpacity
        style={[styles.typeCard, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => handleUserTypeSelect('individual')}
        testID="button-type-individual"
      >
        <Ionicons name="person-outline" size={28} color={colors.primary} style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.typeTitle, { color: colors.foreground }]}>
            {ru ? 'Физическое лицо' : 'Jismoniy shaxs'}
          </Text>
          <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
            {ru ? 'Частное лицо без регистрации' : 'Ro\'yxatdan o\'tmagan shaxs'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.typeCard, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 12 }]}
        onPress={() => handleUserTypeSelect('legal')}
        testID="button-type-legal"
      >
        <Ionicons name="business-outline" size={28} color={colors.primary} style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.typeTitle, { color: colors.foreground }]}>
            {ru ? 'ИП или компания' : 'YT yoki kompaniya'}
          </Text>
          <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
            {ru ? 'ИП, ООО, АО и другие' : 'YT, MChJ, AJ va boshqalar'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );

  const renderStepName = () => {
    const isCompany = userType === 'legal';
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>
          {isCompany ? (ru ? 'Название организации' : 'Tashkilot nomi') : (ru ? 'Ваше имя' : 'Ismingiz')}
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
          {ru ? 'Остальные данные можно добавить позже в Профиле' : 'Qolgan ma\'lumotlarni Profilda keyinroq qo\'shishingiz mumkin'}
        </Text>

        {renderError()}

        {isCompany ? (
          <Input
            label={ru ? 'Название компании / ИП' : 'Kompaniya / YT nomi'}
            value={companyName}
            onChangeText={(v) => { setCompanyName(v); setError(''); }}
            placeholder={ru ? 'ООО "Название"' : 'MChJ "Nomi"'}
            testID="input-company-name"
          />
        ) : (
          <>
            <Input
              label={ru ? 'Имя' : 'Ism'}
              value={firstName}
              onChangeText={(v) => { setFirstName(v); setError(''); }}
              placeholder={ru ? 'Иван' : 'Ivan'}
              testID="input-first-name"
            />
            <Input
              label={ru ? 'Фамилия' : 'Familiya'}
              value={lastName}
              onChangeText={(v) => { setLastName(v); setError(''); }}
              placeholder={ru ? 'Иванов' : 'Ivanov'}
              testID="input-last-name"
            />
          </>
        )}

        <TouchableOpacity
          onPress={() => setShowReferral(v => !v)}
          style={styles.referralToggle}
        >
          <Ionicons
            name={showReferral ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.referralToggleText, { color: colors.primary }]}>
            {ru ? 'Есть реферальный код?' : 'Referal kod bormi?'}
          </Text>
        </TouchableOpacity>

        {showReferral && (
          <Input
            label={ru ? 'Реферальный код' : 'Referal kodi'}
            value={referralCode}
            onChangeText={setReferralCode}
            placeholder={ru ? 'Введите код' : 'Kodni kiriting'}
            autoCapitalize="characters"
            testID="input-referral-code"
          />
        )}

        <Button
          title={ru ? 'Зарегистрироваться' : 'Ro\'yxatdan o\'tish'}
          onPress={handleRegister}
          loading={loading}
          style={styles.btn}
          testID="button-register"
        />
      </View>
    );
  };

  const renderCurrentStep = () => {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2UserType();
    if (step === 3) return renderStepName();
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}
          <View style={styles.logoRow}>
            <Logo size="md" />
          </View>
          {renderCurrentStep()}
        </ScrollView>
      </KeyboardAvoidingView>
      <TelegramAuthModal
        visible={showTelegramModal}
        language={language as 'ru' | 'uz'}
        onClose={() => setShowTelegramModal(false)}
        onNotRegistered={(telegramData) => {
          setShowTelegramModal(false);
          if (telegramData.telegramId) setTelegramId(telegramData.telegramId);
          if (telegramData.telegramFirstName) setFirstName(telegramData.telegramFirstName);
          if (telegramData.telegramLastName) setLastName(telegramData.telegramLastName);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  langBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 14,
  },
  btn: {
    marginTop: 12,
  },
  resendRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
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
    fontSize: 14,
    fontWeight: '600',
  },
  telegramLinkedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  telegramVerifiedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  telegramVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleTextBlock: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleDesc: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  typeDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  referralToggleText: {
    fontSize: 14,
  },
});
