import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Colors } from '../constants/colors';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  language?: 'ru' | 'uz';
  initialValue?: string;
  selectedDate?: string; // DD.MM.YYYY — used to disable past times when date is today
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function ScrollPicker({
  items,
  selectedIndex,
  onSelect,
  colors,
  minIndex = 0,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  colors: any;
  minIndex?: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const effectiveIndex = Math.max(selectedIndex, minIndex);
  const [localIndex, setLocalIndex] = useState(effectiveIndex);

  useEffect(() => {
    const clamped = Math.max(selectedIndex, minIndex);
    setLocalIndex(clamped);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: false });
    }, 50);
  }, [selectedIndex, minIndex]);

  const handleMomentumEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(minIndex, Math.min(idx, items.length - 1));
    setLocalIndex(clamped);
    onSelect(clamped);
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  const padding = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

  return (
    <View style={[pickerStyles.column, { height: CONTAINER_HEIGHT }]}>
      <View style={[pickerStyles.selector, { top: Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT, borderColor: colors.primary }]} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{ paddingTop: padding, paddingBottom: padding }}
      >
        {items.map((item, idx) => {
          const disabled = idx < minIndex;
          return (
            <TouchableOpacity
              key={idx}
              style={[pickerStyles.item, { height: ITEM_HEIGHT }]}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                setLocalIndex(idx);
                onSelect(idx);
                scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text style={[
                pickerStyles.itemText,
                idx === localIndex && !disabled && pickerStyles.itemTextSelected,
                { color: disabled ? colors.mutedForeground : (idx === localIndex ? colors.primary : colors.foreground) },
                disabled && { opacity: 0.3 },
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function TimePickerModal({ visible, onClose, onSelect, language = 'ru', initialValue, selectedDate }: TimePickerModalProps) {
  const colors = Colors.light;
  const ru = language === 'ru';

  const now = new Date();

  const isToday = (() => {
    if (!selectedDate) return false;
    const parts = selectedDate.split('.');
    if (parts.length !== 3) return false;
    const [dd, mm, yyyy] = parts.map(Number);
    return dd === now.getDate() && mm === now.getMonth() + 1 && yyyy === now.getFullYear();
  })();

  const minHour = isToday ? now.getHours() : 0;
  const minMinuteForCurrentHour = isToday ? Math.min(now.getMinutes() + 5, 59) : 0;

  const parseInitial = () => {
    if (initialValue && /^\d{1,2}:\d{2}$/.test(initialValue)) {
      const [h, m] = initialValue.split(':').map(Number);
      return { hour: h, minute: m };
    }
    const defaultHour = isToday ? Math.min(now.getHours() + 1, 23) : 9;
    return { hour: defaultHour, minute: 0 };
  };

  const init = parseInitial();
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const [selectedHour, setSelectedHour] = useState(Math.max(init.hour, minHour));
  const [selectedMinute, setSelectedMinute] = useState(init.minute);

  const minMinuteIndex = isToday && selectedHour === minHour ? minMinuteForCurrentHour : 0;
  const effectiveMinute = Math.max(selectedMinute, minMinuteIndex);

  const handleHourChange = (idx: number) => {
    setSelectedHour(idx);
    if (isToday && idx === minHour && selectedMinute < minMinuteForCurrentHour) {
      setSelectedMinute(minMinuteForCurrentHour);
    }
  };

  const handleConfirm = () => {
    const h = String(selectedHour).padStart(2, '0');
    const m = String(effectiveMinute).padStart(2, '0');
    onSelect(`${h}:${m}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.btn, { color: colors.mutedForeground }]}>{ru ? 'Отмена' : 'Bekor'}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>{ru ? 'Время загрузки' : 'Yuklash vaqti'}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={[styles.btn, { color: colors.primary, fontWeight: '600' }]}>{ru ? 'Выбрать' : 'Tanlash'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pickersRow}>
            <ScrollPicker items={hours} selectedIndex={selectedHour} onSelect={handleHourChange} colors={colors} minIndex={minHour} />
            <View style={styles.colon}>
              <Text style={[styles.colonText, { color: colors.foreground }]}>:</Text>
            </View>
            <ScrollPicker items={minutes} selectedIndex={effectiveMinute} onSelect={setSelectedMinute} colors={colors} minIndex={minMinuteIndex} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  column: { flex: 1, overflow: 'hidden' },
  selector: { position: 'absolute', left: 4, right: 4, height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1, zIndex: 1 },
  item: { justifyContent: 'center', alignItems: 'center' },
  itemText: { fontSize: 20 },
  itemTextSelected: { fontWeight: '700' },
});

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  btn: { fontSize: 16 },
  pickersRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
  colon: { paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', height: ITEM_HEIGHT * VISIBLE_ITEMS },
  colonText: { fontSize: 28, fontWeight: '700' },
});
