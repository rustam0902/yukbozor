import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCreateOrder, useUpdateOrder, useOrder, LocationPoint } from '../hooks/useOrders';
import { trackEvent } from '../services/analytics';
import { useTemplates, useCreateTemplate, useDeleteTemplate, OrderTemplate } from '../hooks/useTemplates';
import { uzbekistanRegions, getDistrictsByRegion, getRegionDisplayName, getDistrictDisplayName } from '../constants/data/uzbekistan-regions';
import { transportTypes, getTransportTypeLabel } from '../constants/data/transport-types';
import { TimePickerModal } from '../components/TimePickerModal';
import { PhotoPickerField } from '../components/PhotoPickerField';
import { ALL_DAY_VALUE } from '../utils/loadingTimeUtils';

interface CreateOrderScreenProps {
  navigation: any;
  route?: any;
}

interface LocationPointState {
  region: string;
  districts: string[];
}

export function CreateOrderScreen({ navigation, route }: CreateOrderScreenProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  
  const [title, setTitle] = useState('');
  const [originPoints, setOriginPoints] = useState<LocationPointState[]>([{ region: '', districts: [''] }]);
  const [destinationPoints, setDestinationPoints] = useState<LocationPointState[]>([{ region: '', districts: [''] }]);
  const [transportType, setTransportType] = useState('');
  const [weightTons, setWeightTons] = useState('');
  const [priceWithVat, setPriceWithVat] = useState('');
  const [loadDate, setLoadDate] = useState('');
  const [loadingTime, setLoadingTime] = useState('09:00');
  const [allDay, setAllDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [requiresCollateral, setRequiresCollateral] = useState(false);
  const [isDangerous, setIsDangerous] = useState(false);
  const [isNonstandard, setIsNonstandard] = useState(false);
  const [isPartialLoad, setIsPartialLoad] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  const [showRegionPicker, setShowRegionPicker] = useState<{ type: 'origin' | 'destination', pointIndex: number } | null>(null);
  const [showDistrictPicker, setShowDistrictPicker] = useState<{ type: 'origin' | 'destination', pointIndex: number, districtIndex: number } | null>(null);
  const [showTransportPicker, setShowTransportPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  const editOrderId: number | undefined = route?.params?.orderId;
  const isEditMode = !!editOrderId;

  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const { data: editOrder } = useOrder(editOrderId ?? 0);
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const createTemplateMutation = useCreateTemplate();
  const deleteTemplateMutation = useDeleteTemplate();

  // Load existing order data in edit mode
  useEffect(() => {
    if (!isEditMode || !editOrder) return;
    if (editOrder.title) setTitle(editOrder.title);
    if (editOrder.transportType) setTransportType(editOrder.transportType);
    if (editOrder.weightTons) setWeightTons(String(editOrder.weightTons));
    if (editOrder.priceWithVat) setPriceWithVat(String(editOrder.priceWithVat));
    const dateStr = editOrder.loadDate || editOrder.loadingDate;
    if (dateStr) {
      // loadDate is stored as "YYYY-MM-DD HH:mm" or similar — extract date part
      setLoadDate(dateStr.substring(0, 10));
      const timePart = dateStr.length > 10 ? dateStr.substring(11, 16) : '';
      if (timePart) setLoadingTime(timePart);
    }
    if (editOrder.loadingTime === ALL_DAY_VALUE) {
      setAllDay(true);
      setLoadingTime('09:00');
    } else {
      setAllDay(false);
    }
    if (editOrder.notes) setNotes(editOrder.notes);
    if (editOrder.requiresCollateral !== undefined) setRequiresCollateral(editOrder.requiresCollateral);
    if (editOrder.isDangerous !== undefined) setIsDangerous(editOrder.isDangerous);
    if (editOrder.isNonstandard !== undefined) setIsNonstandard(editOrder.isNonstandard);
    if (editOrder.isPartialLoad !== undefined) setIsPartialLoad(editOrder.isPartialLoad);
    if (Array.isArray(editOrder.photoUrls) && editOrder.photoUrls.length > 0) setPhotoUrls(editOrder.photoUrls);
    if (editOrder.originPoints && editOrder.originPoints.length > 0) {
      setOriginPoints(editOrder.originPoints.map(p => ({ region: p.region, districts: p.districts.length > 0 ? p.districts : [''] })));
    } else if (editOrder.originRegion) {
      setOriginPoints([{ region: editOrder.originRegion, districts: editOrder.originDistrict?.length ? editOrder.originDistrict : [''] }]);
    }
    if (editOrder.destinationPoints && editOrder.destinationPoints.length > 0) {
      setDestinationPoints(editOrder.destinationPoints.map(p => ({ region: p.region, districts: p.districts.length > 0 ? p.districts : [''] })));
    } else if (editOrder.destinationRegion) {
      setDestinationPoints([{ region: editOrder.destinationRegion, districts: editOrder.destinationDistrict?.length ? editOrder.destinationDistrict : [''] }]);
    }
  }, [editOrder, isEditMode]);

  const texts = {
    ru: {
      newOrder: isEditMode ? 'Редактировать заказ' : 'Новый заказ',
      orderTitle: 'Название заказа',
      route: 'Маршрут',
      originRegion: 'Откуда',
      destinationRegion: 'Куда',
      selectRegion: 'Выберите регион',
      selectDistrict: 'Выберите район',
      addPoint: 'Добавить точку',
      addDistrict: 'Добавить район',
      cargo: 'Груз',
      weightTons: 'Вес (тонн)',
      enterWeight: 'Введите вес',
      transportType: 'Тип транспорта',
      selectTransport: 'Выберите транспорт',
      conditions: 'Условия',
      priceWithVat: 'Цена с НДС (сум)',
      priceWithoutVat: 'Цена без НДС',
      enterPrice: 'Введите цену',
      loadDate: 'Дата погрузки',
      selectDate: 'Выберите дату',
      loadingTime: 'Время погрузки',
      selectTime: 'Выберите время',
      requiresCollateral: 'Работать с залогом 2%',
      collateralAmount: 'Сумма залога',
      flags: 'Характеристики груза',
      isDangerous: 'Опасный груз',
      isNonstandard: 'Нестандартный груз',
      isPartialLoad: 'Частичная загрузка',
      notes: 'Примечания',
      enterNotes: 'Дополнительная информация...',
      createOrder: isEditMode ? 'Сохранить изменения' : 'Создать заказ',
      success: 'Успешно',
      orderCreated: isEditMode ? 'Заказ успешно обновлён' : 'Заказ успешно создан',
      error: 'Ошибка',
      fillRequired: 'Заполните все обязательные поля',
      templates: 'Шаблоны',
      noTemplates: 'Нет сохранённых шаблонов',
      loadTemplate: 'Загрузить',
      saveAsTemplate: 'Сохранить как шаблон',
      templateName: 'Название шаблона',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      close: 'Закрыть',
      point: 'Точка',
      remove: 'Удалить',
    },
    uz: {
      newOrder: isEditMode ? 'Buyurtmani tahrirlash' : 'Yangi buyurtma',
      orderTitle: 'Buyurtma nomi',
      route: 'Yo\'nalish',
      originRegion: 'Qayerdan',
      destinationRegion: 'Qayerga',
      selectRegion: 'Viloyatni tanlang',
      selectDistrict: 'Tumanni tanlang',
      addPoint: 'Nuqta qo\'shish',
      addDistrict: 'Tuman qo\'shish',
      cargo: 'Yuk',
      weightTons: 'Og\'irligi (tonna)',
      enterWeight: 'Og\'irlikni kiriting',
      transportType: 'Transport turi',
      selectTransport: 'Transportni tanlang',
      conditions: 'Shartlar',
      priceWithVat: 'QQS bilan narx (so\'m)',
      priceWithoutVat: 'QQS\'siz narx',
      enterPrice: 'Narxni kiriting',
      loadDate: 'Yuklash sanasi',
      selectDate: 'Sanani tanlang',
      loadingTime: 'Yuklash vaqti',
      selectTime: 'Vaqtni tanlang',
      requiresCollateral: 'Garov bilan ishlash 2%',
      collateralAmount: 'Garov summasi',
      flags: 'Yuk xususiyatlari',
      isDangerous: 'Xavfli yuk',
      isNonstandard: 'Nostandart yuk',
      isPartialLoad: 'Qisman yuklash',
      notes: 'Izohlar',
      enterNotes: 'Qo\'shimcha ma\'lumotlar...',
      createOrder: isEditMode ? 'O\'zgarishlarni saqlash' : 'Buyurtma yaratish',
      success: 'Muvaffaqiyatli',
      orderCreated: isEditMode ? 'Buyurtma muvaffaqiyatli yangilandi' : 'Buyurtma muvaffaqiyatli yaratildi',
      error: 'Xato',
      fillRequired: 'Barcha majburiy maydonlarni to\'ldiring',
      templates: 'Shablonlar',
      noTemplates: 'Saqlangan shablonlar yo\'q',
      loadTemplate: 'Yuklash',
      saveAsTemplate: 'Shablon sifatida saqlash',
      templateName: 'Shablon nomi',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      delete: 'O\'chirish',
      close: 'Yopish',
      point: 'Nuqta',
      remove: 'O\'chirish',
    }
  };

  const t = texts[language];

  const priceNum = parseFloat(priceWithVat) || 0;
  const priceWithoutVatNum = user?.ndsPayer ? Math.round(priceNum * 100 / 112) : priceNum;
  const collateralAmount = requiresCollateral ? Math.floor(priceNum * 0.02) : 0;

  const dateOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    const monthNames = language === 'ru' 
      ? ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
      : ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
    const dayNames = language === 'ru'
      ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
      : ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const value = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      const day = date.getDate();
      const month = monthNames[date.getMonth()];
      const label = `${dayName}, ${day} ${month}`;
      options.push({ value, label });
    }
    return options;
  }, [language]);

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('ru-RU').replace(/,/g, ' ');
  };

  const addOriginPoint = () => {
    setOriginPoints([...originPoints, { region: '', districts: [''] }]);
  };

  const removeOriginPoint = (index: number) => {
    if (originPoints.length > 1) {
      setOriginPoints(originPoints.filter((_, i) => i !== index));
    }
  };

  const updateOriginRegion = (pointIndex: number, region: string) => {
    const updated = [...originPoints];
    updated[pointIndex] = { region, districts: [''] };
    setOriginPoints(updated);
  };

  const addOriginDistrict = (pointIndex: number) => {
    const updated = [...originPoints];
    updated[pointIndex].districts.push('');
    setOriginPoints(updated);
  };

  const removeOriginDistrict = (pointIndex: number, districtIndex: number) => {
    const updated = [...originPoints];
    if (updated[pointIndex].districts.length > 1) {
      updated[pointIndex].districts = updated[pointIndex].districts.filter((_, i) => i !== districtIndex);
      setOriginPoints(updated);
    }
  };

  const updateOriginDistrict = (pointIndex: number, districtIndex: number, district: string) => {
    const updated = [...originPoints];
    updated[pointIndex].districts[districtIndex] = district;
    setOriginPoints(updated);
  };

  const addDestinationPoint = () => {
    setDestinationPoints([...destinationPoints, { region: '', districts: [''] }]);
  };

  const removeDestinationPoint = (index: number) => {
    if (destinationPoints.length > 1) {
      setDestinationPoints(destinationPoints.filter((_, i) => i !== index));
    }
  };

  const updateDestinationRegion = (pointIndex: number, region: string) => {
    const updated = [...destinationPoints];
    updated[pointIndex] = { region, districts: [''] };
    setDestinationPoints(updated);
  };

  const addDestinationDistrict = (pointIndex: number) => {
    const updated = [...destinationPoints];
    updated[pointIndex].districts.push('');
    setDestinationPoints(updated);
  };

  const removeDestinationDistrict = (pointIndex: number, districtIndex: number) => {
    const updated = [...destinationPoints];
    if (updated[pointIndex].districts.length > 1) {
      updated[pointIndex].districts = updated[pointIndex].districts.filter((_, i) => i !== districtIndex);
      setDestinationPoints(updated);
    }
  };

  const updateDestinationDistrict = (pointIndex: number, districtIndex: number, district: string) => {
    const updated = [...destinationPoints];
    updated[pointIndex].districts[districtIndex] = district;
    setDestinationPoints(updated);
  };

  const loadTemplate = (template: OrderTemplate) => {
    setTitle(template.title || '');
    setTransportType(template.transportType || '');
    setWeightTons(template.weightTons?.toString() || '');
    setPriceWithVat(template.priceWithVat?.toString() || '');
    setLoadDate('');
    if (template.loadingTime === ALL_DAY_VALUE) {
      setAllDay(true);
      setLoadingTime('09:00');
    } else {
      setAllDay(false);
      setLoadingTime(template.loadingTime || '09:00');
    }
    setRequiresCollateral(template.requiresCollateral || false);
    setIsDangerous(template.isDangerous || false);
    setIsNonstandard(template.isNonstandard || false);
    setIsPartialLoad(template.isPartialLoad || false);
    setNotes(template.notes || '');
    
    if (template.originPoints && template.originPoints.length > 0) {
      setOriginPoints(template.originPoints.map(p => ({
        region: p.region,
        districts: p.districts.length > 0 ? p.districts : ['']
      })));
    } else if (template.originRegion) {
      setOriginPoints([{
        region: template.originRegion,
        districts: template.originDistrict && template.originDistrict.length > 0 ? template.originDistrict : ['']
      }]);
    }
    
    if (template.destinationPoints && template.destinationPoints.length > 0) {
      setDestinationPoints(template.destinationPoints.map(p => ({
        region: p.region,
        districts: p.districts.length > 0 ? p.districts : ['']
      })));
    } else if (template.destinationRegion) {
      setDestinationPoints([{
        region: template.destinationRegion,
        districts: template.destinationDistrict && template.destinationDistrict.length > 0 ? template.destinationDistrict : ['']
      }]);
    }
    
    setShowTemplates(false);
  };

  useEffect(() => {
    const templateId = route?.params?.templateId;
    if (templateId && templates.length > 0) {
      const template = templates.find((t: OrderTemplate) => t.id === templateId);
      if (template) {
        loadTemplate(template);
      }
    }
  }, [route?.params?.templateId, templates]);

  const saveTemplate = () => {
    if (!templateName.trim()) {
      Alert.alert(t.error, language === 'ru' ? 'Введите название шаблона' : 'Shablon nomini kiriting');
      return;
    }
    
    const cleanedOriginPoints = originPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    
    const cleanedDestinationPoints = destinationPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    
    const templateRequiredFields = [
      { check: cleanedOriginPoints.length === 0, nameRu: 'Откуда', nameUz: 'Qayerdan' },
      { check: cleanedDestinationPoints.length === 0, nameRu: 'Куда', nameUz: 'Qayerga' },
      { check: !transportType, nameRu: 'Тип транспорта', nameUz: 'Transport turi' },
      { check: !priceWithVat, nameRu: 'Цена с НДС', nameUz: 'QQS bilan narx' },
    ];
    const missingTemplateField = templateRequiredFields.find(f => f.check);
    if (missingTemplateField) {
      const fieldName = language === 'ru' ? missingTemplateField.nameRu : missingTemplateField.nameUz;
      const msg = language === 'ru'
        ? `Заполните поле: ${fieldName}`
        : `Maydonni to'ldiring: ${fieldName}`;
      Alert.alert(t.error, msg);
      return;
    }
    
    createTemplateMutation.mutate({
      name: templateName,
      title: title || templateName,
      originRegion: cleanedOriginPoints[0].region,
      originDistrict: cleanedOriginPoints[0].districts,
      destinationRegion: cleanedDestinationPoints[0].region,
      destinationDistrict: cleanedDestinationPoints[0].districts,
      originPoints: cleanedOriginPoints,
      destinationPoints: cleanedDestinationPoints,
      transportType,
      weightTons: weightTons ? parseFloat(weightTons) : 1,
      priceWithVat: parseFloat(priceWithVat),
      loadDate: loadDate || undefined,
      loadingTime: allDay ? ALL_DAY_VALUE : (loadingTime || undefined),
      requiresCollateral,
      isDangerous,
      isNonstandard,
      isPartialLoad,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setTemplateName('');
        Alert.alert(t.success, language === 'ru' ? 'Шаблон сохранён' : 'Shablon saqlandi');
      },
      onError: (error: any) => {
        Alert.alert(t.error, error.message);
      }
    });
  };

  const handleCreateOrder = async () => {
    const cleanedOriginPoints = originPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    
    const cleanedDestinationPoints = destinationPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    
    const requiredFields = [
      { check: cleanedOriginPoints.length === 0, nameRu: 'Откуда', nameUz: 'Qayerdan' },
      { check: cleanedDestinationPoints.length === 0, nameRu: 'Куда', nameUz: 'Qayerga' },
      { check: !transportType, nameRu: 'Тип транспорта', nameUz: 'Transport turi' },
      { check: !priceWithVat, nameRu: 'Цена с НДС', nameUz: 'QQS bilan narx' },
      { check: !loadDate, nameRu: 'Дата погрузки', nameUz: 'Yuklash sanasi' },
    ];
    const missingField = requiredFields.find(f => f.check);
    if (missingField) {
      const fieldName = language === 'ru' ? missingField.nameRu : missingField.nameUz;
      const msg = language === 'ru'
        ? `Заполните поле: ${fieldName}`
        : `Maydonni to'ldiring: ${fieldName}`;
      Alert.alert(t.error, msg);
      return;
    }
    
    const orderData = {
      title: title || undefined,
      originRegion: cleanedOriginPoints[0].region,
      originDistrict: cleanedOriginPoints[0].districts,
      destinationRegion: cleanedDestinationPoints[0].region,
      destinationDistrict: cleanedDestinationPoints[0].districts,
      originPoints: cleanedOriginPoints,
      destinationPoints: cleanedDestinationPoints,
      transportType,
      weightTons: weightTons ? parseFloat(weightTons) : undefined,
      priceWithVat: parseFloat(priceWithVat),
      loadDate: loadDate || undefined,
      loadingTime: allDay ? ALL_DAY_VALUE : (loadingTime || undefined),
      notes: notes || undefined,
      requiresCollateral,
      isDangerous,
      isNonstandard,
      isPartialLoad,
      photoUrls,
    };

    try {
      if (isEditMode && editOrderId) {
        await updateOrderMutation.mutateAsync({ orderId: editOrderId, data: orderData });
      } else {
        await createOrderMutation.mutateAsync(orderData);
        trackEvent('create_order', 'CreateOrderScreen');
      }
      
      Alert.alert(t.success, t.orderCreated, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      const serverMsg = error.response?.data?.message || error.response?.data?.error;
      Alert.alert(t.error, serverMsg || error.message || (language === 'ru' ? 'Не удалось сохранить заказ' : 'Buyurtmani saqlash mumkin bo\'lmadi'));
    }
  };

  const renderLocationPoint = (
    type: 'origin' | 'destination',
    point: LocationPointState,
    pointIndex: number,
    points: LocationPointState[],
    updateRegion: (idx: number, region: string) => void,
    addDistrict: (idx: number) => void,
    removeDistrict: (pIdx: number, dIdx: number) => void,
    updateDistrict: (pIdx: number, dIdx: number, district: string) => void,
    removePoint: (idx: number) => void
  ) => (
    <Card key={`${type}-${pointIndex}`} style={styles.pointCard}>
      <View style={styles.pointHeader}>
        <Text style={[styles.pointTitle, { color: colors.foreground }]}>
          {t.point} #{pointIndex + 1}
        </Text>
        {points.length > 1 && (
          <TouchableOpacity onPress={() => removePoint(pointIndex)} testID={`button-remove-${type}-point-${pointIndex}`}>
            <Ionicons name="close-circle" size={24} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={[styles.inputLabel, { color: colors.foreground }]}>
        {type === 'origin' ? t.originRegion : t.destinationRegion} *
      </Text>
      <TouchableOpacity
        style={[styles.selectInput, { borderColor: colors.border }]}
        onPress={() => setShowRegionPicker({ type, pointIndex })}
        testID={`select-${type}-region-${pointIndex}`}
      >
        <Text style={[styles.selectText, { color: point.region ? colors.foreground : colors.mutedForeground }]}>
          {point.region ? getRegionDisplayName(point.region, language) : t.selectRegion}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
      
      {point.region && (
        <View style={styles.districtsContainer}>
          <View style={styles.districtHeader}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>
              {t.selectDistrict}
            </Text>
            <TouchableOpacity onPress={() => addDistrict(pointIndex)} testID={`button-add-${type}-district-${pointIndex}`}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {point.districts.map((district, districtIndex) => (
            <View key={districtIndex} style={styles.districtRow}>
              <TouchableOpacity
                style={[styles.selectInput, styles.districtSelect, { borderColor: colors.border }]}
                onPress={() => setShowDistrictPicker({ type, pointIndex, districtIndex })}
                testID={`select-${type}-district-${pointIndex}-${districtIndex}`}
              >
                <Text style={[styles.selectText, { color: district ? colors.foreground : colors.mutedForeground }]}>
                  {district ? getDistrictDisplayName(district, language) : t.selectDistrict}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              {point.districts.length > 1 && (
                <TouchableOpacity 
                  onPress={() => removeDistrict(pointIndex, districtIndex)}
                  testID={`button-remove-${type}-district-${pointIndex}-${districtIndex}`}
                >
                  <Ionicons name="close-circle" size={24} color={colors.destructive} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="button-back">
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>{t.newOrder}</Text>
        <TouchableOpacity onPress={() => setShowTemplates(true)} testID="button-templates">
          <Ionicons name="folder-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.section}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.orderTitle}</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            value={title}
            onChangeText={setTitle}
            placeholder={language === 'ru' ? 'Например: Стройматериалы' : 'Masalan: Qurilish materiallari'}
            placeholderTextColor={colors.mutedForeground}
            testID="input-order-title"
          />
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.originRegion}</Text>
            <TouchableOpacity onPress={addOriginPoint} testID="button-add-origin-point">
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {originPoints.map((point, index) => 
            renderLocationPoint(
              'origin', point, index, originPoints,
              updateOriginRegion, addOriginDistrict, removeOriginDistrict, updateOriginDistrict, removeOriginPoint
            )
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.destinationRegion}</Text>
            <TouchableOpacity onPress={addDestinationPoint} testID="button-add-destination-point">
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {destinationPoints.map((point, index) => 
            renderLocationPoint(
              'destination', point, index, destinationPoints,
              updateDestinationRegion, addDestinationDistrict, removeDestinationDistrict, updateDestinationDistrict, removeDestinationPoint
            )
          )}
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.cargo}</Text>
          
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.transportType} *</Text>
          <TouchableOpacity
            style={[styles.selectInput, { borderColor: colors.border }]}
            onPress={() => setShowTransportPicker(true)}
            testID="select-transport-type"
          >
            <Text style={[styles.selectText, { color: transportType ? colors.foreground : colors.mutedForeground }]}>
              {transportType ? getTransportTypeLabel(transportType, language) : t.selectTransport}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.weightTons}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              value={weightTons}
              onChangeText={setWeightTons}
              keyboardType="numeric"
              placeholder={t.enterWeight}
              placeholderTextColor={colors.mutedForeground}
              testID="input-weight"
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.conditions}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.priceWithVat} *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
              value={priceWithVat}
              onChangeText={setPriceWithVat}
              keyboardType="numeric"
              placeholder={t.enterPrice}
              placeholderTextColor={colors.mutedForeground}
              testID="input-price"
            />
          </View>
          
          {priceNum > 0 && (
            <Text style={[styles.calculatedPrice, { color: colors.mutedForeground }]}>
              {t.priceWithoutVat}: {formatMoney(priceWithoutVatNum)} {language === 'ru' ? 'сум' : 'so\'m'}
            </Text>
          )}
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.loadDate}</Text>
              <TouchableOpacity
                style={[styles.selectInput, { borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
                testID="select-load-date"
              >
                <Ionicons name="calendar-outline" size={20} color={colors.mutedForeground} />
                <Text style={[styles.selectText, { color: loadDate ? colors.foreground : colors.mutedForeground, flex: 1, marginLeft: 8 }]}>
                  {loadDate || t.selectDate}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.halfInput}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.loadingTime}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{language === 'ru' ? 'В течение дня' : 'kun davomida'}</Text>
                <Switch
                  value={allDay}
                  onValueChange={setAllDay}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  testID="switch-all-day"
                />
              </View>
              {!allDay && (
                <TouchableOpacity
                  style={[styles.selectInput, { borderColor: colors.border }]}
                  onPress={() => setShowTimePicker(true)}
                  testID="select-loading-time"
                >
                  <Ionicons name="time-outline" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.selectText, { color: colors.foreground, flex: 1, marginLeft: 8 }]}>
                    {loadingTime}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <View style={styles.switchRow}>
            <View style={styles.switchItem}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.requiresCollateral}</Text>
              <Switch
                value={requiresCollateral}
                onValueChange={setRequiresCollateral}
                trackColor={{ false: colors.border, true: colors.primary }}
                testID="switch-collateral"
              />
            </View>
          </View>
          
          {requiresCollateral && collateralAmount > 0 && (
            <Text style={[styles.calculatedPrice, { color: colors.primary }]}>
              {t.collateralAmount}: {formatMoney(collateralAmount)} {language === 'ru' ? 'сум' : 'so\'m'}
            </Text>
          )}
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.flags}</Text>
          
          <View style={styles.flagsContainer}>
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.isDangerous}</Text>
                <Switch
                  value={isDangerous}
                  onValueChange={setIsDangerous}
                  trackColor={{ false: colors.border, true: colors.destructive }}
                  testID="switch-dangerous"
                />
              </View>
            </View>
            
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.isNonstandard}</Text>
                <Switch
                  value={isNonstandard}
                  onValueChange={setIsNonstandard}
                  trackColor={{ false: colors.border, true: colors.warning }}
                  testID="switch-nonstandard"
                />
              </View>
            </View>
            
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.isPartialLoad}</Text>
                <Switch
                  value={isPartialLoad}
                  onValueChange={setIsPartialLoad}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  testID="switch-partial"
                />
              </View>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.notes}</Text>
          <TextInput
            style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder={t.enterNotes}
            placeholderTextColor={colors.mutedForeground}
            testID="input-notes"
          />
        </Card>

        <Card style={styles.section}>
          <PhotoPickerField
            photos={photoUrls}
            onChange={setPhotoUrls}
            language={language}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>{t.saveAsTemplate}</Text>
          <View style={styles.templateSaveRow}>
            <TextInput
              style={[styles.input, styles.templateInput, { borderColor: colors.border, color: colors.foreground }]}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder={t.templateName}
              placeholderTextColor={colors.mutedForeground}
              testID="input-template-name"
            />
            <Button
              title={t.save}
              onPress={saveTemplate}
              loading={createTemplateMutation.isPending}
              testID="button-save-template"
              style={styles.saveButton}
            />
          </View>
        </Card>

        <Button
          title={t.createOrder}
          onPress={handleCreateOrder}
          loading={createOrderMutation.isPending || updateOrderMutation.isPending}
          testID="button-create-order"
        />
      </ScrollView>

      <Modal visible={showRegionPicker !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.selectRegion}</Text>
              <TouchableOpacity onPress={() => setShowRegionPicker(null)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {uzbekistanRegions.map((region) => (
                <TouchableOpacity
                  key={region.name}
                  style={styles.modalItem}
                  onPress={() => {
                    if (showRegionPicker) {
                      if (showRegionPicker.type === 'origin') {
                        updateOriginRegion(showRegionPicker.pointIndex, region.name);
                      } else {
                        updateDestinationRegion(showRegionPicker.pointIndex, region.name);
                      }
                      setShowRegionPicker(null);
                    }
                  }}
                  testID={`region-option-${region.name}`}
                >
                  <Text style={[styles.modalItemText, { color: colors.foreground }]}>
                    {language === 'ru' ? region.nameRu : region.nameUz}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showDistrictPicker !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.selectDistrict}</Text>
              <TouchableOpacity onPress={() => setShowDistrictPicker(null)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {showDistrictPicker && (() => {
                const points = showDistrictPicker.type === 'origin' ? originPoints : destinationPoints;
                const region = points[showDistrictPicker.pointIndex]?.region;
                const districts = region ? getDistrictsByRegion(region) : [];
                return districts.map((district) => (
                  <TouchableOpacity
                    key={district.name}
                    style={styles.modalItem}
                    onPress={() => {
                      if (showDistrictPicker.type === 'origin') {
                        updateOriginDistrict(showDistrictPicker.pointIndex, showDistrictPicker.districtIndex, district.name);
                      } else {
                        updateDestinationDistrict(showDistrictPicker.pointIndex, showDistrictPicker.districtIndex, district.name);
                      }
                      setShowDistrictPicker(null);
                    }}
                    testID={`district-option-${district.name}`}
                  >
                    <Text style={[styles.modalItemText, { color: colors.foreground }]}>
                      {language === 'ru' ? district.nameRu : district.nameUz}
                    </Text>
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTransportPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.selectTransport}</Text>
              <TouchableOpacity onPress={() => setShowTransportPicker(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {transportTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.modalItem,
                    transportType === type.value && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setTransportType(type.value);
                    setShowTransportPicker(false);
                  }}
                  testID={`transport-option-${type.value}`}
                >
                  <Text style={[styles.modalItemText, { color: colors.foreground }]}>
                    {language === 'ru' ? type.labelRu : type.labelUz}
                  </Text>
                  {transportType === type.value && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onSelect={(time) => setLoadingTime(time)}
        language={language}
        initialValue={loadingTime}
        selectedDate={loadDate ? loadDate.split('-').reverse().join('.') : undefined}
      />

      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.selectDate}</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {dateOptions.map((dateOption) => (
                <TouchableOpacity
                  key={dateOption.value}
                  style={[
                    styles.modalItem,
                    loadDate === dateOption.value && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setLoadDate(dateOption.value);
                    setShowDatePicker(false);
                    const now = new Date();
                    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
                    if (dateOption.value === todayStr && loadingTime) {
                      const [hh, mm] = loadingTime.split(':').map(Number);
                      const sel = new Date();
                      sel.setHours(hh, mm, 0, 0);
                      const nowPlus5 = new Date(Date.now() + 5 * 60 * 1000);
                      if (sel.getTime() <= nowPlus5.getTime()) {
                        if (nowPlus5.getDate() !== now.getDate()) {
                          setLoadingTime('23:55');
                        } else {
                          const totalMin = nowPlus5.getHours() * 60 + nowPlus5.getMinutes();
                          const rounded = Math.ceil(totalMin / 5) * 5;
                          const newH = Math.min(Math.floor(rounded / 60), 23);
                          const newM = rounded % 60;
                          setLoadingTime(String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0'));
                        }
                      }
                    }
                  }}
                  testID={`date-option-${dateOption.value}`}
                >
                  <Text style={[styles.modalItemText, { color: colors.foreground }]}>
                    {dateOption.label}
                  </Text>
                  {loadDate === dateOption.value && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTemplates} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t.templates}</Text>
              <TouchableOpacity onPress={() => setShowTemplates(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {templates.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t.noTemplates}</Text>
              ) : (
                templates.map((template) => (
                  <View key={template.id} style={[styles.templateItem, { borderColor: colors.border }]}>
                    <View style={styles.templateInfo}>
                      <Text style={[styles.templateName, { color: colors.foreground }]}>{template.name}</Text>
                      <Text style={[styles.templateDate, { color: colors.mutedForeground }]}>
                        {new Date(template.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.templateActions}>
                      <TouchableOpacity
                        onPress={() => loadTemplate(template)}
                        style={[styles.templateButton, { backgroundColor: colors.primary }]}
                        testID={`button-load-template-${template.id}`}
                      >
                        <Text style={styles.templateButtonText}>{t.loadTemplate}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteTemplateMutation.mutate(template.id)}
                        testID={`button-delete-template-${template.id}`}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  selectText: {
    fontSize: 16,
  },
  pointCard: {
    padding: 12,
    marginBottom: 8,
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  districtsContainer: {
    marginTop: 12,
  },
  districtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  districtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  districtSelect: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  halfInput: {
    flex: 1,
  },
  switchRow: {
    marginTop: 12,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    flex: 1,
  },
  flagsContainer: {
    marginTop: 8,
  },
  calculatedPrice: {
    fontSize: 14,
    marginTop: 8,
  },
  templateSaveRow: {
    flexDirection: 'row',
    gap: 8,
  },
  templateInput: {
    flex: 1,
  },
  saveButton: {
    minWidth: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
  },
  templateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '500',
  },
  templateDate: {
    fontSize: 12,
    marginTop: 4,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  templateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  templateButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
