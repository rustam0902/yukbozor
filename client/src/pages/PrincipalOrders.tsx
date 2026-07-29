import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Loader2, AlertTriangle, UserCheck, Plus, ChevronDown, ChevronUp, Edit, Trash2, Eye } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/utils';
import { formatDate } from '@/lib/dateFormat';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel } from '@shared/transport-types';
import { CreateOrderDialog, EditOrderDialog } from './CustomerDashboard';
import { OffersDialog } from '@/components/OffersDialog';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Order {
  id: number;
  title: string;
  originRegion: string;
  originDistrict: string[];
  destinationRegion: string;
  destinationDistrict: string[];
  transportType: string;
  weightTons: number;
  loadDate: string;
  loadTime?: string;
  priceWithVat: number;
  priceWithoutVat?: number;
  status: string;
  createdAt: string;
  notes?: string;
  isDangerous?: boolean;
  isNonStandard?: boolean;
  isPartialLoad?: boolean;
  deletedAt?: string | null;
}

export default function PrincipalOrders() {
  const { representativeMode, representativeModeEnabled, representativeModeInitialized } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Check representative permissions
  const permissions = representativeMode?.permissions || [];
  const canCreateOrder = permissions.includes('create_order');
  const canEditOwnOrders = permissions.includes('edit_own_orders');
  const canDeleteOwnOrders = permissions.includes('delete_own_orders');
  const canAcceptOffer = permissions.includes('accept_offer');
  const canRejectOffer = permissions.includes('reject_offer');

  const texts = {
    ru: {
      title: 'Заказы доверителей',
      description: 'Заказы, созданные вами от имени организации',
      selectPrincipal: 'Выберите доверителя',
      selectPrincipalDesc: 'Перейдите в раздел "Мои доверители" и активируйте работу от имени организации',
      goToPrincipals: 'Мои доверители',
      currentPrincipal: 'Текущий доверитель',
      noOrders: 'Нет заказов',
      noOrdersDesc: 'Вы ещё не создавали заказов от имени этой организации',
      loading: 'Загрузка...',
      modeDisabled: 'Режим представителя отключён',
      enableInProfile: 'Включите режим представителя в настройках профиля',
      goToProfile: 'Перейти в профиль',
      createOrder: 'Создать заказ',
      orderNumber: 'Номер',
      from: 'Откуда',
      to: 'Куда',
      transportType: 'Тип транспорта',
      cargo: 'Груз',
      loadDateTime: 'Дата и время',
      startPrice: 'Цена',
      status: 'Статус',
      details: 'Подробнее',
      edit: 'Редактировать',
      delete: 'Удалить',
      viewOffers: 'Предложения',
      notes: 'Примечания',
      dangerous: 'Опасный груз',
      nonStandard: 'Негабарит',
      partialLoad: 'Частичная загрузка',
      priceWithVat: 'Цена с НДС',
      priceWithoutVat: 'Цена без НДС',
      weight: 'Вес',
      tons: 'т',
      deleteConfirm: 'Удалить заказ?',
      deleteConfirmDesc: 'Заказ будет удалён. Это действие нельзя отменить.',
      cancel: 'Отмена',
      confirmDelete: 'Удалить',
      orderDeleted: 'Заказ удалён',
      orderDeletedDesc: 'Заказ успешно удалён',
      deleteError: 'Ошибка',
      deleteErrorDesc: 'Не удалось удалить заказ',
      statuses: {
        new: 'Новый',
        active: 'Активный',
        assigned: 'Назначен',
        in_progress: 'В процессе',
        completed: 'Завершён',
        cancelled: 'Отменён',
      }
    },
    uz: {
      title: 'Ishonch beruvchilar buyurtmalari',
      description: 'Tashkilot nomidan siz yaratgan buyurtmalar',
      selectPrincipal: 'Ishonch beruvchini tanlang',
      selectPrincipalDesc: '"Ishonch beruvchilarim" bo\'limiga o\'ting va tashkilot nomidan ishlashni faollashtiring',
      goToPrincipals: 'Ishonch beruvchilarim',
      currentPrincipal: 'Joriy ishonch beruvchi',
      noOrders: 'Buyurtmalar yo\'q',
      noOrdersDesc: 'Siz hali bu tashkilot nomidan buyurtma yaratmagansiz',
      loading: 'Yuklanmoqda...',
      modeDisabled: 'Vakil rejimi o\'chirilgan',
      enableInProfile: 'Profil sozlamalarida vakil rejimini yoqing',
      goToProfile: 'Profilga o\'tish',
      createOrder: 'Buyurtma yaratish',
      orderNumber: 'Raqam',
      from: 'Qayerdan',
      to: 'Qayerga',
      transportType: 'Transport turi',
      cargo: 'Yuk',
      loadDateTime: 'Sana va vaqt',
      startPrice: 'Narx',
      status: 'Holat',
      details: 'Batafsil',
      edit: 'Tahrirlash',
      delete: 'O\'chirish',
      viewOffers: 'Takliflar',
      notes: 'Izohlar',
      dangerous: 'Xavfli yuk',
      nonStandard: 'Nostandart',
      partialLoad: 'Qisman yuklash',
      priceWithVat: 'QQS bilan narx',
      priceWithoutVat: 'QQS siz narx',
      weight: 'Og\'irligi',
      tons: 't',
      deleteConfirm: 'Buyurtmani o\'chirish?',
      deleteConfirmDesc: 'Buyurtma o\'chiriladi. Bu amalni bekor qilib bo\'lmaydi.',
      cancel: 'Bekor qilish',
      confirmDelete: 'O\'chirish',
      orderDeleted: 'Buyurtma o\'chirildi',
      orderDeletedDesc: 'Buyurtma muvaffaqiyatli o\'chirildi',
      deleteError: 'Xato',
      deleteErrorDesc: 'Buyurtmani o\'chirib bo\'lmadi',
      statuses: {
        new: 'Yangi',
        active: 'Faol',
        assigned: 'Tayinlangan',
        in_progress: 'Jarayonda',
        completed: 'Yakunlangan',
        cancelled: 'Bekor qilingan',
      }
    }
  };
  const t = texts[language];

  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ['/api/representatives/principal-orders', { customerId: representativeMode?.customerId }],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch('/api/representatives/principal-orders', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to fetch principal orders');
      }
      return res.json();
    },
    enabled: representativeModeEnabled && representativeMode?.active && !!representativeMode?.customerId,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Accept-Language': language,
      };
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete order');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'], exact: false });
      toast({
        title: t.orderDeleted,
        description: t.orderDeletedDesc,
      });
      setOrderToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: t.deleteError,
        description: error.message || t.deleteErrorDesc,
        variant: 'destructive',
      });
    },
  });

  if (!representativeModeInitialized) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center" data-testid="page-principal-orders-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!representativeModeEnabled) {
    return (
      <div className="container mx-auto p-6" data-testid="page-principal-orders-disabled">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
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
      <div className="container mx-auto p-6" data-testid="page-principal-orders-no-principal">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
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
      <div className="container mx-auto p-6" data-testid="page-principal-orders-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
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

  const getStatusBadge = (status: string, deletedAt?: string | null) => {
    if (deletedAt) {
      return <Badge variant="secondary">{language === 'ru' ? 'Удалён' : 'O\'chirilgan'}</Badge>;
    }
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      new: { variant: 'outline', label: t.statuses.new },
      active: { variant: 'default', label: t.statuses.active },
      assigned: { variant: 'default', label: t.statuses.assigned },
      in_progress: { variant: 'secondary', label: t.statuses.in_progress },
      completed: { variant: 'secondary', label: t.statuses.completed },
      cancelled: { variant: 'destructive', label: t.statuses.cancelled },
    };
    const statusInfo = statusMap[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const toggleExpand = (orderId: number) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const formatDateTime = (dateStr: string, timeStr?: string) => {
    try {
      return timeStr ? `${formatDate(dateStr)} ${timeStr}` : formatDate(dateStr);
    } catch {
      return timeStr ? `${dateStr} ${timeStr}` : dateStr;
    }
  };

  const handleConfirmDelete = () => {
    if (orderToDelete !== null) {
      deleteOrderMutation.mutate(orderToDelete);
    }
  };

  return (
    <div className="container mx-auto p-6" data-testid="page-principal-orders">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t.title}
              </CardTitle>
              <CardDescription className="mt-1">{t.description}</CardDescription>
            </div>
            {canCreateOrder && (
              <Button 
                className="gap-2" 
                onClick={() => setCreateOrderOpen(true)}
                data-testid="button-create-principal-order"
              >
                <Plus className="h-4 w-4" />
                {t.createOrder}
              </Button>
            )}
          </div>
          <div className="mt-2 p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <span className="font-medium text-primary">
              {t.currentPrincipal}: {representativeMode?.companyName || representativeMode?.customerName}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{t.noOrders}</p>
              <p className="text-sm mt-2">{t.noOrdersDesc}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div 
                  key={order.id} 
                  className="border rounded-lg overflow-hidden"
                  data-testid={`card-order-${order.id}`}
                >
                  {/* Compact row */}
                  <div 
                    className="p-4 cursor-pointer hover-elevate flex items-center justify-between gap-4"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <div className="flex items-center gap-4 flex-wrap min-w-0">
                      <span className="font-medium text-sm">#{order.id}</span>
                      <span className="text-sm truncate max-w-[200px]">{order.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {getRegionDisplayName(order.originRegion, language)} → {getRegionDisplayName(order.destinationRegion, language)}
                      </span>
                      <span className="text-sm">{formatDate(order.loadDate)}</span>
                      <span className="font-medium">{formatMoney(order.priceWithVat)}</span>
                      {getStatusBadge(order.status, order.deletedAt)}
                    </div>
                    <Button variant="ghost" size="icon">
                      {expandedOrderId === order.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Expanded details */}
                  {expandedOrderId === order.id && (
                    <div className="px-4 pb-4 border-t bg-muted/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.from}</h4>
                          <p className="text-sm">
                            {getRegionDisplayName(order.originRegion, language)}
                            {order.originDistrict?.length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}({order.originDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.to}</h4>
                          <p className="text-sm">
                            {getRegionDisplayName(order.destinationRegion, language)}
                            {order.destinationDistrict?.length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}({order.destinationDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.transportType}</h4>
                          <p className="text-sm">{getTransportTypeLabel(order.transportType, language)}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.weight}</h4>
                          <p className="text-sm">{order.weightTons} {t.tons}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.loadDateTime}</h4>
                          <p className="text-sm">{formatDateTime(order.loadDate, order.loadTime)}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.priceWithVat}</h4>
                          <p className="text-sm">{formatMoney(order.priceWithVat)}</p>
                          {order.priceWithoutVat && (
                            <p className="text-xs text-muted-foreground">
                              {t.priceWithoutVat}: {formatMoney(order.priceWithoutVat)}
                            </p>
                          )}
                        </div>
                        {order.notes && (
                          <div className="md:col-span-2">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t.notes}</h4>
                            <p className="text-sm">{order.notes}</p>
                          </div>
                        )}
                        {(order.isDangerous || order.isNonStandard || order.isPartialLoad) && (
                          <div className="md:col-span-2 flex gap-2 flex-wrap">
                            {order.isDangerous && <Badge variant="destructive">{t.dangerous}</Badge>}
                            {order.isNonStandard && <Badge variant="secondary">{t.nonStandard}</Badge>}
                            {order.isPartialLoad && <Badge variant="outline">{t.partialLoad}</Badge>}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap pt-2 border-t">
                        {order.status === 'new' && canAcceptOffer && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderId(order.id);
                            }}
                            data-testid={`button-view-offers-${order.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {t.viewOffers}
                          </Button>
                        )}
                        {order.status === 'new' && canEditOwnOrders && !order.deletedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToEdit(order);
                            }}
                            data-testid={`button-edit-order-${order.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            {t.edit}
                          </Button>
                        )}
                        {order.status === 'new' && canDeleteOwnOrders && !order.deletedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToDelete(order.id);
                            }}
                            data-testid={`button-delete-order-${order.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {t.delete}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <CreateOrderDialog
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        language={language}
      />

      <EditOrderDialog
        open={!!orderToEdit}
        onOpenChange={(open) => !open && setOrderToEdit(null)}
        language={language}
        order={orderToEdit}
        onSuccess={() => {
          setOrderToEdit(null);
          queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-orders'], exact: false });
        }}
      />

      <OffersDialog
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        language={language}
        canAccept={canAcceptOffer}
        canReject={canRejectOffer}
      />

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>{t.confirmDelete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
