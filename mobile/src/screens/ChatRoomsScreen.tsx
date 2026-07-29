import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Colors } from '../constants/colors';
import { useLanguage } from '../context/LanguageContext';
import { Card } from '../components/Card';
import { useChatRooms, type ChatRoom } from '../hooks/useChatRooms';

interface ChatRoomsScreenProps {
  navigation: any;
}

export function ChatRoomsScreen({ navigation }: ChatRoomsScreenProps) {
  const { language } = useLanguage();
  const colors = Colors.light;
  const ru = language === 'ru';

  const { data: rooms = [], isLoading, isRefetching, refetch } = useChatRooms();

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const texts = {
    title: ru ? 'Чат' : 'Chat',
    subtitle: ru ? 'Общение с участниками рынка' : 'Bozor ishtirokchilari bilan muloqot',
    empty: ru ? 'Чат-комнаты не найдены' : 'Chat xonalari topilmadi',
    emptyDesc: ru ? 'Попробуйте позже' : 'Keyinroq urinib ko\'ring',
    voice: ru ? 'в голосовом' : 'ovozda',
  };

  const renderRoom = ({ item }: { item: ChatRoom }) => {
    const roomName = ru ? item.nameRu : item.nameUz;
    const hasVoice = (item.voiceParticipantCount ?? 0) > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, roomName })}
        testID={`room-${item.id}`}
      >
        <Card style={styles.roomCard}>
          <View style={styles.roomRow}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="chatbubbles" size={22} color={colors.primary} />
            </View>
            <View style={styles.roomInfo}>
              <Text style={[styles.roomName, { color: colors.foreground }]}>{roomName}</Text>
              {hasVoice && (
                <View style={styles.voiceIndicator}>
                  <View style={[styles.voiceDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={[styles.voiceText, { color: colors.mutedForeground }]}>
                    {item.voiceParticipantCount} {texts.voice}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>{texts.title}</Text>
        <Text style={styles.headerSubtitle}>{texts.subtitle}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{texts.empty}</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{texts.emptyDesc}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: 'white' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  roomCard: { marginBottom: 12, padding: 14 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: '600' },
  voiceIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  voiceDot: { width: 8, height: 8, borderRadius: 4 },
  voiceText: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
