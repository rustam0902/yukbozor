import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Switch } from 'react-native';
import { trackEvent } from '../services/analytics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { TemplateNameModal } from '../components/TemplateNameModal';
import { PhotoGallery } from '../components/PhotoGallery';
import { PhotoPickerField } from '../components/PhotoPickerField';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useMyAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement, useUpdateAnnouncementStatus, useSaveAnnouncementTemplate, type Announcement } from '../hooks/useAnnouncements';
import { AiAnnouncementModal } from '../components/AiAnnouncementModal';
import { getRegionName, formatDate } from '../constants/regions';
import { uzbekistanRegions } from '../constants/data/uzbekistan-regions';
import { transportTypes, getTransportTypeLabel } from '../constants/data/transport-types';
import { ALL_DAY_VALUE, localizeLoadingTime } from '../utils/loadingTimeUtils';

interface MyAnnouncementsScreenProps {
  navigation: any;
  route?: any;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = Colors.light;
  return (
    <View style={sectionStyles.card}>
      <Text style={[sectionStyles.title, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
});

function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function stripPriceSpaces(formatted: string): string {
  return formatted.replace(/\s/g, '');
}

const PAYMENT_TYPES = [
  { value: 'cash', labelRu: 'Наличные', labelUz: 'Naqd' },
  { value: 'card', labelRu: 'Карта', labelUz: 'Karta' },
  { value: 'transfer', labelRu: 'Перечисление', labelUz: 'O\'tkazma' },
];

const emptyForm = (phone: string) => ({
  title: '',
  originRegion: '',
  originDistrict: '',
  destinationRegion: '',
  destinationDistrict: '',
  transportType: '',
  vehicleCount: '1',
  weightTons: '',
  price: '',
  loadDate: '',
  loadingTime: '',
  paymentTypes: [] as string[],
  contactPhone: phone,
  notes: '',
  photoUrls: [] as string[],
});

export function MyAnnouncementsScreen({ navigation, route }: MyAnnouncementsScreenProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  const ru = language === 'ru';
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'new' | 'all'>('new');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSuccessCount, setAiSuccessCount] = useState(0);
  const [formData, setFormData] = useState(emptyForm(user?.phone || ''));
  const [priceNegotiable, setPriceNegotiable] = useState(false);

  useEffect(() => {
    const template = route?.params?.template;
    if (template) {
      setFormData({
        title: template.title || '',
        originRegion: template.originRegion || '',
        originDistrict: template.originDistrict || '',
        destinationRegion: template.destinationRegion || '',
        destinationDistrict: template.destinationDistrict || '',
        transportType: template.transportType || '',
        vehicleCount: template.vehicleCount ? String(template.vehicleCount) : '1',
        weightTons: template.weightTons || '',
        price: template.price && Number(template.price) > 0 ? formatPriceInput(String(Math.round(Number(template.price)))) : '',
        loadDate: '',
        loadingTime: template.loadingTime === ALL_DAY_VALUE ? '' : (template.loadingTime || ''),
        paymentTypes: template.paymentTypes || [],
        contactPhone: template.contactPhone || user?.phone || '',
        notes: template.notes || '',
        photoUrls: [] as string[],
      });
      setPriceNegotiable(!template.price || Number(template.price) === 0);
      setAllDay(template.loadingTime === ALL_DAY_VALUE);
      setShowModal(true);
      navigation.setParams({ template: undefined } as any);
    }
  }, [route?.params?.template]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showOriginDistrictPicker, setShowOriginDistrictPicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showDestDistrictPicker, setShowDestDistrictPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [allDay, setAllDay] = useState(false);

  const { data: activeAnnouncements = [], isLoading: isLoadingActive, refetch: refetchActive, isRefetching: isRefetchingActive } = useMyAnnouncements();
  const { data: allAnnouncements = [], isLoading: isLoadingAll, refetch: refetchAll, isRefetching: isRefetchingAll } = useMyAnnouncements('all');

  const isLoading = activeTab === 'new' ? isLoadingActive : isLoadingAll;
  const isRefetching = activeTab === 'new' ? isRefetchingActive : isRefetchingAll;
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const updateStatusMutation = useUpdateAnnouncementStatus();
  const saveTemplateMutation = useSaveAnnouncementTemplate();

  const onRefresh = useCallback(() => {
    if (activeTab === 'new') refetchActive();
    else refetchAll();
  }, [activeTab, refetchActive, refetchAll]);

  const handleAiCreated = (count: number) => {
    setAiSuccessCount(c => c + count);
    refetchActive();
    refetchAll();
    setTimeout(() => setAiSuccessCount(0), 4000);
  };

  const texts = {
    title: ru ? 'Мои объявления' : 'Mening e\'lonlarim',
    newTab: ru ? 'Новые' : 'Yangi',
    allTab: ru ? 'Все' : 'Barchasi',
    noAnnouncements: ru ? 'У вас нет объявлений' : 'Sizda e\'lonlar yo\'q',
    noAnnouncementsDesc: ru ? 'Создайте своё первое объявление о грузе' : 'Birinchi yuk e\'loningizni yarating',
    create: ru ? 'Новое объявление' : 'Yangi e\'lon',
    titleLabel: ru ? 'Название' : 'Nomi',
    origin: ru ? 'Регион отправления' : 'Jo\'natish viloyati',
    originDistrict: ru ? 'Район отправления' : 'Jo\'natish tumani',
    destination: ru ? 'Регион назначения' : 'Yetkazish viloyati',
    destinationDistrict: ru ? 'Район назначения' : 'Yetkazish tumani',
    transportType: ru ? 'Тип транспорта' : 'Transport turi',
    vehicleCount: ru ? 'Количество машин' : 'Mashinalar soni',
    weightTons: ru ? 'Вес груза (тонн)' : 'Yuk og\'irligi (tonna)',
    price: ru ? 'Цена (UZS)' : 'Narx (so\'m)',
    loadDate: ru ? 'Дата загрузки' : 'Yuklash sanasi',
    loadingTime: ru ? 'Время загрузки' : 'Yuklash vaqti',
    paymentMethod: ru ? 'Способ оплаты' : 'To\'lov usuli',
    phone: ru ? 'Контактный телефон' : 'Aloqa telefoni',
    notes: ru ? 'Примечания' : 'Izohlar',
    publish: ru ? 'Опубликовать' : 'E\'lon qilish',
    saveTemplate: ru ? 'Сохранить как шаблон' : 'Shablon sifatida saqlash',
    cancel: ru ? 'Отмена' : 'Bekor qilish',
    success: ru ? 'Объявление создано' : 'E\'lon yaratildi',
    templateSaved: ru ? 'Шаблон сохранён' : 'Shablon saqlandi',
    deleteConfirm: ru ? 'Удалить объявление?' : 'E\'lonni o\'chirish?',
    deleteDesc: ru ? 'Это действие нельзя отменить.' : 'Bu amalni bekor qilib bo\'lmaydi.',
    delete: ru ? 'Удалить' : 'O\'chirish',
    closeConfirm: ru ? 'Закрыть объявление?' : 'E\'lonni yopish?',
    closeDesc: ru ? 'Объявление станет недоступным для перевозчиков.' : 'E\'lon tashuvchilar uchun yopiladi.',
    close: ru ? 'Закрыть' : 'Yopish',
    statusActive: ru ? 'Активно' : 'Faol',
    statusClosed: ru ? 'Закрыто' : 'Yopilgan',
    statusCancelled: ru ? 'Отменено' : 'Bekor',
    loadTime: ru ? 'Время загрузки' : 'Yuklash vaqti',
    tons: ru ? 'т' : 't',
    selectRegion: ru ? 'Выберите регион' : 'Viloyat tanlang',
    selectDistrict: ru ? 'Выберите район' : 'Tuman tanlang',
    selectType: ru ? 'Выберите тип' : 'Turni tanlang',
    selectDate: ru ? 'Выберите дату' : 'Sanani tanlang',
    selectTime: ru ? 'Выберите время' : 'Vaqtni tanlang',
    edit: ru ? 'Редактировать объявление' : 'E\'lonni tahrirlash',
    saveChanges: ru ? 'Сохранить изменения' : 'O\'zgarishlarni saqlash',
    editSuccess: ru ? 'Объявление обновлено' : 'E\'lon yangilandi',
  };

  const PAYMENT_LABELS: Record<string, { ru: string; uz: string }> = {
    cash: { ru: 'Наличные', uz: 'Naqd' },
    card: { ru: 'Карта', uz: 'Karta' },
    transfer: { ru: 'Перечисление', uz: "O'tkazma" },
  };

  const getPaymentLabel = (value: string) =>
    PAYMENT_LABELS[value] ? (ru ? PAYMENT_LABELS[value].ru : PAYMENT_LABELS[value].uz) : value;

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const isNewAnnouncement = (a: Announcement) => {
    if (a.status === 'closed' || a.status === 'cancelled') return false;
    const diff = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
    return diff < 24;
  };

  const filteredAnnouncements = activeTab === 'new'
    ? activeAnnouncements.filter(isNewAnnouncement)
    : allAnnouncements;

  const originRegionData = uzbekistanRegions.find(r => r.name === formData.originRegion);
  const destRegionData = uzbekistanRegions.find(r => r.name === formData.destinationRegion);
  const originDistrictItems = (originRegionData?.districts || []).map(d => ({ value: d.name, label: ru ? d.nameRu : d.nameUz }));
  const destDistrictItems = (destRegionData?.districts || []).map(d => ({ value: d.name, label: ru ? d.nameRu : d.nameUz }));

  const getDistrictName = (region: string, district: string) => {
    const r = uzbekistanRegions.find(r => r.name === region);
    const d = r?.districts.find(d => d.name === district);
    return d ? (ru ? d.nameRu : d.nameUz) : district;
  };

  const openEditModal = (item: Announcement) => {
    setEditingAnnouncement(item);
    const isNegotiable = !item.price || Number(item.price) === 0;
    setPriceNegotiable(isNegotiable);
    setFormData({
      title: item.title || '',
      originRegion: item.originRegion || '',
      originDistrict: item.originDistrict || '',
      destinationRegion: item.destinationRegion || '',
      destinationDistrict: item.destinationDistrict || '',
      transportType: item.transportType || '',
      vehicleCount: item.vehicleCount ? String(item.vehicleCount) : '1',
      weightTons: item.weightTons || '',
      price: !isNegotiable && item.price ? formatPriceInput(String(Math.round(Number(item.price)))) : '',
      loadDate: item.loadDate || '',
      loadingTime: item.loadingTime === ALL_DAY_VALUE ? '' : (item.loadingTime || ''),
      paymentTypes: item.paymentTypes || [],
      contactPhone: item.contactPhone || user?.phone || '',
      notes: item.notes || '',
      photoUrls: item.photoUrls || [],
    });
    setAllDay(item.loadingTime === ALL_DAY_VALUE);
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData(emptyForm(user?.phone || ''));
    setPriceNegotiable(false);
    setAllDay(false);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    const required = ru ? 'Обязательное поле' : 'Majburiy maydon';
    if (!formData.title.trim()) e.title = required;
    if (!formData.originRegion) e.originRegion = texts.selectRegion;
    if (!formData.destinationRegion) e.destinationRegion = texts.selectRegion;
    if (!formData.transportType) e.transportType = texts.selectType;
    if (!formData.vehicleCount || Number(formData.vehicleCount) < 1) e.vehicleCount = required;
    if (!formData.weightTons || Number(formData.weightTons) <= 0) e.weightTons = required;
    if (!priceNegotiable && (!formData.price || Number(stripPriceSpaces(formData.price)) <= 0)) e.price = required;
    if (!formData.loadDate.trim()) e.loadDate = ru ? 'Выберите дату' : 'Sanani tanlang';
    if (!allDay && !formData.loadingTime.trim()) e.loadingTime = ru ? 'Выберите время' : 'Vaqtni tanlang';
    if (formData.paymentTypes.length === 0) e.paymentTypes = ru ? 'Выберите хотя бы один способ' : 'Kamida bir usulni tanlang';
    if (!formData.contactPhone.trim()) e.contactPhone = required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    const payload = {
      title: formData.title,
      originRegion: formData.originRegion,
      originDistrict: formData.originDistrict || undefined,
      destinationRegion: formData.destinationRegion,
      destinationDistrict: formData.destinationDistrict || undefined,
      transportType: formData.transportType,
      vehicleCount: Number(formData.vehicleCount),
      weightTons: formData.weightTons,
      price: priceNegotiable ? null : stripPriceSpaces(formData.price),
      loadDate: formData.loadDate,
      loadingTime: allDay ? ALL_DAY_VALUE : formData.loadingTime,
      paymentTypes: formData.paymentTypes,
      contactPhone: formData.contactPhone,
      notes: formData.notes || undefined,
      photoUrls: formData.photoUrls,
    };
    try {
      if (editingAnnouncement) {
        await updateMutation.mutateAsync({ id: editingAnnouncement.id, data: payload });
        Alert.alert('', texts.editSuccess);
      } else {
        await createMutation.mutateAsync(payload);
        trackEvent('create_announcement', 'MyAnnouncementsScreen');
        Alert.alert('', texts.success);
      }
      closeModal();
    } catch (error: any) {
      Alert.alert(ru ? 'Ошибка' : 'Xato', error.message);
    }
  };

  const handleSaveTemplate = async (name: string) => {
    try {
      await saveTemplateMutation.mutateAsync({
        name,
        title: formData.title || undefined,
        originRegions: formData.originRegion ? [formData.originRegion] : undefined,
        originDistrict: formData.originDistrict ? [formData.originDistrict] : undefined,
        destinationRegions: formData.destinationRegion ? [formData.destinationRegion] : undefined,
        destinationDistrict: formData.destinationDistrict ? [formData.destinationDistrict] : undefined,
        transportType: formData.transportType || undefined,
        vehicleCount: formData.vehicleCount ? Number(formData.vehicleCount) : undefined,
        weightTons: formData.weightTons || undefined,
        loadingTime: allDay ? ALL_DAY_VALUE : (formData.loadingTime || undefined),
        price: stripPriceSpaces(formData.price) || undefined,
        paymentTypes: formData.paymentTypes.length > 0 ? formData.paymentTypes : undefined,
        contactPhone: formData.contactPhone || undefined,
        notes: formData.notes || undefined,
      });
      setShowTemplateModal(false);
      Alert.alert('', texts.templateSaved);
    } catch (error: any) {
      Alert.alert(ru ? 'Ошибка' : 'Xato', error.message);
    }
  };

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

  const handleClose = (id: number) => {
    Alert.alert(texts.closeConfirm, texts.closeDesc, [
      { text: texts.cancel, style: 'cancel' },
      {
        text: texts.close, style: 'default',
        onPress: async () => {
          try { await updateStatusMutation.mutateAsync({ id, status: 'closed' }); }
          catch (error: any) { Alert.alert(ru ? 'Ошибка' : 'Xato', error.message); }
        }
      },
    ]);
  };

  const getStatusBadge = (item: { status?: string; deletedAt?: string | null }) => {
    if (item.deletedAt) {
      return { label: ru ? 'Удалён' : "O'chirilgan", color: colors.destructive };
    }
    const status = item.status;
    if (!status || status === 'new' || status === 'active') {
      return { label: texts.statusActive, color: '#22c55e' };
    }
    if (status === 'closed' || status === 'completed') {
      return { label: texts.statusClosed, color: colors.mutedForeground };
    }
    if (status === 'cancelled') {
      return { label: texts.statusCancelled, color: colors.destructive };
    }
    return { label: texts.statusActive, color: '#22c55e' };
  };

  const togglePaymentType = (value: string) => {
    const updated = formData.paymentTypes.includes(value)
      ? formData.paymentTypes.filter(v => v !== value)
      : [...formData.paymentTypes, value];
    setFormData(p => ({ ...p, paymentTypes: updated }));
    if (errors.paymentTypes) setErrors(e => ({ ...e, paymentTypes: '' }));
  };

  const renderAnnouncement = ({ item }: { item: Announcement }) => {
    const isExpanded = expandedId === item.id;
    const statusBadge = getStatusBadge(item);
    const isClosed = !!item.deletedAt || item.status === 'closed' || item.status === 'cancelled';

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => toggleExpand(item.id)} testID={`card-announcement-${item.id}`}>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt, language)}</Text>
                {activeTab === 'all' && (
                  <Text style={[styles.statusBadge, { color: statusBadge.color }]}>{statusBadge.label}</Text>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {item.photoUrls && item.photoUrls.length > 0 && (
                <Ionicons name="camera-outline" size={18} color={colors.mutedForeground} testID={`icon-photos-${item.id}`} />
              )}
              {!isClosed && (
                <>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); openEditModal(item); }}
                    testID={`button-edit-${item.id}`}
                  >
                    <Ionicons name="create-outline" size={19} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleClose(item.id)}
                    testID={`button-close-${item.id}`}
                    style={[styles.closeAnnouncementBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.closeAnnouncementText, { color: colors.mutedForeground }]}>
                      {language === 'ru' ? 'Закрыть' : 'Yopish'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => handleDelete(item.id)} testID={`button-delete-${item.id}`}>
                <Ionicons name="trash-outline" size={19} color={colors.destructive} />
              </TouchableOpacity>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
            </View>
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={15} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {getRegionName(item.originRegion, language)}
              {item.originDistrict ? `, ${getDistrictName(item.originRegion, item.originDistrict)}` : ''}
              {' → '}
              {getRegionName(item.destinationRegion, language)}
              {item.destinationDistrict ? `, ${getDistrictName(item.destinationRegion, item.destinationDistrict)}` : ''}
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="car-outline" size={15} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>{getTransportTypeLabel(item.transportType, language)}</Text>
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="cash-outline" size={15} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {Number(item.price) > 0 ? `${Number(item.price).toLocaleString()} UZS` : (ru ? 'Договорная' : 'Kelishiladi')}
            </Text>
          </View>

