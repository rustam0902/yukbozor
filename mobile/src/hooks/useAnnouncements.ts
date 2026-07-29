import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../constants/api';

export interface Announcement {
  id: number;
  title: string;
  description?: string;
  notes?: string;
  status?: string;
  deletedAt?: string | null;
  originRegion: string;
  originDistrict?: string;
  destinationRegion: string;
  destinationDistrict?: string;
  originRegions?: string[];
  destinationRegions?: string[];
  transportType: string;
  vehicleCount?: number;
  weightTons?: string;
  loadDate?: string;
  loadingTime?: string;
  price?: string;
  paymentTypes?: string[];
  contactPhone: string;
  createdAt: string;
  customerId: number;
  customerName?: string;
  customerRating?: number;
  createdByBot?: boolean;
  botSourceChatId?: string | null;
  botSourceMessageId?: number | null;
  photoUrls?: string[];
}

export interface CreateAnnouncementData {
  title: string;
  originRegion: string;
  originDistrict?: string;
  destinationRegion: string;
  destinationDistrict?: string;
  transportType: string;
  vehicleCount?: number;
  weightTons?: string;
  loadDate?: string;
  loadingTime?: string;
  price?: string | null;
  paymentTypes?: string[];
  contactPhone: string;
  notes?: string;
  photoUrls?: string[];
}

export interface AnnouncementTemplate {
  id: number;
  name: string;
  title?: string;
  originRegion?: string;
  originDistrict?: string;
  destinationRegion?: string;
  destinationDistrict?: string;
  transportType?: string;
  vehicleCount?: number;
  weightTons?: string;
  loadingTime?: string;
  price?: string;
  paymentTypes?: string[];
  contactPhone?: string;
  notes?: string;
  createdAt: string;
}

export interface SaveTemplateData {
  name: string;
  title?: string;
  originRegions?: string[];
  originDistrict?: string[];
  destinationRegions?: string[];
  destinationDistrict?: string[];
  transportType?: string;
  vehicleCount?: number;
  weightTons?: string;
  loadingTime?: string;
  price?: string;
  paymentTypes?: string[];
  contactPhone?: string;
  notes?: string;
}

function getFirstFromArrayOrString(value: any): string {
  if (!value) return '';
  if (Array.isArray(value)) return value[0] || '';
  if (typeof value === 'string') return value;
  return '';
}

function transformAnnouncement(item: any): Announcement {
  const originRegions: string[] = item.originRegions || item.origin_regions || [];
  const destinationRegions: string[] = item.destinationRegions || item.destination_regions || [];
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    notes: item.notes,
    originRegion: item.originRegion || originRegions[0] || '',
    originDistrict: getFirstFromArrayOrString(item.originDistrict || item.origin_district),
    destinationRegion: item.destinationRegion || destinationRegions[0] || '',
    destinationDistrict: getFirstFromArrayOrString(item.destinationDistrict || item.destination_district),
    originRegions,
    destinationRegions,
    transportType: item.transportType || item.transport_type || '',
    vehicleCount: item.vehicleCount ?? item.vehicle_count ?? 1,
    weightTons: item.weightTons ?? item.weight_tons,
    loadDate: item.loadDate ?? item.load_date,
    loadingTime: item.loadingTime ?? item.loading_time,
    price: item.price,
    paymentTypes: item.paymentTypes || item.payment_types || [],
    contactPhone: item.contactPhone || item.contact_phone || '',
    createdAt: item.createdAt || item.created_at || '',
    status: item.status || 'new',
    deletedAt: item.deletedAt || item.deleted_at || null,
    customerId: item.customerId ?? item.customer_id,
    customerName: item.customerName,
    customerRating: item.customerRating != null ? Number(item.customerRating) : undefined,
    createdByBot: item.createdByBot ?? item.created_by_bot ?? false,
    botSourceChatId: item.botSourceChatId ?? item.bot_source_chat_id ?? null,
    botSourceMessageId: item.botSourceMessageId ?? item.bot_source_message_id ?? null,
    photoUrls: Array.isArray(item.photoUrls) ? item.photoUrls : (Array.isArray(item.photo_urls) ? item.photo_urls : []),
  };
}

export interface AnnouncementFilters {
  originRegions?: string[];
  destinationRegions?: string[];
  transportTypes?: string[];
  excludeBot?: boolean;
}

export function useAnnouncements(filters?: AnnouncementFilters) {
  const params = new URLSearchParams();
  filters?.originRegions?.forEach(r => params.append('originRegion', r));
  filters?.destinationRegions?.forEach(r => params.append('destinationRegion', r));
  filters?.transportTypes?.forEach(t => params.append('transportType', t));
  if (filters?.excludeBot) params.set('excludeBot', 'true');
  const qs = params.toString() ? '?' + params.toString() : '';
  const url = API_ENDPOINTS.publicAnnouncements + qs;

  return useQuery<Announcement[]>({
    queryKey: ['publicAnnouncements', filters?.originRegions, filters?.destinationRegions, filters?.transportTypes, filters?.excludeBot],
    queryFn: async () => {
      const response = await api.get(url);
      const data = Array.isArray(response.data) ? response.data : [];
      return data.map(transformAnnouncement);
    },
  });
}

