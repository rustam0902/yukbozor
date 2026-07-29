import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, MoreVertical, CreditCard, CheckCircle, XCircle, AlertTriangle, Star, PenLine, Receipt, FileText } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { RatingDialog } from './RatingDialog';
import { ContractSignDialog } from './ContractSignDialog';
import { InvoiceForm } from './InvoiceForm';
import { WaybillForm } from './WaybillForm';
import TableSearchFilter, { FilterState, filterData } from './TableSearchFilter';
import Pagination, { paginateData } from './Pagination';
import { formatDate } from '@/lib/dateFormat';
import { useAuth } from '@/contexts/auth-context';

interface ContractsTableProps {
  language: 'ru' | 'uz';
  userRole: 'customer' | 'carrier';
}

interface Contract {
  id: number;
  orderId: number;
  customerId: number;
  carrierId: number;
  status: string;
  documentHash: string | null;
  contractContent: string | null;
  customerSignature: string | null;
  carrierSignature: string | null;
  customerSignatureMethod: 'eimzo' | 'sms' | null;
  carrierSignatureMethod: 'eimzo' | 'sms' | null;
  customerSignedAt: Date | null;
  carrierSignedAt: Date | null;
  version: number;
  terminationInitiatedBy: number | null;
  terminationPenaltyType: 'penalty_customer' | 'penalty_carrier' | 'no_penalty' | null;
  terminationInitiatedAt: Date | null;
  terminationConfirmedAt: Date | null;
  generatedAt: Date;
  updatedAt: Date;
  order: {
    id: number;
    title: string;
    originRegion: string;
    destinationRegion: string;
    originPoints?: any[];
    destinationPoints?: any[];
    transportType: string;
    priceWithVat: number;
    requiresCollateral: boolean;
  };
  offerPrice: number | null;
  customer: {
    id: number;
    displayName: string;
    phone: string;
  };
  carrier: {
    id: number;
    displayName: string;
    phone: string;
  };
}

const transportTypeLabels: Record<string, { ru: string; uz: string }> = {
  labo: { ru: 'Лабо', uz: 'Labo' },
  bongo: { ru: 'Бонго', uz: 'Bongo' },
  furgon: { ru: 'Фургон', uz: 'Furgon' },
  isuzu5: { ru: 'Исузу 5т', uz: 'Isuzu 5t' },
  isuzu10: { ru: 'Исузу 10т', uz: 'Isuzu 10t' },
  gruzovik: { ru: 'Грузовик', uz: 'Yuk mashina' },
  fura_tent: { ru: 'Фура тент', uz: 'Fura tent' },
  fura_ref: { ru: 'Фура реф', uz: 'Fura ref' },
  paravoz: { ru: 'Паровоз', uz: 'Paravoz' },
  shalanda: { ru: 'Шаланда', uz: 'Shalanda' },
  traller: { ru: 'Траллер', uz: 'Traller' },
};

function getTransportTypeLabel(type: string, lang: 'ru' | 'uz'): string {
  return transportTypeLabels[type]?.[lang] || type;
}

