import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { FilterModal, type FilterValues, EMPTY_FILTERS, countActiveFilters, migrateFilters } from '../components/FilterModal';
import { getTransportTypeLabel } from '../constants/data/transport-types';
import { getRegionName } from '../constants/regions';

const FILTERS_STORAGE_KEY = '@publicOrdersFilters';

interface PublicOrdersScreenProps {
  navigation: any;
}

interface Order {
  id: number;
  loadDate: string;
  transportType: string;
  weightTons: string;
  priceWithVat: string;
  originRegion: string;
  destinationRegion: string;
}

export function PublicOrdersScreen({ navigation }: PublicOrdersScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY).then(saved => {
      let f = EMPTY_FILTERS;
      if (saved) {
        try { f = migrateFilters(JSON.parse(saved)); } catch {}
      }
      setFilters(f);
      loadOrders(f);
    });
  }, []);

  const applyClientFilters = (data: Order[], f: FilterValues): Order[] => {
    let result = data;
    if (f.originRegions.length > 0) {
      result = result.filter(o => f.originRegions.includes(o.originRegion));
    }
    if (f.destinationRegions.length > 0) {
      result = result.filter(o => f.destinationRegions.includes(o.destinationRegion));
    }
    if (f.transportTypes.length > 0) {
      result = result.filter(o => f.transportTypes.includes(o.transportType));
    }
    return result;
  };

  const loadOrders = async (f: FilterValues) => {
    try {
      setError('');
      if (!initialLoadDone.current) setLoading(true);
      const response = await api.get('/api/orders/public/new');
      const data = Array.isArray(response.data) ? response.data : [];
      setOrders(applyClientFilters(data, f));
    } catch (err: any) {
      setError(ru ? 'Ошибка загрузки заказов' : 'Buyurtmalarni yuklashda xato');
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoadDone.current = true;
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders(filters);
  };

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
    setFilterModalVisible(false);
    setLoading(true);
    loadOrders(newFilters);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ru ? 'Не указано' : 'Ko\'rsatilmagan';
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) return `${day}.${month}.${year}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatWeight = (w: string) => {
    const n = Number(w);
    if (isNaN(n)) return '-';
    return `${n % 1 === 0 ? n : n.toFixed(1)} ${ru ? 'т' : 't'}`;
  };

  const formatPrice = (p: string) => {
    const n = Number(p);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('ru-RU').format(n) + ' UZS';
  };

  const getRoute = (order: Order) => {
    const from = order.originRegion ? getRegionName(order.originRegion, language) : (ru ? 'Не указано' : 'Ko\'rsatilmagan');
    const to = order.destinationRegion ? getRegionName(order.destinationRegion, language) : (ru ? 'Не указано' : 'Ko\'rsatilmagan');
    return `${from} → ${to}`;
  };

  const activeFilterCount = countActiveFilters(filters);

  const renderOrderItem = ({ item }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={[styles.orderId, { color: colors.primary }]}>#{item.id}</Text>
        <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
          {formatDate(item.loadDate)}
        </Text>
      </View>

      <View style={styles.routeContainer}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={2}>
          {getRoute(item)}
        </Text>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="car-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
            {getTransportTypeLabel(item.transportType, language)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="cube-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
            {formatWeight(item.weightTons)}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
          {ru ? 'Цена:' : 'Narx:'}
        </Text>
        <Text style={[styles.priceValue, { color: colors.foreground }]}>
          {formatPrice(item.priceWithVat)}
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {ru ? `Заказов: ${orders.length}` : `Buyurtmalar: ${orders.length}`}
        </Text>
        <TouchableOpacity
          style={[styles.filterBtn, { borderColor: activeFilterCount > 0 ? colors.primary : colors.border }]}
          onPress={() => setFilterModalVisible(true)}
          testID="button-filter-orders"
        >
          <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.filterBtnText, { color: activeFilterCount > 0 ? colors.primary : colors.mutedForeground }]}>
            {ru ? 'Фильтр' : 'Filtr'}
          </Text>
          {activeFilterCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Button title={ru ? 'Повторить' : 'Qayta urinish'} onPress={() => loadOrders(filters)} style={styles.retryButton} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {ru ? 'Нет доступных заказов' : 'Mavjud buyurtmalar yo\'q'}
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={() => handleApplyFilters(EMPTY_FILTERS)} style={styles.clearFiltersBtn}>
              <Text style={{ color: colors.primary }}>
                {ru ? 'Сбросить фильтры' : 'Filtrlarni tozalash'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
        />
      )}

      <View style={[styles.loginHint, { borderTopColor: colors.border }]}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.mutedForeground} />
        <Text style={[styles.loginHintText, { color: colors.mutedForeground }]}>
          {ru ? 'Войдите, чтобы откликнуться на заказ' : 'Taklifni yuborish uchun tizimga kiring'}
        </Text>
      </View>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        initialValues={filters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  resultCount: { fontSize: 13 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterBtnText: { fontSize: 14, fontWeight: '500' },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: { fontSize: 16, marginBottom: 16, textAlign: 'center' },
  retryButton: { minWidth: 120 },
  emptyText: { fontSize: 16, marginTop: 16, textAlign: 'center' },
  clearFiltersBtn: { marginTop: 12, padding: 8 },
  listContent: { padding: 16, paddingBottom: 8 },
  orderCard: { padding: 16, marginBottom: 12 },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: { fontSize: 13, fontWeight: '700' },
  orderDate: { fontSize: 14 },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  routeText: { fontSize: 15, flex: 1, lineHeight: 22 },
  orderDetails: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 13 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 17, fontWeight: '700' },
  loginHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderTopWidth: 1,
    justifyContent: 'center',
  },
  loginHintText: { fontSize: 13 },
});
