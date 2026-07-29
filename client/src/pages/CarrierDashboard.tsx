import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from '@/components/AppSidebar';
import Header from '@/components/Header';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OrderCard from '@/components/OrderCard';
import CarrierOrdersTable from '@/components/CarrierOrdersTable';
import { Search, Filter, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useOrders, useDeposit, useAllDeposits, useCreateOffer, useWithdrawOffer, useUpdateOffer } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/language-context';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel } from '@shared/transport-types';
import { carrierSectionResolver, type CarrierSection } from '@/lib/carrierSections';
import { DashboardSectionError } from '@/components/DashboardSectionError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from '@tanstack/react-query';
import { ContractViewer } from '@/components/ContractViewer';
import { ContractsTable } from '@/components/ContractsTable';
import { Deposit } from '@/components/Deposit';
import { ProfileView } from '@/components/ProfileView';
import { Documents } from '@/components/Documents';
import TableSearchFilter, { FilterState, filterData } from '@/components/TableSearchFilter';
import Pagination, { paginateData } from '@/components/Pagination';
import { formatAmountWithSpaces, parseFormattedAmount } from '@/lib/number-to-words';

interface CarrierDashboardMainProps {
  language: 'ru' | 'uz';
  setLanguage: (lang: 'ru' | 'uz') => void;
  user: any;
  renderContent: () => JSX.Element;
}

function CarrierDashboardMain({ language, setLanguage, user, renderContent }: CarrierDashboardMainProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        userRole={user.roles}
        currentRole="carrier"
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

interface CarrierDashboardProps {
  section?: string;
}

export default function CarrierDashboard({ section }: CarrierDashboardProps) {
  const { language, setLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: orders, isLoading: ordersLoading } = useOrders('carrier');
  const { data: deposit, isLoading: depositLoading } = useDeposit();
  const resolvedSection = carrierSectionResolver.resolveSection(section);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.roles.includes('carrier')) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

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
        validSections={carrierSectionResolver.sections}
        dashboardPath="/carrier"
        dashboardName="Carrier Dashboard"
      />
    );
  }

  const activeSection = resolvedSection || 'home';

  const style = {
    "--sidebar-width": "16rem",
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
      case 'orders':
        return <AvailableOrders language={language} orders={orders} ordersLoading={ordersLoading} deposit={deposit} userId={user.id} isNdsPayer={user.ndsPayer || false} />;
      case 'offers':
        return <MyOffers language={language} />;
      case 'contracts':
        return <Contracts language={language} />;
      case 'documents':
        return <Documents language={language} role="carrier" />;
      case 'deposit':
        return <Deposit language={language} />;
      case 'profile':
        return <Profile language={language} />;
      default:
        return <AvailableOrders language={language} orders={orders} ordersLoading={ordersLoading} deposit={deposit} userId={user.id} isNdsPayer={user.ndsPayer || false} />;
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          role="carrier" 
          language={language} 
          activePath={activeSection === 'home' || activeSection === 'orders' ? '/carrier' : `/carrier/${activeSection}`}
          onNavigate={(path) => setLocation(path)}
        />
        <CarrierDashboardMain 
          language={language}
          setLanguage={setLanguage}
          user={user}
          renderContent={renderContent}
        />
      </div>
    </SidebarProvider>
  );
}

