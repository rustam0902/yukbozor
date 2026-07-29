import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatDate } from '../constants/regions';

interface PrincipalContract {
  id: number;
  status: string;
  customerName?: string;
  carrierName?: string;
  offerPrice?: number;
  createdAt: string;
  order?: {
    title?: string;
    originRegion?: string;
    destinationRegion?: string;
  };
}

interface PrincipalContractsScreenProps {
  navigation: any;
}

export function PrincipalContractsScreen({ navigation }: PrincipalContractsScreenProps) {
  const { language } = useLanguage();
  const { activePrincipal } = useAuth();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [contracts, setContracts] = useState<PrincipalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const texts = {
    title: language === 'ru' ? 'Договоры доверителей' : 'Ishonch beruvchi shartnomalari',
    noContracts: language === 'ru' ? 'Нет договоров' : 'Shartnomalar yo\'q',
    noContractsDesc: language === 'ru'
      ? 'Договоры выбранного доверителя появятся здесь'
      : 'Tanlangan ishonch beruvchi shartnomalari bu yerda paydo bo\'ladi',
    noPrincipal: language === 'ru' ? 'Выберите доверителя' : 'Ishonch beruvchini tanlang',
    noPrincipalDesc: language === 'ru'
      ? 'Перейдите в "Доверители" и выберите организацию для работы'
      : '"Ishonch beruvchilar" bo\'limiga o\'ting va ishlash uchun tashkilotni tanlang',
    contract: language === 'ru' ? 'Договор' : 'Shartnoma',
    carrier: language === 'ru' ? 'Перевозчик' : 'Tashuvchi',
  };

  const statusLabels: Record<string, string> = {
    pending: language === 'ru' ? 'Ожидает' : 'Kutilmoqda',
    awaiting_prepayment: language === 'ru' ? 'Ожидает предоплату' : 'Oldindan to\'lov kutilmoqda',
    fully_signed: language === 'ru' ? 'Подписан' : 'Imzolangan',
    in_progress: language === 'ru' ? 'В работе' : 'Jarayonda',
    completed: language === 'ru' ? 'Завершён' : 'Tugallangan',
    cancelled: language === 'ru' ? 'Отменён' : 'Bekor qilingan',
    terminated: language === 'ru' ? 'Расторгнут' : 'Bekor qilingan',
  };

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    awaiting_prepayment: '#f59e0b',
    fully_signed: '#10b981',
    in_progress: '#3b82f6',
    completed: '#6b7280',
    cancelled: '#ef4444',
    terminated: '#ef4444',
  };

  const fetchContracts = async () => {
    try {
      const response = await api.get('/api/representatives/principal-contracts', {
        headers: activePrincipal ? { 'x-representative-customer-id': String(activePrincipal.customerId) } : {},
      });
      setContracts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching principal contracts:', error);
      setContracts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activePrincipal) {
      fetchContracts();
    } else {
      setLoading(false);
    }
  }, [activePrincipal]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContracts();
  }, []);

  const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price);

  const renderContract = ({ item }: { item: PrincipalContract }) => {
    const statusColor = statusColors[item.status] || '#6b7280';
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {texts.contract} #{item.id}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabels[item.status] || item.status}</Text>
          </View>
        </View>

        {item.order?.title && (
          <Text style={[styles.orderTitle, { color: colors.foreground }]} numberOfLines={2}>{item.order.title}</Text>
        )}

        {item.carrierName && (
          <View style={styles.detailsRow}>
            <Ionicons name="person-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>{texts.carrier}: {item.carrierName}</Text>
          </View>
        )}

        {item.offerPrice && (
          <View style={styles.detailsRow}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>{formatPrice(item.offerPrice)} UZS</Text>
          </View>
        )}

        <View style={styles.detailsRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{formatDate(item.createdAt, language)}</Text>
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
          data={contracts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderContract}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noContracts}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noContractsDesc}</Text>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  orderTitle: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '500' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 14, flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
