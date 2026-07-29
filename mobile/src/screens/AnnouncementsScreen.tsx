import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, Linking, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { TemplateNameModal } from '../components/TemplateNameModal';
import { PhotoPickerField } from '../components/PhotoPickerField';
import { PhotoGallery } from '../components/PhotoGallery';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement, useSaveAnnouncementTemplate, type Announcement } from '../hooks/useAnnouncements';
import { AiAnnouncementModal } from '../components/AiAnnouncementModal';
import { getRegionName, formatDate } from '../constants/regions';
import { uzbekistanRegions } from '../constants/data/uzbekistan-regions';
import { transportTypes, getTransportTypeLabel } from '../constants/data/transport-types';
import { ALL_DAY_VALUE } from '../utils/loadingTimeUtils';

interface AnnouncementsScreenProps {
  navigation: any;
}

function FieldRow({ icon, iconColor, children }: { icon: string; iconColor: string; children: React.ReactNode }) {
  return (
    <View style={fieldRowStyles.row}>
      <View style={fieldRowStyles.icon}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={fieldRowStyles.content}>{children}</View>
    </View>
  );
}

const fieldRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 10 },
  icon: { width: 28, alignItems: 'center', paddingTop: 14 },
  content: { flex: 1 },
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

function buildBotSourceLink(chatId: string, msgId: number): string {
  const numericId = chatId.replace(/^-100/, '');
  return /^\d+$/.test(numericId)
    ? `https://t.me/c/${numericId}/${msgId}`
    : `https://t.me/${chatId.replace(/^@/, '')}/${msgId}`;
}

