import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { trackEvent } from '../services/analytics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAnnouncements, type Announcement } from '../hooks/useAnnouncements';
import { getRegionName } from '../constants/regions';
import { localizeLoadingTime } from '../utils/loadingTimeUtils';
import { getTransportTypeLabel } from '../constants/data/transport-types';
import { uzbekistanRegions } from '../constants/data/uzbekistan-regions';
import { FilterModal, type FilterValues, EMPTY_FILTERS, countActiveFilters, migrateFilters } from '../components/FilterModal';
import { PushNotificationBanner } from '../components/PushNotificationBanner';
import { PushFilterIndicator } from '../components/PushFilterIndicator';
import { PhotoGallery } from '../components/PhotoGallery';
import { savePushFilters, registerPushTokenWithFilters } from '../hooks/usePushNotifications';

const FILTERS_STORAGE_KEY = '@cargoListFilters';

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatLoadDate(loadDate: string): string {
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(loadDate)) {
    return loadDate.replace(/\./g, '-');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(loadDate)) {
    const [year, month, day] = loadDate.split('-');
    return `${day}-${month}-${year}`;
  }
  return loadDate;
}

interface CargoListScreenProps {
  navigation: any;
}

const PAYMENT_LABELS: Record<string, { ru: string; uz: string }> = {
  cash: { ru: 'Наличные', uz: 'Naqd' },
  card: { ru: 'Карта', uz: 'Karta' },
  transfer: { ru: 'Перечисление', uz: 'O\'tkazma' },
};

