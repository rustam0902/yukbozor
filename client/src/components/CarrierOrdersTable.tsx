import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, MapPin, Package, Calendar, Clock, Truck, AlertTriangle, Layers, Flame } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { formatDate } from '@/lib/dateFormat';
import { getRegionDisplayName, getDistrictDisplayNameWithRegion } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel } from '@shared/transport-types';
import CountdownTimer from '@/components/CountdownTimer';

interface LocationPoint {
  region: string;
  districts: string[];
}

interface ExistingOffer {
  id: number;
  price: number;
  status: string;
}

interface Order {
  id: number;
  title: string;
  originRegion: string;
  originDistrict: string | string[];
  destinationRegion: string;
  destinationDistrict: string | string[];
  originPoints?: LocationPoint[];
  destinationPoints?: LocationPoint[];
  transportType: string;
  weightTons: number;
  loadDate: string;
  loadingTime?: string;
  priceWithVat: number;
  priceWithoutVat?: number;
  notes?: string;
  status: 'new' | 'assigned' | 'completed' | 'cancelled';
  expiresAt?: string | null;
  isDangerous?: boolean;
  isNonstandard?: boolean;
  isPartialLoad?: boolean;
}

interface CarrierOrdersTableProps {
  orders: Order[];
  language: 'ru' | 'uz';
  offersByOrderId: Record<number, ExistingOffer>;
  onSubmitOffer: (order: Order) => void;
  onEditOffer: (order: Order, offer: ExistingOffer) => void;
}

const translations = {
  ru: {
    id: '№',
    route: 'Маршрут',
    transport: 'Транспорт',
    weight: 'Вес',
    date: 'Дата загрузки',
    price: 'Цена',
    status: 'Статус',
    actions: 'Действия',
    submitOffer: 'Подать предложение',
    editOffer: 'Изменить предложение',
    yourOffer: 'Ваше предложение',
    pending: 'На рассмотрении',
    accepted: 'Принято',
    rejected: 'Отклонено',
    withdrawn: 'Отозвано',
    new: 'Новый',
    assigned: 'Назначен',
    timeLeft: 'Осталось',
    loadingTime: 'Время загрузки',
    notes: 'Примечание',
    dangerous: 'Опасный груз',
    nonstandard: 'Негабаритный',
    partialLoad: 'Догруз',
    priceWithVat: 'с НДС',
    priceWithoutVat: 'без НДС',
    ton: 'т',
    from: 'от',
    to: 'до',
  },
  uz: {
    id: '№',
    route: "Yo'nalish",
    transport: 'Transport',
    weight: "Og'irlik",
    date: 'Yuklash sanasi',
    price: 'Narx',
    status: 'Holat',
    actions: 'Harakatlar',
    submitOffer: 'Taklif berish',
    editOffer: 'Taklifni tahrirlash',
    yourOffer: 'Sizning taklifingiz',
    pending: "Ko'rib chiqilmoqda",
    accepted: 'Qabul qilindi',
    rejected: 'Rad etildi',
    withdrawn: 'Qaytarib olindi',
    new: 'Yangi',
    assigned: 'Tayinlangan',
    timeLeft: 'Qolgan vaqt',
    loadingTime: 'Yuklash vaqti',
    notes: 'Izoh',
    dangerous: 'Xavfli yuk',
    nonstandard: 'Nostandart',
    partialLoad: "Qo'shimcha yuk",
    priceWithVat: 'QQS bilan',
    priceWithoutVat: 'QQSsiz',
    ton: 't',
    from: 'dan',
    to: 'ga',
  },
};

