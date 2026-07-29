import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable,
  ScrollView, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform, Linking, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { uzbekistanRegions } from '../constants/data/uzbekistan-regions';
import { transportTypes } from '../constants/data/transport-types';
import { API_ENDPOINTS } from '../constants/api';

// NOTE: expo-av is a native module. Voice recording only works in a binary that includes
// the expo-av plugin (app.json). Requires a new EAS native Build — cannot be added via OTA.
let Audio: any = null;
try { const av = require('expo-av'); Audio = av.Audio; } catch {}

export interface ParsedAnnouncement {
  title: string;
  originRegion: string;
  destinationRegion: string;
  originDistrict?: string[];
  destinationDistrict?: string[];
  transportType: string;
  vehicleCount: number;
  weightTons?: string;
  loadDate?: string;
  loadingTime?: string;
  price?: string;
  paymentTypes?: string[];
  notes?: string;
  contactPhone: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  ready?: boolean;
  ts: number;
}

interface ConvItem { role: 'user' | 'assistant'; content: string; }
interface CreateResult { created: number; failed: number; }

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (count: number) => void;
  userPhone?: string;
}

const REGION_OPTS = uzbekistanRegions.map(r => ({ value: r.name, labelRu: r.nameRu, labelUz: r.nameUz }));
const TRANSPORT_OPTS = transportTypes.map(t => ({ value: t.value, labelRu: t.labelRu, labelUz: t.labelUz }));

const LOADING_TIME_OPTS = [
  { value: 'kun davomida', labelRu: 'В течение дня', labelUz: 'Kun davomida' },
  { value: 'ertalab', labelRu: 'Утром', labelUz: 'Ertalab' },
  { value: 'kunduzi', labelRu: 'Днём', labelUz: 'Kunduzi' },
  { value: 'kechqurun', labelRu: 'Вечером', labelUz: 'Kechqurun' },
];

const PAYMENT_TYPE_OPTS = [
  { value: 'cash', labelRu: 'Наличные', labelUz: 'Naqd' },
  { value: 'card', labelRu: 'Карта', labelUz: 'Karta' },
  { value: 'transfer', labelRu: 'Перечисление', labelUz: "O'tkazma" },
];