export function useMyAnnouncements(status?: 'all') {
  return useQuery<Announcement[]>({
    queryKey: ['myAnnouncements', status],
    queryFn: async () => {
      const url = status ? `${API_ENDPOINTS.myAnnouncements}?status=${status}` : API_ENDPOINTS.myAnnouncements;
      const response = await api.get(url);
      const data = Array.isArray(response.data) ? response.data : [];
      return data.map(transformAnnouncement);
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAnnouncementData) => {
      const payload = {
        title: data.title,
        originRegions: [data.originRegion],
        originDistrict: data.originDistrict ? [data.originDistrict] : [],
        destinationRegions: [data.destinationRegion],
        destinationDistrict: data.destinationDistrict ? [data.destinationDistrict] : [],
        transportType: data.transportType,
        vehicleCount: data.vehicleCount ? Number(data.vehicleCount) : 1,
        weightTons: data.weightTons ? Number(data.weightTons) : undefined,
        loadDate: data.loadDate,
        loadingTime: data.loadingTime,
        price: data.price === null ? null : (data.price ? Number(data.price) : undefined),
        paymentTypes: data.paymentTypes || [],
        contactPhone: data.contactPhone,
        notes: data.notes,
        photoUrls: data.photoUrls ?? [],
      };
      const response = await api.post(API_ENDPOINTS.announcements, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements', 'all'] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateAnnouncementData> }) => {
      const payload: Record<string, any> = {};
      if (data.title !== undefined) payload.title = data.title;
      if (data.originRegion !== undefined) payload.originRegions = [data.originRegion];
      if (data.originDistrict !== undefined) payload.originDistrict = data.originDistrict ? [data.originDistrict] : [];
      if (data.destinationRegion !== undefined) payload.destinationRegions = [data.destinationRegion];
      if (data.destinationDistrict !== undefined) payload.destinationDistrict = data.destinationDistrict ? [data.destinationDistrict] : [];
      if (data.transportType !== undefined) payload.transportType = data.transportType;
      if (data.vehicleCount !== undefined) payload.vehicleCount = Number(data.vehicleCount);
      if (data.weightTons !== undefined) payload.weightTons = data.weightTons ? Number(data.weightTons) : undefined;
      if (data.loadDate !== undefined) payload.loadDate = data.loadDate;
      if (data.loadingTime !== undefined) payload.loadingTime = data.loadingTime;
      if (data.price !== undefined) payload.price = data.price === null ? null : (data.price ? Number(data.price) : undefined);
      if (data.paymentTypes !== undefined) payload.paymentTypes = data.paymentTypes;
      if (data.contactPhone !== undefined) payload.contactPhone = data.contactPhone;
      if (data.notes !== undefined) payload.notes = data.notes;
      const response = await api.put(`${API_ENDPOINTS.announcements}/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements', 'all'] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: number) => {
      const response = await api.delete(`${API_ENDPOINTS.announcements}/${announcementId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements', 'all'] });
    },
  });
}

export function useAnnouncementTemplates() {
  return useQuery<AnnouncementTemplate[]>({
    queryKey: ['announcementTemplates'],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.announcementTemplates);
      const data = Array.isArray(response.data) ? response.data : [];
      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        originRegion: (item.originRegions || item.origin_regions || [])[0],
        originDistrict: getFirstFromArrayOrString(item.originDistrict || item.origin_district),
        destinationRegion: (item.destinationRegions || item.destination_regions || [])[0],
        destinationDistrict: getFirstFromArrayOrString(item.destinationDistrict || item.destination_district),
        transportType: item.transportType || item.transport_type,
        vehicleCount: item.vehicleCount ?? item.vehicle_count,
        weightTons: item.weightTons ?? item.weight_tons,
        loadingTime: item.loadingTime ?? item.loading_time,
        price: item.price,
        paymentTypes: item.paymentTypes || item.payment_types,
        contactPhone: item.contactPhone || item.contact_phone,
        notes: item.notes,
        createdAt: item.createdAt || item.created_at || '',
      }));
    },
  });
}

export function useDeleteAnnouncementTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: number) => {
      const response = await api.delete(`${API_ENDPOINTS.announcementTemplates}/${templateId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcementTemplates'] });
    },
  });
}

export function useUpdateAnnouncementStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await api.put(`${API_ENDPOINTS.announcements}/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['myAnnouncements', 'all'] });
    },
  });
}

export function useSaveAnnouncementTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveTemplateData) => {
      const response = await api.post(API_ENDPOINTS.announcementTemplates, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcementTemplates'] });
    },
  });
}