export function AnnouncementsScreen({ navigation }: AnnouncementsScreenProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  const isCustomer = user?.roles?.includes('customer');
  const ru = language === 'ru';

  const [showModal, setShowModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSuccessCount, setAiSuccessCount] = useState(0);
  const safeUserPhone = user?.phone?.startsWith('tg_') ? '' : (user?.phone || '');
  const [formData, setFormData] = useState(emptyForm(safeUserPhone));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priceNegotiable, setPriceNegotiable] = useState(false);

  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showOriginDistrictPicker, setShowOriginDistrictPicker] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [showDestDistrictPicker, setShowDestDistrictPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [allDay, setAllDay] = useState(false);

  const { data: announcements = [], isLoading, refetch, isRefetching } = useAnnouncements();
  const createAnnouncementMutation = useCreateAnnouncement();
  const deleteAnnouncementMutation = useDeleteAnnouncement();
  const saveTemplateMutation = useSaveAnnouncementTemplate();

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const handleAiCreated = useCallback((count: number) => {
    refetch();
    if (count > 0) {
      setAiSuccessCount(count);
      setTimeout(() => setAiSuccessCount(0), 4000);
    }
  }, [refetch]);


  const texts = {
    screenTitle: ru ? 'Грузы' : 'Yuklar',
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
    noAnnouncements: ru ? 'Нет активных грузов' : 'Faol yuklar yo\'q',
    noAnnouncementsDesc: ru ? 'Здесь будут отображаться все объявления о грузах' : 'Bu yerda barcha yuk e\'lonlari ko\'rsatiladi',
    selectRegion: ru ? 'Выберите регион' : 'Viloyat tanlang',
    selectDistrict: ru ? 'Выберите район' : 'Tuman tanlang',
    selectType: ru ? 'Выберите тип' : 'Turni tanlang',
    selectDate: ru ? 'Выберите дату' : 'Sanani tanlang',
    selectTime: ru ? 'Выберите время' : 'Vaqtni tanlang',
    count: (n: number) => ru ? `${n} объявлений` : `${n} e\'lon`,
  };

  const originRegionData = uzbekistanRegions.find(r => r.name === formData.originRegion);
  const destRegionData = uzbekistanRegions.find(r => r.name === formData.destinationRegion);
  const originDistrictItems = (originRegionData?.districts || []).map(d => ({ value: d.name, label: ru ? d.nameRu : d.nameUz }));
  const destDistrictItems = (destRegionData?.districts || []).map(d => ({ value: d.name, label: ru ? d.nameRu : d.nameUz }));

  const getDistrictName = (region: string, district: string) => {
    const r = uzbekistanRegions.find(r => r.name === region);
    const d = r?.districts.find(d => d.name === district);
    return d ? (ru ? d.nameRu : d.nameUz) : district;
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
    if (!formData.loadDate.trim()) {
      e.loadDate = ru ? 'Выберите дату' : 'Sanani tanlang';
    } else {
      const parts = formData.loadDate.split('.');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts.map(Number);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const loadDateStart = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
        if (loadDateStart < todayStart) {
          e.loadDate = ru
            ? 'Дата загрузки не может быть в прошлом'
            : 'Yuklash sanasi o\'tgan bo\'lishi mumkin emas';
        } else if (loadDateStart.getTime() === todayStart.getTime() && !allDay && formData.loadingTime.trim()) {
          // Today selected + time chosen — check combined datetime
          const [hh, min] = formData.loadingTime.split(':').map(Number);
          const loadDateTime = new Date(yyyy, mm - 1, dd, hh || 0, min || 0, 0, 0);
          if (loadDateTime <= now) {
            e.loadDate = ru
              ? 'Дата и время загрузки не могут быть в прошлом'
              : 'Yuklash sanasi va vaqti o\'tgan bo\'lishi mumkin emas';
          }
        }
      }
    }
    if (!allDay && !formData.loadingTime.trim()) e.loadingTime = ru ? 'Выберите время' : 'Vaqtni tanlang';
    if (formData.paymentTypes.length === 0) e.paymentTypes = ru ? 'Выберите хотя бы один способ' : 'Kamida bir usulni tanlang';
    if (!formData.contactPhone.trim()) e.contactPhone = required;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      await createAnnouncementMutation.mutateAsync({
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
      });
      Alert.alert('', texts.success);
      setShowModal(false);
      setFormData(emptyForm(user?.phone || ''));
      setPriceNegotiable(false);
      setAllDay(false);
      setErrors({});
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

  const handleDeleteAnnouncement = (id: number) => {
    Alert.alert(texts.deleteConfirm, texts.deleteDesc, [
      { text: texts.cancel, style: 'cancel' },
      {
        text: texts.delete, style: 'destructive',
        onPress: async () => {
          try { await deleteAnnouncementMutation.mutateAsync(id); }
          catch (error: any) { Alert.alert(ru ? 'Ошибка' : 'Xato', error.message); }
        }
      },
    ]);
  };

  const togglePaymentType = (value: string) => {
    const updated = formData.paymentTypes.includes(value)
      ? formData.paymentTypes.filter(v => v !== value)
      : [...formData.paymentTypes, value];
    setFormData(p => ({ ...p, paymentTypes: updated }));
    if (errors.paymentTypes) setErrors(e => ({ ...e, paymentTypes: '' }));
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

  const renderAnnouncement = useCallback(({ item }: { item: Announcement }) => {
    const isOwner = item.customerId === user?.id;
    const botLink = item.botSourceChatId && item.botSourceMessageId
      ? buildBotSourceLink(item.botSourceChatId, item.botSourceMessageId)
      : null;
    return (
      <Card style={styles.announcementCard}>
        <View style={styles.announcementHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt, language)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.photoUrls && item.photoUrls.length > 0 && (
              <Ionicons name="camera-outline" size={18} color={colors.mutedForeground} testID={`icon-photos-${item.id}`} />
            )}
            {botLink && (
              <TouchableOpacity onPress={() => Linking.openURL(botLink)} testID={`button-telegram-source-${item.id}`}>
                <Ionicons name="open-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity onPress={() => handleDeleteAnnouncement(item.id)} testID={`button-delete-announcement-${item.id}`}>
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {getRegionName(item.originRegion, language)} → {getRegionName(item.destinationRegion, language)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="car-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {getTransportTypeLabel(item.transportType, language)}
              {item.vehicleCount && item.vehicleCount > 1 ? `  ×${item.vehicleCount}` : ''}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.foreground }]}>
              {Number(item.price) > 0 ? `${Number(item.price).toLocaleString()} UZS` : (ru ? 'Договорная' : 'Kelishiladi')}
            </Text>
          </View>
        </View>
        {item.photoUrls && item.photoUrls.length > 0 && (
          <PhotoGallery photoUrls={item.photoUrls} language={language} />
        )}
      </Card>
    );
  }, [user?.id, language, colors, ru, handleDeleteAnnouncement]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{texts.screenTitle}</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{texts.count(announcements.length)}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="megaphone-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{texts.noAnnouncements}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.noAnnouncementsDesc}</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          renderItem={renderAnnouncement}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[colors.primary]} />}
          testID="announcements-list"
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={10}
          initialNumToRender={8}
        />
      )}

      {isCustomer && (
        <View style={styles.fabGroup}>
          <TouchableOpacity style={[styles.fabAi, { backgroundColor: '#7c3aed' }]} onPress={() => setShowAiModal(true)} testID="button-ai-announcement">
            <Ionicons name="sparkles" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)} testID="button-create-announcement">
            <Ionicons name="add" size={28} color="white" />
          </TouchableOpacity>
        </View>
      )}

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
        userPhone={safeUserPhone}
      />

      <Modal visible={showModal} animationType="slide" transparent={false} onRequestClose={() => { setShowModal(false); setFormData(emptyForm(safeUserPhone)); setPriceNegotiable(false); setAllDay(false); setErrors({}); }}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setShowModal(false); setFormData(emptyForm(safeUserPhone)); setPriceNegotiable(false); setAllDay(false); setErrors({}); }}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>{texts.cancel}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{texts.create}</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>

            <FieldRow icon="pricetag-outline" iconColor={colors.primary}>
              <Input label={texts.titleLabel} value={formData.title}
                onChangeText={(v) => { setFormData(p => ({ ...p, title: v })); if (errors.title) setErrors(e => ({ ...e, title: '' })); }}
                error={errors.title} testID="input-announcement-title" />
            </FieldRow>

            <FieldRow icon="location-outline" iconColor={colors.primary}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.origin}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.originRegion ? colors.destructive : colors.border }]} onPress={() => setShowOriginPicker(true)} testID="button-select-origin-region">
                <Text style={{ color: formData.originRegion ? colors.foreground : colors.mutedForeground }}>
                  {formData.originRegion ? getRegionName(formData.originRegion, language) : texts.selectRegion}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.originRegion ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.originRegion}</Text> : null}
            </FieldRow>

            {formData.originRegion ? (
              <FieldRow icon="map-outline" iconColor={colors.primary}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.originDistrict}</Text>
                <TouchableOpacity style={[styles.selectButton, { borderColor: colors.border }]} onPress={() => setShowOriginDistrictPicker(true)}>
                  <Text style={{ color: formData.originDistrict ? colors.foreground : colors.mutedForeground }}>
                    {formData.originDistrict ? getDistrictName(formData.originRegion, formData.originDistrict) : texts.selectDistrict}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </FieldRow>
            ) : null}

            <FieldRow icon="navigate-outline" iconColor={colors.primary}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.destination}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.destinationRegion ? colors.destructive : colors.border }]} onPress={() => setShowDestPicker(true)} testID="button-select-destination-region">
                <Text style={{ color: formData.destinationRegion ? colors.foreground : colors.mutedForeground }}>
                  {formData.destinationRegion ? getRegionName(formData.destinationRegion, language) : texts.selectRegion}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.destinationRegion ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.destinationRegion}</Text> : null}
            </FieldRow>

            {formData.destinationRegion ? (
              <FieldRow icon="map-outline" iconColor={colors.primary}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.destinationDistrict}</Text>
                <TouchableOpacity style={[styles.selectButton, { borderColor: colors.border }]} onPress={() => setShowDestDistrictPicker(true)}>
                  <Text style={{ color: formData.destinationDistrict ? colors.foreground : colors.mutedForeground }}>
                    {formData.destinationDistrict ? getDistrictName(formData.destinationRegion, formData.destinationDistrict) : texts.selectDistrict}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </FieldRow>
            ) : null}

            <FieldRow icon="car-outline" iconColor={colors.primary}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.transportType}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.transportType ? colors.destructive : colors.border }]} onPress={() => setShowTypePicker(true)} testID="button-select-transport-type">
                <Text style={{ color: formData.transportType ? colors.foreground : colors.mutedForeground }}>
                  {formData.transportType ? getTransportTypeLabel(formData.transportType, language) : texts.selectType}
                </Text>
                <Ionicons name="chevron-down-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.transportType ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.transportType}</Text> : null}
            </FieldRow>

            <FieldRow icon="layers-outline" iconColor={colors.primary}>
              <Input label={texts.vehicleCount} value={formData.vehicleCount}
                onChangeText={(v) => { setFormData(p => ({ ...p, vehicleCount: v })); if (errors.vehicleCount) setErrors(e => ({ ...e, vehicleCount: '' })); }}
                keyboardType="numeric" error={errors.vehicleCount} testID="input-vehicle-count" />
            </FieldRow>

            <FieldRow icon="cube-outline" iconColor={colors.primary}>
              <Input label={texts.weightTons} value={formData.weightTons}
                onChangeText={(v) => { setFormData(p => ({ ...p, weightTons: v })); if (errors.weightTons) setErrors(e => ({ ...e, weightTons: '' })); }}
                keyboardType="decimal-pad" error={errors.weightTons} testID="input-weight-tons" />
            </FieldRow>

            <FieldRow icon="cash-outline" iconColor={colors.primary}>
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
            </FieldRow>

            <FieldRow icon="calendar-outline" iconColor={colors.primary}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{texts.loadDate}</Text>
              <TouchableOpacity style={[styles.selectButton, { borderColor: errors.loadDate ? colors.destructive : colors.border }]} onPress={() => setShowDatePicker(true)} testID="select-load-date">
                <Text style={{ color: formData.loadDate ? colors.foreground : colors.mutedForeground }}>
                  {formData.loadDate || texts.selectDate}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {errors.loadDate ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.loadDate}</Text> : null}
            </FieldRow>

            <FieldRow icon="time-outline" iconColor={colors.primary}>
              <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8, marginBottom: 4 }]}>{texts.loadingTime}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{ru ? 'В течение дня' : 'kun davomida'}</Text>
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
                    <Text style={{ color: formData.loadingTime ? colors.foreground : colors.mutedForeground }}>
                      {formData.loadingTime || texts.selectTime}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {errors.loadingTime ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.loadingTime}</Text> : null}
                </>
              )}
            </FieldRow>

            <FieldRow icon="card-outline" iconColor={colors.primary}>
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
            </FieldRow>

            <FieldRow icon="call-outline" iconColor={colors.primary}>
              <Input label={texts.phone} value={formData.contactPhone}
                onChangeText={(v) => { setFormData(p => ({ ...p, contactPhone: v })); if (errors.contactPhone) setErrors(e => ({ ...e, contactPhone: '' })); }}
                keyboardType="phone-pad" error={errors.contactPhone} testID="input-contact-phone" />
            </FieldRow>

            <FieldRow icon="document-text-outline" iconColor={colors.primary}>
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
            </FieldRow>

            <FieldRow icon="camera-outline" iconColor={colors.primary}>
              <PhotoPickerField
                photos={formData.photoUrls}
                onChange={(urls) => setFormData(p => ({ ...p, photoUrls: urls }))}
                language={language}
              />
            </FieldRow>

            <View style={styles.buttonRow}>
              <Button title={texts.publish} onPress={handleSubmit} loading={createAnnouncementMutation.isPending} testID="button-submit-announcement" />
            </View>

            <TouchableOpacity style={[styles.templateButton, { borderColor: colors.primary }]} onPress={() => setShowTemplateModal(true)} testID="button-save-template">
              <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
              <Text style={[styles.templateButtonText, { color: colors.primary }]}>{texts.saveTemplate}</Text>
            </TouchableOpacity>

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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  count: { fontSize: 14 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 16, marginTop: 12, textAlign: 'center' },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
  announcementCard: { marginBottom: 12, padding: 16 },
  announcementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDate: { fontSize: 12 },
  detailsContainer: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, flex: 1 },
  fabGroup: { position: 'absolute', bottom: 24, right: 24, alignItems: 'center', gap: 12 },
  fabAi: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  cancelText: { fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  formScroll: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 40 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 10 },
  fieldIcon: { width: 28, alignItems: 'center', paddingTop: 14 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  selectButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
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
  aiToastBanner: { position: 'absolute', bottom: 90, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, zIndex: 999 },
  aiToastText: { color: 'white', fontSize: 15, fontWeight: '600', flex: 1 },
  negotiableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  negotiableToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  negotiableLabel: { fontSize: 14, fontWeight: '500' },
  checkboxBox: { width: 20, height: 20, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
