import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePublicOrders, useMyOrders, useDeleteOrder, Order } from '../hooks/useOrders';
import { getRegionName, getTransportTypeName, getOrderStatusName, getOrderStatusColor, formatPrice, formatDate } from '../constants/regions';

interface OrdersScreenProps {
  navigation: any;
}

type TabType = 'available' | 'my';
type StatusFilter = 'all' | 'new' | 'active' | 'in_progress' | 'completed' | 'cancelled';

const ORDER_STATUSES: { value: StatusFilter; labelRu: string; labelUz: string }[] = [
  { value: 'all', labelRu: 'Все', labelUz: 'Barchasi' },
  { value: 'new', labelRu: 'Новые', labelUz: 'Yangi' },
  { value: 'active', labelRu: 'Активные', labelUz: 'Faol' },
  { value: 'in_progress', labelRu: 'В работе', labelUz: 'Jarayonda' },
  { value: 'completed', labelRu: 'Завершённые', labelUz: 'Tugallangan' },
  { value: 'cancelled', labelRu: 'Отменённые', labelUz: 'Bekor qilingan' },
];

function CountdownTimer({ expiresAt, language }: { expiresAt: string; language: 'ru' | 'uz' }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      
      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(language === 'ru' ? 'Истекло' : 'Tugadi');
        return;
      }
      
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt, language]);
  
  if (!expiresAt) return null;
  
  return (
    <View style={[styles.timerBadge, { backgroundColor: isExpired ? '#EF444420' : '#F59E0B20' }]}>
      <Ionicons 
        name="time-outline" 
        size={12} 
        color={isExpired ? '#EF4444' : '#F59E0B'} 
      />
      <Text style={[styles.timerText, { color: isExpired ? '#EF4444' : '#F59E0B' }]}>
        {timeLeft}
      </Text>
    </View>
  );
}

