import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, History, Loader2, AlertCircle, CheckCircle, Building2, Download, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import type { DepositTransaction } from '@shared/schema';
import { formatAmountWithSpaces, parseFormattedAmount } from '@/lib/number-to-words';
import { formatMoney } from '@/lib/utils';
import { WithdrawalVerificationDialog } from './WithdrawalVerificationDialog';

interface DepositProps {
  language: 'ru' | 'uz';
}

type TransactionWithAccount = DepositTransaction & { accountType: string };

export function Deposit({ language }: DepositProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState<string>('');
  
  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSourceAccount] = useState<'main'>('main');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [pendingWithdrawAmount, setPendingWithdrawAmount] = useState(0);
  
  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('all');
  const [exportAccount, setExportAccount] = useState<'all' | 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus'>('all');
  const [exportDateFrom, setExportDateFrom] = useState<Date | undefined>(undefined);
  const [exportDateTo, setExportDateTo] = useState<Date | undefined>(undefined);

  const { data: depositsArray, isLoading: depositsLoading, refetch: refetchDeposits } = useQuery<any[]>({
    queryKey: ['/api/deposits/me'],
  });

  const { data: transactions, refetch: refetchTransactions } = useQuery<TransactionWithAccount[]>({
    queryKey: ['/api/deposits/transactions'],
  });
  

  // Transform array to object by account type with full deposit info
  const depositsMap = depositsArray?.reduce((acc: any, dep: any) => {
    if (dep.accountType) {
      acc[dep.accountType] = dep;
    }
    return acc;
  }, {}) || {};

  const deposits = {
    main: depositsMap.main?.balance || 0,
    blocked: depositsMap.blocked?.balance || 0,
    in_transit: depositsMap.in_transit?.balance || 0,
    partner_reward: depositsMap.partner_reward?.balance || 0,
    registration_bonus: depositsMap.registration_bonus?.balance || 0,
  };

  // Get transactions for a specific account
  const getAccountTransactions = (accountType: string) => {
    return transactions?.filter(t => t.accountType === accountType) || [];
  };

  // Export transactions to Excel with filters
  const exportTransactionsToExcel = () => {
    if (!transactions || transactions.length === 0) {
      toast({
        title: language === 'uz' ? 'Tranzaksiyalar yo\'q' : 'Нет транзакций',
        description: language === 'uz' ? 'Eksport qilish uchun tranzaksiyalar yo\'q' : 'Нет транзакций для экспорта',
        variant: 'destructive',
      });
      return;
    }

    // Apply filters
    let filteredTransactions = [...transactions];
    
    // Account filter
    if (exportAccount !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => tx.accountType === exportAccount);
    }
    
    // Period filter (7d = today + 6 previous days = 7 days total)
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined = endOfDay(new Date());
    
    if (exportPeriod === '7d') {
      dateFrom = startOfDay(subDays(new Date(), 6));
    } else if (exportPeriod === '30d') {
      dateFrom = startOfDay(subDays(new Date(), 29));
    } else if (exportPeriod === '90d') {
      dateFrom = startOfDay(subDays(new Date(), 89));
    } else if (exportPeriod === 'custom') {
      if (!exportDateFrom) {
        toast({
          title: language === 'uz' ? 'Xato' : 'Ошибка',
          description: language === 'uz' ? 'Boshlanish sanasini tanlang' : 'Выберите начальную дату',
          variant: 'destructive',
        });
        return;
      }
      dateFrom = startOfDay(exportDateFrom);
      dateTo = exportDateTo ? endOfDay(exportDateTo) : endOfDay(new Date());
    }
    
    if (dateFrom) {
      filteredTransactions = filteredTransactions.filter(tx => {
        const txDate = new Date(tx.createdAt);
        return txDate >= dateFrom! && txDate <= dateTo!;
      });
    }
    
    if (filteredTransactions.length === 0) {
      toast({
        title: language === 'uz' ? 'Tranzaksiyalar yo\'q' : 'Нет транзакций',
        description: language === 'uz' ? 'Tanlangan filtrlar bo\'yicha tranzaksiyalar yo\'q' : 'Нет транзакций по выбранным фильтрам',
        variant: 'destructive',
      });
      return;
    }

    const accountNames: Record<string, string> = language === 'ru' ? {
      main: 'Основной',
      blocked: 'Блокированные',
      in_transit: 'В пути',
      partner_reward: 'Вознаграждение партнёра',
      registration_bonus: 'Регистрационный бонус',
    } : {
      main: 'Asosiy',
      blocked: 'Bloklangan',
      in_transit: 'Yo\'lda',
      partner_reward: 'Hamkor mukofoti',
      registration_bonus: 'Ro\'yxatdan o\'tish bonusi',
    };

    const transactionTypeNames: Record<string, string> = language === 'ru' ? {
      topup: 'Пополнение',
      block: 'Блокировка',
      unblock: 'Разблокировка',
      charge_for_service: 'Списание за услугу',
      withdrawal_request: 'Заявка на вывод',
      withdrawal_completed: 'Вывод завершён',
      escrow_block: 'Блокировка эскроу',
      escrow_release: 'Разблокировка эскроу',
      escrow_refund: 'Возврат эскроу',
      transfer_out: 'Перевод на другой счёт',
      transfer_in: 'Получение перевода',
      registration_bonus: 'Регистрационный бонус',
    } : {
      topup: 'To\'ldirish',
      block: 'Bloklash',
      unblock: 'Blokdan chiqarish',
      charge_for_service: 'Xizmat uchun yechish',
      withdrawal_request: 'Yechib olish so\'rovi',
      withdrawal_completed: 'Yechib olish tugallandi',
      escrow_block: 'Escrow bloklash',
      escrow_release: 'Escrow ochish',
      escrow_refund: 'Escrow qaytarish',
      transfer_out: 'Boshqa hisobga o\'tkazish',
      transfer_in: 'O\'tkazma qabul qilish',
      registration_bonus: 'Ro\'yxatdan o\'tish bonusi',
    };

    const statusNames: Record<string, string> = language === 'ru' ? {
      pending: 'В обработке',
      processing: 'Обрабатывается',
      completed: 'Завершено',
      cancelled: 'Отменено',
      rejected: 'Отклонено',
    } : {
      pending: 'Kutilmoqda',
      processing: 'Ishlanmoqda',
      completed: 'Tugallangan',
      cancelled: 'Bekor qilingan',
      rejected: 'Rad etilgan',
    };

    const headers = language === 'ru' 
      ? ['Дата', 'Счёт', 'Тип операции', 'Сумма (сум)', 'Статус', 'Описание']
      : ['Sana', 'Hisob', 'Operatsiya turi', 'Summa (so\'m)', 'Holat', 'Tavsif'];

    const data = filteredTransactions.map(tx => {
      const isPositive = ['topup', 'unblock', 'escrow_release', 'escrow_refund', 'transfer_in', 'registration_bonus'].includes(tx.type);
      const amount = isPositive ? Number(tx.amount) : -Number(tx.amount);
      return [
        new Date(tx.createdAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'uz-UZ'),
        accountNames[tx.accountType] || tx.accountType,
        transactionTypeNames[tx.type] || tx.type,
        amount,
        statusNames[tx.status] || tx.status,
        tx.reference || '',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Date
      { wch: 25 }, // Account
      { wch: 25 }, // Type
      { wch: 15 }, // Amount
      { wch: 15 }, // Status
      { wch: 40 }, // Description
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, language === 'ru' ? 'Транзакции' : 'Tranzaksiyalar');

    const fileName = language === 'ru' 
      ? `Транзакции_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Tranzaksiyalar_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, fileName);

    toast({
      title: language === 'uz' ? 'Muvaffaqiyatli' : 'Успешно',
      description: language === 'uz' ? 'Excel fayl yuklandi' : 'Excel файл скачан',
    });
    
    setExportOpen(false);
  };

  const texts = {
    ru: {
      deposit: 'Депозит',
      mainAccount: 'Основной',
      mainAccountDesc: 'Свободные денежные средства',
      blockedAccount: 'Блокированные',
      blockedAccountDesc: 'Заблокированные средства для комиссии, залога или оплаты',
      inTransitAccount: 'Деньги в пути',
      inTransitAccountDesc: 'Средства в процессе возврата на банковский счёт',
      partnerRewardAccount: 'Вознаграждение партнёра',
      partnerRewardAccountDesc: 'Начисленные вознаграждения по реферальной программе',
      registrationBonusAccount: 'Регистрационный бонус',
      registrationBonusAccountDesc: 'Бонус для новых перевозчиков, используется только для залога по предложениям',
      balance: 'Баланс',
      loading: 'Загрузка...',
      sum: 'сум',
      topUp: 'Пополнить',
      withdraw: 'Вывести средства',
      transferToMain: 'Перевести на основной',
      topUpTitle: 'Пополнение счёта',
      topUpDescription: 'Пополните счёт через платёжные системы',
      withdrawTitle: 'Снятие средств',
      withdrawDescription: 'Снятие средств на ваш',
      withdrawDescriptionIndividual: 'Снятие средств на пластиковую карту',
      withdrawDescriptionLegal: 'Снятие средств на ваш расчётный счёт в банке',
      comingSoon: 'Интеграция с платёжными системами в разработке',
      bankTransfer: 'Возврат средств на расчётный счёт в банке в разработке',
      cardTransfer: 'Возврат средств на пластиковую карту в разработке',
      noCardAttached: 'Для вывода средств необходимо прикрепить пластиковую карту в разделе "Профиль"',
      close: 'Закрыть',
      history: 'История транзакций',
      exportExcel: 'Скачать Excel',
      exportDialog: {
        title: 'Экспорт транзакций',
        description: 'Выберите параметры для экспорта в Excel',
        period: 'Период',
        account: 'Лицевой счёт',
        allAccounts: 'Все счета',
        allTime: 'Всё время',
        last7days: 'Последние 7 дней',
        last30days: 'Последние 30 дней',
        last90days: 'Последние 90 дней',
        customPeriod: 'Указать период',
        dateFrom: 'Дата от',
        dateTo: 'Дата до',
        download: 'Скачать',
        cancel: 'Отмена',
        selectDate: 'Выберите дату',
      },
      noTransactions: 'Нет транзакций',
      transactionTypes: {
        topup: 'Пополнение',
        block: 'Блокировка',
        unblock: 'Разблокировка',
        charge_for_service: 'Списание за услугу',
        withdrawal_request: 'Заявка на вывод',
        withdrawal_completed: 'Вывод завершён',
        escrow_block: 'Блокировка эскроу',
        escrow_release: 'Разблокировка эскроу',
        escrow_refund: 'Возврат эскроу',
        transfer_out: 'Перевод на другой счёт',
        transfer_in: 'Получение перевода',
        registration_bonus: 'Регистрационный бонус',
      },
      statusTypes: {
        pending: 'В обработке',
        processing: 'Обрабатывается',
        completed: 'Завершено',
        cancelled: 'Отменено',
        rejected: 'Отклонено',
      },
      withdrawalLabels: {
        fundsReturned: 'Средства возвращены - Заявка на вывод отклонена',
        withdrawalRequest: 'Заявка на вывод средств',
        withdrawalInTransit: 'Вывод средств в процессе',
        withdrawalCompleted: 'Вывод средств завершён',
        withdrawalRejected: 'Заявка на вывод отклонена - средства возвращены',
      },
      withdrawForm: {
        amount: 'Сумма вывода',
        sourceAccount: 'Счёт списания',
        bankAccount: 'Расчётный счёт',
        bankName: 'Банк',
        noBankAccount: 'Укажите банковские реквизиты в разделе "Профиль"',
        availableBalance: 'Доступно',
        submit: 'Отправить заявку',
        sending: 'Отправка...',
        successTitle: 'Заявка отправлена',
        successMessage: 'Ваша заявка на вывод средств принята и находится на рассмотрении.',
        newRequest: 'Новая заявка',
        insufficientBalance: 'Недостаточно средств',
        enterAmount: 'Введите сумму',
        minAmount: 'Минимальная сумма: 1000 сум',
      },
      bankDetails: {
        title: 'Банковские реквизиты для пополнения депозита:',
        companyName: 'ООО "YUK TASHUVLARI RAQAMLI PLATFORMASI"',
        inn: 'ИНН: 312611245',
        account: 'Р/с: 20208000007356112003',
        bankCode: 'МФО: 00450',
        bankName: 'АО "O\'zmilliybank"',
      },
    },
    uz: {
      deposit: 'Depozit',
      mainAccount: 'Asosiy',
      mainAccountDesc: 'Erkin mablag\'lar',
      blockedAccount: 'Bloklangan',
      blockedAccountDesc: 'Komissiya, garov yoki to\'lov uchun bloklangan mablag\'lar',
      inTransitAccount: 'Yo\'ldagi pullar',
      inTransitAccountDesc: 'Bank hisobiga qaytarish jarayonidagi mablag\'lar',
      partnerRewardAccount: 'Hamkor mukofoti',
      partnerRewardAccountDesc: 'Referral dasturi bo\'yicha hisoblangan mukofotlar',
      registrationBonusAccount: 'Ro\'yxatdan o\'tish bonusi',
      registrationBonusAccountDesc: 'Yangi tashuvchilar uchun bonus, faqat takliflar uchun garovda ishlatiladi',
      balance: 'Balans',
      loading: 'Yuklanmoqda...',
      sum: 'so\'m',
      topUp: 'To\'ldirish',
      withdraw: 'Mablag\' yechib olish',
      transferToMain: 'Asosiyga o\'tkazish',
      topUpTitle: 'Hisobni to\'ldirish',
      topUpDescription: 'To\'lov tizimlari orqali hisobni to\'ldiring',
      withdrawTitle: 'Mablag\'ni yechib olish',
      withdrawDescription: 'Mablag\'ni',
      withdrawDescriptionIndividual: 'Plastik kartaga mablag\'ni yechib olish',
      withdrawDescriptionLegal: 'Bankdagi hisob raqamingizga mablag\'ni qaytarish',
      comingSoon: 'To\'lov tizimlari bilan integratsiya ishlab chiqilmoqda',
      bankTransfer: 'Bankdagi hisob raqamiga mablag\'ni qaytarish ishlab chiqilmoqda',
      cardTransfer: 'Plastik kartaga mablag\'ni qaytarish ishlab chiqilmoqda',
      noCardAttached: 'Mablag\'ni yechib olish uchun "Profil" bo\'limida plastik kartani biriktirish kerak',
      close: 'Yopish',
      history: 'Tranzaksiyalar tarixi',
      exportExcel: 'Excel yuklash',
      exportDialog: {
        title: 'Tranzaksiyalarni eksport qilish',
        description: 'Excelga eksport qilish uchun parametrlarni tanlang',
        period: 'Davr',
        account: 'Hisob raqam',
        allAccounts: 'Barcha hisoblar',
        allTime: 'Barcha vaqt',
        last7days: 'Oxirgi 7 kun',
        last30days: 'Oxirgi 30 kun',
        last90days: 'Oxirgi 90 kun',
        customPeriod: 'Davrni belgilash',
        dateFrom: 'Sanadan',
        dateTo: 'Sanagacha',
        download: 'Yuklash',
        cancel: 'Bekor qilish',
        selectDate: 'Sanani tanlang',
      },
      noTransactions: 'Tranzaksiyalar yo\'q',
      transactionTypes: {
        topup: 'To\'ldirish',
        block: 'Bloklash',
        unblock: 'Blokdan chiqarish',
        charge_for_service: 'Xizmat uchun yechish',
        withdrawal_request: 'Yechib olish so\'rovi',
        withdrawal_completed: 'Yechib olish tugallandi',
        escrow_block: 'Escrow bloklash',
        escrow_release: 'Escrow ochish',
        escrow_refund: 'Escrow qaytarish',
        transfer_out: 'Boshqa hisobga o\'tkazish',
        transfer_in: 'O\'tkazma qabul qilish',
        registration_bonus: 'Ro\'yxatdan o\'tish bonusi',
      },
      statusTypes: {
        pending: 'Kutilmoqda',
        processing: 'Ishlanmoqda',
        completed: 'Tugallangan',
        cancelled: 'Bekor qilingan',
        rejected: 'Rad etilgan',
      },
      withdrawalLabels: {
        fundsReturned: 'Mablag\'lar qaytarildi - Yechib olish so\'rovi rad etildi',
        withdrawalRequest: 'Mablag\' yechib olish so\'rovi',
        withdrawalInTransit: 'Mablag\' yechib olish jarayonida',
        withdrawalCompleted: 'Mablag\' yechib olish tugallandi',
        withdrawalRejected: 'Yechib olish so\'rovi rad etildi - mablag\'lar qaytarildi',
      },
      withdrawForm: {
        amount: 'Yechib olish summasi',
        sourceAccount: 'Hisobdan yechish',
        bankAccount: 'Bank hisobi',
        bankName: 'Bank',
        noBankAccount: '"Profil" bo\'limida bank rekvizitlarini ko\'rsating',
        availableBalance: 'Mavjud',
        submit: 'So\'rov yuborish',
        sending: 'Yuborilmoqda...',
        successTitle: 'So\'rov yuborildi',
        successMessage: 'Sizning mablag\' yechib olish so\'rovingiz qabul qilindi va ko\'rib chiqilmoqda.',
        newRequest: 'Yangi so\'rov',
        insufficientBalance: 'Mablag\' yetarli emas',
        enterAmount: 'Summani kiriting',
        minAmount: 'Minimal summa: 1000 so\'m',
      },
      bankDetails: {
        title: 'Depozitni to\'ldirish uchun bank rekvizitlari:',
        companyName: '"YUK TASHUVLARI RAQAMLI PLATFORMASI" MChJ',
        inn: 'STIR: 312611245',
        account: 'H/r: 20208000007356112003',
        bankCode: 'MFO: 00450',
        bankName: '"O\'zmilliybank" AJ',
      },
    }
  };

  const t = texts[language];

  const translateWithdrawalReference = (reference: string): string => {
    if (!reference) return reference;
    
    if (reference.startsWith('Funds returned') || reference.includes('funds returned')) {
      return t.withdrawalLabels.fundsReturned;
    }
    if (reference.startsWith('Withdrawal rejected')) {
      return t.withdrawalLabels.withdrawalRejected;
    }
    if (reference.startsWith('Withdrawal request')) {
      return t.withdrawalLabels.withdrawalRequest;
    }
    if (reference.startsWith('Withdrawal in transit')) {
      return t.withdrawalLabels.withdrawalInTransit;
    }
    if (reference.startsWith('Withdrawal completed')) {
      return t.withdrawalLabels.withdrawalCompleted;
    }
    
    return reference;
  };

  const isIndividual = user?.userType === 'individual';
  const showTopUpButton = isIndividual;

  if (authLoading || depositsLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{t.deposit}</h1>
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{t.deposit}</h1>
          <div className="flex gap-2">
            {showTopUpButton && (
              <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" data-testid="button-topup">
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    {t.topUp}
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-topup">
                  <DialogHeader>
                    <DialogTitle>{t.topUpTitle}</DialogTitle>
                    <DialogDescription>{t.topUpDescription}</DialogDescription>
                  </DialogHeader>
                  <div className="py-6 text-center text-muted-foreground" data-testid="text-topup-stub">
                    {t.comingSoon}
                  </div>
                  <Button variant="outline" onClick={() => setTopUpOpen(false)} data-testid="button-close-topup">
                    {t.close}
                  </Button>
                </DialogContent>
              </Dialog>
            )}
            
            <Dialog open={withdrawOpen} onOpenChange={(open) => {
              setWithdrawOpen(open);
              if (!open) {
                setWithdrawAmount('');
                setWithdrawSuccess(false);
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-withdraw">
                  <ArrowUpFromLine className="mr-2 h-4 w-4" />
                  {t.withdraw}
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-withdraw" className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.withdrawTitle}</DialogTitle>
                  <DialogDescription>
                    {isIndividual ? t.withdrawDescriptionIndividual : t.withdrawDescriptionLegal}
                  </DialogDescription>
                </DialogHeader>
                
                {withdrawSuccess ? (
                  <div className="py-6 text-center space-y-4">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                    <div>
                      <h3 className="font-semibold text-lg">{t.withdrawForm?.successTitle}</h3>
                      <p className="text-muted-foreground text-sm mt-2">{t.withdrawForm?.successMessage}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setWithdrawSuccess(false);
                        setWithdrawAmount('');
                      }}
                      data-testid="button-new-withdraw"
                    >
                      {t.withdrawForm?.newRequest}
                    </Button>
                  </div>
                ) : !user?.bankAccount && !isIndividual ? (
                  <div className="py-6 text-center space-y-4">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
                    <p className="text-muted-foreground">{t.withdrawForm?.noBankAccount}</p>
                    <Button variant="outline" onClick={() => setWithdrawOpen(false)} data-testid="button-close-withdraw">
                      {t.close}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t.withdrawForm?.sourceAccount}</Label>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="font-medium">{t.mainAccount}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.withdrawForm?.availableBalance}: {formatMoney(deposits.main)} {t.sum}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="amount">{t.withdrawForm?.amount}</Label>
                      <Input
                        id="amount"
                        type="text"
                        placeholder="100 000.00"
                        value={formatAmountWithSpaces(withdrawAmount, true)}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                          setWithdrawAmount(value);
                        }}
                        data-testid="input-withdraw-amount"
                      />
                      <p className="text-xs text-muted-foreground">{t.withdrawForm?.minAmount}</p>
                    </div>
                    
                    <div className="bg-muted/50 p-3 rounded-md space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.withdrawForm?.bankName}:</span>
                        <span className="font-medium">{user?.bankName || '-'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t.withdrawForm?.bankAccount}:</span>
                        <span className="font-medium font-mono">{user?.bankAccount || '-'}</span>
                      </div>
                    </div>
                    
                    <DialogFooter className="pt-4">
                      <Button variant="outline" onClick={() => setWithdrawOpen(false)} data-testid="button-cancel-withdraw">
                        {t.close}
                      </Button>
                      <Button 
                        onClick={() => {
                          const amount = parseFormattedAmount(withdrawAmount, true);
                          if (isNaN(amount) || amount < 1000) {
                            toast({
                              title: language === 'uz' ? 'Xato' : 'Ошибка',
                              description: t.withdrawForm?.minAmount,
                              variant: 'destructive',
                            });
                            return;
                          }
                          const availableBalance = deposits.main;
                          if (amount > availableBalance) {
                            toast({
                              title: language === 'uz' ? 'Xato' : 'Ошибка',
                              description: t.withdrawForm?.insufficientBalance,
                              variant: 'destructive',
                            });
                            return;
                          }
                          setPendingWithdrawAmount(amount);
                          setWithdrawOpen(false);
                          setVerificationDialogOpen(true);
                        }}
                        disabled={!withdrawAmount}
                        data-testid="button-submit-withdraw"
                      >
                        {t.withdrawForm?.submit}
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline"
                  disabled={!transactions || transactions.length === 0}
                  data-testid="button-export-excel"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t.exportExcel}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t.exportDialog?.title}</DialogTitle>
                  <DialogDescription>{t.exportDialog?.description}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>{t.exportDialog?.account}</Label>
                    <Select value={exportAccount} onValueChange={(v) => setExportAccount(v as typeof exportAccount)}>
                      <SelectTrigger data-testid="select-export-account">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t.exportDialog?.allAccounts}</SelectItem>
                        <SelectItem value="main">{t.mainAccount}</SelectItem>
                        <SelectItem value="blocked">{t.blockedAccount}</SelectItem>
                        <SelectItem value="in_transit">{t.inTransitAccount}</SelectItem>
                        <SelectItem value="partner_reward">{t.partnerRewardAccount}</SelectItem>
                        <SelectItem value="registration_bonus">{t.registrationBonusAccount}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{t.exportDialog?.period}</Label>
                    <Select value={exportPeriod} onValueChange={(v) => setExportPeriod(v as typeof exportPeriod)}>
                      <SelectTrigger data-testid="select-export-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t.exportDialog?.allTime}</SelectItem>
                        <SelectItem value="7d">{t.exportDialog?.last7days}</SelectItem>
                        <SelectItem value="30d">{t.exportDialog?.last30days}</SelectItem>
                        <SelectItem value="90d">{t.exportDialog?.last90days}</SelectItem>
                        <SelectItem value="custom">{t.exportDialog?.customPeriod}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {exportPeriod === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t.exportDialog?.dateFrom}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-date-from">
                              <Calendar className="mr-2 h-4 w-4" />
                              {exportDateFrom ? format(exportDateFrom, 'dd.MM.yyyy') : t.exportDialog?.selectDate}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={exportDateFrom}
                              onSelect={setExportDateFrom}
                              locale={language === 'ru' ? ru : uz}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>{t.exportDialog?.dateTo}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-date-to">
                              <Calendar className="mr-2 h-4 w-4" />
                              {exportDateTo ? format(exportDateTo, 'dd.MM.yyyy') : t.exportDialog?.selectDate}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={exportDateTo}
                              onSelect={setExportDateTo}
                              locale={language === 'ru' ? ru : uz}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setExportOpen(false)} data-testid="button-cancel-export">
                    {t.exportDialog?.cancel}
                  </Button>
                  <Button onClick={exportTransactionsToExcel} data-testid="button-confirm-export">
                    <Download className="mr-2 h-4 w-4" />
                    {t.exportDialog?.download}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Accordion type="single" collapsible value={expandedAccount} onValueChange={setExpandedAccount} className="space-y-3">
          {(['main', 'blocked', 'in_transit', 'partner_reward', 'registration_bonus'] as const).map((accountType) => {
            const accountNames: Record<string, string> = {
              main: t.mainAccount,
              blocked: t.blockedAccount,
              in_transit: t.inTransitAccount,
              partner_reward: t.partnerRewardAccount,
              registration_bonus: t.registrationBonusAccount,
            };
            const accountDescriptions: Record<string, string> = {
              main: t.mainAccountDesc,
              blocked: t.blockedAccountDesc,
              in_transit: t.inTransitAccountDesc,
              partner_reward: t.partnerRewardAccountDesc,
              registration_bonus: t.registrationBonusAccountDesc,
            };
            const accountTransactions = getAccountTransactions(accountType);
            return (
              <AccordionItem key={accountType} value={accountType} className="border rounded-lg">
                <AccordionTrigger 
                  className="px-4 py-3 hover:no-underline"
                  data-testid={`button-expand-${accountType}`}
                >
                  <Card className="w-full border-0 shadow-none bg-transparent">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-0 p-0">
                      <div className="text-left flex-1">
                        <CardTitle className="text-sm font-medium">
                          {accountNames[accountType]}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {accountDescriptions[accountType]}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-semibold" data-testid={`text-balance-${accountType}`}>
                          {formatMoney(deposits[accountType])} {t.sum}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3 mt-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium text-sm">{t.history}</h3>
                    </div>
                    {accountTransactions.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm" data-testid={`text-no-transactions-${accountType}`}>
                        {t.noTransactions}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {accountTransactions.map((tx) => {
                          const isPositive = ['topup', 'unblock', 'escrow_release', 'escrow_refund', 'transfer_in', 'registration_bonus'].includes(tx.type);
                          const isTransfer = tx.type === 'transfer_out' || tx.type === 'transfer_in';
                          const displayLabel = isTransfer && tx.reference 
                            ? translateWithdrawalReference(tx.reference) 
                            : t.transactionTypes[tx.type as keyof typeof t.transactionTypes] || tx.type;
                          return (
                            <div 
                              key={tx.id} 
                              className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                              data-testid={`transaction-row-${tx.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs" data-testid={`transaction-type-${tx.id}`}>
                                  {displayLabel}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(tx.createdAt).toLocaleString(language === 'ru' ? 'ru-RU' : 'uz-UZ')}
                                </div>
                                {tx.reference && !isTransfer && !tx.reference.startsWith('Admin credit') && !tx.reference.includes('Withdrawal') && !tx.reference.includes('Funds returned') && (
                                  <div className="text-xs text-muted-foreground truncate" title={tx.reference}>
                                    {tx.reference}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <div 
                                  className={`font-semibold text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                                  data-testid={`transaction-amount-${tx.id}`}
                                >
                                  {isPositive ? '+' : '-'}{formatMoney(Math.abs(Number(tx.amount)))} {t.sum}
                                </div>
                                <Badge 
                                  variant={tx.status === 'completed' ? 'default' : tx.status === 'cancelled' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                  data-testid={`transaction-status-${tx.id}`}
                                >
                                  {t.statusTypes[tx.status as keyof typeof t.statusTypes] || tx.status}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <Card className="mt-6 bg-muted/30" data-testid="card-bank-details">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">{t.bankDetails?.title}</h3>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <div data-testid="text-deposit-company">{t.bankDetails?.companyName}</div>
                  <div data-testid="text-deposit-inn">{t.bankDetails?.inn}</div>
                  <div data-testid="text-deposit-account">{t.bankDetails?.account}</div>
                  <div data-testid="text-deposit-bank-code">{t.bankDetails?.bankCode}</div>
                  <div data-testid="text-deposit-bank-name">{t.bankDetails?.bankName}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WithdrawalVerificationDialog
        isOpen={verificationDialogOpen}
        onClose={() => {
          setVerificationDialogOpen(false);
          setPendingWithdrawAmount(0);
        }}
        onSuccess={() => {
          setWithdrawSuccess(true);
          setWithdrawAmount('');
          setPendingWithdrawAmount(0);
          refetchDeposits();
          refetchTransactions();
        }}
        language={language}
        userType={(user?.userType as 'individual' | 'legal' | 'ip') || 'individual'}
        amount={pendingWithdrawAmount}
        sourceAccountType={withdrawSourceAccount}
        bankName={user?.bankName || undefined}
        bankAccount={user?.bankAccount || undefined}
      />
    </div>
  );
}
