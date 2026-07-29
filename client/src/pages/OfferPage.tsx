import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/language-context';
import { getRegionDisplayName } from '@shared/uzbekistan-regions';
import { SEO } from '@/components/SEO';
import { formatMoney } from '@/lib/utils';

interface OfferPageProps {
  params: {
    id: string;
  };
}

export default function OfferPage({ params }: OfferPageProps) {
  const { language } = useLanguage();
  const [location, setLocation] = useLocation() as any;
  const offerId = parseInt(params.id);

  const { data: offer, isLoading, error } = useQuery({
    queryKey: ['/api/offers', offerId],
    queryFn: async () => {
      const res = await fetch(`/api/offers/${offerId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Offer not found');
      }
      return res.json();
    },
    enabled: !!offerId,
  });

  const texts = {
    ru: {
      back: 'Вернуться',
      offerNotFound: 'Предложение не найдено',
      orderTitle: 'Название заказа',
      carrierPrice: 'Цена перевозчика (с НДС)',
      carrierPriceWithoutVat: 'Цена перевозчика (без НДС)',
      customerPrice: 'Цена заказчика (с НДС)',
      customerPriceWithoutVat: 'Цена заказчика (без НДС)',
      from: 'Откуда',
      to: 'Куда',
      status: 'Статус',
      active: 'Активно',
      withdrawn: 'Отозвано',
      accepted: 'Принято',
      rejected: 'Отклонено'
    },
    uz: {
      back: 'Ortga qaytish',
      offerNotFound: 'Taklif topilmadi',
      orderTitle: 'Buyurtma nomi',
      carrierPrice: 'Tashuvchi narxi (QQS bilan)',
      carrierPriceWithoutVat: 'Tashuvchi narxi (QQSsiz)',
      customerPrice: 'Buyurtmachi narxi (QQS bilan)',
      customerPriceWithoutVat: 'Buyurtmachi narxi (QQSsiz)',
      from: 'Qayerdan',
      to: 'Qayerga',
      status: 'Holat',
      active: 'Aktiv',
      withdrawn: 'Qaytarilgan',
      accepted: 'Qabul qilindi',
      rejected: 'Rad etildi'
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  const handleGoBack = () => {
    setLocation('/carrier/offers');
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <Button variant="outline" onClick={handleGoBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </Button>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                {t.offerNotFound}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-blue-500 text-white',
    withdrawn: 'bg-gray-500 text-white',
    accepted: 'bg-green-500 text-white',
    rejected: 'bg-red-500 text-white'
  };

  const statusTexts: Record<string, string> = {
    active: t.active,
    withdrawn: t.withdrawn,
    accepted: t.accepted,
    rejected: t.rejected
  };

  return (
    <div className="p-4 md:p-8">
      <SEO 
        title={language === 'ru' ? `Предложение #${params.id}` : `Taklif #${params.id}`}
        description={language === 'ru' ? 'Детали предложения на грузоперевозку' : 'Yuk tashish taklifi tafsilotlari'}
        url={`https://yukbozor.uz/offer/${params.id}`}
        noindex={true}
      />
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <Button variant="outline" onClick={handleGoBack} className="gap-2" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Button>

        <Card data-testid="card-offer-details">
          <CardContent className="pt-6 space-y-6">
            {/* Заголовок и статус */}
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t.orderTitle}</div>
                <div className="text-2xl font-bold">{offer.order?.title || `Order #${offer.orderId}`}</div>
              </div>
              <Badge className={`${statusColors[offer.status] || 'bg-gray-500 text-white'} text-sm w-fit no-default-hover-elevate no-default-active-elevate`}>
                {statusTexts[offer.status] || offer.status}
              </Badge>
            </div>

            {/* Маршрут */}
            {offer.order && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{t.from}</div>
                    <div className="font-medium">
                      {getRegionDisplayName(offer.order.originRegion, language as 'ru' | 'uz')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{t.to}</div>
                    <div className="font-medium">
                      {getRegionDisplayName(offer.order.destinationRegion, language as 'ru' | 'uz')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Цены */}
            <div className="border-t pt-4 space-y-4">
              {/* Цена заказчика */}
              {offer.order && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{t.customerPrice}</div>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-customer-price-with-vat">
                      {offer.order.priceWithVat ? formatMoney(offer.order.priceWithVat) : '—'} сум
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{t.customerPriceWithoutVat}</div>
                    <div className="text-2xl font-bold text-green-500" data-testid="text-customer-price-without-vat">
                      {formatMoney(offer.order.priceWithoutVat || offer.order.priceWithVat)} сум
                    </div>
                  </div>
                </div>
              )}

              {/* Цена перевозчика */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{t.carrierPrice}</div>
                    <div className="text-2xl font-bold text-blue-600" data-testid="text-carrier-price-with-vat">
                      {formatMoney(offer.price)} сум
                    </div>
                  </div>
                  {offer.priceWithoutVat && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t.carrierPriceWithoutVat}</div>
                      <div className="text-2xl font-bold text-blue-400" data-testid="text-carrier-price-without-vat">
                        {formatMoney(offer.priceWithoutVat)} сум
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
