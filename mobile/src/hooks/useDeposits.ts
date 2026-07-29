import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { API_ENDPOINTS } from '../constants/api';

export interface DepositAccount {
  id: number;
  userId: number;
  accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward';
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepositTransaction {
  id: number;
  userId: number;
  accountType: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'commission' | 'collateral' | 'prepayment' | 'partner_reward';
  amount: number;
  description?: string;
  relatedOrderId?: number;
  relatedContractId?: number;
  createdAt: string;
}

export function useDepositAccounts() {
  return useQuery<DepositAccount[]>({
    queryKey: ['depositAccounts'],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.depositAccounts);
      return response.data;
    },
  });
}

export function useDepositTransactions(accountType?: string) {
  return useQuery<DepositTransaction[]>({
    queryKey: ['depositTransactions', accountType],
    queryFn: async () => {
      const url = accountType 
        ? `${API_ENDPOINTS.depositTransactions}?accountType=${accountType}`
        : API_ENDPOINTS.depositTransactions;
      const response = await api.get(url);
      return response.data;
    },
  });
}
