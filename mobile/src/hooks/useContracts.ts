import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../constants/api';

export interface Contract {
  id: number;
  orderId: number;
  offerId: number;
  customerId: number;
  carrierId: number;
  customerName?: string;
  carrierName?: string;
  status: string;
  price: number;
  priceWithoutVat?: number;
  signedAt?: string;
  completedAt?: string;
  createdAt: string;
  customerSignature?: string;
  carrierSignature?: string;
  customerSignedAt?: string;
  carrierSignedAt?: string;
  terminationInitiatedBy?: number;
  terminationPenaltyType?: string;
  order?: {
    id: number;
    title: string;
    originRegion: string;
    destinationRegion: string;
    transportType: string;
    loadingDate: string;
    loadingTime?: string;
  };
}

function normalizeContract(item: any): Contract {
  return {
    ...item,
    price: parseFloat(String(item.offerPrice || item.price || 0)),
    priceWithoutVat: item.priceWithoutVat ? parseFloat(String(item.priceWithoutVat)) : undefined,
    customerName: item.customer?.displayName || item.customerName || '',
    carrierName: item.carrier?.displayName || item.carrierName || '',
    order: item.order ? {
      ...item.order,
      loadingDate: item.order.loadDate || item.order.loadingDate || '',
      loadingTime: item.order.loadingTime || '',
    } : undefined,
  };
}

export function useMyContracts(role?: string) {
  return useQuery<Contract[]>({
    queryKey: ['myContracts', role],
    queryFn: async () => {
      const url = role ? `${API_ENDPOINTS.myContracts}?role=${role}` : API_ENDPOINTS.myContracts;
      const response = await api.get(url);
      const data: any[] = response.data || [];
      return data.map(normalizeContract);
    },
    retry: 2,
  });
}

interface PublicContractResponse {
  contract: {
    id: number;
    orderId: number;
    customerId: number;
    carrierId: number;
    status: string;
    generatedAt: string;
  };
  order: {
    id: number;
    title: string;
    originRegion: string;
    destinationRegion: string;
    transportType: string;
    loadDate?: string;
  };
  customer: {
    id: number;
    displayName?: string;
    phone: string;
  };
  carrier: {
    id: number;
    displayName?: string;
    phone: string;
  };
  offerPrice: string | number | null;
}

function transformPublicContract(item: PublicContractResponse): Contract {
  const price = item.offerPrice ? Number(item.offerPrice) : 0;
  return {
    id: item.contract.id,
    orderId: item.contract.orderId,
    offerId: 0,
    customerId: item.contract.customerId,
    carrierId: item.contract.carrierId,
    customerName: item.customer?.displayName || '',
    carrierName: item.carrier?.displayName || '',
    status: item.contract.status,
    price,
    signedAt: item.contract.generatedAt,
    createdAt: item.contract.generatedAt,
    order: {
      id: item.order.id,
      title: item.order.title,
      originRegion: item.order.originRegion,
      destinationRegion: item.order.destinationRegion,
      transportType: item.order.transportType,
      loadingDate: item.order.loadDate || '',
    },
  };
}

export function usePublicContracts() {
  return useQuery<Contract[]>({
    queryKey: ['publicContracts'],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.publicContracts);
      const data = Array.isArray(response.data) ? response.data : [];
      return data.map(transformPublicContract);
    },
    retry: 2,
  });
}

export function useContract(contractId: number) {
  return useQuery<Contract>({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const response = await api.get(`${API_ENDPOINTS.contracts}/${contractId}`);
      return response.data;
    },
    enabled: !!contractId,
  });
}

export interface ContractDetail extends Contract {
  customerSignature?: string;
  carrierSignature?: string;
  customerSignedAt?: string;
  carrierSignedAt?: string;
  blockedAmountCustomer?: number;
  blockedAmountCarrier?: number;
  commission?: number;
  offer?: {
    id: number;
    price: number;
    comment?: string;
  };
}

export function useContractDetail(contractId: number) {
  return useQuery<ContractDetail>({
    queryKey: ['contractDetail', contractId],
    queryFn: async () => {
      const response = await api.get(`${API_ENDPOINTS.contracts}/${contractId}`);
      return normalizeContract(response.data) as ContractDetail;
    },
    enabled: !!contractId,
  });
}

export function useInitiateTermination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, penaltyType }: { contractId: number; penaltyType: string }) => {
      const response = await api.post(`${API_ENDPOINTS.contracts}/${contractId}/initiate-termination`, { penaltyType });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContracts'] });
    },
  });
}

export function useConfirmTermination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: number) => {
      const response = await api.post(`${API_ENDPOINTS.contracts}/${contractId}/confirm-termination`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContracts'] });
    },
  });
}

export function useCancelTermination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: number) => {
      const response = await api.post(`${API_ENDPOINTS.contracts}/${contractId}/cancel-termination`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myContracts'] });
    },
  });
}
