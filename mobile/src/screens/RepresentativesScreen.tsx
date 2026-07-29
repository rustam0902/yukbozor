import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import { api } from '../services/api';

interface Representative {
  id: number;
  representativeUserId: number;
  representativeUser: {
    id: number;
    displayName: string | null;
    phone: string;
    userType: string;
  } | null;
  status: 'pending' | 'active' | 'rejected' | 'revoked';
  permissions: string[];
  createdAt: string;
}

interface UserSearchResult {
  id: number;
  phone: string;
  displayName?: string;
  companyName?: string;
}

const PERMISSION_TYPES = [
  'create_order',
  'edit_own_orders',
  'delete_own_orders',
  'accept_offer',
  'pay_contract',
  'send_waybill',
];

export function RepresentativesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRepresentative, setSelectedRepresentative] = useState<UserSearchResult | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = {
    title: language === 'ru' ? 'Мои представители' : 'Mening vakillarim',
    noRepresentatives: language === 'ru' ? 'У вас нет представителей' : 'Sizda vakillar yo\'q',
    noRepresentativesDesc: language === 'ru'
      ? 'Добавьте людей, которые будут работать от вашего имени'
      : 'O\'zimiz nomidan ishlaydiyan odamlarni qo\'shing',
    addRepresentative: language === 'ru' ? 'Добавить представителя' : 'Vakil qo\'shish',
    searchByPhone: language === 'ru' ? 'Поиск по номеру' : 'Raqam bo\'yicha izlash',
    selectPermissions: language === 'ru' ? 'Выберите разрешения' : 'Ruxsatlarni tanlang',
    add: language === 'ru' ? 'Добавить' : 'Qo\'shish',
    cancel: language === 'ru' ? 'Отмена' : 'Bekor qilish',
    remove: language === 'ru' ? 'Удалить' : 'O\'chirish',
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
    confirmRemove: language === 'ru' ? 'Вы уверены?' : 'Ishonchingiz komilmi?',
    removeDesc: language === 'ru'
      ? 'Этот человек больше не будет представлять вас'
      : 'Bu odam endi sizi ifodalamaydi',
    phone: language === 'ru' ? 'Телефон' : 'Telefon',
    noResults: language === 'ru' ? 'Пользователь не найден' : 'Foydalanuvchi topilmadi',
    selectUser: language === 'ru' ? 'Выберите пользователя' : 'Foydalanuvchini tanlang',
    allPermissions: language === 'ru' ? 'Все разрешения' : 'Barcha ruxsatlar',
  };

  const permissionLabels: Record<string, string> = {
    create_order: t.createOrder,
    edit_own_orders: t.editOrders,
    delete_own_orders: t.deleteOrders,
    accept_offer: t.acceptOffer,
    pay_contract: t.payContract,
    send_waybill: t.sendWaybill,
  };

  const fetchRepresentatives = async () => {
    try {
      const response = await api.get('/api/representatives');
      setRepresentatives(response.data || []);
    } catch (error) {
      console.log('Error fetching representatives:', error);
      setRepresentatives([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRepresentatives();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRepresentatives();
  };

  const searchUsers = async (phone: string) => {
    setSearchError(null);
    if (!phone || phone.length < 5) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/api/representatives/search-user?phone=${encodeURIComponent(phone)}`);
      setSearchResults(response.data ? [response.data] : []);
    } catch (error: any) {
      console.log('Error searching users:', error);
      setSearchResults([]);
      const errMsg = error.response?.data?.error;
      if (errMsg) {
        setSearchError(errMsg);
      } else if (error.response?.status === 404) {
        setSearchError(language === 'ru' ? 'Пользователь не найден' : 'Foydalanuvchi topilmadi');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAddRepresentative = async () => {
    if (!selectedRepresentative || selectedPermissions.length === 0) {
      Alert.alert(
        t.selectUser,
        language === 'ru' ? 'Выберите пользователя и разрешения' : 'Foydalanuvchi va ruxsatlarni tanlang'
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/representatives', {
        representativeUserId: selectedRepresentative.id,
        permissions: selectedPermissions,
      });

      Alert.alert(
        language === 'ru' ? 'Успешно' : 'Muvaffaqiyat',
        language === 'ru'
          ? `${selectedRepresentative.displayName || selectedRepresentative.phone} добавлен`
          : `${selectedRepresentative.displayName || selectedRepresentative.phone} qo'shildi`
      );

      setShowAddModal(false);
      setSearchPhone('');
      setSearchResults([]);
      setSelectedRepresentative(null);
      setSelectedPermissions([]);
      await fetchRepresentatives();
    } catch (error: any) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Xato',
        error.response?.data?.error || (language === 'ru' ? 'Не удалось добавить представителя' : 'Vakil qo\'shilmadi')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRepresentative = (representative: Representative) => {
    Alert.alert(
      t.confirmRemove,
      t.removeDesc,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.remove,
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/representatives/${representative.id}`);
              setRepresentatives(representatives.filter(r => r.id !== representative.id));
              Alert.alert(
                language === 'ru' ? 'Успешно' : 'Muvaffaqiyat',
                language === 'ru' ? 'Представитель удален' : 'Vakil o\'chirildi'
              );
            } catch (error: any) {
              Alert.alert(
                language === 'ru' ? 'Ошибка' : 'Xato',
                error.response?.data?.error || (language === 'ru' ? 'Не удалось удалить представителя' : 'Vakil o\'chirilmadi')
              );
            }
          },
        },
      ]
    );
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
    );
  };

  const toggleAllPermissions = () => {
    if (selectedPermissions.length === PERMISSION_TYPES.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions([...PERMISSION_TYPES]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return colors.primary;
      case 'pending':
        return '#f59e0b';
      case 'rejected':
        return '#ef4444';
      case 'revoked':
        return '#6b7280';
      default:
        return colors.mutedForeground;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t.active;
      case 'pending':
        return t.pending;
      case 'rejected':
        return t.rejected;
      case 'revoked':
        return t.revoked;
      default:
        return status;
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
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          data-testid="button-back"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.title}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          data-testid="button-add-representative"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {representatives.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t.noRepresentatives}</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{t.noRepresentativesDesc}</Text>
          </View>
        ) : (
          representatives.map((representative) => (
            <View
              key={representative.id}
              style={[styles.representativeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              data-testid={`card-representative-${representative.id}`}
            >
              <View style={styles.representativeHeader}>
                <View style={[styles.representativeIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="person" size={24} color={colors.primary} />
                </View>
                <View style={styles.representativeInfo}>
                  <Text style={[styles.representativeName, { color: colors.foreground }]}>
                    {representative.representativeUser?.displayName || representative.representativeUser?.phone || '—'}
                  </Text>
                  <Text style={[styles.representativePhone, { color: colors.mutedForeground }]}>
                    {representative.representativeUser?.phone || '—'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(representative.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(representative.status) }]}>
                    {getStatusText(representative.status)}
                  </Text>
                </View>
              </View>

              {representative.permissions.length > 0 && (
                <View style={styles.permissionsSection}>
                  <Text style={[styles.permissionsTitle, { color: colors.mutedForeground }]}>{t.permissions}:</Text>
                  <View style={styles.permissionsList}>
                    {representative.permissions.map((perm, index) => (
                      <View key={index} style={[styles.permissionBadge, { backgroundColor: colors.background }]}>
                        <Text style={[styles.permissionText, { color: colors.foreground }]}>
                          {permissionLabels[perm] || perm}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.removeButton, { borderColor: colors.destructive }]}
                onPress={() => handleRemoveRepresentative(representative)}
                data-testid={`button-remove-${representative.id}`}
              >
                <Text style={[styles.removeButtonText, { color: colors.destructive }]}>{t.remove}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add Representative Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent={true} data-testid="modal-add-representative">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.primary }]}>
              <Text style={styles.modalTitle}>{t.addRepresentative}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setSearchPhone('');
                  setSearchResults([]);
                  setSelectedRepresentative(null);
                  setSelectedPermissions([]);
                }}
                data-testid="button-close-modal"
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Search Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.searchByPhone}</Text>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder={t.phone}
                  placeholderTextColor={colors.mutedForeground}
                  value={searchPhone}
                  onChangeText={(text) => {
                    setSearchPhone(text);
                    setSearchError(null);
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    searchTimerRef.current = setTimeout(() => searchUsers(text), 600);
                  }}
                  keyboardType="phone-pad"
                  data-testid="input-search-phone"
                />

                {searchError && (
                  <Text style={[styles.searchErrorText, { color: colors.destructive }]}>{searchError}</Text>
                )}

                {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}

                {searchResults.length > 0 ? (
                  <View style={[styles.searchResultsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {searchResults.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.searchResultItem,
                          {
                            backgroundColor: selectedRepresentative?.id === user.id ? colors.primary + '15' : 'transparent',
                            borderColor: selectedRepresentative?.id === user.id ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setSelectedRepresentative(user)}
                        data-testid={`button-select-user-${user.id}`}
                      >
                        <View style={[styles.userIcon, { backgroundColor: colors.primary + '15' }]}>
                          <Ionicons name="person" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={[styles.userName, { color: colors.foreground }]}>
                            {user.displayName || user.companyName || user.phone}
                          </Text>
                          <Text style={[styles.userPhone, { color: colors.mutedForeground }]}>{user.phone}</Text>
                        </View>
                        {selectedRepresentative?.id === user.id && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : searchPhone.length > 0 && !searching ? (
                  <Text style={[styles.noResults, { color: colors.mutedForeground }]}>{t.noResults}</Text>
                ) : null}
              </View>

              {selectedRepresentative && (
                <View style={styles.section}>
                  <View style={styles.permissionsHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.selectPermissions}</Text>
                    <TouchableOpacity
                      onPress={toggleAllPermissions}
                      data-testid="button-toggle-all-permissions"
                    >
                      <Text style={[styles.allPermissionsLink, { color: colors.primary }]}>
                        {selectedPermissions.length === PERMISSION_TYPES.length
                          ? language === 'ru'
                            ? 'Очистить'
                            : 'Tozalash'
                          : t.allPermissions}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.permissionsGrid}>
                    {PERMISSION_TYPES.map((permission) => (
                      <TouchableOpacity
                        key={permission}
                        style={[
                          styles.permissionCheckbox,
                          {
                            backgroundColor: selectedPermissions.includes(permission)
                              ? colors.primary + '20'
                              : colors.card,
                            borderColor: selectedPermissions.includes(permission) ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => togglePermission(permission)}
                        data-testid={`button-permission-${permission}`}
                      >
                        {selectedPermissions.includes(permission) && (
                          <Ionicons name="checkmark" size={16} color={colors.primary} style={styles.checkmark} />
                        )}
                        <Text
                          style={[
                            styles.permissionCheckboxText,
                            { color: colors.foreground },
                          ]}
                        >
                          {permissionLabels[permission]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowAddModal(false);
                  setSearchPhone('');
                  setSearchResults([]);
                  setSelectedRepresentative(null);
                  setSelectedPermissions([]);
                }}
                disabled={submitting}
                data-testid="button-modal-cancel"
              >
                <Text style={[styles.cancelButtonText, { color: colors.foreground }]}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor:
                      selectedRepresentative && selectedPermissions.length > 0 ? colors.primary : colors.muted,
                  },
                ]}
                onPress={handleAddRepresentative}
                disabled={!selectedRepresentative || selectedPermissions.length === 0 || submitting}
                data-testid="button-submit-representative"
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>{t.add}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 48,
    alignItems: 'center',
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
  representativeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  representativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  representativeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  representativeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  representativeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  representativePhone: {
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
    marginTop: 16,
    paddingTop: 16,
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
    gap: 8,
  },
  permissionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  permissionText: {
    fontSize: 12,
  },
  removeButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 32,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  modalScrollView: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchResultsList: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  userPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  noResults: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  searchErrorText: {
    fontSize: 13,
    marginTop: 6,
  },
  permissionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allPermissionsLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  permissionsGrid: {
    gap: 8,
  },
  permissionCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  checkmark: {
    marginRight: 8,
  },
  permissionCheckboxText: {
    fontSize: 14,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
