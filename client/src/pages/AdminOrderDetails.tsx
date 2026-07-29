import { useLocation, Link } from 'wouter';
import { useAdminOrderDetails } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/language-context';
import { formatDate } from '@/lib/dateFormat';
import { formatMoney } from '@/lib/utils';
import { ArrowLeft, Package, User, Truck, FileText, CheckCircle, Clock, MapPin, Weight, Calendar, DollarSign, AlertTriangle, Phone } from 'lucide-react';

interface AdminOrderDetailsProps {
  params: { id: string };
}

const transportTypeLabels = {
  ru: {
    tentovka: 'Тентовка',
    ref: 'Рефрижератор',
    izoterma: 'Изотерма',
    bort: 'Бортовой',
    container: 'Контейнеровоз',
    avtovooz: 'Автовоз',
    samosval: 'Самосвал',
  },
  uz: {
    tentovka: 'Tentovka',
    ref: 'Refrijerator',
    izoterma: 'Izoterma',
    bort: 'Bortli',
    container: 'Konteyner tashuvchi',
    avtovooz: 'Avtovoz',
    samosval: 'Samosval',
  }
};

const orderStatusLabels = {
  ru: {
    new: 'Новый',
    assigned: 'Назначен',
    completed: 'Завершён',
    cancelled: 'Отменён',
  },
  uz: {
    new: 'Yangi',
    assigned: 'Tayinlangan',
    completed: 'Tugallangan',
    cancelled: 'Bekor qilingan',
  }
};

const offerStatusLabels = {
  ru: {
    active: 'Активно',
    accepted: 'Принято',
    rejected: 'Отклонено',
    withdrawn: 'Отозвано',
  },
  uz: {
    active: 'Faol',
    accepted: 'Qabul qilingan',
    rejected: 'Rad etilgan',
    withdrawn: 'Qaytarib olingan',
  }
};

const contractStatusLabels = {
  ru: {
    awaiting_prepayment: 'Ожидает предоплату',
    prepayment_made: 'Предоплата внесена',
    awaiting_completion_confirmation: 'Ожидает подтверждения',
    closed: 'Закрыт',
    termination_pending: 'Ожидает расторжения',
    terminated: 'Расторгнут',
  },
  uz: {
    awaiting_prepayment: 'Oldindan to\'lovni kutmoqda',
    prepayment_made: 'Oldindan to\'lov qilingan',
    awaiting_completion_confirmation: 'Tasdiqlashni kutmoqda',
    closed: 'Yopilgan',
    termination_pending: 'Bekor qilishni kutmoqda',
    terminated: 'Bekor qilingan',
  }
};

