import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { getRegionDisplayName } from '../constants/regions';

const PUSH_ENABLED_KEY = '@pushEnabled';

interface PushFilterIndicatorProps {
  listFilters: {
    originRegions: string[];
    destinationRegions: string[];
    transportTypes: string[];
    excludeBot: boolean;
  };
  onPress?: () => void;
}

function hasFilters(f: PushFilterIndicatorProps['listFilters']): boolean {
  return (
    f.originRegions.length > 0 ||
    f.destinationRegions.length > 0 ||
    f.transportTypes.length > 0 ||
    f.excludeBot === true
  );
}

function formatRegionList(regions: string[], language: 'ru' | 'uz', maxVisible = 2): string {
  if (regions.length === 0) return '';
  const names = regions.map(r => getRegionDisplayName(r, language));
  if (names.length <= maxVisible) return names.join(', ');
  return names.slice(0, maxVisible).join(', ') + ` +${names.length - maxVisible}`;
}

export function PushFilterIndicator({ listFilters, onPress }: PushFilterIndicatorProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';

  const [pushEnabled, setPushEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const loadEnabled = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
      setPushEnabled(raw !== 'false');
    } catch {
      setPushEnabled(true);
    }
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEnabled();
    }, [loadEnabled]),
  );

  if (!loaded) return null;

  const notEnabled = pushEnabled === false;
  const active = !notEnabled && hasFilters(listFilters);

  let filterSummary: string;
  if (notEnabled) {
    filterSummary = ru ? 'не включены' : 'yoqilmagan';
  } else if (!active) {
    filterSummary = ru ? 'все грузы' : 'barcha yuklar';
  } else {
    const originStr = formatRegionList(listFilters.originRegions, language);
    const destStr = formatRegionList(listFilters.destinationRegions, language);
    if (originStr && destStr) {
      filterSummary = `${originStr} → ${destStr}`;
    } else if (originStr) {
      filterSummary = ru ? `из: ${originStr}` : `dan: ${originStr}`;
    } else if (destStr) {
      filterSummary = ru ? `до: ${destStr}` : `ga: ${destStr}`;
    } else {
      filterSummary = ru ? 'настроены' : 'sozlangan';
    }
  }

  const labelText = ru ? 'Уведомления:' : 'Bildirishnomalar:';

  const content = (
    <View style={styles.row}>
      <Ionicons
        name={active ? 'notifications' : 'notifications-outline'}
        size={15}
        color={notEnabled ? colors.mutedForeground : colors.primary}
        style={styles.icon}
      />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{labelText}</Text>
      <Text
        style={[styles.value, { color: notEnabled ? colors.mutedForeground : colors.foreground }]}
        numberOfLines={1}
      >
        {filterSummary}
      </Text>
      {!!onPress && (
        <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} style={styles.chevron} />
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View style={[styles.container, { borderBottomColor: colors.border }]} testID="view-push-filter-indicator">
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
      testID="button-push-filter-indicator"
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  value: {
    fontSize: 12,
    flex: 1,
  },
  chevron: {
    marginLeft: 2,
  },
});
