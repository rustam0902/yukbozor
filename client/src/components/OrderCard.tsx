import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Package, Calendar, Truck, Trash2, Edit } from "lucide-react";
import { uzbekistanRegions } from "@/../../shared/uzbekistan-regions";
import { transportTypes } from "@/../../shared/transport-types";
import CountdownTimer from "@/components/CountdownTimer";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/utils";

interface LocationPoint {
  region: string;
  districts: string[];
}

interface ExistingOffer {
  id: number;
  price: number;
  status: string;
}

interface OrderCardProps {
  id: string;
  title: string;
  originRegion: string;
  originDistrict: string | string[];
  destinationRegion: string;
  destinationDistrict: string | string[];
  originPoints?: LocationPoint[];
  destinationPoints?: LocationPoint[];
  transportType: string;
  weight: number;
  loadDate: string;
  loadingTime?: string;
  price: number;
  priceWithoutVat?: number;
  prepaymentAmount?: number;
  notes?: string;
  status: 'new' | 'assigned' | 'completed' | 'cancelled';
  deletedAt?: string | null;
  expiresAt?: string | null;
  isDangerous?: boolean;
  isNonstandard?: boolean;
  isPartialLoad?: boolean;
  existingOffer?: ExistingOffer;
  onViewOffers?: () => void;
  onSubmitOffer?: () => void;
  onEditOffer?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  language?: 'ru' | 'uz';
}