          {isExpanded && (
            <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
              {item.loadDate ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="calendar-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.loadDate}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{item.loadDate}</Text>
                </View>
              ) : null}
              {item.loadingTime ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.loadTime}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{localizeLoadingTime(item.loadingTime, language)}</Text>
                </View>
              ) : null}
              {item.vehicleCount && item.vehicleCount > 0 ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="layers-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.vehicleCount}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{item.vehicleCount}</Text>
                </View>
              ) : null}
              <View style={styles.detailsRow}>
                <Ionicons name="cube-outline" size={15} color={colors.mutedForeground} />
                <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.weightTons}:</Text>
                <Text style={[styles.expandedValue, { color: colors.foreground }]}>
                  {Number(item.weightTons) > 0 ? `${item.weightTons} ${texts.tons}` : (ru ? 'Не указан' : "Ko'rsatilmagan")}
                </Text>
              </View>
              {item.paymentTypes && item.paymentTypes.length > 0 ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="card-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.paymentMethod}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground }]}>{item.paymentTypes.map(getPaymentLabel).join(', ')}</Text>
                </View>
              ) : null}
              {item.notes ? (
                <View style={styles.detailsRow}>
                  <Ionicons name="document-text-outline" size={15} color={colors.mutedForeground} />
                  <Text style={[styles.expandedLabel, { color: colors.mutedForeground }]}>{texts.notes}:</Text>
                  <Text style={[styles.expandedValue, { color: colors.foreground, flex: 1 }]}>{item.notes}</Text>
                </View>
              ) : null}
              {item.photoUrls && item.photoUrls.length > 0 && (
                <PhotoGallery photoUrls={item.photoUrls} language={language} />
              )}
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderPickerModal = (
    visible: boolean, onClose: () => void,
    items: { value: string; label: string }[],
    onSelect: (value: string) => void, title: string
  ) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.foreground} /></TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.pickerItem, { borderBottomColor: colors.border }]} onPress={() => { onSelect(item.value); onClose(); }}>
                <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const regionItems = uzbekistanRegions.map(r => ({ value: r.name, label: ru ? r.nameRu : r.nameUz }));
  const typeItems = transportTypes.map(t => ({ value: t.value, label: ru ? t.labelRu : t.labelUz }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{texts.title}</Text>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['new', 'all'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
            testID={`tab-${tab}`}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === 'new' ? texts.newTab : texts.allTab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredAnnouncements}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderAnnouncement}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="megaphone-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.noAnnouncements}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noAnnouncementsDesc}</Text>
            </View>
          }
        />
      )}

      <View style={styles.fabGroup}>
        <TouchableOpacity style={[styles.fabAi, { backgroundColor: '#7c3aed' }]} onPress={() => setShowAiModal(true)} testID="button-ai-announcement">
          <Ionicons name="sparkles" size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)} testID="button-create-announcement">
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {aiSuccessCount > 0 && (
        <View style={[styles.aiToastBanner, { backgroundColor: colors.primary }]} testID="banner-ai-success">
          <Ionicons name="checkmark-circle" size={18} color="white" />
          <Text style={styles.aiToastText}>
            {ru ? `Создано ${aiSuccessCount} объявл.` : `${aiSuccessCount} ta e'lon yaratildi`}
          </Text>
        </View>
      )}

      <AiAnnouncementModal
        visible={showAiModal}
        onClose={() => setShowAiModal(false)}
        onCreated={handleAiCreated}
        userPhone={user?.phone || ''}
      />

      <Modal visible={showModal} animationType="slide" transparent={false} onRequestClose={closeModal}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>{texts.cancel}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingAnnouncement ? texts.edit : texts.create}</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>

            <SectionCard title={ru ? 'Название' : 'Nomi'}>
              <Input label={texts.titleLabel} value={formData.title}
                onChangeText={(v) => { setFormData(p => ({ ...p, title: v })); if (errors.title) setErrors(e => ({ ...e, title: '' })); }}
                error={errors.title} testID="input-title" />
            </SectionCard>

            <SectionCard title={ru ? 'Маршрут' : 'Marshrut'}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.origin}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.originRegion ? colors.destructive : colors.border }]} onPress={() => setShowOriginPicker(true)} testID="select-origin">
                <Text style={{ color: formData.originRegion ? colors.foreground : colors.mutedForeground }}>
                  {formData.originRegion ? getRegionName(formData.originRegion, language) : texts.selectRegion}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.originRegion ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.originRegion}</Text> : null}

              {formData.originRegion ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8 }]}>{texts.originDistrict}</Text>
                  <TouchableOpacity style={[styles.selectButton, { borderColor: colors.border }]} onPress={() => setShowOriginDistrictPicker(true)}>
                    <Text style={{ color: formData.originDistrict ? colors.foreground : colors.mutedForeground }}>
                      {formData.originDistrict ? getDistrictName(formData.originRegion, formData.originDistrict) : texts.selectDistrict}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </>
              ) : null}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.destination}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.destinationRegion ? colors.destructive : colors.border }]} onPress={() => setShowDestPicker(true)} testID="select-destination">
                <Text style={{ color: formData.destinationRegion ? colors.foreground : colors.mutedForeground }}>
                  {formData.destinationRegion ? getRegionName(formData.destinationRegion, language) : texts.selectRegion}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.destinationRegion ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.destinationRegion}</Text> : null}

              {formData.destinationRegion ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8 }]}>{texts.destinationDistrict}</Text>
                  <TouchableOpacity style={[styles.selectButton, { borderColor: colors.border }]} onPress={() => setShowDestDistrictPicker(true)}>
                    <Text style={{ color: formData.destinationDistrict ? colors.foreground : colors.mutedForeground }}>
                      {formData.destinationDistrict ? getDistrictName(formData.destinationRegion, formData.destinationDistrict) : texts.selectDistrict}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </>
              ) : null}
            </SectionCard>

            <SectionCard title={ru ? 'О грузе' : 'Yuk haqida'}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.transportType}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.transportType ? colors.destructive : colors.border }]} onPress={() => setShowTypePicker(true)} testID="select-transport">
                <Text style={{ color: formData.transportType ? colors.foreground : colors.mutedForeground }}>
                  {formData.transportType ? getTransportTypeLabel(formData.transportType, language) : texts.selectType}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.transportType ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.transportType}</Text> : null}

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Input label={texts.vehicleCount} value={formData.vehicleCount}
                    onChangeText={(v) => { setFormData(p => ({ ...p, vehicleCount: v })); if (errors.vehicleCount) setErrors(e => ({ ...e, vehicleCount: '' })); }}
                    keyboardType="numeric" error={errors.vehicleCount} testID="input-vehicle-count" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={texts.weightTons} value={formData.weightTons}
                    onChangeText={(v) => { setFormData(p => ({ ...p, weightTons: v })); if (errors.weightTons) setErrors(e => ({ ...e, weightTons: '' })); }}
                    keyboardType="decimal-pad" error={errors.weightTons} testID="input-weight" />
                </View>
              </View>
            </SectionCard>

            <SectionCard title={ru ? 'Условия' : 'Shartlar'}>
              <View style={styles.negotiableRow}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 0 }]}>{texts.price}</Text>
                <TouchableOpacity
                  style={styles.negotiableToggle}
                  onPress={() => {
                    const next = !priceNegotiable;
                    setPriceNegotiable(next);
                    if (next) {
                      setFormData(p => ({ ...p, price: '' }));
                      setErrors(e => ({ ...e, price: '' }));
                    }
                  }}
                  activeOpacity={0.7}
                  testID="checkbox-negotiable"
                >
                  <Text style={[styles.negotiableLabel, { color: colors.mutedForeground }]}>
                    {ru ? 'Договорная' : 'Kelishiladi'}
                  </Text>
                  <View style={[
                    styles.checkboxBox,
                    {
                      borderColor: priceNegotiable ? colors.primary : colors.border,
                      backgroundColor: priceNegotiable ? colors.primary : 'transparent',
                    },
                  ]}>
                    {priceNegotiable && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              </View>
              <View style={{ opacity: priceNegotiable ? 0.4 : 1 }}>
                <Input
                  label=""
                  value={priceNegotiable ? '' : formData.price}
                  onChangeText={(v) => {
                    if (!priceNegotiable) {
                      setFormData(p => ({ ...p, price: formatPriceInput(v) }));
                      if (errors.price) setErrors(e => ({ ...e, price: '' }));
                    }
                  }}
                  keyboardType="numeric"
                  error={priceNegotiable ? '' : errors.price}
                  editable={!priceNegotiable}
                  placeholder={priceNegotiable ? (ru ? 'Договорная' : 'Kelishiladi') : ''}
                  testID="input-price"
                />
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.loadDate}</Text>
                  <TouchableOpacity style={[styles.selectButton, { borderColor: errors.loadDate ? colors.destructive : colors.border }]} onPress={() => setShowDatePicker(true)} testID="select-load-date">
                    <Text style={{ color: formData.loadDate ? colors.foreground : colors.mutedForeground, fontSize: 14 }}>
                      {formData.loadDate || texts.selectDate}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {errors.loadDate ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.loadDate}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 4 }]}>{texts.loadingTime}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{ru ? 'В течение дня' : 'kun davomida'}</Text>
                    <Switch
                      value={allDay}
                      onValueChange={(v) => { setAllDay(v); if (v) setErrors(e => ({ ...e, loadingTime: '' })); }}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      testID="switch-all-day"
                    />
                  </View>
                  {!allDay && (
                    <>
                      <TouchableOpacity style={[styles.selectButton, { borderColor: errors.loadingTime ? colors.destructive : colors.border }]} onPress={() => setShowTimePicker(true)} testID="select-loading-time">
                        <Text style={{ color: formData.loadingTime ? colors.foreground : colors.mutedForeground, fontSize: 14 }}>
                          {formData.loadingTime || texts.selectTime}
                        </Text>
                        <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      {errors.loadingTime ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.loadingTime}</Text> : null}
                    </>
                  )}
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.paymentMethod}</Text>
              <View style={styles.paymentRow}>
                {PAYMENT_TYPES.map(pt => {
                  const selected = formData.paymentTypes.includes(pt.value);
                  return (
                    <TouchableOpacity key={pt.value}
                      style={[styles.paymentChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }]}
                      onPress={() => togglePaymentType(pt.value)} testID={`chip-payment-${pt.value}`}>
                      <Text style={[styles.paymentChipText, { color: selected ? 'white' : colors.foreground }]}>{ru ? pt.labelRu : pt.labelUz}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.paymentTypes ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.paymentTypes}</Text> : null}
            </SectionCard>

            <SectionCard title={ru ? 'Контакт и примечания' : 'Aloqa va izohlar'}>
              <Input label={texts.phone} value={formData.contactPhone}
                onChangeText={(v) => { setFormData(p => ({ ...p, contactPhone: v })); if (errors.contactPhone) setErrors(e => ({ ...e, contactPhone: '' })); }}
                keyboardType="phone-pad" error={errors.contactPhone} testID="input-phone" />
              <Input label={texts.notes} value={formData.notes}
                onChangeText={(v) => setFormData(p => ({ ...p, notes: v }))}
                multiline numberOfLines={3} testID="input-notes" />
              <TouchableOpacity
                style={[styles.voiceHintRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => { setShowModal(false); setTimeout(() => setShowAiModal(true), 300); }}
                testID="button-voice-hint">
                <Ionicons name="mic" size={16} color={colors.primary} />
                <Text style={[styles.voiceHintText, { color: colors.primary }]}>
                  {ru ? 'Описать голосом через ИИ-помощника' : 'AI orqali ovozda tasvirlash'}
                </Text>
                <Ionicons name="sparkles" size={14} color={colors.primary} />
              </TouchableOpacity>
              <PhotoPickerField
                photos={formData.photoUrls}
                onChange={(urls) => setFormData(p => ({ ...p, photoUrls: urls }))}
                language={language}
              />
            </SectionCard>

            <View style={styles.buttonRow}>
              <Button
                title={editingAnnouncement ? texts.saveChanges : texts.publish}
                onPress={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
                testID="button-publish"
              />
            </View>

            {!editingAnnouncement && (
              <TouchableOpacity style={[styles.templateButton, { borderColor: colors.primary }]} onPress={() => setShowTemplateModal(true)} testID="button-save-template">
                <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
                <Text style={[styles.templateButtonText, { color: colors.primary }]}>{texts.saveTemplate}</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {renderPickerModal(showOriginPicker, () => setShowOriginPicker(false), regionItems,
        (v) => { setFormData(p => ({ ...p, originRegion: v, originDistrict: '' })); if (errors.originRegion) setErrors(e => ({ ...e, originRegion: '' })); }, texts.origin)}
      {renderPickerModal(showOriginDistrictPicker, () => setShowOriginDistrictPicker(false), originDistrictItems,
        (v) => setFormData(p => ({ ...p, originDistrict: v })), texts.originDistrict)}
      {renderPickerModal(showDestPicker, () => setShowDestPicker(false), regionItems,
        (v) => { setFormData(p => ({ ...p, destinationRegion: v, destinationDistrict: '' })); if (errors.destinationRegion) setErrors(e => ({ ...e, destinationRegion: '' })); }, texts.destination)}
      {renderPickerModal(showDestDistrictPicker, () => setShowDestDistrictPicker(false), destDistrictItems,
        (v) => setFormData(p => ({ ...p, destinationDistrict: v })), texts.destinationDistrict)}
      {renderPickerModal(showTypePicker, () => setShowTypePicker(false), typeItems,
        (v) => { setFormData(p => ({ ...p, transportType: v })); if (errors.transportType) setErrors(e => ({ ...e, transportType: '' })); }, texts.transportType)}

      <DatePickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}
        onSelect={(d) => { setFormData(p => ({ ...p, loadDate: d })); if (errors.loadDate) setErrors(e => ({ ...e, loadDate: '' })); }}
        language={language} initialValue={formData.loadDate} />

      <TimePickerModal visible={showTimePicker} onClose={() => setShowTimePicker(false)}
        onSelect={(t) => { setFormData(p => ({ ...p, loadingTime: t })); if (errors.loadingTime) setErrors(e => ({ ...e, loadingTime: '' })); }}
        language={language} initialValue={formData.loadingTime} selectedDate={formData.loadDate} />

      <TemplateNameModal visible={showTemplateModal} onClose={() => setShowTemplateModal(false)}
        onSave={handleSaveTemplate} loading={saveTemplateMutation.isPending} language={language} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 16, paddingHorizontal: 16, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardDate: { fontSize: 12, marginTop: 2 },
  detailsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 14, flex: 1 },
  statusBadge: { fontSize: 11, fontWeight: '600' },
  expandedSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  expandedLabel: { fontSize: 13, minWidth: 90 },
  expandedValue: { fontSize: 13 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  fabGroup: { position: 'absolute', bottom: 24, right: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fabAi: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  aiToastBanner: { position: 'absolute', bottom: 90, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, zIndex: 999 },
  aiToastText: { color: 'white', fontSize: 15, fontWeight: '600', flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  cancelText: { fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  formScroll: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 4 },
  selectButton: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowInputs: { flexDirection: 'row', gap: 10, marginTop: 4 },
  divider: { height: 1, marginVertical: 12 },
  errorText: { fontSize: 12, marginBottom: 6 },
  paymentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  paymentChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  paymentChipText: { fontSize: 14, fontWeight: '500' },
  buttonRow: { marginTop: 20 },
  templateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingVertical: 12, marginTop: 12 },
  templateButtonText: { fontSize: 15, fontWeight: '500' },
  voiceHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  voiceHintText: { flex: 1, fontSize: 13, fontWeight: '500' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 18, fontWeight: '600' },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16 },
  closeAnnouncementBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  closeAnnouncementText: { fontSize: 12, fontWeight: '500' },
  negotiableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  negotiableToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  negotiableLabel: { fontSize: 14, fontWeight: '500' },
  checkboxBox: { width: 20, height: 20, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
