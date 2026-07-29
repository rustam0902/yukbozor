import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

export function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();
  const ru = language === 'ru';

  const isIndividual = user?.userType === 'individual';
  const isLegalOrIP = user?.userType === 'legal' || user?.userType === 'ip';

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    companyName: '',
    inn: '',
    pinfl: '',
    passportSeries: '',
    passportNumber: '',
    bankName: '',
    bankAccount: '',
    bankCode: '',
    ndsPayer: false,
    registrationCodeNds: '',
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwPhone, setPwPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const t = {
    title: ru ? 'Редактировать профиль' : 'Profilni tahrirlash',
    save: ru ? 'Сохранить' : 'Saqlash',
    saving: ru ? 'Сохранение...' : 'Saqlanmoqda...',
    success: ru ? 'Профиль обновлён' : 'Profil yangilandi',
    error: ru ? 'Ошибка при сохранении' : 'Saqlashda xatolik',
    phone: ru ? 'Телефон' : 'Telefon',
    sectionBasic: ru ? 'Основная информация' : 'Asosiy ma\'lumot',
    sectionPersonal: ru ? 'Личные данные' : 'Shaxsiy ma\'lumotlar',
    sectionCompany: ru ? 'Данные организации' : 'Tashkilot ma\'lumotlari',
    displayName: ru ? 'Отображаемое имя' : 'Ko\'rinadigan ism',
    email: ru ? 'Email' : 'Email',
    firstName: ru ? 'Имя' : 'Ism',
    lastName: ru ? 'Фамилия' : 'Familiya',
    middleName: ru ? 'Отчество' : 'Otasining ismi',
    passportSeries: ru ? 'Серия паспорта' : 'Pasport seriyasi',
    passportNumber: ru ? 'Номер паспорта' : 'Pasport raqami',
    pinfl: ru ? 'ПИНФЛ' : 'PINFL',
    companyName: ru ? 'Название организации' : 'Tashkilot nomi',
    inn: ru ? 'ИНН' : 'INN',
    ndsPayer: ru ? 'Плательщик НДС' : 'NDS to\'lovchisi',
    registrationCodeNds: ru ? 'Рег. код плательщика НДС' : 'NDS to\'lovchisi kodi',
    sectionBank: ru ? 'Банковские реквизиты' : 'Bank rekvizitlari',
    bankName: ru ? 'Название банка' : 'Bank nomi',
    bankAccount: ru ? 'Расчётный счёт' : 'Hisob raqami',
    bankCode: ru ? 'МФО / Код банка' : 'MFO / Bank kodi',
    password: ru ? 'Пароль' : 'Parol',
    changePassword: ru ? 'Установить / Изменить пароль' : 'Parol o\'rnatish / o\'zgartirish',
    pwModalTitle: ru ? 'Смена пароля' : 'Parolni o\'zgartirish',
    sendCode: ru ? 'Получить SMS-код' : 'SMS-kod olish',
    resendCode: ru ? 'Отправить повторно' : 'Qayta yuborish',
    smsCodeLabel: ru ? 'Код из SMS' : 'SMS kodi',
    newPasswordLabel: ru ? 'Новый пароль' : 'Yangi parol',
    confirmPasswordLabel: ru ? 'Подтвердите пароль' : 'Parolni tasdiqlang',
    setPassword: ru ? 'Установить пароль' : 'Parolni saqlash',
    cancel: ru ? 'Отмена' : 'Bekor qilish',
    pwSuccess: ru ? 'Пароль успешно установлен' : 'Parol muvaffaqiyatli o\'rnatildi',
    pwMismatch: ru ? 'Пароли не совпадают' : 'Parollar mos kelmadi',
    pwTooShort: ru ? 'Пароль минимум 8 символов' : 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak',
    smsCodeHint: ru ? 'Отправим SMS на номер вашего аккаунта' : 'Akkountingiz raqamiga SMS yuboramiz',
  };

  useEffect(() => {
    setFormData({
      displayName: user?.displayName || '',
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      middleName: user?.middleName || '',
      companyName: user?.profile?.companyName || '',
      inn: user?.profile?.inn || '',
      pinfl: user?.profile?.pinfl || '',
      passportSeries: user?.profile?.passportSeries || '',
      passportNumber: user?.profile?.passportNumber || '',
      bankName: user?.profile?.bankName || '',
      bankAccount: user?.profile?.bankAccount || '',
      bankCode: user?.profile?.bankCode || '',
      ndsPayer: user?.profile?.ndsPayer || false,
      registrationCodeNds: user?.profile?.registrationCodeNds || '',
    });
    if (user?.phone) setPwPhone(user.phone);
  }, [user]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: Record<string, string | boolean> = {};
      if (formData.displayName) payload.displayName = formData.displayName;
      if (formData.email) payload.email = formData.email;
      if (isIndividual) {
        if (formData.firstName) payload.firstName = formData.firstName;
        if (formData.lastName) payload.lastName = formData.lastName;
        if (formData.middleName) payload.middleName = formData.middleName;
        if (formData.passportSeries) payload.passportSeries = formData.passportSeries;
        if (formData.passportNumber) payload.passportNumber = formData.passportNumber;
      }
      if (isLegalOrIP) {
        if (formData.companyName) payload.companyName = formData.companyName;
        if (formData.inn) payload.inn = formData.inn;
        payload.ndsPayer = formData.ndsPayer;
        if (formData.ndsPayer && formData.registrationCodeNds) payload.registrationCodeNds = formData.registrationCodeNds;
      }
      if (formData.bankName) payload.bankName = formData.bankName;
      if (formData.bankAccount) payload.bankAccount = formData.bankAccount;
      if (formData.bankCode) payload.bankCode = formData.bankCode;
      await api.patch('/api/profile/update', payload);
      await refreshUser();
      Alert.alert('', t.success);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('', t.error);
    } finally {
      setSaving(false);
    }
  };

  const openPasswordModal = () => {
    setSmsSent(false);
    setSmsCode('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handleSendSms = async () => {
    setSmsLoading(true);
    setPasswordError('');
    try {
      const phone = user?.phone || pwPhone;
      await api.post('/api/sms/send-otp', { phone, purpose: 'change_password' });
      setSmsSent(true);
      setCountdown(60);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || (ru ? 'Ошибка отправки SMS' : 'SMS yuborishda xato'));
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSetPassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) { setPasswordError(t.pwTooShort); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t.pwMismatch); return; }
    if (!smsCode || smsCode.length < 6) {
      setPasswordError(ru ? 'Введите код из SMS' : 'SMS kodini kiriting');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.post('/api/profile/change-password-sms', {
        phone: user?.phone || pwPhone,
        smsCode,
        newPassword,
      });
      setShowPasswordModal(false);
      Alert.alert('', t.pwSuccess);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || (ru ? 'Ошибка' : 'Xatolik'));
    } finally {
      setPasswordLoading(false);
    }
  };

  type StringKeys = { [K in keyof typeof formData]: (typeof formData)[K] extends string ? K : never }[keyof typeof formData];
  const field = (label: string, key: StringKeys, opts?: { keyboardType?: any; maxLength?: number; placeholder?: string }) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={formData[key] as string}
        onChangeText={(text) => setFormData(prev => ({ ...prev, [key]: text }))}
        placeholder={opts?.placeholder || label}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={opts?.keyboardType}
        maxLength={opts?.maxLength}
        testID={`input-${key}`}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="button-back">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{t.phone}</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{user?.phone || '-'}</Text>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t.sectionBasic}</Text>

        {field(t.displayName, 'displayName')}
        {field(t.email, 'email', { keyboardType: 'email-address' })}

        {isIndividual && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t.sectionPersonal}</Text>
            {field(t.lastName, 'lastName')}
            {field(t.firstName, 'firstName')}
            {field(t.middleName, 'middleName')}
            {field(t.pinfl, 'pinfl', { keyboardType: 'number-pad', maxLength: 14 })}
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={[styles.label, { color: colors.foreground }]}>{t.passportSeries}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  value={formData.passportSeries}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, passportSeries: text.toUpperCase() }))}
                  placeholder="AA"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={2}
                  autoCapitalize="characters"
                  testID="input-passportSeries"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfInput]}>
                <Text style={[styles.label, { color: colors.foreground }]}>{t.passportNumber}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  value={formData.passportNumber}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, passportNumber: text }))}
                  placeholder="1234567"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={7}
                  keyboardType="number-pad"
                  testID="input-passportNumber"
                />
              </View>
            </View>
          </>
        )}

        {isLegalOrIP && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t.sectionCompany}</Text>
            {field(t.companyName, 'companyName')}
            {field(t.inn, 'inn', { keyboardType: 'number-pad', maxLength: 12 })}
            <View style={[styles.switchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.ndsPayer}</Text>
              <Switch
                value={formData.ndsPayer}
                onValueChange={(val) => setFormData(prev => ({ ...prev, ndsPayer: val }))}
                trackColor={{ false: colors.border, true: colors.primary }}
                testID="switch-ndsPayer"
              />
            </View>
            {formData.ndsPayer && field(t.registrationCodeNds, 'registrationCodeNds', { keyboardType: 'number-pad', maxLength: 12 })}
          </>
        )}

        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{t.sectionBank}</Text>
        {field(t.bankName, 'bankName')}
        {field(t.bankAccount, 'bankAccount', { keyboardType: 'number-pad' })}
        {field(t.bankCode, 'bankCode', { keyboardType: 'number-pad', maxLength: 5 })}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          testID="button-save"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveButtonText}>{t.save}</Text>
          )}
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={[styles.passwordSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.passwordSectionHeader}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.foreground} />
            <Text style={[styles.passwordSectionTitle, { color: colors.foreground }]}>{t.password}</Text>
          </View>
          <TouchableOpacity
            style={[styles.changePasswordBtn, { borderColor: colors.primary }]}
            onPress={openPasswordModal}
            testID="button-change-password"
          >
            <Text style={[styles.changePasswordBtnText, { color: colors.primary }]}>{t.changePassword}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal visible={showPasswordModal} animationType="slide" transparent onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.pwModalTitle}</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.smsHint, { color: colors.mutedForeground }]}>{t.smsCodeHint}</Text>

              {passwordError ? (
                <View style={[styles.errorBox, { backgroundColor: colors.destructive + '20' }]}>
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{passwordError}</Text>
                </View>
              ) : null}

              {!smsSent ? (
                <TouchableOpacity
                  style={[styles.sendSmsBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSendSms}
                  disabled={smsLoading}
                  testID="button-send-sms-password"
                >
                  {smsLoading ? <ActivityIndicator color="white" /> : <Text style={styles.sendSmsBtnText}>{t.sendCode}</Text>}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t.smsCodeLabel}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                      value={smsCode}
                      onChangeText={(v) => { setSmsCode(v); setPasswordError(''); }}
                      placeholder="XXXXXX"
                      keyboardType="number-pad"
                      maxLength={6}
                      testID="input-sms-code-password"
                    />
                    <TouchableOpacity
                      onPress={handleSendSms}
                      disabled={countdown > 0 || smsLoading}
                      style={{ alignSelf: 'flex-end', marginTop: 4 }}
                    >
                      <Text style={{ color: countdown > 0 ? colors.mutedForeground : colors.primary, fontSize: 13 }}>
                        {t.resendCode}{countdown > 0 ? ` (${countdown}s)` : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t.newPasswordLabel}</Text>
                    <View style={[styles.passwordInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.passwordTextInput, { color: colors.foreground }]}
                        value={newPassword}
                        onChangeText={(v) => { setNewPassword(v); setPasswordError(''); }}
                        placeholder="••••••••"
                        placeholderTextColor={colors.mutedForeground}
                        secureTextEntry={!showNewPw}
                        testID="input-new-password"
                      />
                      <TouchableOpacity onPress={() => setShowNewPw(v => !v)} style={{ padding: 8 }}>
                        <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t.confirmPasswordLabel}</Text>
                    <View style={[styles.passwordInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.passwordTextInput, { color: colors.foreground }]}
                        value={confirmPassword}
                        onChangeText={(v) => { setConfirmPassword(v); setPasswordError(''); }}
                        placeholder="••••••••"
                        placeholderTextColor={colors.mutedForeground}
                        secureTextEntry={!showConfirmPw}
                        testID="input-confirm-password"
                      />
                      <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} style={{ padding: 8 }}>
                        <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.setPasswordBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSetPassword}
                    disabled={passwordLoading}
                    testID="button-set-password"
                  >
                    {passwordLoading ? <ActivityIndicator color="white" /> : <Text style={styles.setPasswordBtnText}>{t.setPassword}</Text>}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPasswordModal(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>{t.cancel}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  infoCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  infoLabel: { fontSize: 12, marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '500' },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
  },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  switchLabel: { fontSize: 16 },
  saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  divider: { height: 1, marginVertical: 20 },
  passwordSection: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 8 },
  passwordSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  passwordSectionTitle: { fontSize: 16, fontWeight: '600' },
  changePasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  changePasswordBtnText: { fontSize: 14, fontWeight: '500' },
  bottomSpacer: { height: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  smsHint: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  errorBox: { padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { fontSize: 14 },
  sendSmsBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  sendSmsBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  passwordInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingLeft: 16 },
  passwordTextInput: { flex: 1, paddingVertical: 14, fontSize: 16 },
  setPasswordBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  setPasswordBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnText: { fontSize: 15 },
});
