import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../constants/api';

export interface LocationPoint {
  region: string;
  districts: string[];
}

export interface Order {
  id: number;
  title: string;
  originRegion: string;
  originDistrict?: string[];
  destinationRegion: string;
  destinationDistrict?: string[];
  originPoints?: LocationPoint[];
  destinationPoints?: LocationPoint[];
  transportType: string;
  weightTons?: number;
  cargoWeight?: number;
  priceWithVat: number;
  priceWithoutVat?: number;
  loadDate?: string;
  loadingDate?: string;
  loadingTime?: string;
  notes?: string;
  status: string;
  customerId: number;
  customerName?: string;
  createdAt: string;
  offersCount?: number;
  activeOffersCount?: number;
  requiresCollateral?: boolean;
  isDangerous?: boolean;
  isNonstandard?: boolean;
  isPartialLoad?: boolean;
  expiresAt?: string;
  deletedAt?: string | null;
  photoUrls?: string[];
}

export function usePublicOrders() {
  return useQuery<Order[]>({
    queryKey: ['publicOrders'],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.publicOrders);
      return response.data;
    },
  });
}

// Authenticated carrier orders — filters out the current user's own orders server-side
export function useCarrierOrders(params?: { originRegion?: string; destinationRegion?: string; transportType?: string }) {
  return useQuery<Order[]>({
    queryKey: ['carrierOrders', params],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.orders, {
        params: { context: 'carrier', ...params },
      });
      return response.data;
    },
  });
}

export function useMyOrders() {
  return useQuery<Order[]>({
    queryKey: ['myOrders'],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.orders, {
        params: { context: 'customer' },
      });
      return response.data;
    },
  });
}

export function useOrder(orderId: number) {
  return useQuery<Order>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await api.get(`${API_ENDPOINTS.orders}/${orderId}`);
      return response.data;
    },
    enabled: !!orderId,
  });
}

export interface CreateOrderData {
  title?: string;
  originRegion: string;
  originDistrict?: string[];
  destinationRegion: string;
  destinationDistrict?: string[];
  originPoints?: LocationPoint[];
  destinationPoints?: LocationPoint[];
  transportType: string;
  weightTons?: number;
  priceWithVat: number;
  loadDate?: string;
  loadingTime?: string;
  notes?: string;
  requiresCollateral?: boolean;
  isDangerous?: boolean;
  isNonstandard?: boolean;
  isPartialLoad?: boolean;
  photoUrls?: string[];
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      const response = await api.post(API_ENDPOINTS.orders, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['publicOrders'] });
      queryClient.invalidateQueries({ queryKey: ['carrierOrders'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderId: number) => {
      const response = await api.delete(`${API_ENDPOINTS.orders}/${orderId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['publicOrders'] });
      queryClient.invalidateQueries({ queryKey: ['carrierOrders'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: number; data: Partial<CreateOrderData> }) => {
      const response = await api.put(`${API_ENDPOINTS.orders}/${orderId}`, data);
      return response.data;
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['publicOrders'] });
      queryClient.invalidateQueries({ queryKey: ['carrierOrders'] });
    },
  });
}