export default function AdminOrderDetails({ params }: AdminOrderDetailsProps) {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const orderId = parseInt(params.id, 10);

  const { data, isLoading, error } = useAdminOrderDetails(orderId);

  const texts = {
    ru: {
      back: 'Назад к отчётам',
      orderDetails: 'Детали заказа',
      orderId: 'ID заказа',
      customer: 'Заказчик',
      status: 'Статус',
      title: 'Название',
      origin: 'Откуда',
      destination: 'Куда',
      transportType: 'Тип транспорта',
      weight: 'Вес',
      loadDate: 'Дата загрузки',
      loadingTime: 'Время загрузки',
      priceWithVat: 'Цена с НДС',
      priceWithoutVat: 'Цена без НДС',
      notes: 'Примечания',
      createdAt: 'Создан',
      expiresAt: 'Истекает',
      collateral: 'Залог',
      customerCollateral: 'Залог заказчика',
      dangerous: 'Опасный груз',
      nonstandard: 'Нестандартный груз',
      partialLoad: 'Частичная загрузка',
      offers: 'Предложения',
      noOffers: 'Нет предложений',
      carrier: 'Перевозчик',
      offerPrice: 'Цена предложения',
      offerTime: 'Время подачи',
      offerStatus: 'Статус',
      blockedAmount: 'Заблокировано',
      commission: 'Комиссия',
      acceptedOffer: 'Выбранное предложение',
      contract: 'Договор',
      noContract: 'Договор не создан',
      contractId: 'ID договора',
      contractStatus: 'Статус договора',
      contractDate: 'Дата создания',
      phone: 'Телефон',
      inn: 'ИНН',
      pinfl: 'ПИНФЛ',
      yes: 'Да',
      no: 'Нет',
      tons: 'тонн',
      orderNotFound: 'Заказ не найден',
      error: 'Ошибка загрузки',
      winner: 'Победитель',
    },
    uz: {
      back: 'Hisobotlarga qaytish',
      orderDetails: 'Buyurtma tafsilotlari',
      orderId: 'Buyurtma ID',
      customer: 'Buyurtmachi',
      status: 'Holat',
      title: 'Nomi',
      origin: 'Qayerdan',
      destination: 'Qayerga',
      transportType: 'Transport turi',
      weight: 'Og\'irlik',
      loadDate: 'Yuklash sanasi',
      loadingTime: 'Yuklash vaqti',
      priceWithVat: 'QQS bilan narx',
      priceWithoutVat: 'QQS siz narx',
      notes: 'Izohlar',
      createdAt: 'Yaratilgan',
      expiresAt: 'Tugaydi',
      collateral: 'Garov',
      customerCollateral: 'Buyurtmachi garovi',
      dangerous: 'Xavfli yuk',
      nonstandard: 'Nostandart yuk',
      partialLoad: 'Qisman yuklash',
      offers: 'Takliflar',
      noOffers: 'Takliflar yo\'q',
      carrier: 'Tashuvchi',
      offerPrice: 'Taklif narxi',
      offerTime: 'Topshirish vaqti',
      offerStatus: 'Holat',
      blockedAmount: 'Bloklangan',
      commission: 'Komissiya',
      acceptedOffer: 'Tanlangan taklif',
      contract: 'Shartnoma',
      noContract: 'Shartnoma yaratilmagan',
      contractId: 'Shartnoma ID',
      contractStatus: 'Shartnoma holati',
      contractDate: 'Yaratilgan sana',
      phone: 'Telefon',
      inn: 'INN',
      pinfl: 'PINFL',
      yes: 'Ha',
      no: 'Yo\'q',
      tons: 'tonna',
      orderNotFound: 'Buyurtma topilmadi',
      error: 'Yuklash xatosi',
      winner: 'G\'olib',
    }
  };

  const t = texts[language];

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' сум';
  };

  const formatLocation = (region: string, districts: string[]) => {
    if (!districts || districts.length === 0) return region;
    return `${region}: ${districts.join(', ')}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t.orderNotFound}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.back}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, offers, acceptedOffer, contract } = data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin')} data-testid="button-back-to-reports">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.back}
        </Button>
        <h1 className="text-2xl font-bold">{t.orderDetails} #{order.id}</h1>
        <Badge variant="outline" className="text-sm">
          {orderStatusLabels[language][order.status as keyof typeof orderStatusLabels['ru']] || order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-order-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t.title}: {order.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t.orderId}:</span>
                <span className="ml-2 font-mono">{order.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t.createdAt}:</span>
                <span className="ml-2">{formatDate(order.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t.transportType}:</span>
                <span className="ml-2">{transportTypeLabels[language][order.transportType as keyof typeof transportTypeLabels['ru']] || order.transportType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t.weight}:</span>
                <span className="ml-2">{order.weightTons} {t.tons}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t.loadDate}:</span>
                <span className="ml-2">{order.loadDate}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t.loadingTime}:</span>
                <span className="ml-2">{order.loadingTime}</span>
              </div>
              {order.expiresAt && (
                <div>
                  <span className="text-muted-foreground">{t.expiresAt}:</span>
                  <span className="ml-2">{formatDate(order.expiresAt)}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-green-600" />
                <div>
                  <span className="text-muted-foreground">{t.origin}:</span>
                  <p className="font-medium">{formatLocation(order.originRegion, order.originDistrict)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 text-red-600" />
                <div>
                  <span className="text-muted-foreground">{t.destination}:</span>
                  <p className="font-medium">{formatLocation(order.destinationRegion, order.destinationDistrict)}</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground block">{t.priceWithVat}</span>
                <span className="text-lg font-bold text-primary">{formatMoney(order.priceWithVat)}</span>
              </div>
              {order.customerBlockedCollateral > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground block">{t.customerCollateral}</span>
                  <span className="text-lg font-bold">{formatMoney(order.customerBlockedCollateral)}</span>
                </div>
              )}
            </div>

            {order.notes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">{t.notes}:</span>
                  <p className="mt-1">{order.notes}</p>
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              {order.isDangerous && <Badge variant="destructive">{t.dangerous}</Badge>}
              {order.isNonstandard && <Badge variant="secondary">{t.nonstandard}</Badge>}
              {order.isPartialLoad && <Badge variant="outline">{t.partialLoad}</Badge>}
              {order.requiresCollateral && <Badge variant="outline">{t.collateral}</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-customer-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t.customer}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.customer ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{order.customer.displayName}</span>
                  <Badge variant="outline" className="text-xs">ID: {order.customer.id}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{order.customer.phone}</span>
                  </div>
                  {order.customer.inn && (
                    <div>
                      <span className="text-muted-foreground">{t.inn}:</span>
                      <span className="ml-2 font-mono">{order.customer.inn}</span>
                    </div>
                  )}
                  {order.customer.pinfl && (
                    <div>
                      <span className="text-muted-foreground">{t.pinfl}:</span>
                      <span className="ml-2 font-mono">{order.customer.pinfl}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">ID: {order.customerId}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-offers">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t.offers} ({offers?.length || 0})
          </CardTitle>
          {acceptedOffer && (
            <CardDescription className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              {t.acceptedOffer}: {acceptedOffer.carrier?.displayName || `ID ${acceptedOffer.carrierId}`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {offers && offers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t.carrier}</TableHead>
                  <TableHead>{t.phone}</TableHead>
                  <TableHead>{t.inn}/{t.pinfl}</TableHead>
                  <TableHead className="text-right">{t.priceWithVat}</TableHead>
                  <TableHead className="text-right">{t.priceWithoutVat}</TableHead>
                  <TableHead className="text-right">{t.blockedAmount}</TableHead>
                  <TableHead className="text-right">{t.commission}</TableHead>
                  <TableHead>{t.offerTime}</TableHead>
                  <TableHead>{t.offerStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer: any) => (
                  <TableRow 
                    key={offer.id} 
                    className={offer.status === 'accepted' ? 'bg-green-50 dark:bg-green-950/20' : ''}
                    data-testid={`row-offer-${offer.id}`}
                  >
                    <TableCell className="font-mono">{offer.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {offer.carrier?.displayName || `ID ${offer.carrierId}`}
                        {offer.status === 'accepted' && (
                          <Badge variant="default" className="text-xs bg-green-600">{t.winner}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{offer.carrier?.phone || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {offer.carrier?.inn || offer.carrier?.pinfl || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(offer.price)}</TableCell>
                    <TableCell className="text-right">{formatMoney(offer.priceWithoutVat)}</TableCell>
                    <TableCell className="text-right">{formatMoney(offer.blockedAmount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(offer.blockedCommissionAmount || 0)}</TableCell>
                    <TableCell>{formatDate(offer.createdAt)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={offer.status === 'accepted' ? 'default' : 'outline'}
                        className={offer.status === 'accepted' ? 'bg-green-600' : ''}
                      >
                        {offerStatusLabels[language][offer.status as keyof typeof offerStatusLabels['ru']] || offer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">{t.noOffers}</p>
          )}
        </CardContent>
      </Card>

      {contract && (
        <Card data-testid="card-contract">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t.contract}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t.contractId}:</span>
                <p className="font-mono font-medium">{contract.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t.contractStatus}:</span>
                <p>
                  <Badge variant="outline">
                    {contractStatusLabels[language][contract.status as keyof typeof contractStatusLabels['ru']] || contract.status}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t.contractDate}:</span>
                <p>{formatDate(contract.generatedAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t.carrier}:</span>
                <p>{contract.carrier?.displayName || `ID ${contract.carrierId}`}</p>
              </div>
            </div>
            {contract.customerPrepaymentBlocked > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Предоплата заказчика:</span>
                <span className="ml-2 font-bold">{formatMoney(contract.customerPrepaymentBlocked)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!contract && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.noContract}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
