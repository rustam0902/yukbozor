import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { API_BASE_URL } from '../constants/api';

export interface ChatRoom {
  id: number;
  nameRu: string;
  nameUz: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  voiceParticipantCount?: number;
}

export interface ChatMessage {
  id: number;
  roomId: number;
  authorName: string;
  userId: number | null;
  text: string;
  createdAt: string;
}

export function useChatRooms() {
  return useQuery<ChatRoom[]>({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      const response = await api.get('/api/chat/rooms');
      const data = Array.isArray(response.data) ? response.data : [];
      return data.map((r: any) => ({
        id: r.id,
        nameRu: r.nameRu ?? r.name_ru ?? '',
        nameUz: r.nameUz ?? r.name_uz ?? '',
        slug: r.slug ?? '',
        sortOrder: r.sortOrder ?? r.sort_order ?? 0,
        isActive: r.isActive ?? r.is_active ?? true,
        voiceParticipantCount: r.voiceParticipantCount ?? 0,
      }));
    },
    staleTime: 30_000,
  });
}

export function useChatMessages(roomId: number) {
  return useQuery<ChatMessage[]>({
    queryKey: ['chatMessages', roomId],
    queryFn: async () => {
      const response = await api.get(`/api/chat/rooms/${roomId}/messages`);
      const data = Array.isArray(response.data) ? response.data : [];
      return data.map((m: any) => ({
        id: m.id,
        roomId: m.roomId ?? m.room_id,
        authorName: m.authorName ?? m.author_name ?? 'Unknown',
        userId: m.userId ?? m.user_id ?? null,
        text: m.text ?? '',
        createdAt: m.createdAt ?? m.created_at ?? '',
      }));
    },
    enabled: roomId > 0,
  });
}

/** Build WebSocket URL from REST API base URL */
export function buildChatWsUrl(roomId: number): string {
  const wsBase = API_BASE_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');
  return `${wsBase}/api/chat/ws?roomId=${roomId}`;
}