function AvailableOrders({ language, orders, ordersLoading, deposit, userId, isNdsPayer }: { language: 'ru' | 'uz'; orders: any; ordersLoading: boolean; deposit?: { balance: number; blocked: number }; userId: number; isNdsPayer: boolean }) {
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [editOfferDialogOpen, setEditOfferDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
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
  
  // Fetch carrier's offers to check which orders already have offers
  const { data: myOffers } = useQuery<any[]>({
    queryKey: ['/api/offers/my'],
  });
  
  // Create a map of orderId -> offer for quick lookup
  const offersByOrderId = (myOffers || []).reduce((acc: Record<number, any>, offer: any) => {
    if (offer.status === 'active') {
      acc[offer.orderId] = offer;
    }
    return acc;
  }, {});
  
  const texts = {
    ru: {
      availableOrders: 'Доступные заказы',
      noOrders: 'Нет доступных заказов'
    },
    uz: {
      availableOrders: 'Mavjud buyurtmalar',
      noOrders: 'Mavjud buyurtmalar yo\'q'
    }
  };

  const t = texts[language as 'ru' | 'uz'];
  const availableOrders = orders?.filter((o: any) => o.status === 'new') || [];
  
  const getSearchableText = (order: any) => {
    const originRegionName = getRegionDisplayName(order.originRegion, language);
    const originDistrictName = order.originDistrict ? getDistrictDisplayName(order.originRegion, order.originDistrict, language) : '';
    const destRegionName = getRegionDisplayName(order.destinationRegion, language);
    const destDistrictName = order.destinationDistrict ? getDistrictDisplayName(order.destinationRegion, order.destinationDistrict, language) : '';
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

  // First apply standard filters
  let filteredAvailableOrders = filterData(
    availableOrders,
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
    undefined,
    (order: any) => order.priceWithVat || 0,
    (order: any) => {
      const regions: string[] = [];
      if (order.destinationPoints && order.destinationPoints.length > 0) {
        order.destinationPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order.destinationRegion) {
        regions.push(order.destinationRegion);
      }
      return regions;
    }
  );
  
  // Then apply offer status filter
  if (filters.offerStatus && filters.offerStatus !== 'all') {
    if (filters.offerStatus === 'offered') {
      filteredAvailableOrders = filteredAvailableOrders.filter((order: any) => offersByOrderId[order.id]);
    } else if (filters.offerStatus === 'not_offered') {
      filteredAvailableOrders = filteredAvailableOrders.filter((order: any) => !offersByOrderId[order.id]);
    }
  }

  // Sort by expiresAt ascending (orders expiring soonest first)
  filteredAvailableOrders = filteredAvailableOrders.sort((a: any, b: any) => {
    if (!a.expiresAt && !b.expiresAt) return 0;
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
  });

  const paginatedOrders = paginateData(filteredAvailableOrders, currentPage, pageSize);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSubmitOffer = (order: any) => {
    setSelectedOrder(order);
    setOfferDialogOpen(true);
  };

  const handleEditOffer = (order: any, offer: any) => {
    setSelectedOrder(order);
    setSelectedOffer(offer);
    setEditOfferDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{t.availableOrders}</h1>

        <TableSearchFilter
          language={language}
          onFilterChange={handleFilterChange}
          showRegionFilter={true}
          showTransportFilter={true}
          showDateFilter={true}
          showOfferStatusFilter={true}
          showPriceFilter={true}
          storageKey={`carrier_orders_filter_${userId}`}
        />

        <div className="space-y-4">
          {ordersLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : filteredAvailableOrders.length > 0 ? (
            <>
              <CarrierOrdersTable
                orders={paginatedOrders}
                language={language}
                offersByOrderId={offersByOrderId}
                onSubmitOffer={handleSubmitOffer}
                onEditOffer={handleEditOffer}
              />
              <Pagination
                language={language}
                totalItems={filteredAvailableOrders.length}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {t.noOrders}
            </div>
          )}
        </div>

        {selectedOrder && (
          <SubmitOfferDialog
            isOpen={offerDialogOpen}
            onClose={() => {
              setOfferDialogOpen(false);
              setSelectedOrder(null);
            }}
            orderId={selectedOrder.id}
            orderTitle={selectedOrder.title}
            orderPrice={selectedOrder.priceWithVat}
            requiresCollateral={selectedOrder.requiresCollateral}
            language={language}
            deposit={deposit}
            userId={userId}
            isNdsPayer={isNdsPayer}
          />
        )}

        {selectedOrder && selectedOffer && (
          <EditOfferDialog
            isOpen={editOfferDialogOpen}
            onClose={() => {
              setEditOfferDialogOpen(false);
              setSelectedOrder(null);
              setSelectedOffer(null);
            }}
            offerId={selectedOffer.id}
            currentPrice={selectedOffer.price}
            orderTitle={selectedOrder.title}
            language={language}
            isNdsPayer={isNdsPayer}
          />
        )}
      </div>
    </div>
  );
}

function MyOffers({ language }: { language: 'ru' | 'uz' }) {
  const { data: offers, isLoading } = useQuery<any[]>({
    queryKey: ['/api/offers/my'],
  });
  const withdrawOfferMutation = useWithdrawOffer();
  const { toast } = useToast();
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
      myOffers: 'Мои предложения',
      noOffers: 'Нет предложений',
      order: 'Заказ',
      orderNumber: 'Номер заявки',
      price: 'Цена',
      status: 'Статус',
      pending: 'В ожидании',
      accepted: 'Принято',
      rejected: 'Отклонено',
      withdrawn: 'Отозвано',
      withdraw: 'Отозвать',
      withdrawSuccess: 'Предложение успешно отозвано',
      withdrawError: 'Ошибка при отзыве предложения'
    },
    uz: {
      myOffers: 'Mening takliflarim',
      noOffers: 'Takliflar yo\'q',
      order: 'Buyurtma',
      orderNumber: 'Buyurtma raqami',
      price: 'Narx',
      status: 'Holat',
      pending: 'Kutilmoqda',
      accepted: 'Qabul qilindi',
      rejected: 'Rad etildi',
      withdrawn: 'Qaytarilgan',
      withdraw: 'Qaytarish',
      withdrawSuccess: 'Taklif muvaffaqiyatli qaytarildi',
      withdrawError: 'Taklif qaytarishda xatolik'
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted': return t.accepted;
      case 'rejected': return t.rejected;
      case 'withdrawn': return t.withdrawn;
      case 'active': return t.pending;
      default: return t.pending;
    }
  };

  const handleWithdraw = async (offerId: number) => {
    try {
      await withdrawOfferMutation.mutateAsync(offerId);
      toast({
        title: t.withdrawSuccess,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.withdrawError,
        description: error.message || t.withdrawError,
      });
    }
  };

  const getOfferSearchableText = (offer: any) => {
    const order = offer.order;
    if (!order) return `${offer.id}`;
    
    const originRegionName = getRegionDisplayName(order.originRegion, language);
    const originDistrictName = order.originDistrict ? getDistrictDisplayName(order.originRegion, order.originDistrict, language) : '';
    const destRegionName = getRegionDisplayName(order.destinationRegion, language);
    const destDistrictName = order.destinationDistrict ? getDistrictDisplayName(order.destinationRegion, order.destinationDistrict, language) : '';
    const transportTypeName = order.transportType ? getTransportTypeLabel(order.transportType, language) : '';
    
    return [
      offer.id,
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
      offer.price ? `${offer.price}` : ''
    ].filter(Boolean).join(' ');
  };

  const filteredOffers = offers ? filterData(
    offers,
    filters,
    getOfferSearchableText,
    (offer: any) => {
      const order = offer.order;
      const regions: string[] = [];
      if (order?.originPoints && order.originPoints.length > 0) {
        order.originPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order?.originRegion) {
        regions.push(order.originRegion);
      }
      return regions;
    },
    (offer: any) => offer.order?.transportType || '',
    (offer: any) => offer.createdAt || '',
    (offer: any) => offer.status,
    undefined,
    (offer: any) => {
      const order = offer.order;
      const regions: string[] = [];
      if (order?.destinationPoints && order.destinationPoints.length > 0) {
        order.destinationPoints.forEach((p: any) => p.region && regions.push(p.region));
      } else if (order?.destinationRegion) {
        regions.push(order.destinationRegion);
      }
      return regions;
    }
  ) : [];

  const paginatedOffers = paginateData(filteredOffers, currentPage, pageSize);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const offerStatusOptions = language === 'ru'
    ? [
        { value: 'active', label: 'В ожидании' },
        { value: 'accepted', label: 'Принято' },
        { value: 'rejected', label: 'Отклонено' },
        { value: 'withdrawn', label: 'Отозвано' }
      ]
    : [
        { value: 'active', label: 'Kutilmoqda' },
        { value: 'accepted', label: 'Qabul qilindi' },
        { value: 'rejected', label: 'Rad etildi' },
        { value: 'withdrawn', label: 'Qaytarilgan' }
      ];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold" data-testid="heading-my-offers">{t.myOffers}</h1>
        
        <TableSearchFilter
          language={language}
          onFilterChange={handleFilterChange}
          showRegionFilter={true}
          showStatusFilter={true}
          statusOptions={offerStatusOptions}
        />
        
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : filteredOffers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-offers">
                {t.noOffers}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {paginatedOffers.map((offer: any) => (
              <Card key={offer.id} data-testid={`card-offer-${offer.id}`}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <Link href={`/offer/${offer.id}`}>
                          <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" data-testid={`text-order-title-${offer.id}`}>
                            <span className="text-muted-foreground font-normal">{t.orderNumber} {offer.orderId}</span>{' · '}
                            {offer.order?.title || `${t.order}`}
                          </h3>
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {getRegionDisplayName(offer.order?.originRegion, language as 'ru' | 'uz')} → {getRegionDisplayName(offer.order?.destinationRegion, language as 'ru' | 'uz')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={offer.status === 'accepted' ? 'default' : offer.status === 'rejected' ? 'destructive' : offer.status === 'withdrawn' ? 'secondary' : 'default'}
                          data-testid={`badge-offer-status-${offer.id}`}
                        >
                          {getStatusText(offer.status)}
                        </Badge>
                        {offer.status === 'active' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleWithdraw(offer.id)}
                            disabled={withdrawOfferMutation.isPending}
                            data-testid={`button-withdraw-offer-${offer.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {t.withdraw}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.price}: </span>
                        <span className="font-semibold" data-testid={`text-offer-price-${offer.id}`}>
                          {formatMoney(offer.price)} UZS
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Pagination
              language={language}
              totalItems={filteredOffers.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Contracts({ language }: { language: 'ru' | 'uz' }) {
  return <ContractsTable language={language} userRole="carrier" />;
}

function Profile({ language }: { language: 'ru' | 'uz' }) {
  return <ProfileView language={language} />;
}

interface SubmitOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderTitle: string;
  orderPrice: number;
  requiresCollateral?: boolean;
  language: 'ru' | 'uz';
  deposit?: { balance: number; blocked: number };
  userId: number;
  isNdsPayer: boolean;
}

function SubmitOfferDialog({ isOpen, onClose, orderId, orderTitle, orderPrice, requiresCollateral = false, language, deposit, userId, isNdsPayer }: SubmitOfferDialogProps) {
  const [price, setPrice] = useState('');
  const { toast } = useToast();
  const createOfferMutation = useCreateOffer();
  const { data: deposits } = useAllDeposits();
  
  const mainDeposit = deposits?.find(d => d.accountType === 'main');
  const bonusDeposit = deposits?.find(d => d.accountType === 'registration_bonus');

  const texts = {
    ru: {
      submitOffer: 'Отправить предложение',
      offerFor: 'Предложение для',
      enterPrice: 'Введите вашу цену',
      priceLabel: 'Цена с НДС (сум)',
      priceWithoutVat: 'Цена без НДС',
      collateral: 'Залог (2%)',
      commission: 'Комиссия платформы (2%)',
      totalBlocked: 'Итого блокируется',
      cancel: 'Отмена',
      submit: 'Отправить',
      success: 'Предложение успешно отправлено',
      error: 'Ошибка при отправке предложения',
      insufficientFunds: 'Недостаточно средств на депозите',
      blacklisted: 'Вы не можете отправить предложение, так как находитесь в чёрном списке заказчика',
      sum: 'сум'
    },
    uz: {
      submitOffer: 'Taklif yuborish',
      offerFor: 'Taklif',
      enterPrice: 'Narxingizni kiriting',
      priceLabel: 'QQS bilan narx (so\'m)',
      priceWithoutVat: 'QQSsiz narx',
      collateral: 'Garov (2%)',
      commission: 'Platforma komissiyasi (2%)',
      totalBlocked: 'Jami bloklanadi',
      cancel: 'Bekor qilish',
      submit: 'Yuborish',
      success: 'Taklif muvaffaqiyatli yuborildi',
      error: 'Taklif yuborishda xatolik',
      insufficientFunds: 'Depozitda mablag\' yetarli emas',
      blacklisted: 'Siz taklif yubora olmaysiz, chunki buyurtmachining qora ro\'yxatidasiz',
      sum: 'so\'m'
    }
  };

  const t = texts[language];
  
  // Calculate price without VAT based on carrier's VAT payer status (returns string with 2 decimals for tiyin)
  const calculatePriceWithoutVat = (priceWithVat: number): string => {
    if (isNdsPayer) {
      // VAT payer: price without VAT = price with VAT / 1.12
      return (priceWithVat / 1.12).toFixed(2);
    } else {
      // Not VAT payer: price without VAT = price with VAT
      return priceWithVat.toFixed(2);
    }
  };

  const handleSubmit = async () => {
    const priceValue = parseFloat(price.replace(',', '.'));
    if (!priceValue || priceValue <= 0 || isNaN(priceValue)) {
      toast({
        variant: "destructive",
        title: t.error,
        description: t.enterPrice
      });
      return;
    }

    // Calculate required blocks: collateral 2% from ORDER price (if required) + commission 2% from OFFER price
    const collateralBlock = requiresCollateral ? Math.floor(orderPrice * 0.02) : 0;
    const commissionBlock = Math.floor(priceValue * 0.02);
    
    const mainBalance = mainDeposit ? (mainDeposit.balance || 0) : 0;
    const bonusBalance = bonusDeposit ? (bonusDeposit.balance || 0) : 0;
    
    const canUseBonusForCommission = bonusBalance >= commissionBlock;
    const mainRequired = canUseBonusForCommission ? collateralBlock : (collateralBlock + commissionBlock);
    const totalAvailable = mainBalance + bonusBalance;

    // Check if user has sufficient funds
    if (mainRequired > 0 && mainBalance < mainRequired) {
      toast({
        variant: "destructive",
        title: t.insufficientFunds,
        description: `${language === 'ru' ? 'Требуется' : 'Kerak'}: ${formatMoney(collateralBlock + commissionBlock)} ${t.sum}, ${language === 'ru' ? 'доступно' : 'mavjud'}: ${formatMoney(totalAvailable)} ${t.sum}`
      });
      return;
    }

    try {
      const priceWithoutVatStr = calculatePriceWithoutVat(priceValue);
      await createOfferMutation.mutateAsync({
        orderId,
        data: { 
          price: priceValue.toString(),
          priceWithoutVat: priceWithoutVatStr,
          carrierId: userId
        }
      });
      
      toast({
        title: t.success,
      });
      setPrice('');
      onClose();
    } catch (error: any) {
      const errorMessage = error.message || '';
      let isBlacklisted = false;
      
      // Try to parse JSON from error message (format: "403: {...}")
      const jsonMatch = errorMessage.match(/^\d+:\s*(.+)$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.error === 'BLACKLISTED') {
            isBlacklisted = true;
          }
        } catch {}
      }
      
      // Fallback checks
      if (!isBlacklisted) {
        isBlacklisted = errorMessage.toUpperCase().includes('BLACKLISTED') || 
                        errorMessage.toLowerCase().includes('черн');
      }
      
      toast({
        variant: "destructive",
        title: isBlacklisted ? t.blacklisted : t.error,
        description: isBlacklisted ? undefined : errorMessage
      });
    }
  };

  const priceValue = price ? parseFormattedAmount(price) : 0;
  // Collateral is calculated from ORDER price, not offer price
  const collateral = requiresCollateral ? Math.floor(orderPrice * 0.02) : 0;
  // Commission is calculated from OFFER price
  const commission = priceValue ? Math.floor(priceValue * 0.02) : 0;
  const totalBlocked = collateral + commission;
  const priceWithoutVatStr = priceValue ? calculatePriceWithoutVat(priceValue) : '0.00';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-submit-offer">
        <DialogHeader>
          <DialogTitle>{t.submitOffer}</DialogTitle>
          <DialogDescription>
            {t.offerFor}: {orderTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offer-price">{t.priceLabel}</Label>
            <Input
              id="offer-price"
              type="text"
              placeholder="1 000 000.00"
              value={formatAmountWithSpaces(price)}
              onChange={(e) => {
                // Allow digits, comma, and period for decimal (tiyin) input
                const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                // Only keep one decimal point, max 2 decimal places
                const parts = cleaned.split('.');
                const formatted = parts.length > 1 
                  ? parts[0] + '.' + parts.slice(1).join('').slice(0, 2)
                  : parts[0];
                setPrice(formatted);
              }}
              data-testid="input-offer-price"
            />
          </div>
          {price && parseFormattedAmount(price) > 0 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t.priceWithoutVat}:</span>
                <span className="font-medium" data-testid="text-price-without-vat">{formatMoney(priceWithoutVatStr)} {t.sum}</span>
              </div>
              <div className="border-t pt-2 space-y-1">
                {requiresCollateral && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.collateral}:</span>
                    <span className="font-medium text-orange-600">{formatMoney(collateral)} {t.sum}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.commission}:</span>
                  <span className="font-medium text-orange-600">{formatMoney(commission)} {t.sum}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>{t.totalBlocked}:</span>
                  <span className="text-red-600" data-testid="text-total-blocked">{formatMoney(totalBlocked)} {t.sum}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-offer"
          >
            {t.cancel}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createOfferMutation.isPending}
            data-testid="button-confirm-offer"
          >
            {createOfferMutation.isPending ? '...' : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: number;
  currentPrice: number;
  orderTitle: string;
  language: 'ru' | 'uz';
  isNdsPayer: boolean;
}

function EditOfferDialog({ isOpen, onClose, offerId, currentPrice, orderTitle, language, isNdsPayer }: EditOfferDialogProps) {
  const [price, setPrice] = useState(currentPrice.toString());
  const { toast } = useToast();
  const updateOfferMutation = useUpdateOffer();

  const texts = {
    ru: {
      editOffer: 'Изменить предложение',
      offerFor: 'Предложение для',
      enterPrice: 'Введите новую цену',
      priceLabel: 'Цена с НДС (сум)',
      priceWithoutVat: 'Цена без НДС',
      currentPrice: 'Текущая цена',
      commission: 'Комиссия платформы (2%)',
      cancel: 'Отмена',
      save: 'Сохранить',
      success: 'Предложение успешно изменено',
      error: 'Ошибка при изменении предложения',
      sum: 'сум'
    },
    uz: {
      editOffer: 'Taklifni o\'zgartirish',
      offerFor: 'Taklif',
      enterPrice: 'Yangi narxni kiriting',
      priceLabel: 'QQS bilan narx (so\'m)',
      priceWithoutVat: 'QQSsiz narx',
      currentPrice: 'Joriy narx',
      commission: 'Platforma komissiyasi (2%)',
      cancel: 'Bekor qilish',
      save: 'Saqlash',
      success: 'Taklif muvaffaqiyatli o\'zgartirildi',
      error: 'Taklif o\'zgartirishda xatolik',
      sum: 'so\'m'
    }
  };

  const t = texts[language];
  
  // Calculate price without VAT based on carrier's VAT payer status (returns string with 2 decimals for tiyin)
  const calculatePriceWithoutVat = (priceWithVat: number): string => {
    if (isNdsPayer) {
      return (priceWithVat / 1.12).toFixed(2);
    } else {
      return priceWithVat.toFixed(2);
    }
  };

  const handleSubmit = async () => {
    const priceValue = parseFloat(price.replace(',', '.'));
    if (!priceValue || priceValue <= 0 || isNaN(priceValue)) {
      toast({
        variant: "destructive",
        title: t.error,
        description: t.enterPrice
      });
      return;
    }

    try {
      const priceWithoutVatStr = calculatePriceWithoutVat(priceValue);
      await updateOfferMutation.mutateAsync({
        offerId,
        data: { 
          price: priceValue.toString(),
          priceWithoutVat: priceWithoutVatStr
        }
      });
      
      toast({
        title: t.success,
      });
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.error,
        description: error.message || t.error
      });
    }
  };

  const priceValue = price ? parseFormattedAmount(price) : 0;
  const commission = priceValue ? Math.floor(priceValue * 0.02) : 0;
  const priceWithoutVatStr = priceValue ? calculatePriceWithoutVat(priceValue) : '0.00';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-edit-offer">
        <DialogHeader>
          <DialogTitle>{t.editOffer}</DialogTitle>
          <DialogDescription>
            {t.offerFor}: {orderTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t.currentPrice}: <span className="font-medium">{formatMoney(currentPrice)} {t.sum}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-offer-price">{t.priceLabel}</Label>
            <Input
              id="edit-offer-price"
              type="text"
              placeholder="1 000 000.00"
              value={formatAmountWithSpaces(price)}
              onChange={(e) => {
                // Allow digits, comma, and period for decimal (tiyin) input
                const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                // Only keep one decimal point, max 2 decimal places
                const parts = cleaned.split('.');
                const formatted = parts.length > 1 
                  ? parts[0] + '.' + parts.slice(1).join('').slice(0, 2)
                  : parts[0];
                setPrice(formatted);
              }}
              data-testid="input-edit-offer-price"
            />
          </div>
          {price && parseFormattedAmount(price) > 0 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t.priceWithoutVat}:</span>
                <span className="font-medium" data-testid="text-edit-price-without-vat">{formatMoney(priceWithoutVatStr)} {t.sum}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t.commission}:</span>
                <span className="font-medium text-orange-600">{formatMoney(commission)} {t.sum}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-edit-offer"
          >
            {t.cancel}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateOfferMutation.isPending || priceValue === currentPrice}
            data-testid="button-confirm-edit-offer"
          >
            {updateOfferMutation.isPending ? '...' : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

