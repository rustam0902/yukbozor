import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { uzbekistanRegions } from '../constants/data/uzbekistan-regions';
import { transportTypes } from '../constants/data/transport-types';

export interface FilterValues {
  originRegions: string[];
  destinationRegions: string[];
  transportTypes: string[];
  excludeBot: boolean;
}

export const EMPTY_FILTERS: FilterValues = {
  originRegions: [],
  destinationRegions: [],
  transportTypes: [],
  excludeBot: false,
};

export function buildQueryString(filters: FilterValues): string {
  const params: string[] = [];
  filters.originRegions.forEach(r => params.push(`originRegion=${encodeURIComponent(r)}`));
  filters.destinationRegions.forEach(r => params.push(`destinationRegion=${encodeURIComponent(r)}`));
  filters.transportTypes.forEach(t => params.push(`transportType=${encodeURIComponent(t)}`));
  if (filters.excludeBot) params.push('excludeBot=true');
  return params.length > 0 ? '?' + params.join('&') : '';
}

export function countActiveFilters(filters: FilterValues): number {
  let count = 0;
  if ((filters.originRegions ?? []).length > 0) count++;
  if ((filters.destinationRegions ?? []).length > 0) count++;
  if ((filters.transportTypes ?? []).length > 0) count++;
  if (filters.excludeBot) count++;
  return count;
}

/** Migrates saved filters from old single-value format to new multi-value format */
export function migrateFilters(saved: any): FilterValues {
  if (!saved) return EMPTY_FILTERS;
  return {
    originRegions: Array.isArray(saved.originRegions)
      ? saved.originRegions
      : saved.originRegion ? [saved.originRegion] : [],
    destinationRegions: Array.isArray(saved.destinationRegions)
      ? saved.destinationRegions
      : saved.destinationRegion ? [saved.destinationRegion] : [],
    transportTypes: Array.isArray(saved.transportTypes)
      ? saved.transportTypes
      : saved.transportType ? [saved.transportType] : [],
    excludeBot: saved.excludeBot ?? false,
  };
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterValues) => void;
  initialValues: FilterValues;
  showExcludeBot?: boolean;
}

export function FilterModal({ visible, onClose, onApply, initialValues, showExcludeBot = false }: FilterModalProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';
  const insets = useSafeAreaInsets();

  const [local, setLocal] = useState<FilterValues>(initialValues);

  useEffect(() => {
    if (visible) setLocal(initialValues);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => handler.remove();
  }, [visible, onClose]);

  const handleApply = () => onApply(local);

  const handleReset = () => setLocal(EMPTY_FILTERS);

  const toggleRegion = (field: 'originRegions' | 'destinationRegions', value: string) => {
    setLocal(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  const toggleTransport = (value: string) => {
    setLocal(prev => {
      const arr = prev.transportTypes;
      return {
        ...prev,
        transportTypes: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  const texts = {
    title: ru ? 'Фильтры' : 'Filtrlar',
    originRegion: ru ? 'Регион отправления' : 'Jo\'natish viloyati',
    destinationRegion: ru ? 'Регион назначения' : 'Yetkazish viloyati',
    transportType: ru ? 'Вид транспорта' : 'Transport turi',
    excludeBot: ru ? 'Без Telegram-объявлений' : 'Telegram e\'lonlarisiz',
    excludeBotDesc: ru ? 'Показывать только объявления от пользователей приложения' : 'Faqat ilova foydalanuvchilarining e\'lonlarini ko\'rsatish',
    reset: ru ? 'Сбросить' : 'Tozalash',
    apply: ru ? 'Применить' : 'Qo\'llash',
  };

  const regionOptions = uzbekistanRegions.map(r => ({ value: r.name, label: ru ? r.nameRu : r.nameUz }));
  const transportOptions = transportTypes.map(t => ({ value: t.value, label: ru ? t.labelRu : t.labelUz }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: colors.background }]} activeOpacity={1} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{texts.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="button-filter-close">
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <SectionLabel label={texts.originRegion} colors={colors} />
            <MultiChipRow
              options={regionOptions}
              selected={local.originRegions}
              onToggle={v => toggleRegion('originRegions', v)}
              colors={colors}
              testPrefix="origin"
            />

            <SectionLabel label={texts.destinationRegion} colors={colors} />
            <MultiChipRow
              options={regionOptions}
              selected={local.destinationRegions}
              onToggle={v => toggleRegion('destinationRegions', v)}
              colors={colors}
              testPrefix="dest"
            />

            <SectionLabel label={texts.transportType} colors={colors} />
            <MultiChipRow
              options={transportOptions}
              selected={local.transportTypes}
              onToggle={toggleTransport}
              colors={colors}
              testPrefix="transport"
            />

            {showExcludeBot && (
              <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
                <View style={styles.toggleTextCol}>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{texts.excludeBot}</Text>
                  <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>{texts.excludeBotDesc}</Text>
                </View>
                <Switch
                  value={local.excludeBot}
                  onValueChange={v => setLocal(prev => ({ ...prev, excludeBot: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="white"
                  testID="switch-exclude-bot"
                />
              </View>
            )}

            <View style={styles.spacer} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.resetBtn, { borderColor: colors.border }]}
              onPress={handleReset}
              testID="button-filter-reset"
            >
              <Text style={[styles.resetBtnText, { color: colors.foreground }]}>{texts.reset}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={handleApply}
              testID="button-filter-apply"
            >
              <Text style={styles.applyBtnText}>{texts.apply}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function SectionLabel({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{label}</Text>
  );
}

function MultiChipRow({ options, selected, onToggle, colors, testPrefix }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  colors: any;
  testPrefix: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map(opt => {
        const isSelected = selected.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? colors.primary : colors.card,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onToggle(opt.value)}
            testID={`chip-${testPrefix}-${opt.value}`}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={13} color="white" style={{ marginRight: 3 }} />
            )}
            <Text style={[styles.chipText, { color: isSelected ? 'white' : colors.foreground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { padding: 4 },
  content: { paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: { paddingBottom: 4, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  toggleTextCol: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  toggleDesc: { fontSize: 12, lineHeight: 16 },
  spacer: { height: 16 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  resetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetBtnText: { fontSize: 15, fontWeight: '500' },
  applyBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
});
