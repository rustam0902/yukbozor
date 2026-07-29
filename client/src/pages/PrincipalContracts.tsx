import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { FileText, Loader2, AlertTriangle, UserCheck, MoreVertical, CreditCard, Download } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/utils';
import { formatDate } from '@/lib/dateFormat';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState, useCallback } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { XCircle } from 'lucide-react';

interface Contract {
  id: number;
  orderId: number;
  status: string;
  signedAt?: string | null;
  generatedAt?: string | null;
  offerPrice?: number | string | null;
  terminationInitiatedBy?: number | null;
  terminationPenaltyType?: 'penalty_customer' | 'penalty_carrier' | 'no_penalty' | null;
  customerId?: number;
  carrierId?: number;
  order?: {
    title: string;
    priceWithVat?: number | string | null;
    requiresCollateral?: boolean;
  };
  carrier?: {
    displayName: string;
    companyName?: string;
  };
}

export default function PrincipalContracts() {
  const { representativeMode, representativeModeEnabled, representativeModeInitialized } = useAuth();
  const { language } = useLanguage();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [prepaymentConfirmOpen, setPrepaymentConfirmOpen] = useState(false);
  const [selectedContractForPrepayment, setSelectedContractForPrepayment] = useState<number | null>(null);
  const [terminationDialogOpen, setTerminationDialogOpen] = useState(false);
  const [selectedContractForTermination, setSelectedContractForTermination] = useState<Contract | null>(null);
  const [selectedPenaltyType, setSelectedPenaltyType] = useState<'penalty_customer' | 'penalty_carrier' | 'no_penalty'>('no_penalty');

  const texts = {
    ru: {
      title: 'Договоры доверителей',
      description: 'Договоры организации, от имени которой вы работаете',
      selectPrincipal: 'Выберите доверителя',
      selectPrincipalDesc: 'Перейдите в раздел "Мои доверители" и активируйте работу от имени организации',
      goToPrincipals: 'Мои доверители',
      currentPrincipal: 'Текущий доверитель',
      noContracts: 'Нет договоров',
      noContractsDesc: 'У этой организации пока нет договоров',
      loading: 'Загрузка...',
      modeDisabled: 'Режим представителя отключён',
      enableInProfile: 'Включите режим представителя в настройках профиля',
      goToProfile: 'Перейти в профиль',
      contractId: 'ID',
      order: 'Заказ',
      carrier: 'Перевозчик',
      amount: 'Сумма',
      date: 'Дата',
      status: 'Статус',
      actions: 'Действия',
      pay: 'Оплатить',
      downloadDocxRu: 'Скачать DOCX (RUS)',
      downloadDocxUz: 'Скачать DOCX (UZB)',
      noPayPermission: 'Нет прав на оплату',
      payConfirmTitle: 'Подтверждение оплаты',
      payConfirmDesc: 'Вы уверены, что хотите произвести предоплату по договору?',
      yes: 'Да',
      cancel: 'Отмена',
      paymentSuccess: 'Предоплата успешно внесена',
      paymentError: 'Ошибка при оплате',
      statuses: {
        pending: 'Ожидает',
        active: 'Активен',
        completed: 'Завершён',
        cancelled: 'Отменён',
        closed: 'Закрыт',
        fully_signed: 'Полностью подписан',
        awaiting_prepayment: 'Ожидается предоплата',
        prepayment_made: 'Предоплата внесена',
        awaiting_completion_confirmation: 'Ожидается подтверждение выполнения',
        termination_pending: 'Ожидает расторжения',
        terminated: 'Договор расторгнут',
      },
      terminateContract: 'Расторгнуть договор',
      terminationTitle: 'Расторжение договора',
      terminationDescription: 'Выберите вариант расторжения договора:',
      penaltyCustomer: 'Штраф заказчику (2%)',
      penaltyCarrier: 'Штраф перевозчику (2%)',
      noPenalty: 'Без штрафа',
      submitTermination: 'Отправить запрос',
      terminationSuccess: 'Запрос на расторжение отправлен',
      terminationError: 'Ошибка при расторжении',
      confirmTermination: 'Подтвердить расторжение',
      cancelTermination: 'Отменить расторжение',
      terminationConfirmed: 'Договор расторгнут',
      terminationCancelled: 'Запрос на расторжение отменён',
      noTerminatePermission: 'Нет прав на расторжение',
    },
    uz: {
      title: 'Ishonch beruvchilar shartnomalari',
      description: 'Nomidan ishlayotgan tashkilot shartnomalari',
      selectPrincipal: 'Ishonch beruvchini tanlang',
      selectPrincipalDesc: '"Ishonch beruvchilarim" bo\'limiga o\'ting va tashkilot nomidan ishlashni faollashtiring',
      goToPrincipals: 'Ishonch beruvchilarim',
      currentPrincipal: 'Joriy ishonch beruvchi',
      noContracts: 'Shartnomalar yo\'q',
      noContractsDesc: 'Bu tashkilotda hali shartnomalar yo\'q',
      loading: 'Yuklanmoqda...',
      modeDisabled: 'Vakil rejimi o\'chirilgan',
      enableInProfile: 'Profil sozlamalarida vakil rejimini yoqing',
      goToProfile: 'Profilga o\'tish',
      contractId: 'ID',
      order: 'Buyurtma',
      carrier: 'Tashuvchi',
      amount: 'Summa',
      date: 'Sana',
      status: 'Holat',
      actions: 'Amallar',
      pay: 'To\'lash',
      downloadDocxRu: 'DOCX yuklash (RUS)',
      downloadDocxUz: 'DOCX yuklash (UZB)',
      noPayPermission: 'To\'lash huquqi yo\'q',
      payConfirmTitle: 'To\'lovni tasdiqlash',
      payConfirmDesc: 'Shartnoma bo\'yicha oldindan to\'lov qilmoqchimisiz?',
      yes: 'Ha',
      cancel: 'Bekor qilish',
      paymentSuccess: 'Oldindan to\'lov muvaffaqiyatli qilindi',
      paymentError: 'To\'lovda xatolik',
      statuses: {
        pending: 'Kutilmoqda',
        active: 'Faol',
        completed: 'Yakunlangan',
        cancelled: 'Bekor qilingan',
        closed: 'Yopilgan',
        fully_signed: 'To\'liq imzolangan',
        awaiting_prepayment: 'Oldindan to\'lov kutilmoqda',
        prepayment_made: 'Oldindan to\'lov qilingan',
        awaiting_completion_confirmation: 'Bajarilganini tasdiqlash kutilmoqda',
        termination_pending: 'Bekor qilish kutilmoqda',
        terminated: 'Shartnoma bekor qilindi',
      },
      terminateContract: 'Shartnomani bekor qilish',
      terminationTitle: 'Shartnomani bekor qilish',
      terminationDescription: 'Bekor qilish variantini tanlang:',
      penaltyCustomer: 'Buyurtmachiga jarima (2%)',
      penaltyCarrier: 'Tashuvchiga jarima (2%)',
      noPenalty: 'Jarimasiz',
      submitTermination: 'So\'rov yuborish',
      terminationSuccess: 'Bekor qilish so\'rovi yuborildi',
      terminationError: 'Bekor qilishda xatolik',
      confirmTermination: 'Bekor qilishni tasdiqlash',
      cancelTermination: 'Bekor qilish so\'rovini qaytarish',
      terminationConfirmed: 'Shartnoma bekor qilindi',
      terminationCancelled: 'Bekor qilish so\'rovi qaytarildi',
      noTerminatePermission: 'Bekor qilish huquqi yo\'q',
    }
  };
  const t = texts[language];

  const hasPayPermission = representativeMode?.permissions?.includes('pay_contract') || false;
  const hasTerminatePermission = representativeMode?.permissions?.includes('terminate_contract') || false;

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ['/api/representatives/principal-contracts', { customerId: representativeMode?.customerId }],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch('/api/representatives/principal-contracts', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to fetch principal contracts');
      }
      return res.json();
    },
    enabled: representativeModeEnabled && representativeMode?.active && !!representativeMode?.customerId,
  });

  const payPrepaymentMutation = useMutation({
    mutationFn: async (contractId: number) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch(`/api/contracts/${contractId}/pay-prepayment`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw errorData;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-contracts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/deposit'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'], exact: false });
      toast({
        title: t.paymentSuccess,
      });
      setPrepaymentConfirmOpen(false);
      setSelectedContractForPrepayment(null);
    },
    onError: (error: { error?: string; message?: string }) => {
      toast({
        title: t.paymentError,
        description: error.error || error.message || 'Unknown error',
        variant: 'destructive',
      });
      setPrepaymentConfirmOpen(false);
      setSelectedContractForPrepayment(null);
    },
  });

  const handlePay = (contractId: number) => {
    setSelectedContractForPrepayment(contractId);
    setPrepaymentConfirmOpen(true);
  };

  const confirmPrepayment = () => {
    if (selectedContractForPrepayment && representativeMode?.customerId) {
      payPrepaymentMutation.mutate(selectedContractForPrepayment);
    } else {
      setPrepaymentConfirmOpen(false);
      setSelectedContractForPrepayment(null);
    }
  };

  const canPayContract = (status: string) => {
    return status === 'awaiting_prepayment' || status === 'fully_signed';
  };

  const canTerminateContract = (status: string) => {
    return status !== 'closed' && status !== 'terminated' && status !== 'termination_pending';
  };

  const initiateTerminationMutation = useMutation({
    mutationFn: async ({ contractId, penaltyType }: { contractId: number; penaltyType: string }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch(`/api/contracts/${contractId}/initiate-termination`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ penaltyType }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw errorData;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-contracts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'], exact: false });
      toast({ title: t.terminationSuccess });
      setTerminationDialogOpen(false);
      setSelectedContractForTermination(null);
    },
    onError: (error: { error?: string; message?: string }) => {
      toast({
        title: t.terminationError,
        description: error.error || error.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const confirmTerminationMutation = useMutation({
    mutationFn: async (contractId: number) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch(`/api/contracts/${contractId}/confirm-termination`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw errorData;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-contracts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'], exact: false });
      toast({ title: t.terminationConfirmed });
    },
    onError: (error: { error?: string; message?: string }) => {
      toast({
        title: t.terminationError,
        description: error.error || error.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const cancelTerminationMutation = useMutation({
    mutationFn: async (contractId: number) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch(`/api/contracts/${contractId}/cancel-termination`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw errorData;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-contracts'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'], exact: false });
      toast({ title: t.terminationCancelled });
    },
    onError: (error: { error?: string; message?: string }) => {
      toast({
        title: t.terminationError,
        description: error.error || error.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const openTerminationDialog = (contract: Contract) => {
    setSelectedContractForTermination(contract);
    setSelectedPenaltyType('no_penalty');
    setTerminationDialogOpen(true);
  };

  const handleInitiateTermination = () => {
    if (selectedContractForTermination && representativeMode?.customerId) {
      initiateTerminationMutation.mutate({
        contractId: selectedContractForTermination.id,
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

  const downloadContract = useCallback(async (contractId: number, lang: 'uz' | 'ru') => {
    if (!representativeMode?.customerId) {
      toast({
        title: language === 'ru' ? 'Ошибка' : 'Xato',
        description: language === 'ru' ? 'Доверитель не выбран' : 'Ishonchli shaxs tanlanmagan',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/contracts/${contractId}/download/${lang}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-Representative-Customer-Id': representativeMode.customerId.toString(),
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${contractId}_${lang}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: language === 'ru' ? 'Ошибка' : 'Xato',
        description: error instanceof Error ? error.message : 'Download failed',
        variant: 'destructive',
      });
    }
  }, [representativeMode?.customerId, language, toast]);

  if (!representativeModeInitialized) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center" data-testid="page-principal-contracts-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!representativeModeEnabled) {
    return (
      <div className="container mx-auto p-6" data-testid="page-principal-contracts-disabled">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">{t.modeDisabled}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.enableInProfile}</p>
              <Link href="/customer/profile">
                <Button variant="outline" className="mt-4" data-testid="button-go-to-profile">
                  {t.goToProfile}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!representativeMode?.active) {
    return (
      <div className="container mx-auto p-6" data-testid="page-principal-contracts-no-principal">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">{t.selectPrincipal}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.selectPrincipalDesc}</p>
              <Link href="/customer/principals">
                <Button variant="default" className="mt-4" data-testid="button-go-to-principals">
                  {t.goToPrincipals}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="page-principal-contracts-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: t.statuses.pending },
      active: { variant: 'default', label: t.statuses.active },
      completed: { variant: 'outline', label: t.statuses.completed },
      cancelled: { variant: 'destructive', label: t.statuses.cancelled },
      closed: { variant: 'outline', label: t.statuses.closed },
      fully_signed: { variant: 'default', label: t.statuses.fully_signed },
      awaiting_prepayment: { variant: 'secondary', label: t.statuses.awaiting_prepayment },
      prepayment_made: { variant: 'default', label: t.statuses.prepayment_made },
      awaiting_completion_confirmation: { variant: 'secondary', label: t.statuses.awaiting_completion_confirmation },
      termination_pending: { variant: 'destructive', label: t.statuses.termination_pending },
      terminated: { variant: 'destructive', label: t.statuses.terminated },
    };
    const statusInfo = statusMap[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6" data-testid="page-principal-contracts">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
          <div className="mt-2 p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <span className="font-medium text-primary">
              {t.currentPrincipal}: {representativeMode?.companyName || representativeMode?.customerName}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!contracts || contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{t.noContracts}</p>
              <p className="text-sm mt-2">{t.noContractsDesc}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.contractId}</TableHead>
                  <TableHead>{t.order}</TableHead>
                  <TableHead>{t.carrier}</TableHead>
                  <TableHead>{t.amount}</TableHead>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="text-right">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => {
                  const amount = contract.offerPrice || contract.order?.priceWithVat;
                  return (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                      <TableCell className="font-medium">#{contract.id}</TableCell>
                      <TableCell>{contract.order?.title || `#${contract.orderId}`}</TableCell>
                      <TableCell>{contract.carrier?.companyName || contract.carrier?.displayName || '—'}</TableCell>
                      <TableCell>{amount ? formatMoney(Number(amount)) : '—'}</TableCell>
                      <TableCell>{contract.generatedAt ? formatDate(contract.generatedAt) : '—'}</TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${contract.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => downloadContract(contract.id, 'uz')}
                              data-testid={`action-download-uz-${contract.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {t.downloadDocxUz}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => downloadContract(contract.id, 'ru')}
                              data-testid={`action-download-ru-${contract.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {t.downloadDocxRu}
                            </DropdownMenuItem>
                            {canPayContract(contract.status) && hasPayPermission && (
                              <DropdownMenuItem
                                onClick={() => handlePay(contract.id)}
                                disabled={payPrepaymentMutation.isPending}
                                data-testid={`action-pay-${contract.id}`}
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                {t.pay}
                              </DropdownMenuItem>
                            )}
                            {canTerminateContract(contract.status) && hasTerminatePermission && (
                              <DropdownMenuItem
                                onClick={() => openTerminationDialog(contract)}
                                disabled={initiateTerminationMutation.isPending}
                                data-testid={`action-terminate-${contract.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                {t.terminateContract}
                              </DropdownMenuItem>
                            )}
                            {contract.status === 'termination_pending' && contract.terminationInitiatedBy === contract.carrierId && hasTerminatePermission && (
                              <DropdownMenuItem
                                onClick={() => handleConfirmTermination(contract.id)}
                                disabled={confirmTerminationMutation.isPending}
                                data-testid={`action-confirm-termination-${contract.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                {t.confirmTermination}
                              </DropdownMenuItem>
                            )}
                            {contract.status === 'termination_pending' && contract.terminationInitiatedBy === contract.customerId && hasTerminatePermission && (
                              <DropdownMenuItem
                                onClick={() => handleCancelTermination(contract.id)}
                                disabled={cancelTerminationMutation.isPending}
                                data-testid={`action-cancel-termination-${contract.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                {t.cancelTermination}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={prepaymentConfirmOpen} onOpenChange={setPrepaymentConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.payConfirmTitle}</DialogTitle>
            <DialogDescription>{t.payConfirmDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPrepaymentConfirmOpen(false);
                setSelectedContractForPrepayment(null);
              }}
              data-testid="button-cancel-prepayment"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={confirmPrepayment}
              disabled={payPrepaymentMutation.isPending}
              data-testid="button-confirm-prepayment"
            >
              {payPrepaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.yes}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={terminationDialogOpen} onOpenChange={setTerminationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.terminationTitle}</DialogTitle>
            <DialogDescription>{t.terminationDescription}</DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={selectedPenaltyType}
            onValueChange={(value) => setSelectedPenaltyType(value as 'penalty_customer' | 'penalty_carrier' | 'no_penalty')}
            className="space-y-3"
          >
            {selectedContractForTermination?.order?.requiresCollateral && (
              <>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="penalty_customer" id="penalty_customer" />
                  <Label htmlFor="penalty_customer">{t.penaltyCustomer}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="penalty_carrier" id="penalty_carrier" />
                  <Label htmlFor="penalty_carrier">{t.penaltyCarrier}</Label>
                </div>
              </>
            )}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no_penalty" id="no_penalty" />
              <Label htmlFor="no_penalty">{t.noPenalty}</Label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTerminationDialogOpen(false);
                setSelectedContractForTermination(null);
              }}
              data-testid="button-cancel-termination-dialog"
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiateTermination}
              disabled={initiateTerminationMutation.isPending}
              data-testid="button-submit-termination"
            >
              {initiateTerminationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.submitTermination}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
