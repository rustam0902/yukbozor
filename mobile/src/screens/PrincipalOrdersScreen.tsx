import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getRegionName, getTransportTypeName, formatDate } from '../constants/regions';

interface PrincipalOrder {
  id: number;
  title: string;
  originRegion: string;
  destinationRegion: string;
  transportType: string;
  weightTons: number;
  priceWithVat: number;
  status: string;
  loadingDate?: string;
  createdAt: string;
  customerName?: string;
}

interface PrincipalOrdersScreenProps {
  navigation: any;
}

export function PrincipalOrdersScreen({ navigation }: PrincipalOrdersScreenProps) {
  const { language } = useLanguage();
  const { activePrincipal } = useAuth();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<PrincipalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const texts = {
    title: language === 'ru' ? 'Заказы доверителей' : 'Ishonch beruvchi buyurtmalari',
    noOrders: language === 'ru' ? 'Нет заказов' : 'Buyurtmalar yo\'q',
    noOrdersDesc: language === 'ru'
      ? 'Заказы выбранного доверителя появятся здесь'
      : 'Tanlangan ishonch beruvchi buyurtmalari bu yerda paydo bo\'ladi',
    noPrincipal: language === 'ru' ? 'Выберите доверителя' : 'Ishonch beruvchini tanlang',
    noPrincipalDesc: language === 'ru'
      ? 'Перейдите в "Доверители" и выберите организацию для работы'
      : '"Ishonch beruvchilar" bo\'limiga o\'ting va ishlash uchun tashkilotni tanlang',
    weight: language === 'ru' ? 'Вес' : 'Og\'irlik',
    tons: language === 'ru' ? 'т' : 't',
  };

  const statusLabels: Record<string, string> = {
    new: language === 'ru' ? 'Новый' : 'Yangi',
    active: language === 'ru' ? 'Активный' : 'Faol',
    completed: language === 'ru' ? 'Завершён' : 'Tugallangan',
    cancelled: language === 'ru' ? 'Отменён' : 'Bekor qilingan',
  };

  const statusColors: Record<string, string> = {
    new: '#3b82f6',
    active: '#10b981',
    completed: '#6b7280',
    cancelled: '#ef4444',
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/representatives/principal-orders', {
        headers: activePrincipal ? { 'x-representative-customer-id': String(activePrincipal.customerId) } : {},
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching principal orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activePrincipal) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [activePrincipal]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, []);

  const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price);

  const renderOrder = ({ item }: { item: PrincipalOrder }) => {
    const statusColor = statusColors[item.status] || '#6b7280';
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt, language)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabels[item.status] || item.status}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {getRegionName(item.originRegion, language)} → {getRegionName(item.destinationRegion, language)}
          </Text>
        </View>
        <View style={styles.detailsRow}>
          <Ionicons name="car-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>{getTransportTypeName(item.transportType, language)}</Text>
        </View>
        <View style={styles.detailsRow}>
          <Ionicons name="cube-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>{texts.weight}: {item.weightTons} {texts.tons}</Text>
        </View>
        <View style={styles.detailsRow}>
          <Ionicons name="cash-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>{formatPrice(item.priceWithVat)} UZS</Text>
        </View>
      </Card>
    );
  };

  if (!activePrincipal) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>{texts.title}</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noPrincipal}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noPrincipalDesc}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{texts.title}</Text>
      </View>

      {activePrincipal && (
        <View style={[styles.principalBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Ionicons name="business" size={18} color={colors.primary} />
          <Text style={[styles.principalName, { color: colors.primary }]}>{activePrincipal.customerName}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrder}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noOrders}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noOrdersDesc}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white' },
  principalBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  principalName: { fontSize: 14, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '500' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 14, flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
