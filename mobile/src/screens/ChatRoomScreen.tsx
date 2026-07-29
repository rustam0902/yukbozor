import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useChatMessages, buildChatWsUrl, type ChatMessage } from '../hooks/useChatRooms';
import { VoiceRoomModal } from '../components/VoiceRoomModal';

const CHAT_NICKNAME_KEY = '@chatNickname';
const MAX_MSG_LEN = 500;

interface VoiceParticipant {
  identity: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface ChatRoomScreenProps {
  navigation: any;
  route: { params: { roomId: number; roomName: string } };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function ChatRoomScreen({ navigation, route }: ChatRoomScreenProps) {
  const { roomId, roomName } = route.params;
  const { language } = useLanguage();
  const { user } = useAuth();
  const colors = Colors.light;
  const ru = language === 'ru';

  const { data: initialMessages = [], isLoading } = useChatMessages(roomId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load nickname for guests
  useEffect(() => {
    if (user) {
      setNickname(user.displayName || null);
    } else {
      AsyncStorage.getItem(CHAT_NICKNAME_KEY).then(n => {
        if (n) setNickname(n);
      });
    }
  }, [user]);

  // Sync initial messages from REST
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = buildChatWsUrl(roomId);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message') {
            const msg: ChatMessage = {
              id: data.id,
              roomId: data.roomId ?? roomId,
              authorName: data.authorName ?? data.author_name ?? '',
              userId: data.userId ?? data.user_id ?? null,
              text: data.text ?? '',
              createdAt: data.createdAt ?? data.created_at ?? '',
            };
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          } else if (data.type === 'message_deleted') {
            setMessages(prev => prev.filter(m => m.id !== data.id));
          } else if (data.type === 'voice_participants') {
            setVoiceParticipants(data.participants ?? []);
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};
    } catch {}

    return () => {
      ws?.close();
      wsRef.current = null;
    };
  }, [roomId]);

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const texts = {
    inputPlaceholder: ru ? 'Написать сообщение...' : 'Xabar yozish...',
    voiceChat: ru ? 'Голосовой чат' : 'Ovozli chat',
    participants: ru ? 'в голосовом' : 'ovozda',
    nicknameTitle: ru ? 'Ваше имя' : 'Ismingiz',
    nicknameDesc: ru ? 'Введите имя, которое будут видеть другие участники чата' : 'Boshqa ishtirokchilar ko\'radigan ismingizni kiriting',
    nicknamePlaceholder: ru ? 'Введите имя...' : 'Ismingizni kiriting...',
    nicknameSave: ru ? 'Сохранить' : 'Saqlash',
    nicknameCancel: ru ? 'Отмена' : 'Bekor',
    empty: ru ? 'Пока нет сообщений. Напишите первым!' : 'Hali xabar yo\'q. Birinchi bo\'ling!',
    sendError: ru ? 'Не удалось отправить сообщение' : 'Xabar yuborib bo\'lmadi',
  };

  const getDisplayName = (): string | null => {
    if (user) return user.displayName || null;
    return nickname;
  };

  const handleSend = async () => {
    const displayName = getDisplayName();
    if (!displayName) {
      setNicknameModalVisible(true);
      return;
    }
    const text = inputText.trim();
    if (!text) return;

    setSending(true);
    setInputText('');
    try {
      await api.post(`/api/chat/rooms/${roomId}/messages`, {
        text,
        authorName: displayName,
      });
    } catch {
      Alert.alert('', texts.sendError);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleSaveNickname = async () => {
    const n = nicknameInput.trim();
    if (!n) return;
    await AsyncStorage.setItem(CHAT_NICKNAME_KEY, n);
    setNickname(n);
    setNicknameModalVisible(false);
    setNicknameInput('');
  };

  const handleVoicePress = () => {
    setVoiceModalVisible(true);
  };

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isOwn = user && item.userId === user.id;
    const isOwnByName = !user && item.authorName === nickname;
    const mine = isOwn || isOwnByName;

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!mine && (
          <View style={[styles.avatarBubble, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {item.authorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[
          styles.msgBubble,
          mine
            ? [styles.msgBubbleMine, { backgroundColor: colors.primary }]
            : [styles.msgBubbleOther, { backgroundColor: colors.card, borderColor: colors.border }]
        ]}>
          {!mine && (
            <Text style={[styles.msgAuthor, { color: colors.primary }]}>{item.authorName}</Text>
          )}
          <Text style={[styles.msgText, { color: mine ? 'white' : colors.foreground }]}>
            {item.text}
          </Text>
          <Text style={[styles.msgTime, { color: mine ? 'rgba(255,255,255,0.7)' : colors.mutedForeground }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  }, [user, nickname, colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{roomName}</Text>
          {voiceParticipants.length > 0 && (
            <Text style={styles.headerSub}>
              🔊 {voiceParticipants.length} {texts.participants}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.voiceBtn} onPress={handleVoicePress}>
          <Ionicons name="mic-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Voice participants banner (from WS broadcast) */}
      {voiceParticipants.length > 0 && (
        <View style={[styles.voicePanel, { backgroundColor: '#f0fdf4', borderColor: '#22c55e30' }]}>
          <View style={styles.voiceLive}>
            <View style={styles.voiceLiveDot} />
            <Text style={styles.voiceLiveText}>{texts.voiceChat}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {voiceParticipants.map((p) => (
              <View key={p.identity} style={styles.participantChip}>
                <Ionicons
                  name={p.isMuted ? 'mic-off' : (p.isSpeaking ? 'mic' : 'mic-outline')}
                  size={12}
                  color={p.isSpeaking ? '#22c55e' : '#6b7280'}
                />
                <Text style={styles.participantName} numberOfLines={1}>{p.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Messages + input */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{texts.empty}</Text>
              </View>
            }
          />
        )}

        {/* Input row */}
        <View style={[styles.inputRow, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={inputText}
            onChangeText={(t) => setInputText(t.slice(0, MAX_MSG_LEN))}
            placeholder={texts.inputPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={MAX_MSG_LEN}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="send" size={18} color="white" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Nickname modal for guests */}
      <Modal
        visible={nicknameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNicknameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{texts.nicknameTitle}</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>{texts.nicknameDesc}</Text>
            <TextInput
              style={[styles.nicknameInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder={texts.nicknamePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              maxLength={50}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => { setNicknameModalVisible(false); setNicknameInput(''); }}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground }}>{texts.nicknameCancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNickname}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                disabled={!nicknameInput.trim()}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>{texts.nicknameSave}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <VoiceRoomModal
        visible={voiceModalVisible}
        roomId={roomId}
        nickname={nickname}
        onClose={() => setVoiceModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: 'white' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  voiceBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 8,
  },
  voicePanel: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceLive: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  voiceLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  voiceLiveText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  participantChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'white', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3, marginRight: 6,
  },
  participantName: { fontSize: 11, color: '#374151', maxWidth: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%' },
  msgRowLeft: { alignSelf: 'flex-start' },
  msgRowRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatarBubble: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8, alignSelf: 'flex-end',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  msgBubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  msgBubbleMine: { borderBottomRightRadius: 4 },
  msgBubbleOther: { borderWidth: 1, borderBottomLeftRadius: 4 },
  msgAuthor: { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  emptyMessages: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 8, borderTopWidth: 1, gap: 8,
  },
  textInput: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, maxHeight: 120, minHeight: 40,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalDesc: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  nicknameInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1,
    paddingVertical: 12, alignItems: 'center',
  },
});