export default function CarrierOrdersTable({
  orders,
  language,
  offersByOrderId,
  onSubmitOffer,
  onEditOffer,
}: CarrierOrdersTableProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const t = translations[language];

  const toggleExpand = (orderId: number) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const getOfferStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t.pending}</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t.accepted}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{t.rejected}</Badge>;
      case 'withdrawn':
        return <Badge variant="secondary">{t.withdrawn}</Badge>;
      default:
        return null;
    }
  };

  const formatRoute = (order: Order) => {
    const origin = getRegionDisplayName(order.originRegion, language);
    const dest = getRegionDisplayName(order.destinationRegion, language);
    return `${origin} → ${dest}`;
  };

  const formatDetailedRoute = (order: Order) => {
    const parts: string[] = [];
    
    if (order.originPoints && order.originPoints.length > 0) {
      order.originPoints.forEach((point) => {
        const region = getRegionDisplayName(point.region, language);
        const districts = point.districts.map(d => getDistrictDisplayNameWithRegion(point.region, d, language)).join(', ');
        parts.push(`${region}: ${districts}`);
      });
    } else {
      const originDistricts = Array.isArray(order.originDistrict) ? order.originDistrict : [order.originDistrict];
      const region = getRegionDisplayName(order.originRegion, language);
      const districts = originDistricts.map(d => getDistrictDisplayNameWithRegion(order.originRegion, d, language)).join(', ');
      parts.push(`${region}: ${districts}`);
    }
    
    return parts;
  };

  const formatDestinationRoute = (order: Order) => {
    const parts: string[] = [];
    
    if (order.destinationPoints && order.destinationPoints.length > 0) {
      order.destinationPoints.forEach((point) => {
        const region = getRegionDisplayName(point.region, language);
        const districts = point.districts.map(d => getDistrictDisplayNameWithRegion(point.region, d, language)).join(', ');
        parts.push(`${region}: ${districts}`);
      });
    } else {
      const destDistricts = Array.isArray(order.destinationDistrict) ? order.destinationDistrict : [order.destinationDistrict];
      const region = getRegionDisplayName(order.destinationRegion, language);
      const districts = destDistricts.map(d => getDistrictDisplayNameWithRegion(order.destinationRegion, d, language)).join(', ');
      parts.push(`${region}: ${districts}`);
    }
    
    return parts;
  };

  // Mobile card view for each order
  const renderMobileCard = (order: Order) => {
    const existingOffer = offersByOrderId[order.id];
    const isExpanded = expandedOrderId === order.id;

    return (
      <Card 
        key={order.id} 
        className="mb-3 hover-elevate cursor-pointer"
        onClick={() => toggleExpand(order.id)}
        data-testid={`card-order-${order.id}`}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">#{order.id}</span>
              {order.expiresAt && order.status === 'new' && (
                <CountdownTimer expiresAt={order.expiresAt} language={language} />
              )}
            </div>
            <div className="flex gap-1">
              {order.isDangerous && (
                <Badge variant="destructive" className="text-xs px-1">
                  <Flame className="h-3 w-3" />
                </Badge>
              )}
              {order.isNonstandard && (
                <Badge variant="secondary" className="text-xs px-1">
                  <AlertTriangle className="h-3 w-3" />
                </Badge>
              )}
              {order.isPartialLoad && (
                <Badge variant="outline" className="text-xs px-1">
                  <Layers className="h-3 w-3" />
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">{formatRoute(order)}</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              <span>{getTransportTypeLabel(order.transportType, language)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{Number(order.weightTons)} {t.ton}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(order.loadDate)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="font-semibold text-lg">{formatMoney(order.priceWithVat)}</div>
            <div className="flex items-center gap-2">
              {existingOffer && getOfferStatusBadge(existingOffer.status)}
              {existingOffer ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); onEditOffer(order, existingOffer); }}
                  data-testid={`button-edit-offer-mobile-${order.id}`}
                >
                  {t.editOffer}
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onSubmitOffer(order); }}
                  data-testid={`button-submit-offer-mobile-${order.id}`}
                >
                  {t.submitOffer}
                </Button>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-green-600" />
                  {t.from}:
                </h4>
                <div className="text-sm text-muted-foreground">
                  {formatDetailedRoute(order).map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-red-600" />
                  {t.to}:
                </h4>
                <div className="text-sm text-muted-foreground">
                  {formatDestinationRoute(order).map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
              {order.priceWithoutVat && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t.priceWithoutVat}: </span>
                  <span className="font-medium">{formatMoney(order.priceWithoutVat)}</span>
                </div>
              )}
              {order.loadingTime && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t.loadingTime}: </span>
                  <span>{order.loadingTime}</span>
                </div>
              )}
              {order.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t.notes}: </span>
                  <span className="whitespace-pre-wrap">{order.notes}</span>
                </div>
              )}
              {existingOffer && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{t.yourOffer}: </span>
                  <span className="font-medium">{formatMoney(existingOffer.price)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      {/* Mobile view - card layout */}
      <div className="md:hidden">
        {orders.map(renderMobileCard)}
      </div>

      {/* Desktop view - table layout */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium w-10"></th>
                  <th className="text-left p-3 font-medium w-16">{t.id}</th>
                  <th className="text-left p-3 font-medium min-w-[200px]">{t.route}</th>
                  <th className="text-left p-3 font-medium">{t.transport}</th>
                  <th className="text-left p-3 font-medium">{t.weight}</th>
                  <th className="text-left p-3 font-medium">{t.date}</th>
                  <th className="text-right p-3 font-medium">{t.price}</th>
                  <th className="text-center p-3 font-medium">{t.status}</th>
                  <th className="text-right p-3 font-medium">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const existingOffer = offersByOrderId[order.id];
                  const isExpanded = expandedOrderId === order.id;
                  
                  return (
                    <>
                      <tr 
                        key={order.id}
                        className="border-b hover-elevate cursor-pointer"
                        onClick={() => toggleExpand(order.id)}
                        data-testid={`row-order-${order.id}`}
                      >
                        <td className="p-3">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(order.id); }}
                            data-testid={`button-expand-${order.id}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </td>
                        <td className="p-3 font-medium">{order.id}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{formatRoute(order)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="whitespace-nowrap">
                            {getTransportTypeLabel(order.transportType, language)}
                          </Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap">{Number(order.weightTons)} {t.ton}</td>
                        <td className="p-3 whitespace-nowrap">{formatDate(order.loadDate)}</td>
                        <td className="p-3 text-right font-medium whitespace-nowrap">
                          {formatMoney(order.priceWithVat)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {order.expiresAt && order.status === 'new' && (
                              <CountdownTimer expiresAt={order.expiresAt} language={language} />
                            )}
                            {existingOffer && getOfferStatusBadge(existingOffer.status)}
                            <div className="flex gap-1">
                              {order.isDangerous && (
                                <Badge variant="destructive" className="text-xs px-1">
                                  <Flame className="h-3 w-3" />
                                </Badge>
                              )}
                              {order.isNonstandard && (
                                <Badge variant="secondary" className="text-xs px-1">
                                  <AlertTriangle className="h-3 w-3" />
                                </Badge>
                              )}
                              {order.isPartialLoad && (
                                <Badge variant="outline" className="text-xs px-1">
                                  <Layers className="h-3 w-3" />
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {existingOffer ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); onEditOffer(order, existingOffer); }}
                              data-testid={`button-edit-offer-${order.id}`}
                            >
                              {t.editOffer}
                            </Button>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); onSubmitOffer(order); }}
                              data-testid={`button-submit-offer-${order.id}`}
                            >
                              {t.submitOffer}
                            </Button>
                          )}
                        </td>
                      </tr>
                    {isExpanded && (
                      <tr key={`${order.id}-details`} className="bg-muted/30">
                        <td colSpan={9} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-green-600" />
                                {t.from}:
                              </h4>
                              <div className="text-sm text-muted-foreground space-y-1">
                                {formatDetailedRoute(order).map((line, idx) => (
                                  <div key={idx}>{line}</div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-red-600" />
                                {t.to}:
                              </h4>
                              <div className="text-sm text-muted-foreground space-y-1">
                                {formatDestinationRoute(order).map((line, idx) => (
                                  <div key={idx}>{line}</div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                                <Package className="h-4 w-4" />
                                {t.price}:
                              </h4>
                              <div className="text-sm space-y-1">
                                <div>{formatMoney(order.priceWithVat)} <span className="text-muted-foreground">({t.priceWithVat})</span></div>
                                {order.priceWithoutVat && (
                                  <div>{formatMoney(order.priceWithoutVat)} <span className="text-muted-foreground">({t.priceWithoutVat})</span></div>
                                )}
                              </div>
                            </div>
                            {order.loadingTime && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {t.loadingTime}:
                                </h4>
                                <div className="text-sm text-muted-foreground">{order.loadingTime}</div>
                              </div>
                            )}
                            {order.notes && (
                              <div className="md:col-span-2">
                                <h4 className="font-medium text-sm mb-2">{t.notes}:</h4>
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</div>
                              </div>
                            )}
                            {existingOffer && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">{t.yourOffer}:</h4>
                                <div className="text-sm">
                                  <span className="font-medium">{formatMoney(existingOffer.price)}</span>
                                  <span className="ml-2">{getOfferStatusBadge(existingOffer.status)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