function regionLabel(v: string, ru: boolean) {
  const r = uzbekistanRegions.find(x => x.name === v);
  return r ? (ru ? r.nameRu : r.nameUz) : v;
}
function transportLabel(v: string, ru: boolean) {
  const t = transportTypes.find(x => x.value === v);
  return t ? (ru ? t.labelRu : t.labelUz) : v;
}
function loadingTimeLabel(v: string | undefined, ru: boolean) {
  if (!v) return '';
  const o = LOADING_TIME_OPTS.find(x => x.value === v);
  return o ? (ru ? o.labelRu : o.labelUz) : v;
}
function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function AiAnnouncementModal({ visible, onClose, onCreated, userPhone }: Props) {
  const { language } = useLanguage();
  const c = Colors.light;
  const ru = language === 'ru';
  // Telegram-registered users have phone like "tg_123456" — don't use as contactPhone
  const safePhone = userPhone?.startsWith('tg_') ? '' : (userPhone || '');

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [convHistory, setConvHistory] = useState<ConvItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [editAnn, setEditAnn] = useState<ParsedAnnouncement[]>([]);
  const [createProgress, setCreateProgress] = useState<{ cur: number; tot: number; ok: number; fail: number } | null>(null);
  const [showPicker, setShowPicker] = useState<{ field: string; idx: number; opts: { value: string; labelRu: string; labelUz: string }[] } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [showResult, setShowResult] = useState<CreateResult | null>(null);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'never_ask_again' | 'unknown'>('unknown');
  const [kbHeight, setKbHeight] = useState(0);

  const recordingRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pressStartRef = useRef<number>(0);
  const handleConfirmRef = useRef<(() => Promise<void>) | null>(null);

  const makeWelcome = useCallback((): ChatMsg => ({
    role: 'assistant',
    text: ru
      ? 'Привет! Я помогу создать объявления о грузе.\n\nОпишите маршрут, тип транспорта и количество машин. Можно сразу несколько направлений.\n\nПример: «Из Ташкента в Самарканд 2 фуры, в Карши 3 рефа»'
      : 'Salom! Men yuk e\'lonlarini yaratishga yordam beraman.\n\nMarshrut, transport turi va mashinalar sonini ayting. Bir vaqtda bir necha yo\'nalish bo\'lishi mumkin.\n\nMasalan: «Toshkentdan Samarqandga 2 fura, Qarshiga 3 ref»',
    ts: 0,
  }), [ru]);

  const resetState = useCallback(() => {
    setChatMsgs([makeWelcome()]);
    setConvHistory([]);
    setInputText('');
    setIsTyping(false);
    setIsReady(false);
    setEditAnn([]);
    setCreateProgress(null);
    setShowPicker(null);
    setIsRecording(false);
    setRecTime(0);
    setShowResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current) {
      try { recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
  }, [makeWelcome]);

  useEffect(() => {
    if (visible) {
      resetState();
      setMicPermission('unknown');
      if (Platform.OS === 'android' && Audio) {
        // Request mic permission proactively after modal animation finishes
        // so the system dialog appears ON TOP of the modal, not behind it
        setTimeout(async () => {
          try {
            const { PermissionsAndroid } = require('react-native');
            const result = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Mikrofonga kirish / Доступ к микрофону',
                message: 'Ovozli e\'lon yaratish uchun / Для голосового создания объявлений',
                buttonNeutral: 'Keyinroq / Позже',
                buttonNegative: 'Bekor / Отмена',
                buttonPositive: 'Ruxsat / Разрешить',
              },
            );
            if (result === PermissionsAndroid.RESULTS.GRANTED) {
              setMicPermission('granted');
            } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              setMicPermission('never_ask_again');
            } else {
              setMicPermission('denied');
            }
          } catch {
            setMicPermission('unknown');
          }
        }, 600);
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) { setKbHeight(0); return; }
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [visible]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  const CONFIRM_PHRASES = ['да', 'да!', 'yes', 'ha', 'ha!', 'ok', 'ок', 'ладно', 'создать', 'верно', 'всё верно', 'подтвердить', 'create'];

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    // If ready — detect verbal confirmation
    if (isReady && CONFIRM_PHRASES.includes(trimmed.toLowerCase())) {
      handleConfirmRef.current?.();
      return;
    }

    const userMsg: ChatMsg = { role: 'user', text: trimmed, ts: Date.now() };
    setChatMsgs(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    scrollToBottom();

    const historySnapshot = convHistory;
    try {
      const res = await api.post(API_ENDPOINTS.aiVoiceAnnouncement, {
        message: trimmed,
        history: historySnapshot,
        language,
        userPhone: safePhone,
      }, { timeout: 35000 });

      const { reply = '', announcements = [], ready } = res.data;
      const safeReply = reply.trim() || (ru ? 'Понял. Продолжайте.' : 'Tushundim. Davom eting.');
      const aiMsg: ChatMsg = { role: 'assistant', text: safeReply, ready: !!ready, ts: Date.now() };
      setChatMsgs(prev => [...prev, aiMsg]);

      setConvHistory([
        ...historySnapshot,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: reply },
      ]);

      // Always update preview cards when announcements present, even before ready
      if (announcements.length > 0) {
        setEditAnn(announcements.map((a: ParsedAnnouncement) => ({
          ...a,
          contactPhone: a.contactPhone || safePhone,
        })));
      }
      if (ready) {
        setIsReady(true);
      }
    } catch (e: any) {
      const errText = e?.response?.data?.error || e.message || 'Unknown error';
      setChatMsgs(prev => [...prev, {
        role: 'assistant',
        text: ru ? `Ошибка: ${errText}. Попробуйте ещё раз.` : `Xatolik: ${errText}. Qayta urining.`,
        ts: Date.now(),
      }]);
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
  }, [isTyping, isReady, convHistory, language, userPhone, ru, scrollToBottom]);

  const transcribeAndSend = async (uri: string) => {
    setIsTyping(true);
    try {
      const formData = new FormData();
      formData.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' } as any);
      formData.append('language', language);
      const res = await api.post(API_ENDPOINTS.aiTranscribe, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35000,
      });
      const transcribed = (res.data?.transcript || res.data?.text || '').trim();
      if (transcribed) {
        await sendMessage(transcribed);
      } else {
        setIsTyping(false);
        Alert.alert(ru ? 'Не распознано' : 'Tanilmadi', ru ? 'Голос не распознан. Попробуйте ещё раз.' : 'Ovoz tanilmadi. Qayta urining.');
      }
    } catch (e: any) {
      setIsTyping(false);
      Alert.alert(ru ? 'Ошибка' : 'Xatolik', e?.response?.data?.error || e.message);
    }
  };

  const openAppSettings = () => {
    // openURL with package: scheme is more reliable than Linking.openSettings() on Android
    Linking.openURL('package:uz.yukbozor.app').catch(() => Linking.openSettings());
  };

  const startRecording = async () => {
    if (!Audio) return;
    try {
      // On Android the permission was already requested proactively when modal opened.
      // Use cached state; only re-request if still unknown.
      let perm = micPermission;

      if (Platform.OS === 'android') {
        if (perm === 'unknown' || perm === 'denied') {
          const { PermissionsAndroid } = require('react-native');
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: ru ? 'Доступ к микрофону' : 'Mikrofonga kirish',
              message: ru
                ? 'Для голосового создания объявлений нужен доступ к микрофону'
                : 'Ovozli e\'lon yaratish uchun mikrofonga kirish kerak',
              buttonNeutral: ru ? 'Спросить позже' : 'Keyinroq so\'rash',
              buttonNegative: ru ? 'Отмена' : 'Bekor qilish',
              buttonPositive: ru ? 'Разрешить' : 'Ruxsat berish',
            },
          );
          if (result === PermissionsAndroid.RESULTS.GRANTED) {
            perm = 'granted';
            setMicPermission('granted');
          } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            perm = 'never_ask_again';
            setMicPermission('never_ask_again');
          } else {
            perm = 'denied';
            setMicPermission('denied');
          }
        }

        if (perm === 'never_ask_again') {
          Alert.alert(
            ru ? 'Разрешение отклонено' : 'Ruxsat rad etilgan',
            ru
              ? 'Доступ к микрофону запрещён. Откройте настройки → Разрешения → Микрофон и разрешите доступ.'
              : 'Mikrofonga kirish taqiqlangan. Sozlamalar → Ruxsatlar → Mikrofon bo\'limiga o\'ting.',
            [
              { text: ru ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
              { text: ru ? 'Открыть настройки' : 'Sozlamalarni ochish', onPress: openAppSettings },
            ],
          );
          return;
        }
        if (perm !== 'granted') return;
      } else {
        // iOS
        const permResult = await Audio.requestPermissionsAsync();
        const granted = permResult?.granted ?? permResult?.status === 'granted';
        if (!granted) {
          const canAskAgain = permResult?.canAskAgain !== false;
          if (!canAskAgain) {
            Alert.alert(
              ru ? 'Разрешение отклонено' : 'Ruxsat rad etilgan',
              ru ? 'Откройте настройки и разрешите доступ к микрофону.' : 'Sozlamalarni oching va mikrofonga ruxsat bering.',
              [
                { text: ru ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
                { text: ru ? 'Открыть настройки' : 'Sozlamalarni ochish', onPress: () => Linking.openSettings() },
              ],
            );
          }
          return;
        }
      }

      // Clean up any leftover recording object before creating a new one
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch (e: any) {
      Alert.alert(ru ? 'Ошибка' : 'Xatolik', e.message);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await transcribeAndSend(uri);
    } catch (e: any) {
      Alert.alert(ru ? 'Ошибка' : 'Xatolik', e.message);
    }
  };

  const updateAnn = (idx: number, field: keyof ParsedAnnouncement, value: any) => {
    setEditAnn(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const removeAnn = (idx: number) => {
    setEditAnn(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setIsReady(false);
      return next;
    });
  };

  const handleMicToggle = async () => {
    if (isTyping) return;
    if (!isRecording) {
      pressStartRef.current = Date.now();
      await startRecording();
    } else {
      // Require at least 1 second of recording to avoid accidental double-tap
      if (Date.now() - pressStartRef.current < 1000) return;
      await stopRecording();
    }
  };

  const handleConfirm = async () => {
    const valid = editAnn.filter(a =>
      a.originRegion && a.destinationRegion && a.transportType && a.vehicleCount > 0 && a.contactPhone
    );
    if (valid.length === 0) {
      Alert.alert(ru ? 'Заполните обязательные поля' : 'Majburiy maydonlarni to\'ldiring');
      return;
    }
    let ok = 0; let fail = 0;
    setCreateProgress({ cur: 0, tot: valid.length, ok, fail });
    for (let i = 0; i < valid.length; i++) {
      setCreateProgress({ cur: i + 1, tot: valid.length, ok, fail });
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        await api.post(API_ENDPOINTS.announcements, {
          title: valid[i].title,
          originRegions: [valid[i].originRegion],
          destinationRegions: [valid[i].destinationRegion],
          originDistrict: valid[i].originDistrict || [],
          destinationDistrict: valid[i].destinationDistrict || [],
          transportType: valid[i].transportType,
          vehicleCount: valid[i].vehicleCount,
          weightTons: Number(valid[i].weightTons) > 0 ? Number(valid[i].weightTons) : null,
          loadDate: valid[i].loadDate || todayISO,
          loadingTime: valid[i].loadingTime || 'kun davomida',
          price: valid[i].price ? Number(valid[i].price) : null,
          paymentTypes: valid[i].paymentTypes?.length ? valid[i].paymentTypes : ['cash'],
          contactPhone: valid[i].contactPhone || safePhone,
          notes: valid[i].notes || '',
        });
        ok++;
      } catch { fail++; }
      setCreateProgress({ cur: i + 1, tot: valid.length, ok, fail });
    }
    setCreateProgress(null);
    setShowResult({ created: ok, failed: fail });
    if (ok > 0) onCreated(ok);
  };

  handleConfirmRef.current = handleConfirm;

  const handleClose = useCallback(() => { resetState(); onClose(); }, [resetState, onClose]);

  const renderPicker = () => {
    if (!showPicker) return null;
    const { field, idx, opts } = showPicker;
    const title = field === 'originRegion' ? (ru ? 'Откуда' : 'Qayerdan')
      : field === 'destinationRegion' ? (ru ? 'Куда' : 'Qayerga')
      : field === 'loadingTime' ? (ru ? 'Время загрузки' : 'Yuklash vaqti')
      : (ru ? 'Тип транспорта' : 'Transport turi');
    return (
      <Modal visible animationType="slide" transparent onRequestClose={() => setShowPicker(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowPicker(null)}>
          <View style={[s.pickerBox, { backgroundColor: c.background }]}>
            <View style={[s.pickerHeader, { borderBottomColor: c.border }]}>
              <Text style={[s.pickerTitle, { color: c.foreground }]}>{title}</Text>
              <TouchableOpacity onPress={() => setShowPicker(null)}>
                <Ionicons name="close" size={22} color={c.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {opts.map(o => (
                <TouchableOpacity key={o.value} style={[s.pickerItem, { borderBottomColor: c.border }]}
                  onPress={() => { updateAnn(idx, field as keyof ParsedAnnouncement, o.value); setShowPicker(null); }}>
                  <Text style={[s.pickerItemText, { color: c.foreground }]}>{ru ? o.labelRu : o.labelUz}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderAnnCard = (a: ParsedAnnouncement, idx: number) => {
    const valid = !!(a.originRegion && a.destinationRegion && a.transportType && a.vehicleCount > 0);
    return (
      <View key={idx} style={[s.annCard, { backgroundColor: c.background, borderColor: valid ? c.border : c.destructive }]}>
        <View style={s.annCardHeader}>
          <View style={[s.annBadge, { backgroundColor: c.primary }]}>
            <Text style={s.annBadgeText}>#{idx + 1}</Text>
          </View>
          <Text style={[s.annCardTitle, { color: c.foreground }]} numberOfLines={1}>
            {a.title || (ru ? 'Объявление' : 'E\'lon')}
          </Text>
          <TouchableOpacity onPress={() => removeAnn(idx)} testID={`button-remove-ann-${idx}`}>
            <Ionicons name="trash-outline" size={18} color={c.destructive} />
          </TouchableOpacity>
        </View>
        <View style={s.annFields}>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Откуда' : 'Qayerdan'}</Text>
            <TouchableOpacity
              style={[s.selectBtn, { borderColor: a.originRegion ? c.border : c.destructive }]}
              onPress={() => setShowPicker({ field: 'originRegion', idx, opts: REGION_OPTS })}>
              <Text style={[s.selectText, { color: a.originRegion ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
                {a.originRegion ? regionLabel(a.originRegion, ru) : (ru ? 'Выбрать' : 'Tanlash')}
              </Text>
              <Ionicons name="chevron-down" size={13} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Куда' : 'Qayerga'}</Text>
            <TouchableOpacity
              style={[s.selectBtn, { borderColor: a.destinationRegion ? c.border : c.destructive }]}
              onPress={() => setShowPicker({ field: 'destinationRegion', idx, opts: REGION_OPTS })}>
              <Text style={[s.selectText, { color: a.destinationRegion ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
                {a.destinationRegion ? regionLabel(a.destinationRegion, ru) : (ru ? 'Выбрать' : 'Tanlash')}
              </Text>
              <Ionicons name="chevron-down" size={13} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Транспорт' : 'Transport'}</Text>
            <TouchableOpacity
              style={[s.selectBtn, { borderColor: a.transportType ? c.border : c.destructive }]}
              onPress={() => setShowPicker({ field: 'transportType', idx, opts: TRANSPORT_OPTS })}>
              <Text style={[s.selectText, { color: a.transportType ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
                {a.transportType ? transportLabel(a.transportType, ru) : (ru ? 'Выбрать' : 'Tanlash')}
              </Text>
              <Ionicons name="chevron-down" size={13} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Машин' : 'Mashina'}</Text>
            <TextInput
              style={[s.fieldInput, { borderColor: c.border, color: c.foreground }]}
              value={String(a.vehicleCount || 1)}
              keyboardType="number-pad"
              onChangeText={v => updateAnn(idx, 'vehicleCount', parseInt(v) || 1)}
              testID={`input-ann-count-${idx}`}
            />
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Вес (т)' : 'Og\'irlik (t)'}</Text>
            <TextInput
              style={[s.fieldInput, { borderColor: c.border, color: c.foreground }]}
              value={a.weightTons || ''}
              keyboardType="decimal-pad"
              placeholder={ru ? 'Не указан' : 'Ko\'rsatilmagan'}
              placeholderTextColor={c.mutedForeground}
              onChangeText={v => updateAnn(idx, 'weightTons', v)}
              testID={`input-ann-weight-${idx}`}
            />
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Телефон' : 'Telefon'}</Text>
            <TextInput
              style={[s.fieldInput, { borderColor: c.border, color: c.foreground }]}
              value={a.contactPhone || ''}
              keyboardType="phone-pad"
              placeholder="+998..."
              placeholderTextColor={c.mutedForeground}
              onChangeText={v => updateAnn(idx, 'contactPhone', v)}
              testID={`input-ann-phone-${idx}`}
            />
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Дата отгрузки' : 'Yuklash sanasi'}</Text>
            <TextInput
              style={[s.fieldInput, { borderColor: c.border, color: c.foreground }]}
              value={a.loadDate || ''}
              placeholder={ru ? 'напр. 25.07.2026' : 'mas. 25.07.2026'}
              placeholderTextColor={c.mutedForeground}
              onChangeText={v => updateAnn(idx, 'loadDate', v)}
              testID={`input-ann-date-${idx}`}
            />
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Время загрузки' : 'Yuklash vaqti'}</Text>
            <TouchableOpacity
              style={[s.selectBtn, { borderColor: c.border }]}
              onPress={() => setShowPicker({ field: 'loadingTime', idx, opts: LOADING_TIME_OPTS })}
              testID={`button-ann-loading-time-${idx}`}>
              <Text style={[s.selectText, { color: a.loadingTime ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
                {a.loadingTime ? loadingTimeLabel(a.loadingTime, ru) : (ru ? 'Выбрать' : 'Tanlash')}
              </Text>
              <Ionicons name="chevron-down" size={13} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={s.fieldHalf}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Цена (USD)' : 'Narx (USD)'}</Text>
            <TextInput
              style={[s.fieldInput, { borderColor: c.border, color: c.foreground }]}
              value={a.price || ''}
              keyboardType="number-pad"
              placeholder={ru ? 'Не указана' : 'Ko\'rsatilmagan'}
              placeholderTextColor={c.mutedForeground}
              onChangeText={v => updateAnn(idx, 'price', v)}
              testID={`input-ann-price-${idx}`}
            />
          </View>
          <View style={s.fieldFull}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Тип оплаты' : 'To\'lov turi'}</Text>
            <View style={s.paymentRow}>
              {PAYMENT_TYPE_OPTS.map(pt => {
                const selected = (a.paymentTypes || []).includes(pt.value);
                return (
                  <TouchableOpacity
                    key={pt.value}
                    style={[s.paymentBtn, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary + '18' : 'transparent' }]}
                    onPress={() => {
                      const current = a.paymentTypes || [];
                      const next = selected ? current.filter(v => v !== pt.value) : [...current, pt.value];
                      updateAnn(idx, 'paymentTypes', next);
                    }}
                    testID={`button-ann-payment-${pt.value}-${idx}`}>
                    <Text style={[s.paymentBtnText, { color: selected ? c.primary : c.mutedForeground }]}>
                      {ru ? pt.labelRu : pt.labelUz}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={s.fieldFull}>
            <Text style={[s.fieldLabel, { color: c.mutedForeground }]}>{ru ? 'Примечание' : 'Izoh'}</Text>
            <TextInput
              style={[s.fieldInput, { borderColor: c.border, color: c.foreground }]}
              value={a.notes || ''}
              placeholder={ru ? 'Доп. информация о грузе' : 'Yuk haqida qo\'shimcha ma\'lumot'}
              placeholderTextColor={c.mutedForeground}
              onChangeText={v => updateAnn(idx, 'notes', v)}
              testID={`input-ann-notes-${idx}`}
            />
          </View>
        </View>
      </View>
    );
  };

  // Delete a user message (and the immediately following AI reply) from chat + history
  const deleteMessage = useCallback((msgTs: number) => {
    setChatMsgs(prev => {
      const idx = prev.findIndex(m => m.ts === msgTs);
      if (idx < 0) return prev;
      // Remove user msg + next assistant reply (if present)
      const next = prev.filter((_, i) => i !== idx && i !== idx + 1);
      // Rebuild convHistory from the remaining messages (skip welcome at index 0)
      const newHistory: ConvItem[] = [];
      for (let i = 1; i < next.length; i++) {
        newHistory.push({ role: next[i].role, content: next[i].text });
      }
      setConvHistory(newHistory);
      return next;
    });
  }, []);

  // Edit a user message: restore text to input, remove that msg + everything after it
  const editMessage = useCallback((msgTs: number, text: string) => {
    setChatMsgs(prev => {
      const idx = prev.findIndex(m => m.ts === msgTs);
      if (idx < 0) return prev;
      const truncated = prev.slice(0, idx);
      // Rebuild convHistory from remaining messages
      const newHistory: ConvItem[] = [];
      for (let i = 1; i < truncated.length; i++) {
        newHistory.push({ role: truncated[i].role, content: truncated[i].text });
      }
      setConvHistory(newHistory);
      return truncated;
    });
    setInputText(text);
    setIsReady(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const handleMsgLongPress = useCallback((msg: ChatMsg) => {
    Alert.alert(
      ru ? 'Сообщение' : 'Xabar',
      undefined,
      [
        {
          text: ru ? 'Редактировать' : 'Tahrirlash',
          onPress: () => editMessage(msg.ts, msg.text),
        },
        {
          text: ru ? 'Удалить' : 'O\'chirish',
          style: 'destructive',
          onPress: () => deleteMessage(msg.ts),
        },
        { text: ru ? 'Отмена' : 'Bekor qilish', style: 'cancel' },
      ],
    );
  }, [ru, editMessage, deleteMessage]);

  const renderChatMsg = (msg: ChatMsg) => {
    const isUser = msg.role === 'user';
    const bubble = (
      <View style={[
        s.bubble,
        isUser
          ? [s.bubbleUser, { backgroundColor: c.primary }]
          : [s.bubbleAi, { backgroundColor: c.card, borderColor: c.border }],
      ]}>
        <Text style={[s.bubbleText, { color: isUser ? 'white' : c.foreground }]}>{msg.text}</Text>
      </View>
    );
    return (
      <View key={msg.ts} style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAi]}>
        {!isUser && (
          <View style={[s.aiAvatar, { backgroundColor: c.primary }]}>
            <Ionicons name="sparkles" size={14} color="white" />
          </View>
        )}
        {isUser ? (
          <Pressable
            onLongPress={() => handleMsgLongPress(msg)}
            delayLongPress={400}
            android_ripple={null}
          >
            {bubble}
          </Pressable>
        ) : bubble}
      </View>
    );
  };

  if (showResult) {
    const allGood = showResult.failed === 0;
    return (
      <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
        <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={handleClose} testID="button-close-ai-modal">
              <Ionicons name="close" size={24} color={c.foreground} />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <Ionicons name="sparkles" size={18} color={c.primary} />
              <Text style={[s.headerTitle, { color: c.foreground }]}>{ru ? 'ИИ-помощник' : 'AI Yordamchi'}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={s.resultContainer}>
            <View style={[s.resultIcon, { backgroundColor: allGood ? '#22c55e20' : '#f59e0b20' }]}>
              <Ionicons name={allGood ? 'checkmark-circle' : 'alert-circle'} size={56} color={allGood ? '#22c55e' : '#f59e0b'} />
            </View>
            <Text style={[s.resultTitle, { color: c.foreground }]}>
              {showResult.created > 0
                ? (ru ? `Создано: ${showResult.created}` : `Yaratildi: ${showResult.created}`)
                : (ru ? 'Не удалось создать' : 'Yaratib bo\'lmadi')}
            </Text>
            {showResult.failed > 0 && (
              <Text style={[s.resultSub, { color: c.mutedForeground }]}>
                {ru ? `Ошибок: ${showResult.failed}` : `Xatolar: ${showResult.failed}`}
              </Text>
            )}
            <TouchableOpacity style={[s.resultBtn, { backgroundColor: c.primary }]} onPress={handleClose} testID="button-ai-done">
              <Text style={s.resultBtnText}>{ru ? 'Готово' : 'Tayyor'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  const validCount = editAnn.filter(a => a.originRegion && a.destinationRegion && a.transportType && a.vehicleCount > 0).length;
  const canSend = !!inputText.trim() && !isTyping && !createProgress;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleClose} testID="button-close-ai-modal">
            <Ionicons name="close" size={24} color={c.foreground} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Ionicons name="sparkles" size={18} color={c.primary} />
            <Text style={[s.headerTitle, { color: c.foreground }]}>{ru ? 'ИИ-помощник' : 'AI Yordamchi'}</Text>
          </View>
          {isReady ? (
            <TouchableOpacity onPress={() => setIsReady(false)} testID="button-ai-refine">
              <Text style={{ color: c.primary, fontSize: 13 }}>{ru ? 'Уточнить' : 'Aniqlash'}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 60 }} />}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? kbHeight : 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={scrollRef}
            style={s.chatScroll}
            contentContainerStyle={s.chatContent}
            keyboardShouldPersistTaps="handled">

            {chatMsgs.map(msg => renderChatMsg(msg))}

            {isTyping && (
              <View style={[s.msgRow, s.msgRowAi]}>
                <View style={[s.aiAvatar, { backgroundColor: c.primary }]}>
                  <Ionicons name="sparkles" size={14} color="white" />
                </View>
                <View style={[s.bubble, s.bubbleAi, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 14, paddingHorizontal: 18 }]}>
                  <ActivityIndicator size="small" color={c.primary} />
                </View>
              </View>
            )}

            {editAnn.length > 0 && (
              <View style={s.cardsContainer}>
                <Text style={[s.cardsLabel, { color: isReady ? c.primary : c.mutedForeground }]}>
                  {ru
                    ? (isReady
                      ? `Готово! ${editAnn.length} объявл. — подтвердите:`
                      : `Разбираю ${editAnn.length} объявл. — уточняю детали...`)
                    : (isReady
                      ? `Tayyor! ${editAnn.length} ta e'lon — tasdiqlang:`
                      : `${editAnn.length} ta e'lon — ma'lumotlarni aniqlayman...`)}
                </Text>
                {editAnn.map((a, i) => renderAnnCard(a, i))}
              </View>
            )}
          </ScrollView>

          {createProgress && (
            <View style={[s.progressBar, { backgroundColor: c.card, borderTopColor: c.border }]}>
              <ActivityIndicator color={c.primary} />
              <Text style={[s.progressText, { color: c.foreground }]}>
                {ru
                  ? `Создаём ${createProgress.cur} из ${createProgress.tot}... (✓${createProgress.ok} ✗${createProgress.fail})`
                  : `Yaratyapmiz ${createProgress.cur}/${createProgress.tot}... (✓${createProgress.ok} ✗${createProgress.fail})`}
              </Text>
            </View>
          )}

          {!createProgress && (
            <View style={[s.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
              {isReady && (
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: c.primary, marginBottom: 8 }]}
                  onPress={handleConfirm}
                  testID="button-ai-confirm">
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={s.confirmBtnText}>
                    {ru ? `Создать (${validCount})` : `Yaratish (${validCount})`}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={s.inputRow}>
                  <TextInput
                    style={[s.chatInput, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={isReady
                      ? (ru ? '"Да" — создать, или уточните...' : '"Ha" — yaratish yoki aniqlang...')
                      : (ru ? 'Опишите груз голосом или текстом...' : 'Ovoz yoki matn bilan tasvirlang...')}
                    placeholderTextColor={c.mutedForeground}
                    multiline
                    maxLength={500}
                    editable={!isTyping}
                    testID="input-ai-chat"
                  />
                  <View style={s.micWrapper}>
                    <TouchableOpacity
                      style={[s.micBtn, {
                        backgroundColor: isRecording ? c.destructive : c.primary,
                        opacity: (isTyping && !isRecording) ? 0.5 : 1,
                      }]}
                      onPress={Audio ? handleMicToggle : () => Alert.alert(
                        ru ? 'Недоступно' : 'Mavjud emas',
                        ru ? 'Голосовой ввод недоступен в этой версии приложения.' : 'Bu versiyada ovozli kiritish mavjud emas.'
                      )}
                      disabled={isTyping && !isRecording}
                      testID="button-ai-mic">
                      {isRecording
                        ? <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{fmtTime(recTime)}</Text>
                        : <Ionicons name="mic" size={20} color="white" />}
                    </TouchableOpacity>
                    <Text style={[s.micHint, { color: c.mutedForeground }]}>
                      {isRecording
                        ? (ru ? 'Нажмите стоп' : 'Stop bosing')
                        : (ru ? 'Нажмите' : 'Bosing')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[s.sendBtn, { backgroundColor: canSend ? c.primary : c.muted }]}
                    onPress={() => sendMessage(inputText)}
                    disabled={!canSend}
                    testID="button-ai-send">
                    <Ionicons name="send" size={18} color={canSend ? 'white' : c.mutedForeground} />
                  </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>

        {renderPicker()}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  chatScroll: { flex: 1 },
  chatContent: { padding: 16, gap: 12, paddingBottom: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAi: { justifyContent: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAi: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  cardsContainer: { gap: 10, marginTop: 4 },
  cardsLabel: { fontSize: 12, textAlign: 'center' },
  annCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  annCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  annBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  annBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  annCardTitle: { flex: 1, fontSize: 13, fontWeight: '600' },
  annFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldHalf: { width: '47%' },
  fieldFull: { width: '100%' },
  fieldLabel: { fontSize: 11, marginBottom: 4 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, gap: 4 },
  selectText: { flex: 1, fontSize: 12 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12 },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  paymentBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  paymentBtnText: { fontSize: 12 },
  progressBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1 },
  progressText: { fontSize: 13, flex: 1 },
  bottomBar: { borderTopWidth: 1, padding: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  micWrapper: { alignItems: 'center', gap: 3 },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  micHint: { fontSize: 9, textAlign: 'center' },
  chatInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  confirmBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 16, fontWeight: '600' },
  pickerItem: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerItemText: { fontSize: 15 },
  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  resultIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  resultSub: { fontSize: 15, textAlign: 'center' },
  resultBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  resultBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
