import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { uzbekistanRegions } from '../constants/data/uzbekistan-regions';
import { transportTypes as transportTypeData } from '../constants/data/transport-types';
import { savePushFilters, registerPushTokenWithFilters } from '../hooks/usePushNotifications';
import { api } from '../services/api';

const PUSH_TOKEN_KEY = '@pushToken';
const PUSH_ENABLED_KEY = '@pushEnabled';
const CARGO_FILTERS_KEY = '@cargoListFilters';

interface CargoFilters {
  originRegions: string[];
  destinationRegions: string[];
  transportTypes: string[];
  excludeBot: boolean;
}

interface Props {
  navigation: any;
}

export function PushNotificationSettingsScreen({ navigation }: Props) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';

  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [cargoFilters, setCargoFilters] = useState<CargoFilters>({
    originRegions: [],
    destinationRegions: [],
    transportTypes: [],
    excludeBot: false,
  });

  const t = {
    title: ru ? 'Push-уведомления' : 'Push-bildirishnomalar',
    enableAll: ru ? 'Получать уведомления' : 'Bildirishnomalar qabul qilish',
    enableAllDesc: ru
      ? 'Включить или отключить push-уведомления о новых грузах'
      : 'Yangi yuklar haqida push-bildirishnomalarni yoqish yoki o\'chirish',
    filtersTitle: ru ? 'Активные фильтры уведомлений' : 'Faol bildirishnoma filtrlari',
    filtersHint: ru
      ? 'Фильтры берутся из фильтра списка грузов. Чтобы изменить — настройте фильтр на экране «Грузы».'
      : 'Filtrlar yuklar ro\'yxatining filtridan olinadi. O\'zgartirish uchun «Yuklar» ekranida filtrlang.',
    noFilters: ru ? 'Нет активных фильтров — получаете все объявления' : 'Faol filtrlar yo\'q — barcha e\'lonlar qabul qilinadi',
    disabledNote: ru
      ? 'Уведомления отключены. Включите переключатель выше, чтобы получать уведомления о новых грузах.'
      : 'Bildirishnomalar o\'chirilgan. Yangi yuklar haqida bildirishnomalar olish uchun yuqoridagi tugmani yoqing.',
    originPrefix: ru ? 'Из:' : 'Dan:',
    destPrefix: ru ? 'В:' : 'Ga:',
    excludeBotLabel: ru ? 'Без Telegram-объявлений' : 'Telegram e\'lonlarisiz',
  };

  const regionOptions = uzbekistanRegions.map(r => ({
    value: r.name,
    label: ru ? r.nameRu : r.nameUz,
  }));

  const transportOptions = transportTypeData.map(tp => ({
    value: tp.value,
    label: ru ? tp.labelRu : tp.labelUz,
  }));

  const loadSettings = useCallback(async () => {
    try {
      const [enabledRaw, cargoRaw] = await Promise.all([
        AsyncStorage.getItem(PUSH_ENABLED_KEY),
        AsyncStorage.getItem(CARGO_FILTERS_KEY),
      ]);
      setPushEnabled(enabledRaw !== 'false');
      if (cargoRaw) {
        const parsed = JSON.parse(cargoRaw);
        setCargoFilters({
          originRegions: Array.isArray(parsed.originRegions) ? parsed.originRegions : [],
          destinationRegions: Array.isArray(parsed.destinationRegions) ? parsed.destinationRegions : [],
          transportTypes: Array.isArray(parsed.transportTypes) ? parsed.transportTypes : [],
          excludeBot: parsed.excludeBot === true,
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleEnabled = async (val: boolean) => {
    setToggling(true);
    setPushEnabled(val);
    try {
      await AsyncStorage.setItem(PUSH_ENABLED_KEY, val ? 'true' : 'false');
      if (!val) {
        const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (token) {
          await api.delete('/api/push/unregister', { data: { expoToken: token } });
        }
      } else {
        await savePushFilters(cargoFilters);
        await registerPushTokenWithFilters(cargoFilters);
      }
    } catch {}
    setToggling(false);
  };

  const activeFilterCount =
    cargoFilters.originRegions.length +
    cargoFilters.destinationRegions.length +
    cargoFilters.transportTypes.length +
    (cargoFilters.excludeBot ? 1 : 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          testID="button-push-settings-back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t.enableAll}</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{t.enableAllDesc}</Text>
            </View>
            {toggling ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={pushEnabled}
                onValueChange={handleToggleEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="white"
                testID="switch-push-enabled"
              />
            )}
          </View>
        </View>

        <View style={[styles.filtersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.filtersTitleRow}>
            <Ionicons
              name={activeFilterCount > 0 ? 'funnel' : 'funnel-outline'}
              size={16}
              color={activeFilterCount > 0 ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.filtersTitle, { color: activeFilterCount > 0 ? colors.foreground : colors.mutedForeground }]}>
              {t.filtersTitle}
            </Text>
          </View>

          {activeFilterCount === 0 ? (
            <Text style={[styles.noFiltersText, { color: colors.mutedForeground }]} testID="text-push-no-filters">
              {t.noFilters}
            </Text>
          ) : (
            <View style={styles.chipWrap} testID="view-push-active-filters">
              {cargoFilters.originRegions.map(r => (
                <View key={`o-${r}`} style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {t.originPrefix} {regionOptions.find(x => x.value === r)?.label ?? r}
                  </Text>
                </View>
              ))}
              {cargoFilters.destinationRegions.map(r => (
                <View key={`d-${r}`} style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {t.destPrefix} {regionOptions.find(x => x.value === r)?.label ?? r}
                  </Text>
                </View>
              ))}
              {cargoFilters.transportTypes.map(tp => (
                <View key={`t-${tp}`} style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {transportOptions.find(x => x.value === tp)?.label ?? tp}
                  </Text>
                </View>
              ))}
              {cargoFilters.excludeBot && (
                <View style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>{t.excludeBotLabel}</Text>
                </View>
              )}
            </View>
          )}

          <View style={[styles.hintRow, { borderTopColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]} testID="text-push-filter-hint">
              {t.filtersHint}
            </Text>
          </View>
        </View>

        {!pushEnabled && (
          <View style={[styles.disabledNote, { backgroundColor: colors.muted + '30', borderColor: colors.border }]}>
            <Ionicons name="notifications-off-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.disabledText, { color: colors.mutedForeground }]}>{t.disabledNote}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowDesc: { fontSize: 13, lineHeight: 18 },
  filtersCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  filtersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noFiltersText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  disabledNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  disabledText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
