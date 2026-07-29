import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, Phone } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface OfferCardProps {
  id: string;
  carrierName: string;
  carrierPhone?: string;
  carrierRating: number;
  price: number;
  priceWithoutVat?: number;
  status: 'active' | 'withdrawn' | 'accepted' | 'rejected';
  createdAt: string;
  orderId?: number;
  orderTitle?: string;
  onAccept?: () => void;
  onReject?: () => void;
  language?: 'ru' | 'uz';
}

export default function OfferCard({
  carrierName,
  carrierPhone,
  carrierRating,
  price,
  priceWithoutVat,
  status,
  createdAt,
  orderId,
  orderTitle,
  onAccept,
  onReject,
  language = 'ru'
}: OfferCardProps) {
  const texts = {
    ru: {
      price: 'сум',
      priceWithVat: 'Цена с НДС',
      priceWithoutVat: 'Цена без НДС',
      submitted: 'Отправлено',
      accept: 'Принять',
      reject: 'Отклонить',
      active: 'Активно',
      withdrawn: 'Отозвано',
      accepted: 'Принято',
      rejected: 'Отклонено',
      order: 'Заказ'
    },
    uz: {
      price: 'so\'m',
      priceWithVat: 'QQS bilan',
      priceWithoutVat: 'QQSsiz',
      submitted: 'Yuborilgan',
      accept: 'Qabul qilish',
      reject: 'Rad etish',
      active: 'Aktiv',
      withdrawn: 'Qaytarilgan',
      accepted: 'Qabul qilingan',
      rejected: 'Rad etilgan',
      order: 'Buyurtma'
    }
  };

  const t = texts[language];

  const statusColors = {
    active: 'bg-blue-500 text-white',
    withdrawn: 'bg-gray-500 text-white',
    accepted: 'bg-green-500 text-white',
    rejected: 'bg-red-500 text-white'
  };

  const initials = carrierName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card className="hover-elevate" data-testid="card-offer">
      <CardContent className="p-6">
        <div className="space-y-4">
          {orderTitle && (
            <div className="pb-3 border-b">
              <div className="text-xs text-muted-foreground font-medium">{t.order}</div>
              <div className="font-semibold text-blue-600 dark:text-blue-400 truncate" data-testid="text-offer-order-title">
                {orderTitle}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate" data-testid="text-carrier-name">{carrierName}</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span data-testid="text-carrier-rating">{carrierRating.toFixed(1)}</span>
                </div>
                {carrierPhone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${carrierPhone}`} className="hover:underline" data-testid="text-carrier-phone">{carrierPhone}</a>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {t.submitted}: {createdAt}
                </div>
              </div>
            </div>

            <div className="text-right min-w-[140px]">
              <div className="mb-2">
                <div className="text-xs text-muted-foreground mb-0.5">{t.priceWithVat}</div>
                <div className="text-xl font-bold" data-testid="text-offer-price">
                  {formatMoney(price)} {t.price}
                </div>
              </div>
              {priceWithoutVat && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">{t.priceWithoutVat}</div>
                  <div className="text-lg font-semibold text-muted-foreground" data-testid="text-offer-price-without-vat">
                    {formatMoney(priceWithoutVat)} {t.price}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge className={`${statusColors[status]} text-xs no-default-hover-elevate no-default-active-elevate`} data-testid="badge-offer-status">
                {t[status]}
              </Badge>
              {status === 'active' && (onAccept || onReject) && (
                <div className="flex gap-2">
                  {onAccept && (
                    <Button size="sm" onClick={onAccept} data-testid="button-accept-offer">
                      {t.accept}
                    </Button>
                  )}
                  {onReject && (
                    <Button size="sm" variant="outline" onClick={onReject} data-testid="button-reject-offer">
                      {t.reject}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
