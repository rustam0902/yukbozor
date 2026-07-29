import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";
import type { Order, Offer, DepositTransaction } from "@shared/schema";

// Orders API
export function useOrders(context?: 'customer' | 'carrier' | 'partner') {
  return useQuery<Order[]>({
    queryKey: context ? ["/api/orders", { context }] : ["/api/orders"],
    queryFn: async () => {
      const url = context ? `/api/orders?context=${context}` : '/api/orders';
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return await res.json();
    },
  });
}

export function useOrder(id: number) {
  return useQuery<Order>({
    queryKey: ["/api/orders", id],
    enabled: !!id,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"], exact: false });
    },
  });
}

// Offers API
export function useOrderOffers(orderId: number) {
  return useQuery<Offer[]>({
    queryKey: ['/api/orders', orderId, 'offers'],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/offers`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return await res.json();
    },
    enabled: !!orderId,
  });
}

export function useCreateOffer() {
  return useMutation({
    mutationFn: async ({ orderId, data }: { orderId: number; data: any }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/offers`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", variables.orderId, "offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/my"] });
    },
  });
}

export function useAcceptOffer() {
  return useMutation({
    mutationFn: async (offerId: number) => {
      const res = await apiRequest("POST", `/api/offers/${offerId}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/my"] });
    },
  });
}

export function useRejectOffer() {
  return useMutation({
    mutationFn: async (offerId: number) => {
      const res = await apiRequest("POST", `/api/offers/${offerId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/my"] });
    },
  });
}

export function useWithdrawOffer() {
  return useMutation({
    mutationFn: async (offerId: number) => {
      const res = await apiRequest("POST", `/api/offers/${offerId}/withdraw`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/my"] });
    },
  });
}

export function useUpdateOffer() {
  return useMutation({
    mutationFn: async ({ offerId, data }: { offerId: number; data: { price: string | number; priceWithoutVat: string | number } }) => {
      const res = await apiRequest("PATCH", `/api/offers/${offerId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/offers/my"] });
    },
  });
}

// Deposits API
// Returns main account summary for backward compatibility
// Full deposits array is cached under ["/api/deposits", "me"]
export function useDeposit() {
  const query = useQuery<any[]>({
    queryKey: ["/api/deposits", "me"],
  });
  
  // Extract main account for backward compatibility
  const mainAccount = query.data?.find(d => d.accountType === 'main');
  
  return {
    ...query,
    data: mainAccount ? {
      balance: mainAccount.balance || 0,
      blockedAmount: mainAccount.blockedAmount || 0,
      // Legacy alias for existing code
      blocked: mainAccount.blockedAmount || 0
    } : undefined,
  };
}

export function useDepositTransactions() {
  return useQuery<DepositTransaction[]>({
    queryKey: ["/api/deposits", "transactions"],
  });
}

export function useAllDeposits() {
  return useQuery<any[]>({
    queryKey: ["/api/deposits", "me"],
  });
}

export function useTopUpDeposit() {
  return useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/deposits/topup", { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"], exact: false });
    },
  });
}

// Partner API
export function usePartnerEnroll() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/partners/enroll", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners", "me"] });
    },
  });
}

export function usePartnerInfo() {
  return useQuery<{ id: number; userId: number; referralCode: string }>({
    queryKey: ["/api/partners", "me"],
    retry: false, // Don't retry on 404 - user needs to enroll first
  });
}

export function usePartnerClients() {
  return useQuery<any[]>({
    queryKey: ["/api/partners", "me", "clients"],
  });
}

export function usePartnerCommissions() {
  return useQuery<any[]>({
    queryKey: ["/api/partners", "me", "commissions"],
  });
}

// Admin API
export function useAdminUsers() {
  return useQuery<any[]>({
    queryKey: ["/api/admin", "users"],
  });
}

export function useAdminUsersWithProfiles() {
  return useQuery<any[]>({
    queryKey: ["/api/admin", "users", "withProfiles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?includeProfiles=true", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });
}

export function useAdminWithdrawals() {
  return useQuery<any[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
  });
}

export function useAdminAllWithdrawals() {
  return useQuery<any[]>({
    queryKey: ["/api/admin/withdrawals/all"],
  });
}

export function useApproveWithdrawal() {
  return useMutation({
    mutationFn: async (withdrawalId: number) => {
      const res = await apiRequest("POST", `/api/admin/withdrawals/${withdrawalId}/process`, { action: 'complete' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/all"] });
    },
  });
}

export function useRejectWithdrawal() {
  return useMutation({
    mutationFn: async (withdrawalId: number) => {
      const res = await apiRequest("POST", `/api/admin/withdrawals/${withdrawalId}/process`, { action: 'reject' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/all"] });
    },
  });
}

// Change Password API
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string; language?: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to change password');
      }
      return res.json();
    },
  });
}

// Admin: Credit user deposit
export function useAdminCreditDeposit() {
  return useMutation({
    mutationFn: async (data: { userId: number; amount: number; reference?: string; language?: string }) => {
      const res = await apiRequest("POST", "/api/admin/deposits/credit", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to credit deposit');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin", "users"] });
    },
  });
}

// Admin: Get user deposits
export function useAdminUserDeposits(userId: number) {
  return useQuery<any>({
    queryKey: ["/api/admin/deposits", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/deposits/${userId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
    enabled: !!userId,
  });
}

// Admin Reports
export function useAdminBalanceReport(asOfDate: string) {
  return useQuery<any>({
    queryKey: ["/api/admin/reports/balances", asOfDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/balances?asOfDate=${asOfDate}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });
}

export async function searchAdminUsers(query: string): Promise<any[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(query)}`, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export function useAdminUserTransactions(userId: number | null, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return useQuery<any>({
    queryKey: ["/api/admin/users/transactions", userId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/transactions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useAdminOrdersReport(filters: { startDate?: string; endDate?: string; status?: string[]; includeDeleted?: boolean; page: number; pageSize: number }) {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.status) filters.status.forEach(s => params.append('status', s));
  if (filters.includeDeleted) params.append('includeDeleted', 'true');
  params.append('page', filters.page.toString());
  params.append('pageSize', filters.pageSize.toString());
  
  return useQuery<any>({
    queryKey: ["/api/admin/reports/orders", filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });
}

export async function adminDeleteOrder(orderId: number): Promise<void> {
  const res = await fetch(`/api/admin/orders/${orderId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete order');
  }
}

export function useAdminContractsReport(filters: { startDate?: string; endDate?: string; status?: string[]; page: number; pageSize: number }) {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.status) filters.status.forEach(s => params.append('status', s));
  params.append('page', filters.page.toString());
  params.append('pageSize', filters.pageSize.toString());
  
  return useQuery<any>({
    queryKey: ["/api/admin/reports/contracts", filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/contracts?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });
}

export function useAdminPartnerRewardsReport(filters: { startDate?: string; endDate?: string; page: number; pageSize: number }) {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  params.append('page', filters.page.toString());
  params.append('pageSize', filters.pageSize.toString());
  
  return useQuery<any>({
    queryKey: ["/api/admin/reports/partner-rewards", filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/partner-rewards?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });
}

export function useAdminPlatformCommissionReport(filters: { startDate?: string; endDate?: string; status?: string[]; page: number; pageSize: number }) {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.status && filters.status.length > 0) {
    filters.status.forEach(s => params.append('status', s));
  }
  params.append('page', filters.page.toString());
  params.append('pageSize', filters.pageSize.toString());
  
  return useQuery<any>({
    queryKey: ["/api/admin/reports/platform-commission", filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/platform-commission?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });
}

// Ratings API
export function useUserRatings(userId: number) {
  return useQuery<any[]>({
    queryKey: ["/api/ratings", userId],
    enabled: !!userId,
  });
}

export function useCreateRating() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ratings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ratings"] });
    },
  });
}

// Admin Order Details API
export function useAdminOrderDetails(orderId: number) {
  return useQuery<{
    order: any;
    offers: any[];
    acceptedOffer: any;
    contract: any;
    offerCount: number;
  }>({
    queryKey: ["/api/admin/orders", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
    enabled: !!orderId && !isNaN(orderId),
  });
}
