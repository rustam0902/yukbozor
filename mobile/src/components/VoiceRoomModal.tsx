import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Room, RoomEvent, Track } from 'livekit-client';
import { AudioSession, registerGlobals } from '@livekit/react-native';
import { api } from '../services/api';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

// Must be called once before any LiveKit usage
registerGlobals();

interface ParticipantInfo {
  identity: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
}

interface Props {
  visible: boolean;
  roomId: number;
  nickname: string | null;
  onClose: () => void;
}

export function VoiceRoomModal({ visible, roomId, nickname, onClose }: Props) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const ru = language === 'ru';
  const colors = Colors.light;

  const roomRef = useRef<Room | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshParticipants = useCallback((room: Room) => {
    const list: ParticipantInfo[] = [];

    // Local participant
    const lp = room.localParticipant;
    list.push({
      identity: lp.identity,
      name: lp.name || lp.identity,
      isMuted: !lp.isMicrophoneEnabled,
      isSpeaking: lp.isSpeaking,
      isLocal: true,
    });

    // Remote participants
    for (const [, rp] of room.remoteParticipants) {
      const pub = rp.getTrackPublication(Track.Source.Microphone);
      list.push({
        identity: rp.identity,
        name: rp.name || rp.identity,
        isMuted: !pub || pub.isMuted,
        isSpeaking: rp.isSpeaking,
        isLocal: false,
      });
    }

    setParticipants(list);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const displayName = user?.displayName || nickname || (ru ? 'Гость' : 'Mehmon');
      const res = await api.get(`/api/chat/rooms/${roomId}/voice-token`, {
        params: { displayName },
      });
      const { token, url } = res.data;

      await AudioSession.startAudioSession();

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => refreshParticipants(room));
      room.on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room));
      room.on(RoomEvent.TrackMuted, () => refreshParticipants(room));
      room.on(RoomEvent.TrackUnmuted, () => refreshParticipants(room));
      room.on(RoomEvent.ActiveSpeakersChanged, () => refreshParticipants(room));
      room.on(RoomEvent.LocalTrackPublished, () => refreshParticipants(room));
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setParticipants([]);
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setConnected(true);
      setIsMuted(false);
      refreshParticipants(room);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || (ru ? 'Ошибка подключения' : 'Ulanishda xato'));
    } finally {
      setConnecting(false);
    }
  }, [roomId, user, nickname, ru, refreshParticipants]);

  const doDisconnect = useCallback(async () => {
    try {
      await roomRef.current?.disconnect();
      await AudioSession.stopAudioSession();
    } catch {}
    roomRef.current = null;
    setConnected(false);
    setConnecting(false);
    setParticipants([]);
    setError(null);
    onClose();
  }, [onClose]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !connected) return;
    const next = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
    refreshParticipants(room);
  }, [isMuted, connected, refreshParticipants]);

  // Connect when modal opens; cleanup when it closes
  useEffect(() => {
    if (visible) {
      connect();
    } else {
      roomRef.current?.disconnect().catch(() => {});
      AudioSession.stopAudioSession().catch(() => {});
      roomRef.current = null;
      setConnected(false);
      setConnecting(false);
      setParticipants([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect().catch(() => {});
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={doDisconnect}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.liveBadge}>
              {connected && <View style={styles.liveDot} />}
              <Text style={[styles.liveTitle, { color: connected ? '#16a34a' : colors.foreground }]}>
                {ru ? 'Голосовой чат' : 'Ovozli chat'}
              </Text>
            </View>
            <TouchableOpacity onPress={doDisconnect} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Connecting */}
          {connecting && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                {ru ? 'Подключение...' : 'Ulanmoqda...'}
              </Text>
            </View>
          )}

          {/* Error */}
          {!connecting && error && (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
              <Text style={[styles.statusText, { color: '#ef4444', textAlign: 'center' }]}>{error}</Text>
              <TouchableOpacity
                onPress={connect}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryText}>{ru ? 'Повторить' : 'Qayta urinish'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Connected */}
          {connected && !connecting && (
            <>
              <ScrollView style={styles.participantList} showsVerticalScrollIndicator={false}>
                {participants.map((p) => (
                  <View key={p.identity} style={[styles.participantRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + '25' }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {(p.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={[styles.participantName, { color: colors.foreground }]} numberOfLines={1}>
                        {p.name}{p.isLocal ? (ru ? ' (вы)' : ' (siz)') : ''}
                      </Text>
                      {p.isSpeaking && !p.isMuted && (
                        <Text style={styles.speakingLabel}>
                          {ru ? '🎙 говорит...' : '🎙 gapirmoqda...'}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={p.isMuted ? 'mic-off' : 'mic'}
                      size={18}
                      color={p.isMuted ? '#9ca3af' : (p.isSpeaking ? '#22c55e' : colors.primary)}
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: isMuted ? '#6b7280' : colors.primary }]}
                  onPress={toggleMute}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="white" />
                  <Text style={styles.controlLabel}>
                    {isMuted ? (ru ? 'Включить' : 'Yoqish') : (ru ? 'Выключить' : "O'chirish")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlBtn, { backgroundColor: '#ef4444' }]}
                  onPress={doDisconnect}
                >
                  <Ionicons name="exit-outline" size={26} color="white" />
                  <Text style={styles.controlLabel}>{ru ? 'Выйти' : 'Chiqish'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 280,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  liveTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  centered: { alignItems: 'center', padding: 36, gap: 14 },
  statusText: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryText: { color: 'white', fontWeight: '600', fontSize: 14 },
  participantList: { maxHeight: 260, paddingHorizontal: 20 },
  participantRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, gap: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 15 },
  speakingLabel: { fontSize: 12, color: '#22c55e', marginTop: 2 },
  controls: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 16, paddingHorizontal: 24, paddingTop: 20,
  },
  controlBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, gap: 6,
    minWidth: 120,
  },
  controlLabel: { color: 'white', fontSize: 12, fontWeight: '600' },
});
