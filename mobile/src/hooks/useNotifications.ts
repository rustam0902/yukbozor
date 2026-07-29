import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  orderId: number | null;
  offerId: number | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

interface NotificationSetting {
  notificationType: string;
  labelRu: string;
  labelUz: string;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

export function useNotifications(limit: number = 50) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const response = await api.get(`/api/notifications?limit=${limit}`);
      return response.data;
    },
    refetchInterval: 30000,
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const response = await api.get('/api/notifications/unread-count');
      return response.data;
    },
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await api.put(`/api/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.put('/api/notifications/read-all');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useNotificationSettings() {
  return useQuery<NotificationSetting[]>({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const response = await api.get('/api/notification-settings');
      const data = response.data;
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useUpdateNotificationSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ type, smsEnabled, inAppEnabled }: { type: string; smsEnabled: boolean; inAppEnabled: boolean }) => {
      const response = await api.put(`/api/notification-settings/${type}`, { smsEnabled, inAppEnabled });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });
}