export function CargoListScreen({ navigation }: CargoListScreenProps) {
  const route = useRoute();
  const hideTopInset = (route.params as any)?.hideTopInset === true;
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const colors = Colors.light;
  const ru = language === 'ru';

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY).then(saved => {
      if (saved) {
        try { setFilters(migrateFilters(JSON.parse(saved))); } catch {}
      }
      setFiltersLoaded(true);
    });
  }, []);

  const announcementFilters = filtersLoaded ? {
    originRegions: filters.originRegions.length > 0 ? filters.originRegions : undefined,
    destinationRegions: filters.destinationRegions.length > 0 ? filters.destinationRegions : undefined,
    transportTypes: filters.transportTypes.length > 0 ? filters.transportTypes : undefined,
    excludeBot: filters.excludeBot || undefined,
  } : undefined;

  const { data: announcements = [], isLoading, refetch, isRefetching } = useAnnouncements(filtersLoaded ? announcementFilters : undefined);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
    setFilterModalVisible(false);
    AsyncStorage.getItem('@pushEnabled').then(enabledRaw => {
      if (enabledRaw !== 'false') {
        savePushFilters(newFilters).catch(() => {});
        registerPushTokenWithFilters(newFilters).catch(() => {});
      }
    }).catch(() => {});
  };

  const activeFilterCount = countActiveFilters(filters);

  const texts = {
    title: ru ? 'Грузы' : 'Yuklar',
    noAnnouncements: ru ? 'Нет активных грузов' : 'Faol yuklar yo\'q',
    noAnnouncementsDesc: ru ? 'Попробуйте изменить фильтры или проверьте позже' : 'Filtrlarni o\'zgartiring yoki keyinroq tekshiring',
    vehicleCount: ru ? 'Кол-во машин' : 'Mashinalar',
    weightTons: ru ? 'Вес' : 'Og\'irlik',
    loadDate: ru ? 'Дата загрузки' : 'Yuklash sanasi',
    loadingTime: ru ? 'Время загрузки' : 'Yuklash vaqti',
    paymentMethod: ru ? 'Оплата' : 'To\'lov',
    notes: ru ? 'Примечания' : 'Izohlar',
    customer: ru ? 'Заказчик' : 'Mijoz',
    tons: ru ? 'т' : 't',
    callError: ru ? 'Не удалось открыть звонок' : 'Qo\'ng\'iroqni ochib bo\'lmadi',
    filter: ru ? 'Фильтр' : 'Filtr',
    resetFilters: ru ? 'Сбросить фильтры' : 'Filtrlarni tozalash',
    count: (n: number) => ru ? `Объявлений: ${n}` : `E\'lonlar: ${n}`,
  };

  const getDistrictName = (region: string, district: string) => {
    const r = uzbekistanRegions.find(r => r.name === region);
    const d = r?.districts.find(d => d.name === district);
    return d ? (ru ? d.nameRu : d.nameUz) : '';
  };

  const getPaymentLabel = (value: string) =>
    PAYMENT_LABELS[value] ? (ru ? PAYMENT_LABELS[value].ru : PAYMENT_LABELS[value].uz) : value;

  const handleCall = (phone: string, announcementId: number) => {
    trackEvent('call_announcement', 'CargoListScreen', { announcementId });
    const url = `tel:${phone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('', texts.callError);
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => {
      if (prev !== id) trackEvent('open_announcement', 'CargoListScreen', { announcementId: id });
      return prev === id ? null : id;
    });
  };

  const renderAnnouncement = ({ item }: { item: Announcement }) => {
    const isExpanded = expandedId === item.id;

    const originName = item.originRegion ? getRegionName(item.originRegion, language) : '';
    const destName = item.destinationRegion ? getRegionName(item.destinationRegion, language) : '';
    const originDistrictName = item.originDistrict ? getDistrictName(item.originRegion, item.originDistrict) : '';
    const destDistrictName = item.destinationDistrict ? getDistrictName(item.destinationRegion, item.destinationDistrict) : '';

    const routeFrom = originName ? `${originName}${originDistrictName ? `, ${originDistrictName}` : ''}` : (ru ? 'Не указано' : 'Ko\'rsatilmagan');
    const routeTo = destName ? `${destName}${destDistrictName ? `, ${destDistrictName}` : ''}` : (ru ? 'Не указано' : 'Ko\'rsatilmagan');

    const transportLabel = item.transportType ? getTransportTypeLabel(item.transportType, language) : '-';

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => toggleExpand(item.id)} testID={`card-announcement-${item.id}`}>
        <Card style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={[styles.cardNum, { color: colors.primary }]}>#{item.id}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>{item.title}</Text>
                {item.photoUrls && item.photoUrls.length > 0 && (
                  <Ionicons name="camera-outline" size={17} color={colors.mutedForeground} style={{ marginRight: 4 }} testID={`icon-photos-${item.id}`} />
                )}
                {item.createdByBot && (
                  <View style={[styles.botBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.botBadgeText}>{ru ? 'Бот' : 'Bot'}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{formatCreatedAt(item.createdAt)}</Text>
            </View>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {routeFrom} → {routeTo}
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="car-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>{transportLabel}</Text>
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {Number(item.price) > 0 ? `${Number(item.price).toLocaleString()} UZS` : (ru ? 'Договорная' : 'Kelishiladi')}
            </Text>
          </View>

          {item.loadDate ? (
            <View style={styles.detailsRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>{formatLoadDate(item.loadDate)}</Text>
            </View>
          ) : null}

          {isExpanded && (
            <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>

              {item.vehicleCount && item.vehicleCount > 0 ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="layers-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.vehicleCount}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{item.vehicleCount}</Text>
                </View>
              ) : null}

              <View style={styles.detailsRow}>
                <Ionicons name="cube-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.weightTons}:</Text>
                <Text style={[styles.expandedValue, { color: colors.foreground }]}>
                  {Number(item.weightTons) > 0 ? `${item.weightTons} ${texts.tons}` : (ru ? 'Не указан' : "Ko'rsatilmagan")}
                </Text>
              </View>

              {item.loadingTime ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.loadingTime}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{localizeLoadingTime(item.loadingTime, language)}</Text>
                </View>
              ) : null}

              {item.paymentTypes && item.paymentTypes.length > 0 ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="card-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.paymentMethod}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{item.paymentTypes.map(getPaymentLabel).join(', ')}</Text>
                </View>
              ) : null}

              {item.notes ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.notes}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground, flex: 1 }]}>{item.notes}</Text>
                </View>
              ) : null}

              {item.photoUrls && item.photoUrls.length > 0 && (
                <PhotoGallery photoUrls={item.photoUrls} language={language} />
              )}

              <View style={[styles.separator, { backgroundColor: colors.border }]} />

              <TouchableOpacity style={styles.detailsRow} onPress={() => handleCall(item.contactPhone, item.id)} testID={`button-call-${item.id}`} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={16} color={colors.primary} />
                <Text style={[styles.detailText, styles.phoneText, { color: colors.primary }]}>{item.contactPhone}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>

              {(item.customerName || item.createdByBot) ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="person-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.detailText, { color: colors.foreground }]}>
                    {item.createdByBot ? 'Telegram' : item.customerName}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={hideTopInset ? ['bottom', 'left', 'right'] : undefined} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>{texts.title}</Text>
        <TouchableOpacity
          style={[styles.filterHeaderBtn, activeFilterCount > 0 && { backgroundColor: 'rgba(255,255,255,0.25)' }]}
          onPress={() => setFilterModalVisible(true)}
          testID="button-filter-announcements"
        >
          <Ionicons name="options-outline" size={22} color="white" />
          <Text style={styles.filterHeaderBtnText}>{texts.filter}</Text>
          {activeFilterCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <PushNotificationBanner hasActiveFilters={activeFilterCount > 0} />

      <PushFilterIndicator
        listFilters={{
          originRegions: filters.originRegions,
          destinationRegions: filters.destinationRegions,
          transportTypes: filters.transportTypes,
          excludeBot: filters.excludeBot || false,
        }}
        onPress={() => navigation.navigate('PushNotificationSettings')}
      />

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAnnouncement}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListHeaderComponent={announcements.length > 0 ? (
            <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
              {texts.count(announcements.length)}
            </Text>
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noAnnouncements}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noAnnouncementsDesc}</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={() => handleApplyFilters(EMPTY_FILTERS)} style={styles.clearFiltersBtn}>
                  <Text style={{ color: colors.primary, fontWeight: '500' }}>{texts.resetFilters}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        initialValues={filters}
        showExcludeBot
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 15, fontWeight: '600', color: 'white' },
  filterHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 6,
    position: 'relative',
  },
  filterHeaderBtnText: { fontSize: 11, fontWeight: '600', color: 'white' },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: { fontSize: 10, fontWeight: '700', color: '#1976D2' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  countLabel: { fontSize: 13, marginBottom: 8 },
  card: { marginBottom: 12, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  cardNum: { fontSize: 12, fontWeight: '700', marginTop: 2, marginRight: 2, minWidth: 28 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardDate: { fontSize: 12 },
  botBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 1 },
  botBadgeText: { fontSize: 10, fontWeight: '700', color: 'white' },
  detailsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  detailText: { fontSize: 14, flex: 1 },
  phoneText: { fontWeight: '500', textDecorationLine: 'underline' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  expandedLabel: { fontSize: 13, minWidth: 90 },
  expandedValue: { fontSize: 13 },
  separator: { height: 1, marginVertical: 8 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  clearFiltersBtn: { marginTop: 16, padding: 8 },
});
