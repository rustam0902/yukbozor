import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useMyOrders, useDeleteOrder } from '../hooks/useOrders';
import { useNotifications } from '../hooks/useNotifications';
import { formatPrice, formatDate, getOrderStatusName, getOrderStatusColor, getRegionName } from '../constants/regions';

interface CustomerHomeScreenProps {
  navigation: any;
}

type FilterTab = 'new' | 'all';

export function CustomerHomeScreen({ navigation }: CustomerHomeScreenProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  const ru = language === 'ru';

  const [activeTab, setActiveTab] = useState<FilterTab>('new');

  const {
    data: myOrders = [],
    isLoading: loadingOrders,
    refetch: refetchOrders,
    isRefetching
  } = useMyOrders();

  const { data: notificationsData } = useNotifications();
  const unreadCount = notificationsData?.unreadCount || 0;
  const deleteOrderMutation = useDeleteOrder();

  const onRefresh = useCallback(() => { refetchOrders(); }, [refetchOrders]);

  const handleDeleteOrder = (orderId: number) => {
    Alert.alert(
      ru ? 'Удалить заказ?' : 'Buyurtmani o\'chirish?',
      ru ? 'Это действие нельзя отменить.' : 'Bu amalni bekor qilib bo\'lmaydi.',
      [
        { text: ru ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
        {
          text: ru ? 'Удалить' : 'O\'chirish',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrderMutation.mutateAsync(orderId);
            } catch (error: any) {
              Alert.alert(
                ru ? 'Ошибка' : 'Xato',
                error.message || (ru ? 'Не удалось удалить заказ' : 'Buyurtmani o\'chirib bo\'lmadi')
              );
            }
          },
        },
      ]
    );
  };

  const activeOrders = myOrders.filter(o => o.status === 'new' || o.status === 'assigned');
  const pendingOrders = myOrders.filter(o => o.status === 'assigned');

  const filteredOrders = activeTab === 'new'
    ? myOrders.filter(o => o.status === 'new' && !o.deletedAt)
    : myOrders;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {ru ? 'Добро пожаловать,' : 'Xush kelibsiz,'}
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
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
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
        <View style={styles.statsRow}>
          <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: colors.primary }])}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{activeOrders.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {ru ? 'Активных' : 'Faol'}
            </Text>
          </Card>
          <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: colors.warning }])}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{pendingOrders.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {ru ? 'В процессе' : 'Jarayonda'}
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {ru ? 'Мои заказы' : 'Mening buyurtmalarim'}
          </Text>

          <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'new' && { backgroundColor: colors.primary }]}
              onPress={() => setActiveTab('new')}
              testID="tab-new-orders"
            >
              <Text style={[styles.tabBtnText, { color: activeTab === 'new' ? '#fff' : colors.mutedForeground }]}>
                {ru ? 'Новые' : 'Yangi'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && { backgroundColor: colors.primary }]}
              onPress={() => setActiveTab('all')}
              testID="tab-all-orders"
            >
              <Text style={[styles.tabBtnText, { color: activeTab === 'all' ? '#fff' : colors.mutedForeground }]}>
                {ru ? 'Все' : 'Barchasi'}
              </Text>
            </TouchableOpacity>
          </View>

          {loadingOrders ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : filteredOrders.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === 'new'
                  ? (ru ? 'Нет новых заказов' : 'Yangi buyurtmalar yo\'q')
                  : (ru ? 'У вас пока нет заказов' : 'Sizda hali buyurtmalar yo\'q')}
              </Text>
            </Card>
          ) : (
            filteredOrders.map((order) => {
              const statusColor = getOrderStatusColor(order.status, order.deletedAt);
              const isDeleted = !!order.deletedAt;
              const canEdit = !isDeleted && order.status === 'new';
              const canDelete = !isDeleted && (order.status === 'new' || order.status === 'assigned');
              const offerCount = order.activeOffersCount ?? order.offersCount ?? 0;
              const hasOffers = offerCount > 0;
              return (
                <TouchableOpacity
                  key={order.id}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                  testID={`card-order-${order.id}`}
                >
                  <Card style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={[styles.orderId, { color: colors.foreground }]}>
                        #{order.id}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {getOrderStatusName(order.status, language, order.deletedAt)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.orderRoute}>
                      <View style={styles.routePoint}>
                        <Ionicons name="location" size={16} color={colors.primary} />
                        <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                          {getRegionName(order.originRegion, language)}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.mutedForeground} />
                      <View style={styles.routePoint}>
                        <Ionicons name="location" size={16} color={colors.success} />
                        <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                          {getRegionName(order.destinationRegion, language)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.orderFooter}>
                      <Text style={[styles.orderPrice, { color: colors.primary }]}>
                        {formatPrice(order.priceWithVat, language)}
                      </Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.orderDateLabel, { color: colors.mutedForeground }]}>
                          {ru ? 'Дата загрузки' : 'Yuklash sanasi'}
                        </Text>
                        <Text style={[styles.orderDate, { color: colors.foreground }]}>
                          {formatDate(order.loadDate || order.loadingDate, language)}
                        </Text>
                      </View>
                    </View>
                    {/* Action buttons */}
                    <View style={styles.orderActions}>
                      {hasOffers && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                          onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                          testID={`button-view-offers-${order.id}`}
                        >
                          <Ionicons name="list" size={14} color={colors.primary} />
                          <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                            {ru ? `Предложения (${offerCount})` : `Takliflar (${offerCount})`}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {!hasOffers && !isDeleted && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.mutedForeground + '15' }]}
                          onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                          testID={`button-view-offers-empty-${order.id}`}
                        >
                          <Ionicons name="list-outline" size={14} color={colors.mutedForeground} />
                          <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
                            {ru ? 'Предложений нет' : 'Takliflar yo\'q'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <View style={styles.actionBtnRight}>
                        {canEdit && (
                          <TouchableOpacity
                            style={[styles.actionIconBtn, { backgroundColor: colors.primary + '15' }]}
                            onPress={() => navigation.navigate('CreateOrder', { orderId: order.id, editMode: true })}
                            testID={`button-edit-order-${order.id}`}
                          >
                            <Ionicons name="pencil" size={15} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        {canDelete && (
                          <TouchableOpacity
                            style={[styles.actionIconBtn, { backgroundColor: '#EF444415' }]}
                            onPress={() => handleDeleteOrder(order.id)}
                            testID={`button-delete-order-${order.id}`}
                          >
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.fabSpacer} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CreateOrder')}
        testID="button-create-order-fab"
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  greeting: { fontSize: 14 },
  userName: { fontSize: 20, fontWeight: 'bold' },
  notificationButton: { position: 'relative', padding: 8 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 0, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16, borderLeftWidth: 4 },
  statValue: { fontSize: 28, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  tabBtnText: { fontSize: 14, fontWeight: '600' },
  loader: { marginVertical: 40 },
  emptyCard: { padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  orderCard: { padding: 16, marginBottom: 12 },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: { fontSize: 16, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '500' },
  orderRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeText: { fontSize: 14, flex: 1 },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderPrice: { fontSize: 16, fontWeight: '600' },
  orderDateLabel: { fontSize: 10, marginBottom: 2 },
  orderDate: { fontSize: 12 },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flex: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '500' },
  actionBtnRight: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto' as any,
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSpacer: { height: 20 },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
});