export function OrdersScreen({ navigation }: OrdersScreenProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('new');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  
  const isCustomer = user?.roles?.includes('customer');
  
  const { 
    data: publicOrders = [], 
    isLoading: loadingPublic, 
    refetch: refetchPublic,
    isRefetching: refetchingPublic 
  } = usePublicOrders();
  
  const { 
    data: myOrders = [], 
    isLoading: loadingMy, 
    refetch: refetchMy,
    isRefetching: refetchingMy 
  } = useMyOrders();
  
  const deleteOrderMutation = useDeleteOrder();

  const onRefresh = useCallback(() => {
    if (activeTab === 'available') {
      refetchPublic();
    } else {
      refetchMy();
    }
  }, [activeTab, refetchPublic, refetchMy]);

  const getRouteDisplay = (order: Order): string => {
    const origins = order.originPoints?.length 
      ? order.originPoints.map(p => getRegionName(p.region, language)).join(', ')
      : getRegionName(order.originRegion, language);
    
    const destinations = order.destinationPoints?.length
      ? order.destinationPoints.map(p => getRegionName(p.region, language)).join(', ')
      : getRegionName(order.destinationRegion, language);
    
    return `${origins} → ${destinations}`;
  };

  const handleDeleteOrder = (orderId: number) => {
    Alert.alert(
      language === 'ru' ? 'Удалить заказ?' : 'Buyurtmani o\'chirish?',
      language === 'ru' ? 'Это действие нельзя отменить.' : 'Bu amalni bekor qilib bo\'lmaydi.',
      [
        { text: language === 'ru' ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        { 
          text: language === 'ru' ? 'Удалить' : 'O\'chirish', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrderMutation.mutateAsync(orderId);
              Alert.alert(
                language === 'ru' ? 'Успешно' : 'Muvaffaqiyatli',
                language === 'ru' ? 'Заказ удалён' : 'Buyurtma o\'chirildi'
              );
            } catch (error: any) {
              Alert.alert(
                language === 'ru' ? 'Ошибка' : 'Xato',
                error.message || (language === 'ru' ? 'Не удалось удалить заказ' : 'Buyurtmani o\'chirib bo\'lmadi')
              );
            }
          }
        },
      ]
    );
  };

  const filterOrders = (orders: Order[]): Order[] => {
    if (statusFilter === 'all') return orders;
    return orders.filter(order => !order.deletedAt && order.status === statusFilter);
  };

  const renderOrderItem = useCallback(({ item }: { item: Order }) => {
    const statusColor = getOrderStatusColor(item.status, item.deletedAt);
    const isOwner = item.customerId === user?.id;
    const canDelete = isOwner && (item.status === 'new' || item.status === 'active');
    const showTimer = item.status === 'new' && item.expiresAt;
    
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
        testID={`order-card-${item.id}`}
      >
        <Card style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <Text style={[styles.orderNumber, { color: colors.foreground }]}>
                #{item.id}
              </Text>
              {showTimer && (
                <CountdownTimer expiresAt={item.expiresAt!} language={language} />
              )}
            </View>
            <View style={styles.orderHeaderRight}>
              {item.photoUrls && item.photoUrls.length > 0 && (
                <Ionicons name="camera-outline" size={18} color={colors.mutedForeground} testID={`icon-photos-${item.id}`} />
              )}
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getOrderStatusName(item.status, language, item.deletedAt)}
                </Text>
              </View>
              {canDelete && (
                <TouchableOpacity 
                  onPress={() => handleDeleteOrder(item.id)}
                  style={styles.deleteButton}
                  testID={`button-delete-order-${item.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <Text style={[styles.orderTitle, { color: colors.foreground }]} numberOfLines={2}>
            {item.title}
          </Text>
          
          <Text style={[styles.orderRoute, { color: colors.mutedForeground }]} numberOfLines={1}>
            {getRouteDisplay(item)}
          </Text>
          
          {(item.isDangerous || item.isNonstandard || item.isPartialLoad) && (
            <View style={styles.flagsRow}>
              {item.isDangerous && (
                <View style={[styles.flagBadge, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="warning" size={12} color="#EF4444" />
                  <Text style={[styles.flagText, { color: '#EF4444' }]}>
                    {language === 'ru' ? 'Опасный' : 'Xavfli'}
                  </Text>
                </View>
              )}
              {item.isNonstandard && (
                <View style={[styles.flagBadge, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="resize" size={12} color="#8B5CF6" />
                  <Text style={[styles.flagText, { color: '#8B5CF6' }]}>
                    {language === 'ru' ? 'Негабарит' : 'Nostandart'}
                  </Text>
                </View>
              )}
              {item.isPartialLoad && (
                <View style={[styles.flagBadge, { backgroundColor: '#06B6D420' }]}>
                  <Ionicons name="cube-outline" size={12} color="#06B6D4" />
                  <Text style={[styles.flagText, { color: '#06B6D4' }]}>
                    {language === 'ru' ? 'Частичная' : 'Qisman'}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          <View style={styles.orderDetails}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Транспорт' : 'Transport'}
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>
                {getTransportTypeName(item.transportType, language)}
              </Text>
            </View>
            
            {item.weightTons && (
              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                  {language === 'ru' ? 'Вес' : 'Og\'irlik'}
                </Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {item.weightTons} {language === 'ru' ? 'т' : 't'}
                </Text>
              </View>
            )}
            
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                {language === 'ru' ? 'Дата' : 'Sana'}
              </Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>
                {formatDate(item.loadDate || item.loadingDate, language)}
              </Text>
            </View>
          </View>
          
          <View style={styles.orderFooter}>
            <Text style={[styles.orderPrice, { color: colors.primary }]}>
              {formatPrice(item.priceWithVat, language)}
            </Text>
            {((item.activeOffersCount ?? item.offersCount) ?? 0) > 0 && (
              <View style={[styles.offersBadge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.offersText, { color: colors.success }]}>
                  {item.activeOffersCount ?? item.offersCount} {language === 'ru' ? 'предл.' : 'taklif'}
                </Text>
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  }, [user?.id, language, colors, navigation, deleteOrderMutation]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
        {activeTab === 'available' 
          ? (language === 'ru' ? 'Нет доступных заказов' : 'Mavjud buyurtmalar yo\'q')
          : (language === 'ru' ? 'У вас нет заказов' : 'Sizda buyurtmalar yo\'q')
        }
      </Text>
      {activeTab === 'my' && (
        <Button 
          title={language === 'ru' ? 'Создать заказ' : 'Buyurtma yaratish'}
          onPress={() => navigation.navigate('CreateOrder')}
          style={{ marginTop: 16 }}
        />
      )}
    </View>
  );

  const isLoading = activeTab === 'available' ? loadingPublic : loadingMy;
  const isRefetching = activeTab === 'available' ? refetchingPublic : refetchingMy;
  const rawOrders = activeTab === 'available' ? publicOrders : myOrders;
  const orders = filterOrders(rawOrders);

  const activeFilterLabel = ORDER_STATUSES.find(s => s.value === statusFilter);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {language === 'ru' ? 'Заказы' : 'Buyurtmalar'}
        </Text>
        {activeTab === 'my' && (
          <TouchableOpacity 
            onPress={() => setShowFilterModal(true)}
            style={[styles.filterButton, { borderColor: colors.border }]}
            testID="button-filter"
          >
            <Ionicons name="filter" size={16} color={colors.primary} />
            <Text style={[styles.filterButtonText, { color: colors.primary }]}>
              {language === 'ru' ? activeFilterLabel?.labelRu : activeFilterLabel?.labelUz}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={[styles.tabContainer, { borderColor: colors.border }]}>
        {isCustomer && (
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'my' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('my')}
            testID="tab-my-orders"
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'my' ? colors.primary : colors.mutedForeground }
            ]}>
              {language === 'ru' ? 'Мои заказы' : 'Mening buyurtmalarim'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'available' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('available')}
          testID="tab-available-orders"
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'available' ? colors.primary : colors.mutedForeground }
          ]}>
            {language === 'ru' ? 'Доступные' : 'Mavjud'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {t.loading}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id || Math.random())}
          renderItem={renderOrderItem}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={isRefetching} 
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={10}
          initialNumToRender={8}
        />
      )}
      
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {language === 'ru' ? 'Фильтр по статусу' : 'Status bo\'yicha filtr'}
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.filterList}>
              {ORDER_STATUSES.map(status => (
                <TouchableOpacity
                  key={status.value}
                  style={[
                    styles.filterItem,
                    statusFilter === status.value && { backgroundColor: colors.primary + '10' }
                  ]}
                  onPress={() => {
                    setStatusFilter(status.value);
                    setShowFilterModal(false);
                  }}
                  testID={`filter-${status.value}`}
                >
                  <Text style={[
                    styles.filterItemText,
                    { color: statusFilter === status.value ? colors.primary : colors.foreground }
                  ]}>
                    {language === 'ru' ? status.labelRu : status.labelUz}
                  </Text>
                  {statusFilter === status.value && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  orderCard: {
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 4,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  orderRoute: {
    fontSize: 14,
    marginBottom: 8,
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 4,
  },
  flagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  orderDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailItem: {
    marginRight: 16,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  offersBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  offersText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterList: {
    padding: 8,
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  filterItemText: {
    fontSize: 16,
  },
});
