import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

interface Principal {
  id: number;
  customerId: number;
  status: 'pending' | 'active' | 'rejected' | 'revoked';
  permissions: string[];
  createdAt: string;
  customer?: {
    id: number;
    displayName?: string;
    phone?: string;
    companyName?: string;
    inn?: string;
  };
}

const getCustomerName = (p: Principal): string =>
  p.customer?.companyName || p.customer?.displayName || p.customer?.phone || '—';

const getCustomerInn = (p: Principal): string =>
  p.customer?.inn || '';

export function PrincipalsScreen() {
  const { activePrincipal, setActivePrincipal } = useAuth();
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [principals, setPrincipals] = useState<Principal[]>([]);

  const t = {
    title: language === 'ru' ? 'Мои доверители' : 'Mening ishonchli shaxslarim',
    noPrincipals: language === 'ru' ? 'У вас нет доверителей' : 'Sizda ishonchli shaxslar yo\'q',
    noPrincipalsDesc: language === 'ru'
      ? 'Когда компания добавит вас как представителя, она появится здесь'
      : 'Kompaniya sizni vakil sifatida qo\'shganda, u yerda paydo bo\'ladi',
    workOnBehalf: language === 'ru' ? 'Работать от имени' : 'Nomidan ishlash',
    stopWorking: language === 'ru' ? 'Завершить работу' : 'Ishni yakunlash',
    active: language === 'ru' ? 'Активен' : 'Faol',
    pending: language === 'ru' ? 'Ожидает' : 'Kutilmoqda',
    rejected: language === 'ru' ? 'Отклонен' : 'Rad etilgan',
    revoked: language === 'ru' ? 'Отозван' : 'Bekor qilingan',
    permissions: language === 'ru' ? 'Разрешения' : 'Ruxsatlar',
    createOrder: language === 'ru' ? 'Создание заказов' : 'Buyurtma yaratish',
    editOrders: language === 'ru' ? 'Редактирование заказов' : 'Buyurtmalarni tahrirlash',
    deleteOrders: language === 'ru' ? 'Удаление заказов' : 'Buyurtmalarni o\'chirish',
    acceptOffer: language === 'ru' ? 'Принятие предложений' : 'Takliflarni qabul qilish',
    payContract: language === 'ru' ? 'Оплата контрактов' : 'Shartnomalarni to\'lash',
    sendWaybill: language === 'ru' ? 'Отправка ТТН' : 'TTN yuborish',
    workingAs: language === 'ru' ? 'Работаете от имени' : 'Nomidan ishlayapsiz',
    currentlyWorking: language === 'ru' ? 'Текущий режим' : 'Joriy rejim',
  };

  const permissionLabels: Record<string, string> = {
    create_order: t.createOrder,
    edit_own_orders: t.editOrders,
    delete_own_orders: t.deleteOrders,
    accept_offer: t.acceptOffer,
    pay_contract: t.payContract,
    send_waybill: t.sendWaybill,
  };

  const fetchPrincipals = async () => {
    try {
      const response = await api.get('/api/representatives/my-principals');
      setPrincipals(response.data || []);
    } catch (error) {
      console.error('Error fetching principals:', error);
      setPrincipals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrincipals();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPrincipals();
  };

  const handleWorkOnBehalf = async (principal: Principal) => {
    try {
      await setActivePrincipal({
        customerId: principal.customerId,
        customerName: getCustomerName(principal),
        customerInn: getCustomerInn(principal),
        permissions: principal.permissions,
      });
      Alert.alert(
        '',
        language === 'ru'
          ? `Вы теперь работаете от имени ${getCustomerName(principal)}`
          : `Siz hozir ${getCustomerName(principal)} nomidan ishlayapsiz`
      );
    } catch (error) {
      console.error('Error activating principal:', error);
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Xato',
        language === 'ru' ? 'Не удалось активировать доверителя' : 'Ishonchli shaxsni faollashtirib bo\'lmadi'
      );
    }
  };

  const handleStopWorking = async () => {
    try {
      await setActivePrincipal(null);
    } catch (error) {
      console.error('Error deactivating principal:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.primary;
      case 'pending': return '#f59e0b';
      case 'rejected': return '#ef4444';
      case 'revoked': return '#6b7280';
      default: return colors.mutedForeground;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return t.active;
      case 'pending': return t.pending;
      case 'rejected': return t.rejected;
      case 'revoked': return t.revoked;
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t.title}</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {activePrincipal && (
          <View style={[styles.activeCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
            <View style={[styles.activeCardIcon, { backgroundColor: colors.primary + '25' }]}>
              <Ionicons name="business-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.activeCardContent}>
              <Text style={[styles.activeCardLabel, { color: colors.primary }]}>{t.workingAs}:</Text>
              <Text style={[styles.activeCardValue, { color: colors.foreground }]}>
                {activePrincipal.customerName}
              </Text>
              {activePrincipal.customerInn ? (
                <Text style={[styles.activeCardInn, { color: colors.mutedForeground }]}>
                  ИНН: {activePrincipal.customerInn}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.stopButton, { borderColor: '#ef4444' }]}
              onPress={handleStopWorking}
              testID="button-stop-working"
            >
              <Ionicons name="close-circle-outline" size={14} color="#ef4444" />
              <Text style={[styles.stopButtonText, { color: '#ef4444' }]}>{t.stopWorking}</Text>
            </TouchableOpacity>
          </View>
        )}

        {principals.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t.noPrincipals}</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{t.noPrincipalsDesc}</Text>
          </View>
        ) : (
          principals.map((principal) => {
            const isCurrentlyActive = activePrincipal?.customerId === principal.customerId;
            return (
              <View
                key={principal.id}
                style={[
                  styles.principalCard,
                  { backgroundColor: colors.card, borderColor: isCurrentlyActive ? colors.primary : colors.border },
                  isCurrentlyActive && styles.principalCardActive,
                ]}
              >
                <View style={styles.principalHeader}>
                  <View style={[styles.principalIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="business" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.principalInfo}>
                    <Text style={[styles.principalName, { color: colors.foreground }]}>
                      {getCustomerName(principal)}
                    </Text>
                    {getCustomerInn(principal) ? (
                      <Text style={[styles.principalInn, { color: colors.mutedForeground }]}>
                        ИНН: {getCustomerInn(principal)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(principal.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(principal.status) }]}>
                      {getStatusText(principal.status)}
                    </Text>
                  </View>
                </View>

                {principal.permissions.length > 0 && (
                  <View style={styles.permissionsSection}>
                    <Text style={[styles.permissionsTitle, { color: colors.mutedForeground }]}>{t.permissions}:</Text>
                    <View style={styles.permissionsList}>
                      {principal.permissions.map((perm, index) => (
                        <View key={index} style={[styles.permissionBadge, { backgroundColor: colors.background }]}>
                          <Text style={[styles.permissionText, { color: colors.foreground }]}>
                            {permissionLabels[perm] || perm}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {principal.status === 'active' && (
                  isCurrentlyActive ? (
                    <View style={[styles.workingBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[styles.workingBadgeText, { color: colors.primary }]}>
                        {language === 'ru' ? 'Активный режим' : 'Faol rejim'}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.workButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleWorkOnBehalf(principal)}
                      testID={`button-work-on-behalf-${principal.id}`}
                    >
                      <Ionicons name="person-circle-outline" size={18} color="white" />
                      <Text style={styles.workButtonText}>{t.workOnBehalf}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            );
          })
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  activeCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCardContent: {
    flex: 1,
  },
  activeCardLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeCardValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  activeCardInn: {
    fontSize: 12,
    marginTop: 2,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stopButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  principalCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  principalCardActive: {
    borderWidth: 1.5,
  },
  principalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  principalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  principalName: {
    fontSize: 16,
    fontWeight: '600',
  },
  principalInn: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  permissionsSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  permissionsTitle: {
    fontSize: 12,
    marginBottom: 8,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  permissionText: {
    fontSize: 12,
  },
  workButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 14,
  },
  workButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  workingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 14,
  },
  workingBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },
});
