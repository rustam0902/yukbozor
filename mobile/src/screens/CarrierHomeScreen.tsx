import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCarrierOrders } from '../hooks/useOrders';
import { trackEvent } from '../services/analytics';
import { useCreateOffer } from '../hooks/useOffers';
import { useDepositAccounts } from '../hooks/useDeposits';
import { formatPrice, formatDate, formatDateTime, getRegionName, getTransportTypeName } from '../constants/regions';
import { localizeLoadingTime } from '../utils/loadingTimeUtils';
import { FilterModal, FilterValues, EMPTY_FILTERS, countActiveFilters } from '../components/FilterModal';

interface CarrierHomeScreenProps {
  navigation: any;
}

export function CarrierHomeScreen({ navigation }: CarrierHomeScreenProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [offerPrice, setOfferPrice] = useState('');
  
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  
  const { 
    data: carrierOrders = [], 
    isLoading,
    refetch,
    isRefetching 
  } = useCarrierOrders();
  
  const { data: depositAccountsData } = useDepositAccounts();
  const depositAccounts = Array.isArray(depositAccountsData) ? depositAccountsData : [];
  const createOfferMutation = useCreateOffer();

  const mainBalance = useMemo(() => {
    const mainAccount = depositAccounts.find(a => a.accountType === 'main');
    return mainAccount?.balance || 0;
  }, [depositAccounts]);

  const parsePrice = (price: string): number => {
    const normalized = price.replace(/,/g, '.').replace(/\s/g, '');
    const numPrice = parseFloat(normalized);
    return isNaN(numPrice) ? 0 : numPrice;
  };

  const handlePriceInput = (value: string): string => {
    let v = value.replace(/,/g, '.');
    v = v.replace(/[^\d.]/g, '');
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    if (v.includes('.')) {
      const [int, dec] = v.split('.');
      v = int + '.' + dec.slice(0, 2);
    }
    return v;
  };

  const calculateCollateral = (price: string) => {
    return Math.round(parsePrice(price) * 0.02);
  };

  const collateralAmount = useMemo(() => {
    if (!selectedOrder?.requiresCollateral) return 0;
    return Math.floor((Number(selectedOrder.priceWithVat) || 0) * 0.02);
  }, [selectedOrder]);

  const hasInsufficientBalance = collateralAmount > 0 && collateralAmount > mainBalance;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filteredOrders = useMemo(() => {
    return carrierOrders.filter((order: any) => {
      // Client-side safety: exclude own orders (server also filters, but double-check)
      if (user && order.customerId === user.id) return false;
      if (filters.originRegions.length > 0 && !filters.originRegions.includes(order.originRegion)) return false;
      if (filters.destinationRegions.length > 0 && !filters.destinationRegions.includes(order.destinationRegion)) return false;
      if (filters.transportTypes.length > 0 && !filters.transportTypes.includes(order.transportType)) return false;
      return true;
    });
  }, [carrierOrders, filters, user]);

  const activeFiltersCount = countActiveFilters(filters);

  const handleOpenOfferModal = (order: any) => {
    setSelectedOrder(order);
    setOfferPrice(order.priceWithVat?.toString() || '');
  };

  const offerPriceNum = parsePrice(offerPrice);
  const offerPriceWithoutVat = user?.ndsPayer
    ? parseFloat((offerPriceNum / 1.12).toFixed(2))
    : offerPriceNum;

  const handleSubmitOffer = async () => {
    const price = parsePrice(offerPrice);
    if (!selectedOrder || price <= 0) return;
    const priceWithoutVat = user?.ndsPayer
      ? parseFloat((price / 1.12).toFixed(2))
      : price;
    
    try {
      await createOfferMutation.mutateAsync({
        orderId: selectedOrder.id,
        carrierId: user!.id,
        price: price,
        priceWithoutVat,
      });
      
      Alert.alert(
        language === 'ru' ? 'Успешно' : 'Muvaffaqiyatli',
        language === 'ru' ? 'Ваше предложение отправлено' : 'Taklifingiz yuborildi'
      );
      
      setSelectedOrder(null);
      setOfferPrice('');
    } catch (error: any) {
      const serverError = error.response?.data?.error || error.response?.data?.message;
      const details = error.response?.data?.details;
      let errorMsg = serverError || error.message || (language === 'ru' ? 'Не удалось отправить предложение' : 'Taklif yuborib bo\'lmadi');
      if (details && Array.isArray(details)) {
        errorMsg += '\n' + details.map((d: any) => `${d.path?.join('.') || ''}: ${d.message}`).join('\n');
      }
      if (serverError === 'Insufficient deposit balance') {
        const required = error.response?.data?.required;
        const available = error.response?.data?.available;
        errorMsg = language === 'ru'
          ? `Недостаточно средств на депозите. Требуется: ${Number(required).toLocaleString()} UZS, доступно: ${Number(available).toLocaleString()} UZS`
          : `Depozitda mablag' yetarli emas. Kerak: ${Number(required).toLocaleString()} UZS, mavjud: ${Number(available).toLocaleString()} UZS`;
      } else if (serverError === 'Cannot submit offer on your own order') {
        errorMsg = language === 'ru' ? 'Нельзя подавать предложение на собственный заказ' : 'O\'z buyurtmangizga taklif bera olmaysiz';
      }
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Xato', errorMsg);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {language === 'ru' ? 'Режим перевозчика' : 'Tashuvchi rejimi'}
          </Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.displayName || user?.profile?.companyName || user?.phone}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
          testID="button-notifications"
        >
          <Ionicons name="notifications-outline" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchHeader}>
        <Text style={[styles.ordersCount, { color: colors.foreground }]}>
          {language === 'ru'
            ? `${filteredOrders.length} доступных заказов`
            : `${filteredOrders.length} ta mavjud buyurtma`}
        </Text>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && { backgroundColor: colors.primary + '20' }]}
          onPress={() => setFilterModalVisible(true)}
          testID="button-filters"
        >
          <Ionicons name="filter-outline" size={20} color={activeFiltersCount > 0 ? colors.primary : colors.foreground} />
          {activeFiltersCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : filteredOrders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {activeFiltersCount > 0
                ? (language === 'ru' ? 'Нет заказов по фильтру' : 'Filtr bo\'yicha buyurtmalar yo\'q')
                : (language === 'ru' ? 'Нет доступных заказов' : 'Mavjud buyurtmalar yo\'q')}
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity onPress={() => setFilters(EMPTY_FILTERS)}>
                <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
                  {language === 'ru' ? 'Сбросить фильтры' : 'Filtrlarni tozalash'}
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        ) : (
          filteredOrders.map((order: any) => (
            <TouchableOpacity
              key={order.id}
              activeOpacity={0.7}
              onPress={() => { trackEvent('open_order', 'CarrierHomeScreen', { orderId: order.id }); navigation.navigate('OrderDetail', { orderId: order.id }); }}
              testID={`order-card-${order.id}`}
            >
            <Card style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={[styles.orderId, { color: colors.foreground }]}>
                  #{order.id}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.orderDateLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'Дата и время загрузки' : 'Yuklash sanasi va vaqti'}
                  </Text>
                  <Text style={[styles.orderDate, { color: colors.foreground }]}>
                    {formatDate(order.loadDate || order.loadingDate, language)}{order.loadingTime ? `, ${localizeLoadingTime(order.loadingTime, language)}` : ''}
                  </Text>
                </View>
              </View>
              
              <View style={styles.orderRoute}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                    {getRegionName(order.originRegion, language)}
                  </Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                    {getRegionName(order.destinationRegion, language)}
                  </Text>
                </View>
              </View>

              <View style={styles.orderDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="car-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                    {getTransportTypeName(order.transportType, language)}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="cube-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                    {order.weightTons ?? order.cargoWeight} {language === 'ru' ? 'т' : 't'}
                  </Text>
                </View>
              </View>

              <View style={styles.orderFooter}>
                <Text style={[styles.orderPrice, { color: colors.primary }]}>
                  {formatPrice(order.priceWithVat, language)}
                </Text>
                <TouchableOpacity
                  style={[styles.offerButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleOpenOfferModal(order)}
                  testID={`button-offer-${order.id}`}
                >
                  <Text style={styles.offerButtonText}>
                    {language === 'ru' ? 'Предложить' : 'Taklif qilish'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setFilterModalVisible(false);
        }}
        initialValues={filters}
      />

      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Отправить предложение' : 'Taklif yuborish'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <View style={styles.orderSummary}>
                <Text style={[styles.summaryText, { color: colors.foreground }]}>
                  {language === 'ru' ? 'Заказ' : 'Buyurtma'} #{selectedOrder.id}
                </Text>
                <Text style={[styles.summaryRoute, { color: colors.mutedForeground }]}>
                  {getRegionName(selectedOrder.originRegion, language)} → {getRegionName(selectedOrder.destinationRegion, language)}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {language === 'ru' ? 'Ваша цена (сум)' : 'Sizning narxingiz (so\'m)'}
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                value={offerPrice}
                onChangeText={(v) => setOfferPrice(handlePriceInput(v))}
                keyboardType="decimal-pad"
                placeholder={language === 'ru' ? 'Введите цену' : 'Narxni kiriting'}
                placeholderTextColor={colors.mutedForeground}
                testID="input-offer-price"
              />
            </View>

            {offerPriceNum > 0 && (
              <Text style={[styles.calculatedPrice, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Без НДС' : 'QQSsiz'}: {formatPrice(offerPriceWithoutVat, language)} {language === 'ru' ? 'сум' : 'so\'m'}
              </Text>
            )}

            {selectedOrder?.requiresCollateral && (
              <View style={styles.collateralInfo}>
                <View style={styles.collateralRow}>
                  <Text style={[styles.collateralLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'Залог (2%)' : 'Garov (2%)'}
                  </Text>
                  <Text style={[styles.collateralValue, { color: colors.warning }]}>
                    {formatPrice(collateralAmount, language)}
                  </Text>
                </View>
                <View style={styles.collateralRow}>
                  <Text style={[styles.collateralLabel, { color: colors.mutedForeground }]}>
                    {language === 'ru' ? 'Ваш баланс' : 'Sizning balansingiz'}
                  </Text>
                  <Text style={[styles.collateralValue, { color: hasInsufficientBalance ? colors.destructive : colors.success }]}>
                    {formatPrice(mainBalance, language)}
                  </Text>
                </View>
                {hasInsufficientBalance && (
                  <View style={[styles.warningBox, { backgroundColor: colors.destructive + '15', borderColor: colors.destructive }]}>
                    <Ionicons name="warning-outline" size={16} color={colors.destructive} />
                    <Text style={[styles.warningText, { color: colors.destructive }]}>
                      {language === 'ru' 
                        ? 'Недостаточно средств на балансе. Пополните депозит.'
                        : 'Balansda mablag\' yetarli emas. Depozitni to\'ldiring.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {hasInsufficientBalance ? (
              <Button
                title={language === 'ru' ? 'Пополнить депозит' : 'Depozitni to\'ldirish'}
                onPress={() => {
                  setSelectedOrder(null);
                  navigation.getParent()?.navigate('Deposit');
                }}
                testID="button-goto-deposit"
              />
            ) : (
              <Button
                title={language === 'ru' ? 'Отправить предложение' : 'Taklifni yuborish'}
                onPress={handleSubmitOffer}
                loading={createOfferMutation.isPending}
                disabled={!offerPrice || parsePrice(offerPrice) <= 0}
                testID="button-submit-offer"
              />
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  notificationButton: {
    padding: 8,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  ordersCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  loader: {
    marginVertical: 40,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  orderCard: {
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderDateLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 12,
  },
  orderRoute: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
  },
  routeText: {
    fontSize: 14,
    flex: 1,
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  offerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  offerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderSummary: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRoute: {
    fontSize: 12,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  calculatedPrice: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  filterTypeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterList: {
    maxHeight: 200,
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  filterItemText: {
    fontSize: 14,
  },
  filterListSmall: {
    maxHeight: 50,
  },
  transportChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  transportChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  collateralInfo: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  collateralRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  collateralLabel: {
    fontSize: 14,
  },
  collateralValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
