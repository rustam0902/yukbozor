import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Colors } from '../constants/colors';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  language?: 'ru' | 'uz';
  initialValue?: string;
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

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

export function DatePickerModal({ visible, onClose, onSelect, language = 'ru', initialValue }: DatePickerModalProps) {
  const colors = Colors.light;
  const ru = language === 'ru';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const parseInitial = () => {
    if (initialValue && /^\d{2}\.\d{2}\.\d{4}$/.test(initialValue)) {
      const [d, m, y] = initialValue.split('.').map(Number);
      if (y >= currentYear) return { day: d, month: m, year: y };
    }
    return { day: currentDay, month: currentMonth, year: currentYear };
  };

  const init = parseInitial();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);
  const months = ru
    ? ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    : ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

  const [selectedYear, setSelectedYear] = useState(Math.max(0, years.indexOf(init.year)));
  const [selectedMonth, setSelectedMonth] = useState(init.month - 1);
  const [selectedDay, setSelectedDay] = useState(init.day - 1);

  const isCurrentYear = years[selectedYear] === currentYear;
  const isCurrentMonth = isCurrentYear && (selectedMonth + 1) === currentMonth;

  const minMonthIndex = isCurrentYear ? currentMonth - 1 : 0;
  const minDayIndex = isCurrentMonth ? currentDay - 1 : 0;

  const daysCount = getDaysInMonth(selectedMonth + 1, years[selectedYear]);
  const days = Array.from({ length: daysCount }, (_, i) => String(i + 1).padStart(2, '0'));
  const yearItems = years.map(String);

  const clampedDay = Math.min(Math.max(selectedDay, minDayIndex), daysCount - 1);

  const handleYearChange = (idx: number) => {
    setSelectedYear(idx);
    const newIsCurrentYear = years[idx] === currentYear;
    if (newIsCurrentYear && selectedMonth < currentMonth - 1) {
      setSelectedMonth(currentMonth - 1);
      setSelectedDay(Math.max(selectedDay, currentDay - 1));
    }
  };

  const handleMonthChange = (idx: number) => {
    setSelectedMonth(idx);
    const newIsCurrentMonth = isCurrentYear && (idx + 1) === currentMonth;
    if (newIsCurrentMonth && selectedDay < currentDay - 1) {
      setSelectedDay(currentDay - 1);
    }
  };

  const handleConfirm = () => {
    const finalDay = String(clampedDay + 1).padStart(2, '0');
    const finalMonth = String(selectedMonth + 1).padStart(2, '0');
    const finalYear = years[selectedYear];
    onSelect(`${finalDay}.${finalMonth}.${finalYear}`);
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
            <Text style={[styles.title, { color: colors.foreground }]}>{ru ? 'Дата загрузки' : 'Yuklash sanasi'}</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={[styles.btn, { color: colors.primary, fontWeight: '600' }]}>{ru ? 'Выбрать' : 'Tanlash'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pickersRow}>
            <ScrollPicker items={days} selectedIndex={clampedDay} onSelect={setSelectedDay} colors={colors} minIndex={minDayIndex} />
            <ScrollPicker items={months} selectedIndex={selectedMonth} onSelect={handleMonthChange} colors={colors} minIndex={minMonthIndex} />
            <ScrollPicker items={yearItems} selectedIndex={selectedYear} onSelect={handleYearChange} colors={colors} minIndex={0} />
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
  itemText: { fontSize: 17 },
  itemTextSelected: { fontWeight: '600' },
});

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  btn: { fontSize: 16 },
  pickersRow: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8 },
});
