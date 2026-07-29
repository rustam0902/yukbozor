import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth, UserRole } from '../context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

interface ProfileScreenProps {
  navigation: any;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, setActiveRole, activeRole, representativeModeEnabled, setRepresentativeModeEnabled } = useAuth();
  const colors = Colors.light;
  const queryClient = useQueryClient();
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    bankName: user?.profile?.bankName || '',
    bankAccount: user?.profile?.bankAccount || '',
    bankCode: user?.profile?.bankCode || '',
  });

  const isIndividual = user?.userType === 'individual' || user?.entityType === 'physical_person';
  const isLegalOrIP = user?.entityType === 'legal_entity' || user?.entityType === 'individual_entrepreneur';

  const updateBankDetailsMutation = useMutation({
    mutationFn: async (data: { bankName: string; bankAccount: string; bankCode: string }) => {
      const response = await api.put('/profile/bank-details', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setShowBankModal(false);
      Alert.alert(
        language === 'ru' ? 'Успешно' : 'Muvaffaqiyatli',
        language === 'ru' ? 'Банковские реквизиты обновлены' : 'Bank rekvizitlari yangilandi'
      );
    },
    onError: () => {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Xato',
        language === 'ru' ? 'Не удалось обновить реквизиты' : 'Rekvizitlarni yangilab bo\'lmadi'
      );
    },
  });

  const getRoleName = (role: string) => {
    switch (role) {
      case 'customer': return t.customer;
      case 'carrier': return t.carrier;
      case 'partner': return t.partner;
      default: return role;
    }
  };

  const getRoleIcon = (role: string): string => {
    switch (role) {
      case 'customer': return 'cube-outline';
      case 'carrier': return 'car-outline';
      case 'partner': return 'people-outline';
      default: return 'person-outline';
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'customer': return '#3B82F6';
      case 'carrier': return '#10B981';
      case 'partner': return '#F59E0B';
      default: return colors.primary;
    }
  };

  const getEntityTypeName = (type: string) => {
    switch (type) {
      case 'legal': return t.legalEntity;
      case 'ip': return t.individualEntrepreneur;
      case 'individual': return t.physicalPerson;
      case 'legal_entity': return t.legalEntity;
      case 'individual_entrepreneur': return t.individualEntrepreneur;
      case 'physical_person': return t.physicalPerson;
      default: return type;
    }
  };

  const handleLogout = () => {
    Alert.alert(
      language === 'ru' ? 'Выход' : 'Chiqish',
      language === 'ru' ? 'Вы уверены, что хотите выйти?' : 'Chiqishni xohlaysizmi?',
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.confirm, onPress: () => logout(), style: 'destructive' },
      ]
    );
  };

  const handleSwitchRole = async (role: UserRole) => {
    if (isIndividual && role === 'carrier') {
      Alert.alert(
        language === 'ru' ? 'Недоступно' : 'Mavjud emas',
        t.carrierOnlyForLegal
      );
      return;
    }
    await setActiveRole(role);
  };

  const getAvailableRoles = (): UserRole[] => {
    const userRoles = (user?.roles || []) as UserRole[];
    if (isIndividual) {
      return userRoles.filter(role => role !== 'carrier');
    }
    return userRoles;
  };

  const menuItems = [
    {
      title: language === 'ru' ? 'Редактировать профиль' : 'Profilni tahrirlash',
      icon: 'person-outline',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      title: language === 'ru' ? 'Безопасность' : 'Xavfsizlik',
      icon: 'lock-closed-outline',
      onPress: () => navigation.navigate('Security'),
    },
    {
      title: t.referralProgram,
      icon: 'gift-outline',
      onPress: () => navigation.navigate('Referral'),
    },
    {
      title: language === 'ru' ? 'Уведомления' : 'Bildirishnomalar',
      icon: 'notifications-outline',
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      title: language === 'ru' ? 'Настройки Push-уведомлений' : 'Push-bildirishnoma sozlamalari',
      icon: 'radio-outline',
      onPress: () => navigation.navigate('PushNotificationSettings'),
    },
    {
      title: language === 'ru' ? 'Помощь' : 'Yordam',
      icon: 'help-circle-outline',
      onPress: () => navigation.navigate('Help'),
    },
    ...(activeRole === 'carrier' ? [{
      title: language === 'ru' ? 'Чат' : 'Chat',
      icon: 'chatbubbles-outline',
      onPress: () => navigation.navigate('CarrierChat'),
    }] : []),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t.profile}
          </Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(user?.displayName || user?.profile?.companyName || user?.phone || 'U')[0].toUpperCase()}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.displayName || user?.profile?.companyName || user?.phone}
          </Text>
          
          <Text style={[styles.userPhone, { color: colors.mutedForeground }]}>
            {user?.phone}
          </Text>

          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {getEntityTypeName(user?.userType || '')}
              </Text>
            </View>
            {user?.profile?.ndsPayer && (
              <View style={[styles.badge, { backgroundColor: colors.success + '20', marginLeft: 8 }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  {language === 'ru' ? 'Плательщик НДС' : 'QQS to\'lovchi'}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {isLegalOrIP && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Реквизиты' : 'Rekvizitlar'}
            </Text>

            <Card style={styles.infoCard}>
              {user?.profile?.inn && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'ИНН' : 'INN'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {user.profile.inn}
                  </Text>
                </View>
              )}
              {user?.profile?.pinfl && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'ПИНФЛ' : 'PINFL'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {user.profile.pinfl}
                  </Text>
                </View>
              )}
              {user?.profile?.companyName && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'Организация' : 'Tashkilot'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {user.profile.companyName}
                  </Text>
                </View>
              )}
            </Card>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Банковские реквизиты' : 'Bank rekvizitlari'}
            </Text>

            <Card style={styles.infoCard}>
              {user?.profile?.bankName ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                      {language === 'ru' ? 'Банк' : 'Bank'}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>
                      {user.profile.bankName}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                      {language === 'ru' ? 'Расчётный счёт' : 'Hisob raqami'}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>
                      {user.profile.bankAccount}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                      {language === 'ru' ? 'МФО' : 'MFO'}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>
                      {user.profile.bankCode}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Банковские реквизиты не указаны' : 'Bank rekvizitlari ko\'rsatilmagan'}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.editButton, { borderColor: colors.primary }]}
                onPress={() => {
                  setBankDetails({
                    bankName: user?.profile?.bankName || '',
                    bankAccount: user?.profile?.bankAccount || '',
                    bankCode: user?.profile?.bankCode || '',
                  });
                  setShowBankModal(true);
                }}
                testID="button-edit-bank-details"
              >
                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                <Text style={[styles.editButtonText, { color: colors.primary }]}>
                  {language === 'ru' ? 'Редактировать' : 'Tahrirlash'}
                </Text>
              </TouchableOpacity>
            </Card>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Электронная подпись' : 'Elektron imzo'}
            </Text>

            <Card style={styles.infoCard}>
              <View style={styles.eimzoRow}>
                <View style={[
                  styles.eimzoIcon,
                  { backgroundColor: user?.profile?.eimzoVerified ? colors.success + '20' : colors.warning + '20' }
                ]}>
                  <Ionicons 
                    name={user?.profile?.eimzoVerified ? 'shield-checkmark' : 'shield-outline'} 
                    size={24} 
                    color={user?.profile?.eimzoVerified ? colors.success : colors.warning} 
                  />
                </View>
                <View style={styles.eimzoInfo}>
                  <Text style={[styles.eimzoTitle, { color: colors.foreground }]}>
                    E-IMZO
                  </Text>
                  <Text style={[styles.eimzoStatus, { 
                    color: user?.profile?.eimzoVerified ? colors.success : colors.warning 
                  }]}>
                    {user?.profile?.eimzoVerified 
                      ? (language === 'ru' ? 'Верифицирован' : 'Tasdiqlangan')
                      : (language === 'ru' ? 'Не подключен' : 'Ulanmagan')
                    }
                  </Text>
                  {user?.profile?.eimzoCertSerial && (
                    <Text style={[styles.eimzoCert, { color: colors.mutedForeground }]}>
                      {language === 'ru' ? 'Сертификат: ' : 'Sertifikat: '}{user.profile.eimzoCertSerial}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Текущая роль' : 'Joriy rol'}
        </Text>

        <View style={styles.rolesContainer}>
          {getAvailableRoles().map((role) => {
            const isActive = activeRole === role;
            const roleColor = getRoleColor(role);
            const roleSubtitle: Record<string, string> = {
              customer: language === 'ru' ? 'Создание заказов и объявлений' : 'Buyurtma va e\'lon berish',
              carrier: language === 'ru' ? 'Поиск и выполнение заказов' : 'Buyurtma qidirish va bajarish',
              partner: language === 'ru' ? 'Реферальная программа' : 'Referal dasturi',
            };
            
            return (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleCard,
                  {
                    borderColor: isActive ? roleColor : colors.border,
                    backgroundColor: isActive ? roleColor + '10' : colors.card,
                  }
                ]}
                onPress={() => handleSwitchRole(role)}
              >
                <View style={[styles.roleIconContainer, { backgroundColor: roleColor + '20' }]}>
                  <Ionicons name={getRoleIcon(role) as any} size={24} color={roleColor} />
                </View>
                <View style={styles.roleCardTextContainer}>
                  <Text style={[
                    styles.roleCardText,
                    { color: isActive ? roleColor : colors.foreground }
                  ]}>
                    {getRoleName(role)}
                  </Text>
                  {roleSubtitle[role] && (
                    <Text style={[styles.roleCardSubtitle, { color: colors.mutedForeground }]}>
                      {roleSubtitle[role]}
                    </Text>
                  )}
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={20} color={roleColor} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isIndividual && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t.representativeMode}
            </Text>

            <Card style={styles.representativeCard}>
              <View style={styles.representativeHeader}>
                <View style={styles.representativeInfo}>
                  <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
                  <View style={styles.representativeTextContainer}>
                    <Text style={[styles.representativeTitle, { color: colors.foreground }]}>
                      {t.representativeMode}
                    </Text>
                    <Text style={[styles.representativeDesc, { color: colors.mutedForeground }]}>
                      {t.representativeModeDesc}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={representativeModeEnabled}
                  onValueChange={setRepresentativeModeEnabled}
                  trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                  thumbColor={representativeModeEnabled ? colors.primary : '#f4f3f4'}
                />
              </View>

              {representativeModeEnabled && (
                <View style={styles.representativeHint}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.representativeHintText, { color: colors.mutedForeground }]}>
                    {language === 'ru'
                      ? 'Навигация переключена на режим представителя. Используйте вкладки внизу для доступа к доверителям, заказам и договорам.'
                      : 'Navigatsiya vakil rejimiga almashtirildi. Ishonch beruvchilar, buyurtmalar va shartnomalarga pastdagi yorliqlar orqali kiring.'}
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}

        {!isIndividual && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {language === 'ru' ? 'Управление' : 'Boshqarish'}
            </Text>

            <Card style={styles.representativeCard}>
              <TouchableOpacity
                style={[styles.principalsButton, { borderColor: colors.border }]}
                onPress={() => navigation.navigate('Representatives')}
                data-testid="button-manage-representatives"
              >
                <View style={styles.menuItemContent}>
                  <Ionicons name="people-outline" size={20} color={colors.primary} />
                  <Text style={[styles.principalsButtonText, { color: colors.primary, marginLeft: 12 }]}>
                    {language === 'ru' ? 'Мои представители' : 'Mening vakillarim'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </Card>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Язык' : 'Til'}
        </Text>

        <View style={styles.languageRow}>
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
              Русский
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
              O'zbekcha
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {language === 'ru' ? 'Настройки' : 'Sozlamalar'}
        </Text>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={item.onPress}
          >
            <View style={styles.menuItemContent}>
              <Ionicons name={item.icon as any} size={22} color={colors.mutedForeground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>
                {item.title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}

        <Button
          title={t.logout}
          onPress={handleLogout}
          variant="destructive"
          style={styles.logoutButton}
        />

        <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
          {language === 'ru' ? 'Версия' : 'Versiya'} {Constants.expoConfig?.version || '1.0.0'}
          {!Updates.currentlyRunning?.isEmbeddedLaunch && Updates.currentlyRunning?.createdAt
            ? (language === 'ru'
                ? ` · Обновлено ${new Date(Updates.currentlyRunning.createdAt).toLocaleDateString('ru-RU')}`
                : ` · Yangilangan ${new Date(Updates.currentlyRunning.createdAt).toLocaleDateString('uz-UZ')}`)
            : ''}
        </Text>
      </ScrollView>

      <Modal
        visible={showBankModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Банковские реквизиты' : 'Bank rekvizitlari'}
              </Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)} testID="button-close-bank-modal">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {language === 'ru' ? 'Название банка' : 'Bank nomi'}
              </Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: colors.border, 
                  color: colors.foreground,
                  backgroundColor: colors.background 
                }]}
                value={bankDetails.bankName}
                onChangeText={(text) => setBankDetails({ ...bankDetails, bankName: text })}
                placeholder={language === 'ru' ? 'Ipak Yo\'li Bank' : 'Ipak Yo\'li Bank'}
                placeholderTextColor={colors.mutedForeground}
                testID="input-bank-name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {language === 'ru' ? 'Расчётный счёт' : 'Hisob raqami'}
              </Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: colors.border, 
                  color: colors.foreground,
                  backgroundColor: colors.background 
                }]}
                value={bankDetails.bankAccount}
                onChangeText={(text) => setBankDetails({ ...bankDetails, bankAccount: text })}
                placeholder="20208000000000000000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                testID="input-bank-account"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {language === 'ru' ? 'МФО (код банка)' : 'MFO (bank kodi)'}
              </Text>
              <TextInput
                style={[styles.input, { 
                  borderColor: colors.border, 
                  color: colors.foreground,
                  backgroundColor: colors.background 
                }]}
                value={bankDetails.bankCode}
                onChangeText={(text) => setBankDetails({ ...bankDetails, bankCode: text })}
                placeholder="00000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                maxLength={5}
                testID="input-bank-mfo"
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                title={language === 'ru' ? 'Отмена' : 'Bekor qilish'}
                onPress={() => setShowBankModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title={language === 'ru' ? 'Сохранить' : 'Saqlash'}
                onPress={() => updateBankDetailsMutation.mutate(bankDetails)}
                loading={updateBankDetailsMutation.isPending}
                style={styles.modalButton}
                testID="button-save-bank-details"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  rolesContainer: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  roleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTextContainer: {
    flex: 1,
    gap: 2,
  },
  roleCardText: {
    fontSize: 15,
    fontWeight: '600',
  },
  roleCardSubtitle: {
    fontSize: 12,
  },
  representativeCard: {
    padding: 16,
    marginBottom: 24,
  },
  representativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  representativeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  representativeTextContainer: {
    flex: 1,
  },
  representativeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  representativeDesc: {
    fontSize: 13,
  },
  principalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  principalsButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  representativeHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  representativeHintText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  languageRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  langButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  langText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 16,
  },
  logoutButton: {
    marginTop: 24,
    marginBottom: 16,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 32,
  },
  infoCard: {
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  eimzoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eimzoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eimzoInfo: {
    flex: 1,
  },
  eimzoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  eimzoStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  eimzoCert: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
});
