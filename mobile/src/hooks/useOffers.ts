import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../constants/api';

export interface Offer {
  id: number;
  orderId: number;
  carrierId: number;
  carrierName?: string;
  price: number;
  priceWithoutVat?: number;
  blockedAmount: number;
  commission: number;
  status: string;
  notes?: string;
  comment?: string;
  createdAt: string;
  order?: {
    id: number;
    title: string;
    originRegion: string;
    destinationRegion: string;
    priceWithVat: number;
    loadingDate?: string;
    transportType?: string;
  };
}

interface CreateOfferData {
  orderId: number;
  carrierId: number;
  price: number;
  priceWithoutVat?: number;
}

export function useMyOffers() {
  return useQuery<Offer[]>({
    queryKey: ['myOffers'],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.myOffers);
      return response.data;
    },
  });
}

export function useOrderOffers(orderId: number) {
  return useQuery<Offer[]>({
    queryKey: ['orderOffers', orderId],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.orderOffers(orderId));
      return response.data;
    },
    enabled: !!orderId,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateOfferData) => {
      // Server expects POST /api/orders/:orderId/offers (orderId in URL, not body)
      const { orderId, ...offerData } = data;
      const response = await api.post(`/api/orders/${orderId}/offers`, offerData);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['myOffers'] });
      queryClient.invalidateQueries({ queryKey: ['publicOrders'] });
      queryClient.invalidateQueries({ queryKey: ['carrierOrders'] });
      queryClient.invalidateQueries({ queryKey: ['orderOffers', variables.orderId] });
    },
  });
}

export function useWithdrawOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: number) => {
      const response = await api.post(`/api/offers/${offerId}/withdraw`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOffers'] });
      queryClient.invalidateQueries({ queryKey: ['carrierOrders'] });
    },
  });
}

export function useAcceptOffer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (offerId: number) => {
      const response = await api.post(`/api/offers/${offerId}/accept`);
      return response.data;
    },
    onSuccess: (_, offerId) => {
      queryClient.invalidateQueries({ queryKey: ['orderOffers'] });
      queryClient.invalidateQueries({ queryKey: ['myOrders'] });
      queryClient.invalidateQueries({ queryKey: ['publicOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myContracts'] });
    },
  });
}

export function useRejectOffer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (offerId: number) => {
      const response = await api.post(`/api/offers/${offerId}/reject`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderOffers'] });
    },
  });
}