export function ContractsTable({ language, userRole }: ContractsTableProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ['/api/contracts/my', userRole],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/my?role=${userRole}`);
      if (!res.ok) throw new Error('Failed to fetch contracts');
      return res.json();
    },
  });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    region: [],
    regionFrom: [],
    regionTo: [],
    transportType: [],
    dateFrom: '',
    dateTo: '',
    status: [],
    offerStatus: '',
    priceFrom: '',
    priceTo: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const texts = {
    ru: {
      myContracts: userRole === 'customer' ? 'Мои договоры' : 'Договоры',
      noContracts:
        userRole === 'customer'
          ? 'Нет договоров. Договоры создаются автоматически после принятия предложения.'
          : 'Нет договоров. Договоры создаются автоматически после принятия предложения заказчиком.',
      contractNumberDate: 'Номер и дата договора',
      orderNumber: 'Номер заказа',
      cargoName: 'Название груза',
      amount: 'Сумма',
      route: 'Маршрут',
      customer: 'Заказчик',
      carrier: 'Перевозчик',
      transportType: 'Тип транспорта',
      status: 'Статус',
      actions: 'Действия',
      downloadDocxUz: 'Скачать DOCX (UZB)',
      downloadDocxRu: 'Скачать DOCX (RUS)',
      pay: 'Оплатить',
      confirmCompletion: 'Подтвердить выполнение',
      markComplete: 'Выполнен',
      statusFullySigned: 'Полностью подписан',
      statusAwaitingPrepayment: 'Ожидается предоплата',
      statusPrepaymentMade: 'Предоплата внесена',
      statusAwaitingConfirmation: 'Ожидается подтверждение выполнения',
      statusClosed: 'Договор закрыт',
      statusTerminationPending: 'Ожидает расторжения',
      statusTerminated: 'Договор расторгнут',
      paymentSuccess: 'Предоплата успешно внесена',
      markCompleteSuccess: 'Договор отмечен как выполненный',
      confirmSuccess: 'Выполнение подтверждено, договор закрыт',
      error: 'Ошибка',
      insufficientFunds: 'Недостаточно средств на депозите',
      requiredAmount: 'Требуется',
      availableAmount: 'Доступно',
      terminateContract: 'Расторгнуть договор',
      signContract: 'Подписать',
      terminationTitle: 'Расторжение договора',
      terminationDescription: 'Выберите вариант расторжения договора:',
      penaltyCustomer: 'Штраф с Заказчика',
      penaltyCarrier: 'Штраф с Перевозчика',
      noPenalty: 'Без штрафа',
      submitTermination: 'Отправить запрос',
      cancel: 'Отмена',
      terminationInitiated: 'Запрос на расторжение отправлен',
      confirmTermination: 'Подтвердить расторжение',
      cancelTermination: 'Отменить расторжение',
      terminationConfirmed: 'Договор расторгнут',
      terminationCancelled: 'Запрос на расторжение отменён',
      awaitingTerminationConfirmation: 'Ожидается подтверждение расторжения',
      terminationRequestedByYou: 'Вы запросили расторжение',
      terminationRequestedByOther: 'Другая сторона запросила расторжение',
      confirmPrepaymentTitle: 'Подтверждение предоплаты',
      confirmPrepaymentMessage: 'Вы действительно хотите осуществить предоплату по данному договору?',
      confirmCompletionTitle: 'Подтверждение выполнения',
      confirmCompletionMessage: 'Вы действительно хотите подтвердить выполнение перевозки? После подтверждения договор будет закрыт.',
      yes: 'Да',
      reject: 'Отклонить',
    },
    uz: {
      myContracts: userRole === 'customer' ? 'Mening shartnomalarim' : 'Shartnomalar',
      noContracts:
        userRole === 'customer'
          ? 'Shartnomalar yo\'q. Shartnomalar taklif qabul qilingandan keyin avtomatik yaratiladi.'
          : 'Shartnomalar yo\'q. Shartnomalar buyurtmachi tomonidan taklif qabul qilingandan keyin avtomatik yaratiladi.',
      contractNumberDate: 'Shartnoma raqami va sanasi',
      orderNumber: 'Buyurtma raqami',
      cargoName: 'Yuk nomi',
      amount: 'Summa',
      route: 'Marshrut',
      customer: 'Buyurtmachi',
      carrier: 'Tashuvchi',
      transportType: 'Transport turi',
      status: 'Holati',
      actions: 'Amallar',
      downloadDocxUz: 'DOCX yuklash (UZB)',
      downloadDocxRu: 'DOCX yuklash (RUS)',
      pay: 'To\'lash',
      confirmCompletion: 'Bajarilganini tasdiqlash',
      markComplete: 'Bajarildi',
      statusFullySigned: 'To\'liq imzolangan',
      statusAwaitingPrepayment: 'Oldindan to\'lov kutilmoqda',
      statusPrepaymentMade: 'Oldindan to\'lov qilingan',
      statusAwaitingConfirmation: 'Bajarilganini tasdiqlash kutilmoqda',
      statusClosed: 'Shartnoma yopilgan',
      statusTerminationPending: 'Bekor qilish kutilmoqda',
      statusTerminated: 'Shartnoma bekor qilindi',
      paymentSuccess: 'Oldindan to\'lov muvaffaqiyatli qilindi',
      markCompleteSuccess: 'Shartnoma bajarilgan deb belgilandi',
      confirmSuccess: 'Bajarilgan tasdiqlandi, shartnoma yopildi',
      error: 'Xato',
      insufficientFunds: 'Depozitda mablag\' yetarli emas',
      requiredAmount: 'Kerakli summa',
      availableAmount: 'Mavjud',
      terminateContract: 'Shartnomani bekor qilish',
      signContract: 'Imzolash',
      terminationTitle: 'Shartnomani bekor qilish',
      terminationDescription: 'Bekor qilish variantini tanlang:',
      penaltyCustomer: 'Buyurtmachidan jarima',
      penaltyCarrier: 'Tashuvchidan jarima',
      noPenalty: 'Jarimasiz',
      submitTermination: 'So\'rov yuborish',
      cancel: 'Bekor qilish',
      terminationInitiated: 'Bekor qilish so\'rovi yuborildi',
      confirmTermination: 'Bekor qilishni tasdiqlash',
      cancelTermination: 'Bekor qilish so\'rovini qaytarish',
      terminationConfirmed: 'Shartnoma bekor qilindi',
      terminationCancelled: 'Bekor qilish so\'rovi qaytarildi',
      awaitingTerminationConfirmation: 'Bekor qilishni tasdiqlash kutilmoqda',
      terminationRequestedByYou: 'Siz bekor qilishni so\'radingiz',
      terminationRequestedByOther: 'Boshqa tomon bekor qilishni so\'radi',
      confirmPrepaymentTitle: 'Oldindan to\'lovni tasdiqlash',
      confirmPrepaymentMessage: 'Ushbu shartnoma bo\'yicha oldindan to\'lovni amalga oshirmoqchimisiz?',
      confirmCompletionTitle: 'Bajarilganini tasdiqlash',
      confirmCompletionMessage: 'Tashishni bajarilganini tasdiqlaysizmi? Tasdiqlashdan so\'ng shartnoma yopiladi.',
      yes: 'Ha',
      reject: 'Rad etish',
    },
  };

  const t = texts[language];

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      fully_signed: t.statusFullySigned,
      awaiting_prepayment: t.statusAwaitingPrepayment,
      prepayment_made: t.statusPrepaymentMade,
      awaiting_completion_confirmation: t.statusAwaitingConfirmation,
      closed: t.statusClosed,
      termination_pending: t.statusTerminationPending,
      terminated: t.statusTerminated,
    };
    return statusMap[status] || status;
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'awaiting_prepayment':
        return 'default';
      case 'prepayment_made':
      case 'awaiting_completion_confirmation':
        return 'secondary';
      case 'fully_signed':
      case 'closed':
        return 'default';
      case 'termination_pending':
        return 'secondary';
      case 'terminated':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const payPrepaymentMutation = useMutation({
    mutationFn: async (contractId: number) => {
      const res = await fetch(`/api/contracts/${contractId}/pay-prepayment`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw errorData;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.paymentSuccess });
    },
    onError: (error: any) => {
      if (error?.error === 'Insufficient funds for prepayment' || error?.required) {
        const required = error.required ? formatMoney(error.required) : '?';
        const available = error.available !== undefined ? formatMoney(error.available) : '0';
        toast({ 
          title: t.insufficientFunds,
          description: `${t.requiredAmount}: ${required} сум. ${t.availableAmount}: ${available} сум.`,
          variant: 'destructive' 
        });
      } else {
        toast({ title: t.error, description: error?.error || '', variant: 'destructive' });
      }
    },
  });

  const markCompletedMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return await apiRequest('POST', `/api/contracts/${contractId}/mark-completed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      toast({ title: t.markCompleteSuccess });
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    },
  });

  const confirmCompletionMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return await apiRequest('POST', `/api/contracts/${contractId}/confirm-completion`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.confirmSuccess });
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    },
  });

  const handlePay = (contractId: number) => {
    setSelectedContractForPrepayment(contractId);
    setPrepaymentConfirmOpen(true);
  };

  const handleConfirmCompletion = (contractId: number) => {
    setSelectedContractForCompletion(contractId);
    setCompletionConfirmOpen(true);
  };

  const confirmPrepayment = () => {
    if (selectedContractForPrepayment) {
      payPrepaymentMutation.mutate(selectedContractForPrepayment);
    }
    setPrepaymentConfirmOpen(false);
    setSelectedContractForPrepayment(null);
  };

  const confirmCompletion = () => {
    if (selectedContractForCompletion) {
      confirmCompletionMutation.mutate(selectedContractForCompletion);
    }
    setCompletionConfirmOpen(false);
    setSelectedContractForCompletion(null);
  };

  const handleMarkComplete = (contractId: number) => {
    markCompletedMutation.mutate(contractId);
  };

  // Termination state and mutations
  const [terminationDialogOpen, setTerminationDialogOpen] = useState(false);
  const [selectedContractForTermination, setSelectedContractForTermination] = useState<number | null>(null);
  const [selectedPenaltyType, setSelectedPenaltyType] = useState<string>('no_penalty');
  
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedContractForRating, setSelectedContractForRating] = useState<Contract | null>(null);
  const [unratedClosedContracts, setUnratedClosedContracts] = useState<Contract[]>([]);
  const [dismissedContractIds, setDismissedContractIds] = useState<Set<number>>(new Set());
  
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedContractForSign, setSelectedContractForSign] = useState<number | null>(null);
  
  // Didox document dialogs
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [waybillDialogOpen, setWaybillDialogOpen] = useState(false);
  const [selectedContractForDocument, setSelectedContractForDocument] = useState<number | null>(null);
  
  // Confirmation dialogs for prepayment and completion
  const [prepaymentConfirmOpen, setPrepaymentConfirmOpen] = useState(false);
  const [selectedContractForPrepayment, setSelectedContractForPrepayment] = useState<number | null>(null);
  const [completionConfirmOpen, setCompletionConfirmOpen] = useState(false);
  const [selectedContractForCompletion, setSelectedContractForCompletion] = useState<number | null>(null);

  const closedContracts = useMemo(() => contracts?.filter(c => c.status === 'closed') || [], [contracts]);
  const closedContractIdsKey = useMemo(() => closedContracts.map(c => c.id).sort().join(','), [closedContracts]);

  const { data: unratedContracts = [], refetch: refetchUnrated } = useQuery<Contract[]>({
    queryKey: ['/api/ratings/unrated-contracts', userRole, closedContractIdsKey],
    queryFn: async () => {
      if (closedContracts.length === 0) return [];
      
      const results: (Contract | null)[] = [];
      const batchSize = 3;
      
      for (let i = 0; i < closedContracts.length; i += batchSize) {
        const batch = closedContracts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (contract) => {
            try {
              const res = await fetch(`/api/ratings/check/${contract.id}`, { credentials: 'include' });
              if (!res.ok) return null;
              const data = await res.json();
              return data.hasRated ? null : contract;
            } catch {
              return null;
            }
          })
        );
        results.push(...batchResults);
      }
      
      return results.filter((c): c is Contract => c !== null);
    },
    enabled: closedContracts.length > 0,
    staleTime: 120000,
    gcTime: 180000,
  });

  useEffect(() => {
    setUnratedClosedContracts(unratedContracts);
  }, [unratedContracts]);

  useEffect(() => {
    const availableForPrompt = unratedContracts.find(c => !dismissedContractIds.has(c.id));
    if (availableForPrompt && !ratingDialogOpen && !selectedContractForRating) {
      setSelectedContractForRating(availableForPrompt);
      setRatingDialogOpen(true);
    }
  }, [unratedContracts]);

  const openRatingDialog = useCallback((contract: Contract) => {
    setSelectedContractForRating(contract);
    setRatingDialogOpen(true);
  }, []);

  const handleRatingClose = useCallback(() => {
    if (!selectedContractForRating) return;
    const contractId = selectedContractForRating.id;
    setRatingDialogOpen(false);
    setSelectedContractForRating(null);
    setDismissedContractIds(prev => new Set(prev).add(contractId));
  }, [selectedContractForRating?.id]);

  const handleRatingSuccess = useCallback(() => {
    refetchUnrated();
  }, [refetchUnrated]);

  const initiateTerminationMutation = useMutation({
    mutationFn: async ({ contractId, penaltyType }: { contractId: number; penaltyType: string }) => {
      return await apiRequest('POST', `/api/contracts/${contractId}/initiate-termination`, { penaltyType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.terminationInitiated });
      setTerminationDialogOpen(false);
      setSelectedContractForTermination(null);
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    },
  });

  const confirmTerminationMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return await apiRequest('POST', `/api/contracts/${contractId}/confirm-termination`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.terminationConfirmed });
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    },
  });

  const cancelTerminationMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return await apiRequest('POST', `/api/contracts/${contractId}/cancel-termination`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.terminationCancelled });
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    },
  });

  const openTerminationDialog = (contractId: number) => {
    setSelectedContractForTermination(contractId);
    setSelectedPenaltyType('no_penalty');
    setTerminationDialogOpen(true);
  };

  const openSignDialog = (contractId: number) => {
    if (!user?.userType) {
      toast({
        title: language === 'ru' ? 'Подождите' : 'Kuting',
        description: language === 'ru' ? 'Загрузка данных пользователя...' : 'Foydalanuvchi ma\'lumotlari yuklanmoqda...',
        variant: 'default'
      });
      return;
    }
    setSelectedContractForSign(contractId);
    setSignDialogOpen(true);
  };

  const canSign = (contract: Contract) => {
    const mySignature = userRole === 'customer' ? contract.customerSignature : contract.carrierSignature;
    const isAutoSigned = mySignature?.startsWith('AUTO_SIGNED_');
    const hasSigned = mySignature && !isAutoSigned;
    
    const validStatuses = ['awaiting_prepayment', 'prepayment_made', 'awaiting_completion_confirmation', 'fully_signed'];
    const canSignNow = validStatuses.includes(contract.status) && !hasSigned;
    
    return canSignNow;
  };

  const handleInitiateTermination = () => {
    if (selectedContractForTermination) {
      initiateTerminationMutation.mutate({
        contractId: selectedContractForTermination,
        penaltyType: selectedPenaltyType,
      });
    }
  };

  const handleConfirmTermination = (contractId: number) => {
    confirmTerminationMutation.mutate(contractId);
  };

  const handleCancelTermination = (contractId: number) => {
    cancelTerminationMutation.mutate(contractId);
  };

  const getPenaltyTypeLabel = (penaltyType: string | null) => {
    switch (penaltyType) {
      case 'penalty_customer':
        return t.penaltyCustomer;
      case 'penalty_carrier':
        return t.penaltyCarrier;
      case 'no_penalty':
        return t.noPenalty;
      default:
        return '';
    }
  };

  const getContractSearchableText = (contract: Contract) => {
    const order = contract.order;
    const originRegionName = getRegionDisplayName(order.originRegion, language);
    const destRegionName = getRegionDisplayName(order.destinationRegion, language);
    const transportTypeName = getTransportTypeLabel(order.transportType, language);
    const statusLabel = getStatusLabel(contract.status);
    
    return [
      contract.id,
      `YB-${contract.id.toString().padStart(6, '0')}`,
      order.id,
      order.title,
      order.originRegion,
      order.destinationRegion,
      originRegionName,
      destRegionName,
      transportTypeName,
      statusLabel,
      contract.customer?.displayName || '',
      contract.carrier?.displayName || '',
      contract.offerPrice ? `${contract.offerPrice}` : (order.priceWithVat ? `${order.priceWithVat}` : '')
    ].filter(Boolean).join(' ');
  };

  const filteredContracts = contracts ? filterData(
    contracts,
    filters,
    getContractSearchableText,
    (contract: Contract) => {
      const order = contract.order;
      const regions: string[] = [];
      if (order.originPoints && order.originPoints.length > 0) {
        order.originPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order.originRegion) {
        regions.push(order.originRegion);
      }
      return regions;
    },
    (contract: Contract) => contract.order.transportType,
    (contract: Contract) => contract.generatedAt ? new Date(contract.generatedAt).toISOString().split('T')[0] : '',
    (contract: Contract) => contract.status,
    undefined,
    (contract: Contract) => {
      const order = contract.order;
      const regions: string[] = [];
      if (order.destinationPoints && order.destinationPoints.length > 0) {
        order.destinationPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order.destinationRegion) {
        regions.push(order.destinationRegion);
      }
      return regions;
    }
  ) : [];

  const paginatedContracts = paginateData(filteredContracts, currentPage, pageSize);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const contractStatusOptions = language === 'ru'
    ? [
        { value: 'awaiting_prepayment', label: 'Ожидается предоплата' },
        { value: 'prepayment_made', label: 'Предоплата внесена' },
        { value: 'awaiting_completion_confirmation', label: 'Ожидается подтверждение' },
        { value: 'closed', label: 'Договор закрыт' },
        { value: 'termination_pending', label: 'Ожидает расторжения' },
        { value: 'terminated', label: 'Расторгнут' }
      ]
    : [
        { value: 'awaiting_prepayment', label: 'Oldindan to\'lov kutilmoqda' },
        { value: 'prepayment_made', label: 'Oldindan to\'lov qilingan' },
        { value: 'awaiting_completion_confirmation', label: 'Tasdiqlash kutilmoqda' },
        { value: 'closed', label: 'Shartnoma yopilgan' },
        { value: 'termination_pending', label: 'Bekor qilish kutilmoqda' },
        { value: 'terminated', label: 'Bekor qilingan' }
      ];

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold" data-testid="heading-my-contracts">
            {t.myContracts}
          </h1>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold" data-testid="heading-my-contracts">
            {t.myContracts}
          </h1>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-contracts">
                {t.noContracts}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold" data-testid="heading-my-contracts">
          {t.myContracts}
        </h1>

        <TableSearchFilter
          language={language}
          onFilterChange={handleFilterChange}
          showRegionFilter={true}
          showTransportFilter={true}
          showDateFilter={true}
          showStatusFilter={true}
          statusOptions={contractStatusOptions}
        />

        {filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                {language === 'ru' ? 'Договоры не найдены' : 'Shartnomalar topilmadi'}
              </div>
            </CardContent>
          </Card>
        ) : (
        <div className="space-y-3">
          {paginatedContracts.map((contract) => (
            <Card
              key={contract.id}
              className="p-4"
              data-testid={`contract-row-${contract.id}`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div data-testid={`text-contract-number-${contract.id}`}>
                      <div className="font-semibold text-base">
                        YB-{contract.id.toString().padStart(6, '0')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(contract.generatedAt)}
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(contract.status)} data-testid={`badge-status-${contract.id}`}>
                      {getStatusLabel(contract.status)}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-actions-${contract.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => window.open(`/api/contracts/${contract.id}/download/uz`, '_blank')}
                        data-testid={`action-download-uz-${contract.id}`}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t.downloadDocxUz}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.open(`/api/contracts/${contract.id}/download/ru`, '_blank')}
                        data-testid={`action-download-ru-${contract.id}`}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t.downloadDocxRu}
                      </DropdownMenuItem>
                      {canSign(contract) && (
                        <DropdownMenuItem
                          onClick={() => openSignDialog(contract.id)}
                          data-testid={`action-sign-${contract.id}`}
                        >
                          <PenLine className="h-4 w-4 mr-2" />
                          {t.signContract}
                        </DropdownMenuItem>
                      )}
                      {userRole === 'customer' && (contract.status === 'awaiting_prepayment' || contract.status === 'fully_signed') && (
                        <DropdownMenuItem
                          onClick={() => handlePay(contract.id)}
                          disabled={payPrepaymentMutation.isPending}
                          data-testid={`action-pay-${contract.id}`}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          {t.pay}
                        </DropdownMenuItem>
                      )}
                      {userRole === 'customer' && contract.status === 'awaiting_completion_confirmation' && (
                        <DropdownMenuItem
                          onClick={() => handleConfirmCompletion(contract.id)}
                          disabled={confirmCompletionMutation.isPending}
                          data-testid={`action-confirm-completion-${contract.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {t.confirmCompletion}
                        </DropdownMenuItem>
                      )}
                      {userRole === 'carrier' && (contract.status === 'prepayment_made' || contract.status === 'fully_signed') && (
                        <DropdownMenuItem
                          onClick={() => handleMarkComplete(contract.id)}
                          disabled={markCompletedMutation.isPending}
                          data-testid={`action-mark-complete-${contract.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {t.markComplete}
                        </DropdownMenuItem>
                      )}
                      {contract.status !== 'closed' && contract.status !== 'terminated' && contract.status !== 'termination_pending' && (
                        <DropdownMenuItem
                          onClick={() => openTerminationDialog(contract.id)}
                          data-testid={`action-terminate-${contract.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {t.terminateContract}
                        </DropdownMenuItem>
                      )}
                      {contract.status === 'termination_pending' && contract.terminationInitiatedBy !== (userRole === 'customer' ? contract.customerId : contract.carrierId) && (
                        <DropdownMenuItem
                          onClick={() => handleConfirmTermination(contract.id)}
                          disabled={confirmTerminationMutation.isPending}
                          data-testid={`action-confirm-termination-${contract.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {t.confirmTermination} ({getPenaltyTypeLabel(contract.terminationPenaltyType)})
                        </DropdownMenuItem>
                      )}
                      {contract.status === 'termination_pending' && contract.terminationInitiatedBy === (userRole === 'customer' ? contract.customerId : contract.carrierId) && (
                        <DropdownMenuItem
                          onClick={() => handleCancelTermination(contract.id)}
                          disabled={cancelTerminationMutation.isPending}
                          data-testid={`action-cancel-termination-${contract.id}`}
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          {t.cancelTermination}
                        </DropdownMenuItem>
                      )}
                      {contract.status === 'closed' && unratedClosedContracts.some(c => c.id === contract.id) && (
                        <DropdownMenuItem
                          onClick={() => openRatingDialog(contract)}
                          data-testid={`action-rate-${contract.id}`}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          {language === 'ru' ? 'Оценить' : 'Baholash'}
                        </DropdownMenuItem>
                      )}
                      {userRole === 'carrier' && (contract.status === 'closed' || contract.status === 'prepayment_made' || contract.status === 'awaiting_completion_confirmation') && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedContractForDocument(contract.id);
                            setInvoiceDialogOpen(true);
                          }}
                          data-testid={`action-invoice-${contract.id}`}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          {language === 'ru' ? 'Счёт-фактура (Didox)' : 'Hisob-faktura (Didox)'}
                        </DropdownMenuItem>
                      )}
                      {userRole === 'customer' && (contract.status === 'closed' || contract.status === 'prepayment_made' || contract.status === 'awaiting_completion_confirmation') && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedContractForDocument(contract.id);
                            setWaybillDialogOpen(true);
                          }}
                          data-testid={`action-waybill-${contract.id}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {language === 'ru' ? 'ТТН (Didox)' : 'TTYu (Didox)'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                  <div data-testid={`text-order-number-${contract.id}`}>
                    <div className="text-muted-foreground text-xs font-medium mb-1">{t.orderNumber}</div>
                    <div>#{contract.orderId}</div>
                  </div>

                  <div data-testid={`text-cargo-name-${contract.id}`}>
                    <div className="text-muted-foreground text-xs font-medium mb-1">{t.cargoName}</div>
                    <div className="truncate">{contract.order.title}</div>
                  </div>

                  <div data-testid={`text-amount-${contract.id}`}>
                    <div className="text-muted-foreground text-xs font-medium mb-1">{t.amount}</div>
                    <div className="font-semibold">{formatMoney(contract.offerPrice || contract.order.priceWithVat)} UZS</div>
                  </div>

                  <div className="col-span-2 md:col-span-2 lg:col-span-2" data-testid={`text-route-${contract.id}`}>
                    <div className="text-muted-foreground text-xs font-medium mb-1">{t.route}</div>
                    <div className="text-xs whitespace-normal break-words">
                      <span>
                        {(contract.order.originPoints && contract.order.originPoints.length > 0 ? contract.order.originPoints : [{region: contract.order.originRegion}]).map((point: any, idx: number) => (
                          <span key={idx}>
                            {(contract.order.originPoints && contract.order.originPoints.length > 1) && <span className="font-medium">{idx + 1}. </span>}
                            {getRegionDisplayName(point.region, language)}
                            {idx < (contract.order.originPoints && contract.order.originPoints.length > 0 ? contract.order.originPoints.length : 1) - 1 && ', '}
                          </span>
                        ))}
                      </span>
                      <span> → </span>
                      <span>
                        {(contract.order.destinationPoints && contract.order.destinationPoints.length > 0 ? contract.order.destinationPoints : [{region: contract.order.destinationRegion}]).map((point: any, idx: number) => (
                          <span key={idx}>
                            {(contract.order.destinationPoints && contract.order.destinationPoints.length > 1) && <span className="font-medium">{idx + 1}. </span>}
                            {getRegionDisplayName(point.region, language)}
                            {idx < (contract.order.destinationPoints && contract.order.destinationPoints.length > 0 ? contract.order.destinationPoints.length : 1) - 1 && ', '}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-2 md:col-span-2 lg:col-span-2" data-testid={`text-customer-${contract.id}`}>
                    <div className="text-muted-foreground text-xs font-medium mb-1">{t.customer}</div>
                    <div className="whitespace-normal break-words">{contract.customer.displayName}</div>
                  </div>

                  <div className="col-span-2 md:col-span-2 lg:col-span-2" data-testid={`text-carrier-${contract.id}`}>
                    <div className="text-muted-foreground text-xs font-medium mb-1">{t.carrier}</div>
                    <div className="whitespace-normal break-words">{contract.carrier.displayName}</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <Pagination
            language={language}
            totalItems={filteredContracts.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
        )}
      </div>

      <Dialog open={terminationDialogOpen} onOpenChange={setTerminationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.terminationTitle}</DialogTitle>
            <DialogDescription>{t.terminationDescription}</DialogDescription>
          </DialogHeader>
          {(() => {
            const selectedContract = contracts?.find(c => c.id === selectedContractForTermination);
            const showPenaltyOptions = selectedContract?.order?.requiresCollateral === true;
            
            return (
              <RadioGroup value={selectedPenaltyType} onValueChange={setSelectedPenaltyType}>
                {showPenaltyOptions && (
                  <>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="penalty_customer" id="penalty_customer" data-testid="radio-penalty-customer" />
                      <Label htmlFor="penalty_customer">{t.penaltyCustomer}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="penalty_carrier" id="penalty_carrier" data-testid="radio-penalty-carrier" />
                      <Label htmlFor="penalty_carrier">{t.penaltyCarrier}</Label>
                    </div>
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no_penalty" id="no_penalty" data-testid="radio-no-penalty" />
                  <Label htmlFor="no_penalty">{t.noPenalty}</Label>
                </div>
              </RadioGroup>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminationDialogOpen(false)} data-testid="button-cancel-termination-dialog">
              {t.cancel}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleInitiateTermination}
              disabled={initiateTerminationMutation.isPending}
              data-testid="button-submit-termination"
            >
              {t.submitTermination}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedContractForRating && (
        <RatingDialog
          isOpen={ratingDialogOpen}
          onClose={handleRatingClose}
          onSuccess={handleRatingSuccess}
          language={language}
          contractId={selectedContractForRating.id}
          ratedUserId={userRole === 'customer' ? selectedContractForRating.carrierId : selectedContractForRating.customerId}
          ratedAsRole={userRole === 'customer' ? 'carrier' : 'customer'}
          counterpartyName={userRole === 'customer' ? selectedContractForRating.carrier.displayName : selectedContractForRating.customer.displayName}
        />
      )}

      {selectedContractForSign && user && user.userType && (
        <ContractSignDialog
          isOpen={signDialogOpen}
          onClose={() => {
            setSignDialogOpen(false);
            setSelectedContractForSign(null);
          }}
          contractId={selectedContractForSign}
          language={language}
          userType={user.userType as 'individual' | 'legal' | 'ip'}
          userRole={userRole}
        />
      )}

      {/* Prepayment Confirmation Dialog */}
      <Dialog open={prepaymentConfirmOpen} onOpenChange={setPrepaymentConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirmPrepaymentTitle}</DialogTitle>
            <DialogDescription>{t.confirmPrepaymentMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setPrepaymentConfirmOpen(false);
                setSelectedContractForPrepayment(null);
              }}
              data-testid="button-reject-prepayment"
            >
              {t.reject}
            </Button>
            <Button 
              onClick={confirmPrepayment}
              disabled={payPrepaymentMutation.isPending}
              data-testid="button-confirm-prepayment"
            >
              {t.yes}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Confirmation Dialog */}
      <Dialog open={completionConfirmOpen} onOpenChange={setCompletionConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirmCompletionTitle}</DialogTitle>
            <DialogDescription>{t.confirmCompletionMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCompletionConfirmOpen(false);
                setSelectedContractForCompletion(null);
              }}
              data-testid="button-reject-completion"
            >
              {t.reject}
            </Button>
            <Button 
              onClick={confirmCompletion}
              disabled={confirmCompletionMutation.isPending}
              data-testid="button-confirm-completion"
            >
              {t.yes}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Form Dialog (Didox) */}
      {selectedContractForDocument && (
        <InvoiceForm
          language={language}
          contractId={selectedContractForDocument}
          open={invoiceDialogOpen}
          onClose={() => {
            setInvoiceDialogOpen(false);
            setSelectedContractForDocument(null);
          }}
        />
      )}

      {/* Waybill Form Dialog (Didox) */}
      {selectedContractForDocument && (
        <WaybillForm
          language={language}
          contractId={selectedContractForDocument}
          open={waybillDialogOpen}
          onClose={() => {
            setWaybillDialogOpen(false);
            setSelectedContractForDocument(null);
          }}
        />
      )}
    </div>
  );
}