export default function OrderCard({
  id,
  title,
  originRegion,
  originDistrict,
  destinationRegion,
  destinationDistrict,
  originPoints,
  destinationPoints,
  transportType,
  weight,
  loadDate,
  loadingTime,
  price,
  priceWithoutVat,
  prepaymentAmount,
  notes,
  status,
  deletedAt,
  expiresAt,
  isDangerous,
  isNonstandard,
  isPartialLoad,
  existingOffer,
  onViewOffers,
  onSubmitOffer,
  onEditOffer,
  onEdit,
  onDelete,
  language = 'ru'
}: OrderCardProps) {
  // Helper functions to get localized names
  const getRegionName = (regionKey: string): string => {
    const region = uzbekistanRegions.find(r => r.name === regionKey);
    if (!region) return regionKey;
    return language === 'ru' ? region.nameRu : region.nameUz;
  };

  const getDistrictName = (regionKey: string, districtKey: string): string => {
    const region = uzbekistanRegions.find(r => r.name === regionKey);
    if (!region) return districtKey;
    const district = region.districts.find(d => d.name === districtKey);
    if (!district) return districtKey;
    return language === 'ru' ? district.nameRu : district.nameUz;
  };

  const getDistrictsDisplay = (regionKey: string, districts: string | string[]): string => {
    const districtArr = Array.isArray(districts) ? districts : [districts];
    return districtArr.map(d => getDistrictName(regionKey, d)).join(', ');
  };

  // Normalize points: use originPoints/destinationPoints if available, otherwise build from legacy fields
  const normalizedOriginPoints: LocationPoint[] = (originPoints && originPoints.length > 0)
    ? originPoints
    : [{ region: originRegion, districts: Array.isArray(originDistrict) ? originDistrict : [originDistrict] }];
  
  const normalizedDestinationPoints: LocationPoint[] = (destinationPoints && destinationPoints.length > 0)
    ? destinationPoints
    : [{ region: destinationRegion, districts: Array.isArray(destinationDistrict) ? destinationDistrict : [destinationDistrict] }];

  const hasMultipleOrigins = normalizedOriginPoints.length > 1;
  const hasMultipleDestinations = normalizedDestinationPoints.length > 1;

  const getTransportTypeName = (typeKey: string): string => {
    const type = transportTypes.find(t => t.value === typeKey);
    if (!type) return typeKey;
    return language === 'ru' ? type.labelRu : type.labelUz;
  };

  const texts = {
    ru: {
      from: 'Откуда',
      to: 'Куда',
      weight: 'Вес',
      tons: 'т',
      loadDate: 'Дата загрузки',
      loadingTime: 'Время загрузки',
      price: 'сум',
      priceWithVat: 'Цена с НДС',
      priceWithoutVat: 'Цена без НДС',
      prepaymentAmount: 'Предоплата',
      notes: 'Примечание',
      dangerous: 'Опасный груз',
      nonstandard: 'Негабарит',
      partialLoad: 'Частичная загрузка',
      viewOffers: 'Посмотреть предложения',
      submitOffer: 'Отправить предложение',
      editOffer: 'Изменить предложение',
      alreadyOffered: 'Вы уже предложили по этому заказу',
      yourOffer: 'Ваше предложение',
      deleteOrder: 'Удалить',
      new: 'Новый',
      assigned: 'Назначен',
      completed: 'Выполнен',
      cancelled: 'Отменен',
      deleted: 'Удален'
    },
    uz: {
      from: 'Qayerdan',
      to: 'Qayerga',
      weight: 'Og\'irlik',
      tons: 't',
      loadDate: 'Yuklash sanasi',
      loadingTime: 'Yuklash vaqti',
      price: 'so\'m',
      priceWithVat: 'QQS bilan',
      priceWithoutVat: 'QQSsiz',
      prepaymentAmount: 'Oldindan to\'lov',
      notes: 'Izoh',
      dangerous: 'Xavfli yuk',
      nonstandard: 'Nostandart',
      partialLoad: 'Qisman yuklash',
      viewOffers: 'Takliflarni ko\'rish',
      submitOffer: 'Taklif yuborish',
      editOffer: 'Taklifni o\'zgartirish',
      alreadyOffered: 'Siz bu buyurtmaga taklif bergansiz',
      yourOffer: 'Sizning taklifingiz',
      deleteOrder: 'O\'chirish',
      new: 'Yangi',
      assigned: 'Tayinlangan',
      completed: 'Bajarilgan',
      cancelled: 'Bekor qilingan',
      deleted: 'O\'chirilgan'
    }
  };

  const t = texts[language];

  const statusColors = {
    new: 'bg-blue-500 text-white',
    assigned: 'bg-yellow-500 text-white',
    completed: 'bg-green-500 text-white',
    cancelled: 'bg-red-500 text-white',
    deleted: 'bg-gray-500 text-white'
  };

  const isDeleted = !!deletedAt;
  const displayStatus = isDeleted ? 'deleted' : status;

  return (
    <Card className={`hover-elevate ${isDeleted ? 'opacity-60' : ''}`} data-testid="card-order">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground" data-testid="text-order-id">#{id}</span>
          <h3 className="font-semibold text-lg" data-testid="text-order-title">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColors[displayStatus]} text-xs uppercase tracking-wide no-default-hover-elevate no-default-active-elevate`} data-testid="badge-order-status">
            {t[displayStatus]}
          </Badge>
          {status === 'new' && expiresAt && (
            <CountdownTimer expiresAt={expiresAt} language={language} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{t.from}</div>
                <div className="space-y-1" data-testid="text-origin">
                  {normalizedOriginPoints.map((point, idx) => (
                    <div key={idx} className="text-sm font-medium">
                      {hasMultipleOrigins && <span className="text-muted-foreground mr-1">{idx + 1}.</span>}
                      {getRegionName(point.region)}: {getDistrictsDisplay(point.region, point.districts)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">{t.to}</div>
                <div className="space-y-1" data-testid="text-destination">
                  {normalizedDestinationPoints.map((point, idx) => (
                    <div key={idx} className="text-sm font-medium">
                      {hasMultipleDestinations && <span className="text-muted-foreground mr-1">{idx + 1}.</span>}
                      {getRegionName(point.region)}: {getDistrictsDisplay(point.region, point.districts)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm" data-testid="text-transport-type">{getTransportTypeName(transportType)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm" data-testid="text-weight">{weight} {t.tons}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm" data-testid="text-load-date">{formatDate(loadDate)}</span>
            </div>
            {loadingTime && (
              <div className="pl-6">
                <span className="text-xs text-muted-foreground" data-testid="text-loading-time">
                  {t.loadingTime}: {loadingTime}
                </span>
              </div>
            )}
          </div>
        </div>

        {(isDangerous || isNonstandard || isPartialLoad) && (
          <div className="flex flex-wrap gap-2">
            {isDangerous && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-dangerous">
                {t.dangerous}
              </Badge>
            )}
            {isNonstandard && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-nonstandard">
                {t.nonstandard}
              </Badge>
            )}
            {isPartialLoad && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-partial">
                {t.partialLoad}
              </Badge>
            )}
          </div>
        )}

        {notes && (
          <div className="text-sm text-muted-foreground" data-testid="text-notes">
            <span className="font-medium">{t.notes}:</span> {notes}
          </div>
        )}

        <div className="pt-2 border-t space-y-2">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">{t.priceWithVat}</div>
            <div className="text-2xl font-bold" data-testid="text-price">
              {formatMoney(price)} {t.price}
            </div>
          </div>
          {priceWithoutVat !== undefined && (
            <div data-testid="text-price-without-vat">
              <div className="text-xs text-muted-foreground mb-0.5">{t.priceWithoutVat}</div>
              <div className="text-lg font-semibold text-muted-foreground">
                {formatMoney(priceWithoutVat)} {t.price}
              </div>
            </div>
          )}
          {prepaymentAmount !== undefined && prepaymentAmount > 0 && (
            <div className="text-sm font-medium text-primary mt-2" data-testid="text-prepayment-amount">
              {t.prepaymentAmount}: {formatMoney(prepaymentAmount)} {t.price}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {existingOffer && existingOffer.status === 'active' && (
          <div className="w-full p-3 bg-primary/10 border border-primary/20 rounded-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-primary" data-testid="text-already-offered">
                  {t.alreadyOffered}
                </div>
                <div className="text-sm text-muted-foreground" data-testid="text-your-offer-price">
                  {t.yourOffer}: <span className="font-semibold">{formatMoney(existingOffer.price)} {t.price}</span>
                </div>
              </div>
              {onEditOffer && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onEditOffer} 
                  data-testid="button-edit-offer"
                  className="whitespace-nowrap"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t.editOffer}
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 w-full">
          {!isDeleted && onEdit && status === 'new' && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onEdit} 
              data-testid="button-edit-order"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {!isDeleted && onDelete && status === 'new' && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={onDelete} 
              data-testid="button-delete-order"
              className="hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {!isDeleted && onViewOffers && (
            <Button variant="outline" className="flex-1" onClick={onViewOffers} data-testid="button-view-offers">
              {t.viewOffers}
            </Button>
          )}
          {!isDeleted && onSubmitOffer && !existingOffer && (
            <Button className="flex-1" onClick={onSubmitOffer} data-testid="button-submit-offer">
              {t.submitOffer}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
