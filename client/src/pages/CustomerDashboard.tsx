import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from '@/components/AppSidebar';
import Header from '@/components/Header';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import StatsCard from '@/components/StatsCard';
import OrderCard from '@/components/OrderCard';
import { Package, FileText, TrendingUp, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useOrders } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/language-context';
import { customerSectionResolver, individualCustomerSectionResolver, type CustomerSection } from '@/lib/customerSections';
import Announcements from '@/components/Announcements';
import AnnouncementTemplates from '@/components/AnnouncementTemplates';
import { DashboardSectionError } from '@/components/DashboardSectionError';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertOrderSchema, type InsertOrder, type OrderTemplate, insertOrderTemplateSchema, type InsertOrderTemplate } from '@shared/schema';
import { uzbekistanRegions, getDistrictsByRegion, getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { transportTypes, getTransportTypeLabel } from '@shared/transport-types';
import { TransportTypeSelect } from '@/components/TransportTypeSelect';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient, getRepresentativeCustomerId } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ContractViewer } from '@/components/ContractViewer';
import { ContractsTable } from '@/components/ContractsTable';
import { OffersDialog } from '@/components/OffersDialog';
import { Deposit } from '@/components/Deposit';
import { ProfileView } from '@/components/ProfileView';
import { Documents } from '@/components/Documents';
import TableSearchFilter, { FilterState, filterData } from '@/components/TableSearchFilter';
import Pagination, { paginateData } from '@/components/Pagination';
import CountdownTimer from '@/components/CountdownTimer';
import { formatDate } from '@/lib/dateFormat';
import { formatAmountWithSpaces, parseFormattedAmount } from '@/lib/number-to-words';
import Representatives from '@/components/Representatives';
import MyPrincipals from '@/pages/MyPrincipals';
import PrincipalOrders from '@/pages/PrincipalOrders';
import PrincipalContracts from '@/pages/PrincipalContracts';
import PrincipalDocuments from '@/pages/PrincipalDocuments';

interface CustomerDashboardMainProps {
  language: 'ru' | 'uz';
  setLanguage: (lang: 'ru' | 'uz') => void;
  user: any;
  renderContent: () => JSX.Element;
}

function CustomerDashboardMain({ language, setLanguage, user, renderContent }: CustomerDashboardMainProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        userRole={user.roles}
        currentRole="customer"
        userName={user.displayName}
        onMenuClick={toggleSidebar}
        sticky={false}
      />
      <main className="flex-1 overflow-auto min-h-0">
        {renderContent()}
      </main>
    </div>
  );
}

interface CustomerDashboardProps {
  section?: string;
}

