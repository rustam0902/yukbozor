import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { LocationPoint } from './useOrders';

export interface OrderTemplate {
  id: number;
  name: string;
  title: string;
  originRegion: string;
  originDistrict: string[];
  destinationRegion: string;
  destinationDistrict: string[];
  originPoints?: LocationPoint[];
  destinationPoints?: LocationPoint[];
  transportType: string;
  weightTons: number;
  priceWithVat: number;
  loadDate?: string;
  loadingTime?: string;
  requiresCollateral: boolean;
  isDangerous: boolean;
  isNonstandard: boolean;
  isPartialLoad: boolean;
  notes?: string;
  createdAt: string;
}

export interface CreateTemplateData {
  name: string;
  title: string;
  originRegion: string;
  originDistrict: string[];
  destinationRegion: string;
  destinationDistrict: string[];
  originPoints?: LocationPoint[];
  destinationPoints?: LocationPoint[];
  transportType: string;
  weightTons: number;
  priceWithVat: number;
  loadDate?: string;
  loadingTime?: string;
  requiresCollateral?: boolean;
  isDangerous?: boolean;
  isNonstandard?: boolean;
  isPartialLoad?: boolean;
  notes?: string;
}

export function useTemplates() {
  return useQuery<OrderTemplate[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get('/api/templates');
      return response.data;
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      const response = await api.post('/api/templates', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (templateId: number) => {
      const response = await api.delete(`/api/templates/${templateId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
