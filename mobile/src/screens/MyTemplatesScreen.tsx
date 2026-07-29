import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAnnouncementTemplates, useDeleteAnnouncementTemplate, type AnnouncementTemplate } from '../hooks/useAnnouncements';
import { getRegionName } from '../constants/regions';
import { getTransportTypeLabel } from '../constants/data/transport-types';

interface MyTemplatesScreenProps {
  navigation: any;
}

export function MyTemplatesScreen({ navigation }: MyTemplatesScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const insets = useSafeAreaInsets();
  const ru = language === 'ru';

  const { data: templates = [], isLoading, refetch, isRefetching } = useAnnouncementTemplates();
  const deleteMutation = useDeleteAnnouncementTemplate();

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const texts = {
    title: ru ? 'Шаблоны объявлений' : 'E\'lon shablonlari',
    noTemplates: ru ? 'У вас нет шаблонов' : 'Sizda shablonlar yo\'q',
    noTemplatesDesc: ru ? 'Сохраняйте шаблоны при создании объявлений' : 'E\'lon yaratishda shablonlarni saqlang',
    deleteConfirm: ru ? 'Удалить шаблон?' : 'Shablonni o\'chirish?',
    deleteDesc: ru ? 'Это действие нельзя отменить.' : 'Bu amalni bekor qilib bo\'lmaydi.',
    delete: ru ? 'Удалить' : 'O\'chirish',
    cancel: ru ? 'Отмена' : 'Bekor qilish',
    create: ru ? 'Создать объявление' : 'E\'lon yaratish',
    price: ru ? 'Цена' : 'Narx',
    weight: ru ? 'Вес' : 'Og\'irlik',
    tons: ru ? 'т' : 't',
    vehicles: ru ? 'машин' : 'mashina',
    payment: ru ? 'Оплата' : 'To\'lov',
  };

  const PAYMENT_LABELS: Record<string, { ru: string; uz: string }> = {
    cash: { ru: 'Наличные', uz: 'Naqd' },
    card: { ru: 'Карта', uz: 'Karta' },
    transfer: { ru: 'Перечисление', uz: "O'tkazma" },
  };

  const getPaymentLabel = (v: string) =>
    PAYMENT_LABELS[v] ? (ru ? PAYMENT_LABELS[v].ru : PAYMENT_LABELS[v].uz) : v;

  const handleDelete = (id: number) => {
    Alert.alert(texts.deleteConfirm, texts.deleteDesc, [
      { text: texts.cancel, style: 'cancel' },
      {
        text: texts.delete, style: 'destructive',
        onPress: async () => {
          try { await deleteMutation.mutateAsync(id); }
          catch (error: any) { Alert.alert(ru ? 'Ошибка' : 'Xato', error.message); }
        }
      },
    ]);
  };

  const handleCreateFromTemplate = (item: AnnouncementTemplate) => {
    navigation.navigate('MyAnnouncements', { template: item });
  };

  const renderTemplate = ({ item }: { item: AnnouncementTemplate }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.primary }]}>{item.name}</Text>
          {item.title ? (
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)} testID={`button-delete-template-${item.id}`} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      {(item.originRegion || item.destinationRegion) ? (
        <View style={styles.detailsRow}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {item.originRegion ? getRegionName(item.originRegion, language) : '—'}
            {' → '}
            {item.destinationRegion ? getRegionName(item.destinationRegion, language) : '—'}
          </Text>
        </View>
      ) : null}

      {item.transportType ? (
        <View style={styles.detailsRow}>
          <Ionicons name="car-outline" size={16} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>{getTransportTypeLabel(item.transportType, language)}</Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        {item.vehicleCount ? (
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.vehicleCount} {texts.vehicles}</Text>
          </View>
        ) : null}
        {item.weightTons ? (
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.weightTons} {texts.tons}</Text>
          </View>
        ) : null}
        {item.price ? (
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{Number(item.price).toLocaleString()} UZS</Text>
          </View>
        ) : null}
      </View>

      {item.paymentTypes && item.paymentTypes.length > 0 ? (
        <View style={styles.detailsRow}>
          <Ionicons name="card-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{item.paymentTypes.map(getPaymentLabel).join(', ')}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={() => handleCreateFromTemplate(item)}
        testID={`button-create-from-template-${item.id}`}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle-outline" size={16} color="white" />
        <Text style={styles.createButtonText}>{texts.create}</Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{texts.title}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTemplate}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="copy-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noTemplates}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noTemplatesDesc}</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  cardName: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '500' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 14, flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 10 },
  createButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