export default function CustomerDashboard({ section }: CustomerDashboardProps) {
  const { language, setLanguage } = useLanguage();
  const { user, loading: authLoading, representativeModeEnabled, representativeModeInitialized } = useAuth();
  const [, setLocation] = useLocation();
  const { data: orders, isLoading: ordersLoading } = useOrders('customer');
  
  // Use different section resolver for individual users
  const isIndividual = user?.userType === 'individual';
  const resolvedSection = isIndividual 
    ? individualCustomerSectionResolver.resolveSection(section)
    : customerSectionResolver.resolveSection(section);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<any | null>(null);
  const [templateForAnnouncement, setTemplateForAnnouncement] = useState<any | null>(null);
  const { toast } = useToast();
  
  // Handle viewOffers URL parameter for opening offers dialog from notifications
  const [viewOffersOrderId, setViewOffersOrderId] = useState<number | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewOffersParam = urlParams.get('viewOffers');
    if (viewOffersParam) {
      const orderId = parseInt(viewOffersParam, 10);
      if (!isNaN(orderId)) {
        setViewOffersOrderId(orderId);
        // Clean URL without reloading page
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const texts = {
    ru: {
      deleteOrder: 'Удалить заказ',
      deleteOrderConfirm: 'Вы уверены что хотите удалить этот заказ? Это действие нельзя отменить.',
      orderDeleted: 'Заказ удален',
      cannotDelete: 'Невозможно удалить заказ',
      cancel: 'Отмена',
      delete: 'Удалить'
    },
    uz: {
      deleteOrder: 'Buyurtmani o\'chirish',
      deleteOrderConfirm: 'Ushbu buyurtmani o\'chirmoqchimisiz? Bu amalni bekor qilib bo\'lmaydi.',
      orderDeleted: 'Buyurtma o\'chirildi',
      cannotDelete: 'Buyurtmani o\'chirib bo\'lmaydi',
      cancel: 'Bekor qilish',
      delete: 'O\'chirish'
    }
  };

  const t = texts[language];

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return await apiRequest('DELETE', `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'], exact: false });
      toast({
        title: t.orderDeleted,
      });
      setOrderToDelete(null);
    },
    onError: (error: any) => {
      // Error message is already parsed by queryClient
      toast({
        title: error?.message || t.cannotDelete,
        variant: 'destructive',
      });
      setOrderToDelete(null);
    }
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.roles.includes('customer')) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  // Calculate activeSection before early returns to use in useEffect
  // Default section for individual users is 'announcements', for others is 'home'
  const activeSection = resolvedSection || (isIndividual ? 'announcements' : 'home');

  // Redirect to principal-orders when representative mode is enabled and user is on a non-representative section
  // IMPORTANT: This useEffect MUST be before any early return statements to follow React hooks rules
  useEffect(() => {
    if (authLoading || !user) return; // Skip if still loading or no user
    if (!representativeModeInitialized) return;
    if (representativeModeEnabled && isIndividual) {
      const representativeSections = ['principals', 'principal-orders', 'principal-contracts', 'principal-documents', 'profile'];
      if (!representativeSections.includes(activeSection)) {
        setLocation('/customer/principal-orders');
      }
    }
  }, [authLoading, user, representativeModeEnabled, representativeModeInitialized, activeSection, isIndividual, setLocation]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (resolvedSection === null && section) {
    return (
      <DashboardSectionError
        invalidSection={section}
        validSections={isIndividual ? individualCustomerSectionResolver.sections : customerSectionResolver.sections}
        dashboardPath="/customer"
        dashboardName="Customer Dashboard"
      />
    );
  }

  const style = {
    "--sidebar-width": "16rem",
  };

  const handleNavigateToSection = (sectionName: CustomerSection) => {
    const path = sectionName === 'home' ? '/customer' : `/customer/${sectionName}`;
    setLocation(path);
  };

  const handleConfirmDelete = () => {
    if (orderToDelete !== null) {
      deleteOrderMutation.mutate(orderToDelete);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <DashboardHome language={language} orders={orders} ordersLoading={ordersLoading} onNavigate={handleNavigateToSection} onDeleteOrder={setOrderToDelete} onEditOrder={setOrderToEdit} />;
      case 'orders':
        return <MyOrders language={language} orders={orders} ordersLoading={ordersLoading} onDeleteOrder={setOrderToDelete} onEditOrder={setOrderToEdit} userType={user?.userType} />;
      case 'contracts':
        return <MyContracts language={language} />;
      case 'documents':
        return <Documents language={language} role="customer" />;
      case 'deposit':
        return <Deposit language={language} />;
      case 'blacklist':
        return <BlacklistSection language={language} />;
      case 'representatives':
        return <Representatives />;
      case 'announcements':
        return <Announcements 
          language={language} 
          initialTemplate={templateForAnnouncement}
          onTemplateUsed={() => setTemplateForAnnouncement(null)}
        />;
      case 'templates':
        return <AnnouncementTemplates 
          language={language} 
          onUseTemplate={(template) => {
            setTemplateForAnnouncement(template);
            setLocation('/customer/announcements');
          }}
        />;
      case 'principals':
        return <MyPrincipals />;
      case 'principal-orders':
        return <PrincipalOrders />;
      case 'principal-contracts':
        return <PrincipalContracts />;
      case 'principal-documents':
        return <PrincipalDocuments />;
      case 'profile':
        return <Profile language={language} />;
      default:
        // For individual users, default to announcements; for others, default to home
        if (isIndividual) {
          return <Announcements language={language} />;
        }
        return <DashboardHome language={language} orders={orders} ordersLoading={ordersLoading} onNavigate={handleNavigateToSection} onDeleteOrder={setOrderToDelete} onEditOrder={setOrderToEdit} />;
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          role="customer" 
          language={language} 
          activePath={activeSection === 'home' || activeSection === 'announcements' ? '/customer' : `/customer/${activeSection}`}
          onNavigate={(path) => setLocation(path)}
          userType={user?.userType as 'legal' | 'ip' | 'individual' | undefined}
          representativeModeEnabled={representativeModeEnabled}
        />
        <CustomerDashboardMain 
          language={language}
          setLanguage={setLanguage}
          user={user}
          renderContent={renderContent}
        />
      </div>
      {orderToEdit && (
        <EditOrderDialog
          open={orderToEdit !== null}
          onOpenChange={(open) => !open && setOrderToEdit(null)}
          order={orderToEdit}
          language={language}
        />
      )}
      <AlertDialog open={orderToDelete !== null} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteOrder}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteOrderConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Offers dialog opened from notifications */}
      <OffersDialog
        orderId={viewOffersOrderId}
        open={viewOffersOrderId !== null}
        onOpenChange={(open) => !open && setViewOffersOrderId(null)}
        language={language}
      />
    </SidebarProvider>
  );
}

export interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: 'ru' | 'uz';
}

export function CreateOrderDialog({ open, onOpenChange, language }: CreateOrderDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templateName, setTemplateName] = useState<string>('');
  
  const texts = {
    ru: {
      title: 'Создать заказ',
      orderTitle: 'Название заказа',
      originRegion: 'Регион отправления',
      originDistrict: 'Район отправления',
      destinationRegion: 'Регион назначения',
      destinationDistrict: 'Район назначения',
      transportType: 'Тип транспорта',
      weightTons: 'Вес (тонн)',
      loadDate: 'Дата загрузки',
      loadingTime: 'Время отгрузки',
      priceWithVat: 'Цена с НДС (сум)',
      priceWithoutVat: 'Цена без НДС (сум)',
      requiresCollateral: 'Работать с залогом 2%',
      notes: 'Примечание',
      isDangerous: 'Опасный груз',
      isNonstandard: 'Нестандартный груз',
      isPartialLoad: 'Частичная загрузка',
      addDistrict: 'Добавить район',
      addOriginPoint: 'Добавить пункт отправки',
      addDestinationPoint: 'Добавить пункт назначения',
      removePoint: 'Удалить пункт',
      originPoint: 'Пункт отправления',
      destinationPoint: 'Пункт назначения',
      cancel: 'Отмена',
      create: 'Создать',
      creating: 'Создание...',
      success: 'Заказ успешно создан',
      error: 'Ошибка при создании заказа',
      transfer: 'С перечислением',
      card: 'С картой',
      cash: 'С наличным',
      selectTime: 'Выберите время',
      selectPayment: 'Выберите способ',
      selectRegion: 'Выберите регион',
      selectDistrict: 'Выберите район',
      selectTransport: 'Выберите тип',
      templateName: 'Название шаблона',
      saveAsTemplate: 'Сохранить как шаблон',
      loadTemplate: 'Загрузить шаблон',
      selectTemplate: 'Выберите шаблон',
      templateSaved: 'Шаблон сохранен',
      templateDeleted: 'Шаблон удален',
      templates: 'Шаблоны',
      deleteTemplate: 'Удалить',
      saving: 'Сохранение...',
      templateNameRequired: 'Введите название шаблона',
      noTemplates: 'Нет сохраненных шаблонов'
    },
    uz: {
      title: 'Buyurtma yaratish',
      orderTitle: 'Buyurtma nomi',
      originRegion: 'Jo\'natish hududi',
      originDistrict: 'Jo\'natish tumani',
      destinationRegion: 'Yetkazish hududi',
      destinationDistrict: 'Yetkazish tumani',
      transportType: 'Transport turi',
      weightTons: 'Og\'irligi (tonna)',
      loadDate: 'Yuklash sanasi',
      loadingTime: 'Yuklash vaqti',
      priceWithVat: 'QQS bilan narxi (so\'m)',
      priceWithoutVat: 'QQSsiz narx (so\'m)',
      requiresCollateral: 'Garov bilan ishlash 2%',
      notes: 'Izoh',
      isDangerous: 'Xavfli yuk',
      isNonstandard: 'Nostandart yuk',
      isPartialLoad: 'Qisman yuklash',
      addDistrict: 'Tuman qo\'shish',
      addOriginPoint: 'Jo\'natish punkti qo\'shish',
      addDestinationPoint: 'Yetkazish punkti qo\'shish',
      removePoint: 'Punktni o\'chirish',
      originPoint: 'Jo\'natish punkti',
      destinationPoint: 'Yetkazish punkti',
      cancel: 'Bekor qilish',
      create: 'Yaratish',
      creating: 'Yaratilmoqda...',
      success: 'Buyurtma muvaffaqiyatli yaratildi',
      error: 'Buyurtma yaratishda xatolik',
      transfer: 'O\'tkazmalar bilan',
      card: 'Karta bilan',
      cash: 'Naqd pul bilan',
      selectTime: 'Vaqtni tanlang',
      selectPayment: 'Usulni tanlang',
      selectRegion: 'Hududni tanlang',
      selectDistrict: 'Tumanni tanlang',
      selectTransport: 'Turini tanlang',
      templateName: 'Shablon nomi',
      saveAsTemplate: 'Shablon sifatida saqlash',
      loadTemplate: 'Shablonni yuklash',
      selectTemplate: 'Shablonni tanlang',
      templateSaved: 'Shablon saqlandi',
      templateDeleted: 'Shablon o\'chirildi',
      templates: 'Shablonlar',
      deleteTemplate: 'O\'chirish',
      saving: 'Saqlanmoqda...',
      templateNameRequired: 'Shablon nomini kiriting',
      noTemplates: 'Saqlangan shablonlar yo\'q'
    }
  };

  const t = texts[language];

  // State for multiple origin/destination points
  type LocationPointState = { region: string; districts: string[] };
  const [originPoints, setOriginPoints] = useState<LocationPointState[]>([{ region: '', districts: [''] }]);
  const [destinationPoints, setDestinationPoints] = useState<LocationPointState[]>([{ region: '', districts: [''] }]);

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery<OrderTemplate[]>({
    queryKey: ['/api/templates'],
    enabled: open,
  });

  const defaultFormValues = {
    title: '',
    originRegion: '',
    originDistrict: [''],
    destinationRegion: '',
    destinationDistrict: [''],
    transportType: undefined,
    weightTons: undefined as any,
    loadDate: '',
    loadingTime: '09:00',
    priceWithVat: undefined as any,
    requiresCollateral: false,
    notes: '',
    isDangerous: false,
    isNonstandard: false,
    isPartialLoad: false,
  };

  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: defaultFormValues
  });

  // Track previous open state to detect open transition
  const prevOpenRef = useRef(false);
  
  // Reset form when dialog opens (transition from closed to open)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Dialog just opened - reset form
      form.reset(defaultFormValues);
      setOriginPoints([{ region: '', districts: [''] }]);
      setDestinationPoints([{ region: '', districts: [''] }]);
      setTemplateName('');
    }
    prevOpenRef.current = open;
  }, [open, form]);

  const priceWithVat = form.watch('priceWithVat');
  const requiresCollateral = form.watch('requiresCollateral');
  // Calculate priceWithoutVat with 2 decimal places for tiyin support
  const priceWithoutVat = priceWithVat ? (user?.ndsPayer ? (priceWithVat / 1.12).toFixed(2) : priceWithVat.toFixed(2)) : '0.00';
  const customerCollateral = (requiresCollateral && priceWithVat) ? Math.floor(priceWithVat * 0.02) : 0;
  
  // Sync legacy form fields with first point for validation
  useEffect(() => {
    const firstOrigin = originPoints[0];
    if (firstOrigin?.region) {
      form.setValue('originRegion', firstOrigin.region);
    }
    const validOriginDistricts = firstOrigin?.districts.filter(d => d) || [];
    if (validOriginDistricts.length > 0) {
      form.setValue('originDistrict', validOriginDistricts);
    }
  }, [originPoints, form]);

  useEffect(() => {
    const firstDestination = destinationPoints[0];
    if (firstDestination?.region) {
      form.setValue('destinationRegion', firstDestination.region);
    }
    const validDestinationDistricts = firstDestination?.districts.filter(d => d) || [];
    if (validDestinationDistricts.length > 0) {
      form.setValue('destinationDistrict', validDestinationDistricts);
    }
  }, [destinationPoints, form]);
  
  // Origin points management
  const addOriginPoint = () => setOriginPoints([...originPoints, { region: '', districts: [''] }]);
  const removeOriginPoint = (idx: number) => setOriginPoints(originPoints.filter((_, i) => i !== idx));
  const updateOriginRegion = (idx: number, region: string) => {
    const updated = [...originPoints];
    updated[idx] = { region, districts: [''] };
    setOriginPoints(updated);
  };
  const addOriginDistrict = (pointIdx: number) => {
    const updated = [...originPoints];
    updated[pointIdx].districts.push('');
    setOriginPoints(updated);
  };
  const removeOriginDistrict = (pointIdx: number, districtIdx: number) => {
    const updated = [...originPoints];
    updated[pointIdx].districts = updated[pointIdx].districts.filter((_, i) => i !== districtIdx);
    setOriginPoints(updated);
  };
  const updateOriginDistrict = (pointIdx: number, districtIdx: number, value: string) => {
    const updated = [...originPoints];
    updated[pointIdx].districts[districtIdx] = value;
    setOriginPoints(updated);
  };

  // Destination points management
  const addDestinationPoint = () => setDestinationPoints([...destinationPoints, { region: '', districts: [''] }]);
  const removeDestinationPoint = (idx: number) => setDestinationPoints(destinationPoints.filter((_, i) => i !== idx));
  const updateDestinationRegion = (idx: number, region: string) => {
    const updated = [...destinationPoints];
    updated[idx] = { region, districts: [''] };
    setDestinationPoints(updated);
  };
  const addDestinationDistrict = (pointIdx: number) => {
    const updated = [...destinationPoints];
    updated[pointIdx].districts.push('');
    setDestinationPoints(updated);
  };
  const removeDestinationDistrict = (pointIdx: number, districtIdx: number) => {
    const updated = [...destinationPoints];
    updated[pointIdx].districts = updated[pointIdx].districts.filter((_, i) => i !== districtIdx);
    setDestinationPoints(updated);
  };
  const updateDestinationDistrict = (pointIdx: number, districtIdx: number, value: string) => {
    const updated = [...destinationPoints];
    updated[pointIdx].districts[districtIdx] = value;
    setDestinationPoints(updated);
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: InsertOrder) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const representativeCustomerId = getRepresentativeCustomerId();
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = representativeCustomerId;
      }
      const response = await fetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(data),
        headers,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || 'Failed to create order') as Error & { 
          errorData?: { required?: number; available?: number; shortage?: number; error?: string } 
        };
        error.errorData = errorData;
        throw error;
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-orders'], exact: false });
      toast({
        title: t.success,
        description: language === 'ru' ? 'Ваш заказ успешно создан и отправлен перевозчикам' : 'Sizning buyurtmangiz muvaffaqiyatli yaratildi va tashuvchilarga yuborildi',
      });
      onOpenChange(false);
      form.reset();
      setOriginPoints([{ region: '', districts: [''] }]);
      setDestinationPoints([{ region: '', districts: [''] }]);
    },
    onError: (error: Error & { errorData?: { required?: number; available?: number; shortage?: number; error?: string; message?: string } }) => {
      let description = language === 'ru' 
        ? 'Не удалось создать заказ. Проверьте данные и попробуйте снова.' 
        : 'Buyurtmani yaratib bo\'lmadi. Ma\'lumotlarni tekshiring va qayta urinib ko\'ring.';
      
      if (error.errorData?.error === 'Invalid loading time') {
        description = language === 'ru' 
          ? 'Время загрузки не может быть раньше текущего времени. Пожалуйста, выберите время не ранее текущего момента.'
          : 'Yuklash vaqti joriy vaqtdan oldin bo\'lishi mumkin emas. Iltimos, hozirgi vaqtdan kechroq vaqtni tanlang.';
      } else if (error.errorData?.error === 'Insufficient deposit balance for collateral' && 
          error.errorData.required !== undefined && 
          error.errorData.available !== undefined && 
          error.errorData.shortage !== undefined) {
        const { required, available, shortage } = error.errorData;
        if (language === 'ru') {
          description = `Недостаточно средств на депозите для блокировки залога. Требуется: ${formatMoney(required)} сум. На балансе: ${formatMoney(available)} сум. Не хватает: ${formatMoney(shortage)} сум.`;
        } else {
          description = `Garov uchun depozitda mablag' yetarli emas. Kerakli summa: ${formatMoney(required)} so'm. Balansingiz: ${formatMoney(available)} so'm. Yetishmayapti: ${formatMoney(shortage)} so'm.`;
        }
      }
      
      toast({
        title: t.error,
        description,
        variant: 'destructive',
      });
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertOrderTemplate) => {
      return await apiRequest('POST', '/api/templates', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: t.templateSaved,
      });
      setTemplateName('');
    },
    onError: () => {
      toast({
        title: language === 'ru' ? 'Ошибка при сохранении шаблона' : 'Shablonni saqlashda xatolik',
        variant: 'destructive',
      });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return await apiRequest('DELETE', `/api/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: t.templateDeleted,
      });
    },
    onError: () => {
      toast({
        title: language === 'ru' ? 'Ошибка при удалении шаблона' : 'Shablonni o\'chirishda xatolik',
        variant: 'destructive',
      });
    }
  });

  const loadTemplate = (template: OrderTemplate) => {
    console.log('[loadTemplate] Raw template:', JSON.stringify(template, null, 2));
    
    // Helper to normalize districts array: filter nulls/empty, ensure at least one entry
    const normalizeDistricts = (districts: any): string[] => {
      if (!districts) return [''];
      if (!Array.isArray(districts)) {
        return districts ? [String(districts)] : [''];
      }
      const filtered = districts.filter((d: any) => d !== null && d !== undefined && d !== '');
      return filtered.length > 0 ? filtered.map(String) : [''];
    };
    
    // Load originPoints/destinationPoints if available, else create from legacy fields
    const templateOriginPoints = template.originPoints && Array.isArray(template.originPoints) && template.originPoints.length > 0
      ? template.originPoints
      : [{ region: template.originRegion || '', districts: normalizeDistricts(template.originDistrict) }];
    const templateDestinationPoints = template.destinationPoints && Array.isArray(template.destinationPoints) && template.destinationPoints.length > 0
      ? template.destinationPoints
      : [{ region: template.destinationRegion || '', districts: normalizeDistricts(template.destinationDistrict) }];
    
    // Normalize all points to ensure valid structure
    const normalizedOriginPoints = templateOriginPoints.map((p: any) => ({
      region: p?.region || '',
      districts: normalizeDistricts(p?.districts)
    }));
    const normalizedDestinationPoints = templateDestinationPoints.map((p: any) => ({
      region: p?.region || '',
      districts: normalizeDistricts(p?.districts)
    }));
    
    console.log('[loadTemplate] Normalized originPoints:', JSON.stringify(normalizedOriginPoints, null, 2));
    console.log('[loadTemplate] Normalized destinationPoints:', JSON.stringify(normalizedDestinationPoints, null, 2));
    
    // Set state for origin/destination points UI
    setOriginPoints(normalizedOriginPoints);
    setDestinationPoints(normalizedDestinationPoints);
    
    // Parse numeric values from string (database returns numeric as string)
    const parsedWeight = typeof template.weightTons === 'string' 
      ? parseFloat(template.weightTons) 
      : template.weightTons;
    const parsedPrice = typeof template.priceWithVat === 'string'
      ? parseFloat(template.priceWithVat)
      : template.priceWithVat;
    
    form.reset({
      title: template.title,
      originRegion: normalizedOriginPoints[0]?.region || '',
      originDistrict: normalizedOriginPoints[0]?.districts || [''],
      destinationRegion: normalizedDestinationPoints[0]?.region || '',
      destinationDistrict: normalizedDestinationPoints[0]?.districts || [''],
      transportType: template.transportType,
      weightTons: parsedWeight as any,
      loadDate: template.loadDate ?? '',
      loadingTime: template.loadingTime ?? undefined,
      priceWithVat: parsedPrice as any,
      requiresCollateral: template.requiresCollateral ?? false,
      notes: template.notes ?? '',
      isDangerous: template.isDangerous,
      isNonstandard: template.isNonstandard,
      isPartialLoad: template.isPartialLoad,
    });
    
    toast({
      title: language === 'ru' ? 'Шаблон загружен' : 'Shablon yuklandi',
      description: template.name,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: t.templateNameRequired,
        variant: 'destructive',
      });
      return;
    }

    const formValues = form.getValues();
    // Clean origin/destination points for template storage
    // Only filter out points where BOTH region AND all districts are empty
    const cleanedOriginPoints = originPoints
      .filter(p => p.region)
      .map(p => ({ 
        region: p.region, 
        districts: p.districts.filter(d => d).length > 0 ? p.districts.filter(d => d) : [''] 
      }));
    const cleanedDestinationPoints = destinationPoints
      .filter(p => p.region)
      .map(p => ({ 
        region: p.region, 
        districts: p.districts.filter(d => d).length > 0 ? p.districts.filter(d => d) : [''] 
      }));
    
    // Fallback to form values if no points were filled
    const finalOriginPoints = cleanedOriginPoints.length > 0 
      ? cleanedOriginPoints 
      : (formValues.originRegion ? [{ region: formValues.originRegion, districts: formValues.originDistrict?.filter((d: string) => d) || [''] }] : []);
    const finalDestinationPoints = cleanedDestinationPoints.length > 0 
      ? cleanedDestinationPoints 
      : (formValues.destinationRegion ? [{ region: formValues.destinationRegion, districts: formValues.destinationDistrict?.filter((d: string) => d) || [''] }] : []);
    
    const templateData: InsertOrderTemplate = {
      name: templateName,
      title: formValues.title,
      originRegion: finalOriginPoints[0]?.region || formValues.originRegion || '',
      originDistrict: finalOriginPoints[0]?.districts || formValues.originDistrict || [''],
      destinationRegion: finalDestinationPoints[0]?.region || formValues.destinationRegion || '',
      destinationDistrict: finalDestinationPoints[0]?.districts || formValues.destinationDistrict || [''],
      originPoints: finalOriginPoints,
      destinationPoints: finalDestinationPoints,
      transportType: formValues.transportType,
      weightTons: formValues.weightTons,
      loadDate: formValues.loadDate || undefined,
      loadingTime: formValues.loadingTime || undefined,
      priceWithVat: formValues.priceWithVat,
      requiresCollateral: formValues.requiresCollateral,
      notes: formValues.notes || undefined,
      isDangerous: formValues.isDangerous,
      isNonstandard: formValues.isNonstandard,
      isPartialLoad: formValues.isPartialLoad,
    } as any;

    createTemplateMutation.mutate(templateData);
  };

  const onSubmit = (data: InsertOrder) => {
    // Filter out empty districts from points
    const cleanedOriginPoints = originPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    const cleanedDestinationPoints = destinationPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    
    // Override legacy fields with first point data for backward compatibility
    const orderData: InsertOrder = {
      ...data,
      originRegion: cleanedOriginPoints[0]?.region || '',
      originDistrict: cleanedOriginPoints[0]?.districts || [''],
      destinationRegion: cleanedDestinationPoints[0]?.region || '',
      destinationDistrict: cleanedDestinationPoints[0]?.districts || [''],
      originPoints: cleanedOriginPoints,
      destinationPoints: cleanedDestinationPoints,
    };
    
    createOrderMutation.mutate(orderData);
  };

  // Generate time options for 24-hour format
  const timeOptions: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      timeOptions.push(`${hourStr}:${minuteStr}`);
    }
  }

  // Get current Tashkent time to disable past times when today is selected
  const loadDateValue = form.watch('loadDate');
  const getTashkentNow = () => {
    const now = new Date();
    const tashkentOffset = 5 * 60; // UTC+5 in minutes
    const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
    return new Date((utcMinutes + tashkentOffset) * 60000);
  };
  const tashkentNow = getTashkentNow();
  const todayTashkent = tashkentNow.toISOString().split('T')[0];
  const isToday = loadDateValue === todayTashkent;
  const currentHour = tashkentNow.getHours();
  const currentMinute = tashkentNow.getMinutes();
  
  const isTimeDisabled = (time: string): boolean => {
    if (!isToday) return false;
    const [hour, minute] = time.split(':').map(Number);
    if (hour < currentHour) return true;
    if (hour === currentHour && minute <= currentMinute) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(
              onSubmit, 
              () => {
                toast({
                  title: language === 'ru' ? 'Ошибка валидации' : 'Validatsiya xatosi',
                  description: language === 'ru' ? 'Заполните все обязательные поля корректно' : 'Barcha majburiy maydonlarni to\'g\'ri to\'ldiring',
                  variant: 'destructive',
                });
              }
            )} 
            className="space-y-4">
            {templates && templates.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium">{t.templates}</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {templates
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((template) => (
                      <Card key={template.id} className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(template.createdAt)}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => loadTemplate(template)}
                              data-testid={`button-load-template-${template.id}`}
                            >
                              {t.loadTemplate}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`button-delete-template-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
                <Separator className="my-4" />
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.orderTitle}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-order-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Origin Points - Multiple pickup locations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">{t.originRegion}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOriginPoint}
                  data-testid="button-add-origin-point"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t.addOriginPoint}
                </Button>
              </div>
              
              {originPoints.map((point, pointIdx) => (
                <Card key={`origin-${pointIdx}-${point.region}-${point.districts.join(',')}`} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.originPoint} #{pointIdx + 1}</span>
                    {originPoints.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOriginPoint(pointIdx)}
                        data-testid={`button-remove-origin-point-${pointIdx}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t.removePoint}
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <FormLabel>{t.originRegion}</FormLabel>
                    <Select 
                      onValueChange={(value) => updateOriginRegion(pointIdx, value)} 
                      value={point.region}
                    >
                      <SelectTrigger data-testid={`select-origin-region-${pointIdx}`}>
                        <SelectValue placeholder={t.selectRegion} />
                      </SelectTrigger>
                      <SelectContent>
                        {uzbekistanRegions.map((region) => (
                          <SelectItem key={region.name} value={region.name}>
                            {language === 'ru' ? region.nameRu : region.nameUz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>{t.originDistrict}</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOriginDistrict(pointIdx)}
                        disabled={!point.region}
                        data-testid={`button-add-origin-district-${pointIdx}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t.addDistrict}
                      </Button>
                    </div>
                    {point.districts.map((district, districtIdx) => (
                      <div key={districtIdx} className="flex gap-2">
                        <Select 
                          onValueChange={(value) => updateOriginDistrict(pointIdx, districtIdx, value)} 
                          value={district}
                          disabled={!point.region}
                        >
                          <SelectTrigger data-testid={`select-origin-district-${pointIdx}-${districtIdx}`}>
                            <SelectValue placeholder={t.selectDistrict} />
                          </SelectTrigger>
                          <SelectContent>
                            {point.region && getDistrictsByRegion(point.region).map((d) => (
                              <SelectItem key={d.name} value={d.name}>
                                {language === 'ru' ? d.nameRu : d.nameUz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {point.districts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOriginDistrict(pointIdx, districtIdx)}
                            data-testid={`button-remove-origin-district-${pointIdx}-${districtIdx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            {/* Destination Points - Multiple delivery locations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">{t.destinationRegion}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDestinationPoint}
                  data-testid="button-add-destination-point"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t.addDestinationPoint}
                </Button>
              </div>
              
              {destinationPoints.map((point, pointIdx) => (
                <Card key={`dest-${pointIdx}-${point.region}-${point.districts.join(',')}`} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.destinationPoint} #{pointIdx + 1}</span>
                    {destinationPoints.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDestinationPoint(pointIdx)}
                        data-testid={`button-remove-destination-point-${pointIdx}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t.removePoint}
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <FormLabel>{t.destinationRegion}</FormLabel>
                    <Select 
                      onValueChange={(value) => updateDestinationRegion(pointIdx, value)} 
                      value={point.region}
                    >
                      <SelectTrigger data-testid={`select-destination-region-${pointIdx}`}>
                        <SelectValue placeholder={t.selectRegion} />
                      </SelectTrigger>
                      <SelectContent>
                        {uzbekistanRegions.map((region) => (
                          <SelectItem key={region.name} value={region.name}>
                            {language === 'ru' ? region.nameRu : region.nameUz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>{t.destinationDistrict}</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addDestinationDistrict(pointIdx)}
                        disabled={!point.region}
                        data-testid={`button-add-destination-district-${pointIdx}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t.addDistrict}
                      </Button>
                    </div>
                    {point.districts.map((district, districtIdx) => (
                      <div key={districtIdx} className="flex gap-2">
                        <Select 
                          onValueChange={(value) => updateDestinationDistrict(pointIdx, districtIdx, value)} 
                          value={district}
                          disabled={!point.region}
                        >
                          <SelectTrigger data-testid={`select-destination-district-${pointIdx}-${districtIdx}`}>
                            <SelectValue placeholder={t.selectDistrict} />
                          </SelectTrigger>
                          <SelectContent>
                            {point.region && getDistrictsByRegion(point.region).map((d) => (
                              <SelectItem key={d.name} value={d.name}>
                                {language === 'ru' ? d.nameRu : d.nameUz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {point.districts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDestinationDistrict(pointIdx, districtIdx)}
                            data-testid={`button-remove-destination-district-${pointIdx}-${districtIdx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.transportType}</FormLabel>
                    <FormControl>
                      <TransportTypeSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        language={language}
                        placeholder={t.selectTransport}
                        data-testid="select-transport-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weightTons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.weightTons}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          field.onChange(value);
                        }}
                        data-testid="input-weight-tons"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="loadDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.loadDate}</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        onChange={(e) => {
                          const selectedDate = e.target.value;
                          const today = new Date().toISOString().split('T')[0];
                          // Prevent past dates
                          if (selectedDate && selectedDate < today) {
                            e.target.value = today;
                            field.onChange(today);
                          } else {
                            field.onChange(selectedDate);
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        data-testid="input-load-date" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loadingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.loadingTime}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-loading-time">
                          <SelectValue placeholder={t.selectTime} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem 
                            key={time} 
                            value={time}
                            disabled={isTimeDisabled(time)}
                            className={isTimeDisabled(time) ? 'opacity-50' : ''}
                          >
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priceWithVat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.priceWithVat}</FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      value={field.value !== undefined && field.value !== null ? formatAmountWithSpaces(String(field.value)) : ''}
                      onChange={(e) => {
                        // Allow digits, comma, and period for decimal (tiyin) input
                        const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                        // Only keep one decimal point, max 2 decimal places
                        const parts = cleaned.split('.');
                        const formatted = parts.length > 1 
                          ? parts[0] + '.' + parts.slice(1).join('').slice(0, 2)
                          : parts[0];
                        // Use null for empty value to properly clear the field
                        const value = formatted === '' ? null : parseFloat(formatted);
                        field.onChange(value as any);
                      }}
                      placeholder="1 000 000.00"
                      data-testid="input-price-with-vat"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {priceWithVat && (
              <div className="text-sm text-muted-foreground" data-testid="text-price-without-vat">
                {t.priceWithoutVat}: <span className="font-semibold">{formatMoney(priceWithoutVat)}</span>
              </div>
            )}

            {customerCollateral > 0 && (
              <div className="text-sm p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md" data-testid="text-customer-collateral">
                <div className="flex justify-between items-center">
                  <span className="text-orange-700 dark:text-orange-300">
                    {language === 'ru' ? 'Залог заказчика (2%):' : 'Buyurtmachi garovi (2%):'}
                  </span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {formatMoney(customerCollateral)} {language === 'ru' ? 'сум' : 'so\'m'}
                  </span>
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  {language === 'ru' 
                    ? 'Будет заблокировано на вашем депозите при создании заказа' 
                    : 'Buyurtma yaratilganda depozitingizda bloklanadi'}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.notes}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      value={field.value ?? ''}
                      placeholder={language === 'ru' ? 'Дополнительная информация (необязательно)' : 'Qo\'shimcha ma\'lumot (ixtiyoriy)'}
                      data-testid="textarea-notes"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap gap-6">
              <FormField
                control={form.control}
                name="requiresCollateral"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-requires-collateral"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {t.requiresCollateral}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDangerous"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-is-dangerous"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {t.isDangerous}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isNonstandard"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-is-nonstandard"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {t.isNonstandard}
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPartialLoad"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-is-partial-load"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">
                      {t.isPartialLoad}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.templateName}</label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={language === 'ru' ? 'Введите название для сохранения как шаблон (необязательно)' : 'Shablon sifatida saqlash uchun nom kiriting (ixtiyoriy)'}
                  data-testid="input-template-name"
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveTemplate}
                disabled={createTemplateMutation.isPending || !templateName.trim()}
                data-testid="button-save-template"
              >
                {createTemplateMutation.isPending ? t.saving : t.saveAsTemplate}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-order"
                >
                  {t.cancel}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createOrderMutation.isPending}
                  data-testid="button-submit-order"
                >
                  {createOrderMutation.isPending ? t.creating : t.create}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  language: 'ru' | 'uz';
  onSuccess?: () => void;
}

export function EditOrderDialog({ open, onOpenChange, order, language, onSuccess }: EditOrderDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const texts = {
    ru: {
      title: 'Редактировать заказ',
      orderTitle: 'Название заказа',
      save: 'Сохранить',
      cancel: 'Отмена',
      saving: 'Сохранение...',
      success: 'Сохранено',
      error: 'Ошибка',
      cannotEdit: 'Невозможно редактировать',
      rejectOffersFirst: 'Сначала отклоните все активные предложения',
      originRegion: 'Регион отправления',
      destinationRegion: 'Регион назначения',
      originDistrict: 'Район отправления',
      destinationDistrict: 'Район назначения',
      selectRegion: 'Выберите регион',
      selectDistrict: 'Выберите район',
      transportType: 'Тип транспорта',
      selectTransport: 'Выберите тип',
      weightTons: 'Вес груза (тонн)',
      loadDate: 'Дата погрузки',
      loadingTime: 'Время погрузки',
      selectTime: 'Выберите время',
      priceWithVat: 'Цена с НДС',
      priceWithoutVat: 'Цена без НДС',
      requiresCollateral: 'Требуется залог 2%',
      notes: 'Примечания',
      isDangerous: 'Опасный груз',
      isNonstandard: 'Негабаритный груз',
      isPartialLoad: 'Частичная загрузка',
      addDistrict: 'Добавить район'
    },
    uz: {
      title: 'Buyurtmani tahrirlash',
      orderTitle: 'Buyurtma nomi',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      saving: 'Saqlanmoqda...',
      success: 'Saqlandi',
      error: 'Xatolik',
      cannotEdit: 'Tahrirlab bo\'lmaydi',
      rejectOffersFirst: 'Avval barcha faol takliflarni rad eting',
      originRegion: 'Jo\'nash hududi',
      destinationRegion: 'Manzil hududi',
      originDistrict: 'Jo\'nash tumani',
      destinationDistrict: 'Manzil tumani',
      selectRegion: 'Hududni tanlang',
      selectDistrict: 'Tumanni tanlang',
      transportType: 'Transport turi',
      selectTransport: 'Turini tanlang',
      weightTons: 'Yuk og\'irligi (tonna)',
      loadDate: 'Yuklash sanasi',
      loadingTime: 'Yuklash vaqti',
      selectTime: 'Vaqtni tanlang',
      priceWithVat: 'QQS bilan narx',
      priceWithoutVat: 'QQS siz narx',
      requiresCollateral: '2% garov talab qilinadi',
      notes: 'Izohlar',
      isDangerous: 'Xavfli yuk',
      isNonstandard: 'O\'lchovdan tashqari yuk',
      isPartialLoad: 'Qisman yuklash',
      addDistrict: 'Tuman qo\'shish'
    }
  };

  const t = texts[language];

  // Initialize points from order data
  type LocationPointState = { region: string; districts: string[] };
  const initOriginPoints = (): LocationPointState[] => {
    if (!order) return [{ region: '', districts: [''] }];
    if (order.originPoints && order.originPoints.length > 0) {
      return order.originPoints;
    }
    return [{ 
      region: order.originRegion || '', 
      districts: Array.isArray(order.originDistrict) ? order.originDistrict : [order.originDistrict || ''] 
    }];
  };
  const initDestinationPoints = (): LocationPointState[] => {
    if (!order) return [{ region: '', districts: [''] }];
    if (order.destinationPoints && order.destinationPoints.length > 0) {
      return order.destinationPoints;
    }
    return [{ 
      region: order.destinationRegion || '', 
      districts: Array.isArray(order.destinationDistrict) ? order.destinationDistrict : [order.destinationDistrict || ''] 
    }];
  };
  
  const [originPoints, setOriginPoints] = useState<LocationPointState[]>(initOriginPoints);
  const [destinationPoints, setDestinationPoints] = useState<LocationPointState[]>(initDestinationPoints);

  // Origin points management
  const addOriginPointEdit = () => setOriginPoints([...originPoints, { region: '', districts: [''] }]);
  const removeOriginPointEdit = (idx: number) => setOriginPoints(originPoints.filter((_, i) => i !== idx));
  const updateOriginRegionEdit = (idx: number, region: string) => {
    const updated = [...originPoints];
    updated[idx] = { region, districts: [''] };
    setOriginPoints(updated);
  };
  const addOriginDistrictEdit = (pointIdx: number) => {
    const updated = [...originPoints];
    updated[pointIdx].districts.push('');
    setOriginPoints(updated);
  };
  const removeOriginDistrictEdit = (pointIdx: number, districtIdx: number) => {
    const updated = [...originPoints];
    updated[pointIdx].districts = updated[pointIdx].districts.filter((_, i) => i !== districtIdx);
    setOriginPoints(updated);
  };
  const updateOriginDistrictEdit = (pointIdx: number, districtIdx: number, value: string) => {
    const updated = [...originPoints];
    updated[pointIdx].districts[districtIdx] = value;
    setOriginPoints(updated);
  };

  // Destination points management
  const addDestinationPointEdit = () => setDestinationPoints([...destinationPoints, { region: '', districts: [''] }]);
  const removeDestinationPointEdit = (idx: number) => setDestinationPoints(destinationPoints.filter((_, i) => i !== idx));
  const updateDestinationRegionEdit = (idx: number, region: string) => {
    const updated = [...destinationPoints];
    updated[idx] = { region, districts: [''] };
    setDestinationPoints(updated);
  };
  const addDestinationDistrictEdit = (pointIdx: number) => {
    const updated = [...destinationPoints];
    updated[pointIdx].districts.push('');
    setDestinationPoints(updated);
  };
  const removeDestinationDistrictEdit = (pointIdx: number, districtIdx: number) => {
    const updated = [...destinationPoints];
    updated[pointIdx].districts = updated[pointIdx].districts.filter((_, i) => i !== districtIdx);
    setDestinationPoints(updated);
  };
  const updateDestinationDistrictEdit = (pointIdx: number, districtIdx: number, value: string) => {
    const updated = [...destinationPoints];
    updated[pointIdx].districts[districtIdx] = value;
    setDestinationPoints(updated);
  };

  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      title: order?.title || '',
      originRegion: order?.originRegion || '',
      originDistrict: Array.isArray(order?.originDistrict) ? order.originDistrict : [order?.originDistrict || ''],
      destinationRegion: order?.destinationRegion || '',
      destinationDistrict: Array.isArray(order?.destinationDistrict) ? order.destinationDistrict : [order?.destinationDistrict || ''],
      transportType: order?.transportType,
      weightTons: order?.weightTons,
      loadDate: order?.loadDate || '',
      loadingTime: order?.loadingTime || '09:00',
      priceWithVat: order?.priceWithVat,
      requiresCollateral: order?.requiresCollateral || false,
      notes: order?.notes || '',
      isDangerous: order?.isDangerous || false,
      isNonstandard: order?.isNonstandard || false,
      isPartialLoad: order?.isPartialLoad || false,
    }
  });

  const priceWithVat = form.watch('priceWithVat');
  const priceWithoutVat = priceWithVat ? (user?.ndsPayer ? Math.round(priceWithVat * 100 / 112) : priceWithVat) : 0;

  // Sync legacy form fields with first point for validation
  useEffect(() => {
    const firstOrigin = originPoints[0];
    if (firstOrigin?.region) {
      form.setValue('originRegion', firstOrigin.region);
    }
    const validOriginDistricts = firstOrigin?.districts.filter(d => d) || [];
    if (validOriginDistricts.length > 0) {
      form.setValue('originDistrict', validOriginDistricts);
    }
  }, [originPoints, form]);

  useEffect(() => {
    const firstDestination = destinationPoints[0];
    if (firstDestination?.region) {
      form.setValue('destinationRegion', firstDestination.region);
    }
    const validDestinationDistricts = firstDestination?.districts.filter(d => d) || [];
    if (validDestinationDistricts.length > 0) {
      form.setValue('destinationDistrict', validDestinationDistricts);
    }
  }, [destinationPoints, form]);

  const editOrderMutation = useMutation({
    mutationFn: async (data: InsertOrder) => {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Cannot edit order with active offers') {
          throw new Error('active_offers');
        }
        throw new Error('Failed to edit order');
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-orders'], exact: false });
      toast({
        title: t.success,
        description: language === 'ru' ? 'Заказ успешно обновлен' : 'Buyurtma muvaffaqiyatli yangilandi',
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      if (error.message === 'active_offers') {
        toast({
          title: t.cannotEdit,
          description: t.rejectOffersFirst,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t.error,
          description: language === 'ru' ? 'Не удалось обновить заказ. Проверьте данные и попробуйте снова.' : 'Buyurtmani yangilab bo\'lmadi. Ma\'lumotlarni tekshiring va qayta urinib ko\'ring.',
          variant: 'destructive',
        });
      }
    }
  });

  const onSubmit = (data: InsertOrder) => {
    // Filter out empty districts from points
    const cleanedOriginPoints = originPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    const cleanedDestinationPoints = destinationPoints
      .filter(p => p.region && p.districts.some(d => d))
      .map(p => ({ region: p.region, districts: p.districts.filter(d => d) }));
    
    // Override legacy fields with first point data for backward compatibility
    const orderData: InsertOrder = {
      ...data,
      originRegion: cleanedOriginPoints[0]?.region || '',
      originDistrict: cleanedOriginPoints[0]?.districts || [''],
      destinationRegion: cleanedDestinationPoints[0]?.region || '',
      destinationDistrict: cleanedDestinationPoints[0]?.districts || [''],
      originPoints: cleanedOriginPoints,
      destinationPoints: cleanedDestinationPoints,
    };
    
    editOrderMutation.mutate(orderData);
  };

  const timeOptions: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      timeOptions.push(`${hourStr}:${minuteStr}`);
    }
  }

  // Get current Tashkent time to disable past times when today is selected
  const loadDateValue = form.watch('loadDate');
  const getTashkentNow = () => {
    const now = new Date();
    const tashkentOffset = 5 * 60; // UTC+5 in minutes
    const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset();
    return new Date((utcMinutes + tashkentOffset) * 60000);
  };
  const tashkentNow = getTashkentNow();
  const todayTashkent = tashkentNow.toISOString().split('T')[0];
  const isToday = loadDateValue === todayTashkent;
  const currentHour = tashkentNow.getHours();
  const currentMinute = tashkentNow.getMinutes();
  
  const isTimeDisabled = (time: string): boolean => {
    if (!isToday) return false;
    const [hour, minute] = time.split(':').map(Number);
    if (hour < currentHour) return true;
    if (hour === currentHour && minute <= currentMinute) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.orderTitle}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-order-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Origin Points - Multiple pickup locations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">{t.originRegion}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOriginPointEdit}
                  data-testid="button-add-edit-origin-point"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {language === 'ru' ? 'Добавить пункт' : 'Punkt qo\'shish'}
                </Button>
              </div>
              
              {originPoints.map((point, pointIdx) => (
                <Card key={pointIdx} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{language === 'ru' ? 'Пункт' : 'Punkt'} #{pointIdx + 1}</span>
                    {originPoints.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOriginPointEdit(pointIdx)}
                        data-testid={`button-remove-edit-origin-point-${pointIdx}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {language === 'ru' ? 'Удалить' : 'O\'chirish'}
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <FormLabel>{t.originRegion}</FormLabel>
                    <Select 
                      onValueChange={(value) => updateOriginRegionEdit(pointIdx, value)} 
                      value={point.region}
                    >
                      <SelectTrigger data-testid={`select-edit-origin-region-${pointIdx}`}>
                        <SelectValue placeholder={t.selectRegion} />
                      </SelectTrigger>
                      <SelectContent>
                        {uzbekistanRegions.map((region) => (
                          <SelectItem key={region.name} value={region.name}>
                            {language === 'ru' ? region.nameRu : region.nameUz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>{t.originDistrict}</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOriginDistrictEdit(pointIdx)}
                        disabled={!point.region}
                        data-testid={`button-add-edit-origin-district-${pointIdx}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t.addDistrict}
                      </Button>
                    </div>
                    {point.districts.map((district, districtIdx) => (
                      <div key={districtIdx} className="flex gap-2">
                        <Select 
                          onValueChange={(value) => updateOriginDistrictEdit(pointIdx, districtIdx, value)} 
                          value={district}
                          disabled={!point.region}
                        >
                          <SelectTrigger data-testid={`select-edit-origin-district-${pointIdx}-${districtIdx}`}>
                            <SelectValue placeholder={t.selectDistrict} />
                          </SelectTrigger>
                          <SelectContent>
                            {point.region && getDistrictsByRegion(point.region).map((d) => (
                              <SelectItem key={d.name} value={d.name}>
                                {language === 'ru' ? d.nameRu : d.nameUz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {point.districts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOriginDistrictEdit(pointIdx, districtIdx)}
                            data-testid={`button-remove-edit-origin-district-${pointIdx}-${districtIdx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            {/* Destination Points - Multiple delivery locations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">{t.destinationRegion}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDestinationPointEdit}
                  data-testid="button-add-edit-destination-point"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {language === 'ru' ? 'Добавить пункт' : 'Punkt qo\'shish'}
                </Button>
              </div>
              
              {destinationPoints.map((point, pointIdx) => (
                <Card key={pointIdx} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{language === 'ru' ? 'Пункт' : 'Punkt'} #{pointIdx + 1}</span>
                    {destinationPoints.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDestinationPointEdit(pointIdx)}
                        data-testid={`button-remove-edit-destination-point-${pointIdx}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {language === 'ru' ? 'Удалить' : 'O\'chirish'}
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <FormLabel>{t.destinationRegion}</FormLabel>
                    <Select 
                      onValueChange={(value) => updateDestinationRegionEdit(pointIdx, value)} 
                      value={point.region}
                    >
                      <SelectTrigger data-testid={`select-edit-destination-region-${pointIdx}`}>
                        <SelectValue placeholder={t.selectRegion} />
                      </SelectTrigger>
                      <SelectContent>
                        {uzbekistanRegions.map((region) => (
                          <SelectItem key={region.name} value={region.name}>
                            {language === 'ru' ? region.nameRu : region.nameUz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel>{t.destinationDistrict}</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addDestinationDistrictEdit(pointIdx)}
                        disabled={!point.region}
                        data-testid={`button-add-edit-destination-district-${pointIdx}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t.addDistrict}
                      </Button>
                    </div>
                    {point.districts.map((district, districtIdx) => (
                      <div key={districtIdx} className="flex gap-2">
                        <Select 
                          onValueChange={(value) => updateDestinationDistrictEdit(pointIdx, districtIdx, value)} 
                          value={district}
                          disabled={!point.region}
                        >
                          <SelectTrigger data-testid={`select-edit-destination-district-${pointIdx}-${districtIdx}`}>
                            <SelectValue placeholder={t.selectDistrict} />
                          </SelectTrigger>
                          <SelectContent>
                            {point.region && getDistrictsByRegion(point.region).map((d) => (
                              <SelectItem key={d.name} value={d.name}>
                                {language === 'ru' ? d.nameRu : d.nameUz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {point.districts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDestinationDistrictEdit(pointIdx, districtIdx)}
                            data-testid={`button-remove-edit-destination-district-${pointIdx}-${districtIdx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.transportType}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-transport-type">
                          <SelectValue placeholder={t.selectTransport} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transportTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {language === 'ru' ? type.labelRu : type.labelUz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weightTons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.weightTons}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-edit-weight"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priceWithVat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.priceWithVat}</FormLabel>
                    <FormControl>
                      <Input 
                        type="text"
                        value={field.value !== undefined && field.value !== null ? formatAmountWithSpaces(String(field.value)) : ''}
                        onChange={(e) => {
                          // Allow digits, comma, and period for decimal (tiyin) input
                          const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                          // Only keep one decimal point, max 2 decimal places
                          const parts = cleaned.split('.');
                          const formatted = parts.length > 1 
                            ? parts[0] + '.' + parts.slice(1).join('').slice(0, 2)
                            : parts[0];
                          // Use null for empty value to properly clear the field
                          const value = formatted === '' ? null : parseFloat(formatted);
                          field.onChange(value as any);
                        }}
                        placeholder="1 000 000.00"
                        data-testid="input-edit-price-with-vat"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>{t.priceWithoutVat}</FormLabel>
                <div className="h-9 px-3 py-2 border rounded-md bg-muted text-muted-foreground" data-testid="text-edit-price-without-vat">
                  {formatMoney(priceWithoutVat)} UZS
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-order"
              >
                {t.cancel}
              </Button>
              <Button 
                type="submit" 
                disabled={editOrderMutation.isPending}
                data-testid="button-save-edit-order"
              >
                {editOrderMutation.isPending ? t.saving : t.save}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DashboardHome({ language, orders, ordersLoading, onNavigate, onDeleteOrder, onEditOrder }: { language: 'ru' | 'uz'; orders: any; ordersLoading: boolean; onNavigate: (section: CustomerSection) => void; onDeleteOrder: (orderId: number) => void; onEditOrder: (order: any) => void }) {
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const texts = {
    ru: {
      createOrder: 'Создать заказ',
      newOrders: 'Новые заказы',
      totalNewOrders: 'Новых заказов',
      activeOffers: 'Активные предложения',
      completedDeliveries: 'Выполнено',
      noOrders: 'Нет новых заказов'
    },
    uz: {
      createOrder: 'Buyurtma yaratish',
      newOrders: 'Yangi buyurtmalar',
      totalNewOrders: 'Yangi buyurtmalar',
      activeOffers: 'Faol takliflar',
      completedDeliveries: 'Bajarilgan',
      noOrders: 'Yangi buyurtmalar yo\'q'
    }
  };

  const t = texts[language as 'ru' | 'uz'];
  
  // Filter only new orders for home page (exclude deleted)
  const newOrders = orders?.filter((o: any) => o.status === 'new' && !o.deletedAt) || [];
  const totalNewOrders = newOrders.length;
  const completedOrders = orders?.filter((o: any) => o.status === 'completed').length || 0;
  // Sum active offers count from all orders
  const activeOffersCount = orders?.reduce((sum: number, o: any) => sum + (o.activeOffersCount || 0), 0) || 0;

  return (
    <>
      <CreateOrderDialog 
        open={createOrderOpen} 
        onOpenChange={setCreateOrderOpen} 
        language={language}
      />
      <OffersDialog
        orderId={selectedOrderId}
        open={selectedOrderId !== null}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        language={language}
      />
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">{t.newOrders}</h1>
            <Button className="gap-2" onClick={() => setCreateOrderOpen(true)} data-testid="button-create-order">
              <Plus className="h-4 w-4" />
              {t.createOrder}
            </Button>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            title={t.totalNewOrders}
            value={totalNewOrders}
            icon={Package}
          />
          <StatsCard
            title={t.activeOffers}
            value={activeOffersCount}
            icon={TrendingUp}
          />
          <StatsCard
            title={t.completedDeliveries}
            value={completedOrders}
            icon={FileText}
          />
        </div>

        <div className="space-y-4">
          {ordersLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : newOrders.length > 0 ? (
            newOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                id={order.id.toString()}
                title={order.title}
                originRegion={order.originRegion}
                originDistrict={order.originDistrict}
                destinationRegion={order.destinationRegion}
                destinationDistrict={order.destinationDistrict}
                originPoints={order.originPoints}
                destinationPoints={order.destinationPoints}
                transportType={order.transportType}
                weight={Number(order.weightTons)}
                loadDate={order.loadDate}
                loadingTime={order.loadingTime}
                price={order.priceWithVat}
                priceWithoutVat={order.priceWithoutVat}
                prepaymentAmount={order.prepaymentAmount}
                notes={order.notes}
                status={order.status}
                deletedAt={order.deletedAt}
                expiresAt={order.expiresAt}
                isNonstandard={order.isNonstandard}
                isDangerous={order.isDangerous}
                isPartialLoad={order.isPartialLoad}
                language={language}
                onEdit={() => onEditOrder(order)}
                onViewOffers={() => setSelectedOrderId(order.id)}
                onDelete={() => onDeleteOrder(order.id)}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t.noOrders}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function MyOrders({ language, orders, ordersLoading, onDeleteOrder, onEditOrder, userType }: { language: 'ru' | 'uz'; orders: any; ordersLoading: boolean; onDeleteOrder: (orderId: number) => void; onEditOrder: (order: any) => void; userType?: string }) {
  const isLegalOrIP = userType === 'legal' || userType === 'ip';
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
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
  
  // Handle ?create=true URL parameter for opening create order dialog from principal orders page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const createParam = urlParams.get('create');
    if (createParam === 'true') {
      setCreateOrderOpen(true);
      // Clean URL without reloading page
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);
  
  const texts = {
    ru: {
      myOrders: 'Мои заказы',
      createOrder: 'Создать заказ',
      noOrders: 'Нет заказов',
      orderNumber: 'Номер заказа',
      from: 'Откуда',
      to: 'Куда',
      transportType: 'Тип транспорта',
      cargo: 'Груз',
      loadDateTime: 'Дата и время отгрузки',
      startPrice: 'Стартовая цена',
      status: 'Статус',
      timeLeft: 'Осталось времени',
      details: 'Подробнее',
      close: 'Закрыть',
      statusNew: 'Новый',
      statusAssigned: 'Назначен',
      statusCompleted: 'Завершён',
      statusCancelled: 'Отменён',
      statusDeleted: 'Удален',
      author: 'Автор'
    },
    uz: {
      myOrders: 'Mening buyurtmalarim',
      createOrder: 'Buyurtma yaratish',
      noOrders: 'Buyurtmalar yo\'q',
      orderNumber: 'Buyurtma raqami',
      from: 'Qayerdan',
      to: 'Qayerga',
      transportType: 'Transport turi',
      cargo: 'Yuk',
      loadDateTime: 'Yuklash sanasi va vaqti',
      startPrice: 'Boshlang\'ich narx',
      status: 'Holati',
      timeLeft: 'Qolgan vaqt',
      details: 'Batafsil',
      close: 'Yopish',
      statusNew: 'Yangi',
      statusAssigned: 'Tayinlangan',
      statusCompleted: 'Tugallangan',
      statusCancelled: 'Bekor qilingan',
      statusDeleted: 'O\'chirilgan',
      author: 'Muallif'
    }
  };

  const t = texts[language as 'ru' | 'uz'];
  
  const formatDateTime = (dateStr: string, timeStr: string) => {
    try {
      return `${formatDate(dateStr)} ${timeStr}`;
    } catch {
      return `${dateStr} ${timeStr}`;
    }
  };

  const getStatusLabel = (status: string, deletedAt?: string | null) => {
    if (deletedAt) {
      return t.statusDeleted;
    }
    const statusMap: Record<string, string> = {
      'new': t.statusNew,
      'assigned': t.statusAssigned,
      'completed': t.statusCompleted,
      'cancelled': t.statusCancelled
    };
    return statusMap[status] || status;
  };

  const getStatusVariant = (status: string, deletedAt?: string | null): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (deletedAt) {
      return 'secondary';
    }
    switch (status) {
      case 'new':
        return 'outline';
      case 'assigned':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getSearchableText = (order: any) => {
    const originRegionName = getRegionDisplayName(order.originRegion, language);
    const originDistrictName = order.originDistrict ? getDistrictDisplayName(order.originDistrict, language) : '';
    const destRegionName = getRegionDisplayName(order.destinationRegion, language);
    const destDistrictName = order.destinationDistrict ? getDistrictDisplayName(order.destinationDistrict, language) : '';
    const transportTypeName = getTransportTypeLabel(order.transportType, language);
    
    return [
      order.id,
      order.title,
      order.originRegion,
      order.destinationRegion,
      originRegionName,
      originDistrictName,
      destRegionName,
      destDistrictName,
      transportTypeName,
      order.notes || '',
      order.weightTons ? `${order.weightTons}` : '',
      order.priceWithVat ? `${order.priceWithVat}` : ''
    ].filter(Boolean).join(' ');
  };

  const filteredOrders = orders ? filterData(
    orders,
    filters,
    getSearchableText,
    (order: any) => {
      const regions: string[] = [];
      if (order.originPoints && order.originPoints.length > 0) {
        order.originPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order.originRegion) {
        regions.push(order.originRegion);
      }
      return regions;
    },
    (order: any) => order.transportType,
    (order: any) => order.loadDate,
    (order: any) => order.status,
    undefined,
    (order: any) => {
      const regions: string[] = [];
      if (order.destinationPoints && order.destinationPoints.length > 0) {
        order.destinationPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order.destinationRegion) {
        regions.push(order.destinationRegion);
      }
      return regions;
    }
  ) : [];

  const paginatedOrders = paginateData(filteredOrders, currentPage, pageSize);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const orderStatusOptions = language === 'ru' 
    ? [
        { value: 'new', label: 'Новый' },
        { value: 'assigned', label: 'Назначен' },
        { value: 'completed', label: 'Завершён' },
        { value: 'cancelled', label: 'Отменён' }
      ]
    : [
        { value: 'new', label: 'Yangi' },
        { value: 'assigned', label: 'Tayinlangan' },
        { value: 'completed', label: 'Tugallangan' },
        { value: 'cancelled', label: 'Bekor qilingan' }
      ];

  return (
    <>
      <CreateOrderDialog 
        open={createOrderOpen} 
        onOpenChange={setCreateOrderOpen} 
        language={language}
      />
      <OffersDialog
        orderId={selectedOrderId}
        open={selectedOrderId !== null}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        language={language}
      />
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">{t.myOrders}</h1>
            <Button className="gap-2" onClick={() => setCreateOrderOpen(true)} data-testid="button-create-order-page">
              <Plus className="h-4 w-4" />
              {t.createOrder}
            </Button>
          </div>

          <TableSearchFilter
            language={language}
            onFilterChange={handleFilterChange}
            showRegionFilter={true}
            showTransportFilter={true}
            showDateFilter={true}
            showStatusFilter={true}
            statusOptions={orderStatusOptions}
          />

          {ordersLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {paginatedOrders.map((order: any) => (
                <div key={order.id}>
                  <div className="border rounded-md p-4 hover-elevate cursor-pointer" onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
                      <div data-testid={`text-order-number-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.orderNumber}</div>
                        <div className="font-semibold">#{order.id}</div>
                      </div>
                      <div className="col-span-2 md:col-span-2 lg:col-span-2" data-testid={`text-from-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.from}</div>
                        <div className="text-sm whitespace-normal break-words">
                          {(order.originPoints && order.originPoints.length > 0 ? order.originPoints : [{region: order.originRegion, districts: order.originDistrict}]).map((point: any, idx: number) => (
                            <span key={idx}>
                              {(order.originPoints && order.originPoints.length > 1) && <span className="font-medium">{idx + 1}. </span>}
                              {getRegionDisplayName(point.region, language)}
                              {idx < (order.originPoints && order.originPoints.length > 0 ? order.originPoints.length : 1) - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-2 lg:col-span-2" data-testid={`text-to-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.to}</div>
                        <div className="text-sm whitespace-normal break-words">
                          {(order.destinationPoints && order.destinationPoints.length > 0 ? order.destinationPoints : [{region: order.destinationRegion, districts: order.destinationDistrict}]).map((point: any, idx: number) => (
                            <span key={idx}>
                              {(order.destinationPoints && order.destinationPoints.length > 1) && <span className="font-medium">{idx + 1}. </span>}
                              {getRegionDisplayName(point.region, language)}
                              {idx < (order.destinationPoints && order.destinationPoints.length > 0 ? order.destinationPoints.length : 1) - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div data-testid={`text-transport-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.transportType}</div>
                        <div>{getTransportTypeLabel(order.transportType, language)}</div>
                      </div>
                      <div data-testid={`text-cargo-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.cargo}</div>
                        <div className="truncate">{order.title}</div>
                      </div>
                      <div data-testid={`text-datetime-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.loadDateTime}</div>
                        <div className="text-sm">{formatDateTime(order.loadDate, order.loadingTime)}</div>
                      </div>
                      <div data-testid={`text-price-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.startPrice}</div>
                        <div className="font-semibold">{formatMoney(order.priceWithVat || 0)} UZS</div>
                      </div>
                      <div data-testid={`text-status-${order.id}`}>
                        <div className="text-muted-foreground text-xs font-medium uppercase">{t.status}</div>
                        <Badge variant={getStatusVariant(order.status, order.deletedAt)} data-testid={`badge-status-${order.id}`}>
                          {getStatusLabel(order.status, order.deletedAt)}
                        </Badge>
                      </div>
                      {(isLegalOrIP || order.createdByUser) && (
                        <div data-testid={`text-author-${order.id}`}>
                          <div className="text-muted-foreground text-xs font-medium uppercase">{t.author}</div>
                          <div className="text-sm truncate">{order.createdByUser?.displayName || '—'}</div>
                        </div>
                      )}
                      {order.status === 'new' && order.expiresAt && !order.deletedAt && (
                        <div data-testid={`text-timer-${order.id}`}>
                          <div className="text-muted-foreground text-xs font-medium uppercase">{t.timeLeft}</div>
                          <CountdownTimer expiresAt={order.expiresAt} language={language} />
                        </div>
                      )}
                    </div>
                  </div>
                  {expandedOrderId === order.id && (
                    <div className="border border-t-0 rounded-b-md p-4 bg-muted/50 space-y-4">
                      <OrderCard
                        id={order.id.toString()}
                        title={order.title}
                        originRegion={order.originRegion}
                        originDistrict={order.originDistrict}
                        destinationRegion={order.destinationRegion}
                        destinationDistrict={order.destinationDistrict}
                        originPoints={order.originPoints}
                        destinationPoints={order.destinationPoints}
                        transportType={order.transportType}
                        weight={Number(order.weightTons)}
                        loadDate={order.loadDate}
                        loadingTime={order.loadingTime}
                        price={order.priceWithVat}
                        priceWithoutVat={order.priceWithoutVat}
                        prepaymentAmount={order.prepaymentAmount}
                        notes={order.notes}
                        status={order.status}
                        deletedAt={order.deletedAt}
                        expiresAt={order.expiresAt}
                        isNonstandard={order.isNonstandard}
                        isDangerous={order.isDangerous}
                        isPartialLoad={order.isPartialLoad}
                        language={language}
                        onViewOffers={() => setSelectedOrderId(order.id)}
                        onEdit={() => onEditOrder(order)}
                        onDelete={() => onDeleteOrder(order.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
              <Pagination
                language={language}
                totalItems={filteredOrders.length}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                  {t.noOrders}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function MyContracts({ language }: { language: 'ru' | 'uz' }) {
  return <ContractsTable language={language} userRole="customer" />;
}

function Profile({ language }: { language: 'ru' | 'uz' }) {
  return <ProfileView language={language} />;
}

interface BlacklistEntry {
  id: number;
  customerId: number;
  carrierId: number;
  reason: string | null;
  createdAt: string;
  carrier?: {
    id: number;
    displayName: string;
    phone: string;
  };
}

interface CarrierSearchResult {
  id: number;
  displayName: string | null;
  phone: string;
}

function BlacklistSection({ language }: { language: 'ru' | 'uz' }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierSearchResult | null>(null);
  const [reasonToAdd, setReasonToAdd] = useState('');
  const [carrierToRemove, setCarrierToRemove] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const texts = {
    ru: {
      title: 'Чёрный список',
      description: 'Перевозчики из чёрного списка не смогут отправлять вам предложения',
      empty: 'Чёрный список пуст',
      searchPlaceholder: 'Введите ID или название перевозчика',
      reason: 'Причина (необязательно)',
      add: 'Добавить',
      remove: 'Удалить',
      carrier: 'Перевозчик',
      phone: 'Телефон',
      addedAt: 'Дата добавления',
      reasonLabel: 'Причина',
      noReason: 'Не указана',
      addSuccess: 'Перевозчик добавлен в чёрный список',
      removeSuccess: 'Перевозчик удалён из чёрного списка',
      confirmRemove: 'Удалить из чёрного списка?',
      confirmRemoveDescription: 'Этот перевозчик снова сможет отправлять вам предложения.',
      cancel: 'Отмена',
      error: 'Ошибка',
      carrierNotFound: 'Перевозчик не найден',
      alreadyInBlacklist: 'Перевозчик уже в чёрном списке',
      selectCarrier: 'Выберите перевозчика из списка',
      noResults: 'Ничего не найдено',
      loading: 'Загрузка...'
    },
    uz: {
      title: 'Qora ro\'yxat',
      description: 'Qora ro\'yxatdagi tashuvchilar sizga takliflar yubora olmaydi',
      empty: 'Qora ro\'yxat bo\'sh',
      searchPlaceholder: 'Tashuvchi IDsi yoki nomini kiriting',
      reason: 'Sabab (ixtiyoriy)',
      add: 'Qo\'shish',
      remove: 'O\'chirish',
      carrier: 'Tashuvchi',
      phone: 'Telefon',
      addedAt: 'Qo\'shilgan sana',
      reasonLabel: 'Sabab',
      noReason: 'Ko\'rsatilmagan',
      addSuccess: 'Tashuvchi qora ro\'yxatga qo\'shildi',
      removeSuccess: 'Tashuvchi qora ro\'yxatdan o\'chirildi',
      confirmRemove: 'Qora ro\'yxatdan o\'chirilsinmi?',
      confirmRemoveDescription: 'Bu tashuvchi yana sizga takliflar yuborishi mumkin.',
      cancel: 'Bekor qilish',
      error: 'Xato',
      carrierNotFound: 'Tashuvchi topilmadi',
      alreadyInBlacklist: 'Tashuvchi allaqachon qora ro\'yxatda',
      selectCarrier: 'Ro\'yxatdan tashuvchini tanlang',
      noResults: 'Hech narsa topilmadi',
      loading: 'Yuklanmoqda...'
    }
  };

  const t = texts[language];

  const { data: blacklist, isLoading } = useQuery<BlacklistEntry[]>({
    queryKey: ['/api/blacklist']
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<CarrierSearchResult[]>({
    queryKey: ['/api/carriers/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 1) return [];
      const response = await fetch(`/api/carriers/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: searchQuery.length >= 1
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addMutation = useMutation({
    mutationFn: async ({ carrierId, reason }: { carrierId: number; reason?: string }) => {
      return await apiRequest('POST', '/api/blacklist', { carrierId, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blacklist'] });
      setSearchQuery('');
      setSelectedCarrier(null);
      setReasonToAdd('');
      toast({ title: t.addSuccess });
    },
    onError: (error: any) => {
      const message = error?.message || t.error;
      if (message.includes('not found')) {
        toast({ title: t.carrierNotFound, variant: 'destructive' });
      } else if (message.includes('already')) {
        toast({ title: t.alreadyInBlacklist, variant: 'destructive' });
      } else {
        toast({ title: t.error, variant: 'destructive' });
      }
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (carrierId: number) => {
      return await apiRequest('DELETE', `/api/blacklist/${carrierId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blacklist'] });
      setCarrierToRemove(null);
      toast({ title: t.removeSuccess });
    },
    onError: () => {
      toast({ title: t.error, variant: 'destructive' });
    }
  });

  const handleSelectCarrier = (carrier: CarrierSearchResult) => {
    setSelectedCarrier(carrier);
    setSearchQuery(carrier.displayName || `ID: ${carrier.id}`);
    setShowDropdown(false);
  };

  const handleAddToBlacklist = () => {
    if (!selectedCarrier) {
      toast({ title: t.selectCarrier, variant: 'destructive' });
      return;
    }
    addMutation.mutate({ carrierId: selectedCarrier.id, reason: reasonToAdd || undefined });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedCarrier(null);
    setShowDropdown(true);
  };

  const formatDateWithTime = (dateString: string) => {
    return formatDate(dateString, true);
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-blacklist-title">{t.title}</h1>
          <p className="text-muted-foreground">{t.description}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative" ref={dropdownRef}>
                  <Input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchQuery && setShowDropdown(true)}
                    data-testid="input-carrier-search"
                  />
                  {showDropdown && searchQuery && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                      {isSearching ? (
                        <div className="p-3 text-center text-muted-foreground">
                          {t.loading}
                        </div>
                      ) : searchResults && searchResults.length > 0 ? (
                        searchResults.map((carrier) => (
                          <div
                            key={carrier.id}
                            className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => handleSelectCarrier(carrier)}
                            data-testid={`carrier-option-${carrier.id}`}
                          >
                            <div className="font-medium">
                              {carrier.displayName || `ID: ${carrier.id}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {carrier.id} | {carrier.phone}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-muted-foreground">
                          {t.noResults}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    placeholder={t.reason}
                    value={reasonToAdd}
                    onChange={(e) => setReasonToAdd(e.target.value)}
                    data-testid="input-blacklist-reason"
                  />
                </div>
                <Button 
                  onClick={handleAddToBlacklist}
                  disabled={addMutation.isPending || !selectedCarrier}
                  data-testid="button-add-to-blacklist"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {addMutation.isPending ? t.loading : t.add}
                </Button>
              </div>
              {selectedCarrier && (
                <div className="text-sm text-muted-foreground">
                  {language === 'ru' ? 'Выбран' : 'Tanlangan'}: <span className="font-medium">{selectedCarrier.displayName || `ID: ${selectedCarrier.id}`}</span> ({selectedCarrier.phone})
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : blacklist && blacklist.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {blacklist.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg"
                    data-testid={`blacklist-entry-${entry.carrierId}`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="font-medium" data-testid={`text-carrier-name-${entry.carrierId}`}>
                        {entry.carrier?.displayName || `${t.carrier} #${entry.carrierId}`}
                      </div>
                      {entry.carrier?.phone && (
                        <div className="text-sm text-muted-foreground">
                          {t.phone}: {entry.carrier.phone}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {t.reasonLabel}: {entry.reason || t.noReason}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.addedAt}: {formatDate(entry.createdAt)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCarrierToRemove(entry.carrierId)}
                      data-testid={`button-remove-${entry.carrierId}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t.remove}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-blacklist">
                {t.empty}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={carrierToRemove !== null} onOpenChange={(open) => !open && setCarrierToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmRemove}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmRemoveDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => carrierToRemove && removeMutation.mutate(carrierToRemove)}
              data-testid="button-confirm-remove"
            >
              {t.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
