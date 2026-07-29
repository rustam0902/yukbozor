import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Truck, Phone, Package, AlertTriangle, Filter, Star, ExternalLink } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getRegionDisplayName, getDistrictDisplayName, uzbekistanRegions } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel, transportTypes } from '@shared/transport-types';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import type { Announcement } from '@shared/schema';

interface PublicAnnouncement extends Announcement {
  customerName: string;
  customerRating: number | null;
}

const paymentTypeLabels = {
  ru: { cash: 'Наличные', card: 'Карта', transfer: 'Перечисление' },
  uz: { cash: 'Naqd', card: 'Karta', transfer: 'Pul ko\'chirish' }
};

// Helper function to format date as DD.MM.YYYY
function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  // If already in DD.MM.YYYY format, return as is
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  // If in YYYY-MM-DD format, convert
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  }
  return dateStr;
}

export default function PublicAnnouncementsPage() {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [originRegionFilter, setOriginRegionFilter] = useState<string>('all');
  const [destinationRegionFilter, setDestinationRegionFilter] = useState<string>('all');
  const [transportFilter, setTransportFilter] = useState<string>('all');

  const texts = {
    ru: {
      title: 'Объявления о грузах',
      subtitle: 'Грузы от частных лиц',
      metaDescription: 'Список объявлений о грузоперевозках от частных лиц. Найдите подходящий груз для перевозки.',
      noAnnouncements: 'Объявлений пока нет',
      filterByOriginRegion: 'Регион отправления',
      filterByDestinationRegion: 'Регион назначения',
      filterByTransport: 'Тип транспорта',
      allRegions: 'Все регионы',
      announcementNumber: 'E',
      allTransports: 'Все типы',
      from: 'Откуда',
      to: 'Куда',
      weight: 'Вес',
      tons: 'тонн',
      date: 'Дата загрузки',
      price: 'Цена',
      payment: 'Оплата',
      contact: 'Контакт',
      dangerous: 'Опасный груз',
      nonstandard: 'Негабаритный',
      partial: 'Догруз',
      customer: 'Заказчик',
      viewDetails: 'Подробнее',
      login: 'Войти',
      register: 'Регистрация',
      vehicles: 'машин'
    },
    uz: {
      title: 'Yuklar haqida e\'lonlar',
      subtitle: 'Jismoniy shaxslardan yuklar',
      metaDescription: 'Jismoniy shaxslardan yuk tashish haqida e\'lonlar ro\'yxati. Tashish uchun mos yukni toping.',
      noAnnouncements: 'Hali e\'lonlar yo\'q',
      filterByOriginRegion: 'Jo\'natish viloyati',
      filterByDestinationRegion: 'Yetkazish viloyati',
      filterByTransport: 'Transport turi',
      allRegions: 'Barcha viloyatlar',
      announcementNumber: 'E',
      allTransports: 'Barcha turlar',
      from: 'Qayerdan',
      to: 'Qayerga',
      weight: 'Og\'irlik',
      tons: 'tonna',
      date: 'Yuklash sanasi',
      price: 'Narx',
      payment: 'To\'lov',
      contact: 'Aloqa',
      dangerous: 'Xavfli yuk',
      nonstandard: 'Nostandart',
      partial: 'Qo\'shimcha yuk',
      customer: 'Buyurtmachi',
      viewDetails: 'Batafsil',
      login: 'Kirish',
      register: 'Ro\'yxatdan o\'tish',
      vehicles: 'mashina'
    }
  };

  const t = texts[language];

  const { data: announcements, isLoading } = useQuery<PublicAnnouncement[]>({
    queryKey: ['/api/announcements/public', originRegionFilter, destinationRegionFilter, transportFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (originRegionFilter && originRegionFilter !== 'all') {
        params.append('originRegion', originRegionFilter);
      }
      if (destinationRegionFilter && destinationRegionFilter !== 'all') {
        params.append('destinationRegion', destinationRegionFilter);
      }
      if (transportFilter && transportFilter !== 'all') {
        params.append('transportType', transportFilter);
      }
      const res = await fetch(`/api/announcements/public?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const renderAnnouncementCard = (announcement: PublicAnnouncement) => {
    return (
      <Card key={announcement.id} className="hover-elevate" data-testid={`card-public-announcement-${announcement.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit text-xs">
                {t.announcementNumber}-{announcement.id}
              </Badge>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{announcement.title}</CardTitle>
                {announcement.botSourceChatId && announcement.botSourceMessageId && (() => {
                  const chatId = announcement.botSourceChatId!;
                  const msgId = announcement.botSourceMessageId!;
                  const numericId = chatId.replace(/^-100/, '');
                  const link = /^\d+$/.test(numericId)
                    ? `https://t.me/c/${numericId}/${msgId}`
                    : `https://t.me/${chatId.replace(/^@/, '')}/${msgId}`;
                  return (
                    <a href={link} target="_blank" rel="noopener noreferrer" title="Оригинал в Telegram" className="text-muted-foreground hover:text-foreground shrink-0" data-testid={`link-telegram-source-${announcement.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  );
                })()}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-bold text-primary">
                {formatMoney(Number(announcement.price))} UZS
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-4 w-4 text-green-600 shrink-0" />
              <span className="font-medium">{t.from}:</span>
              <span>{announcement.originRegions.map(r => getRegionDisplayName(r, language)).join(', ')}</span>
              {announcement.originDistrict && announcement.originDistrict.length > 0 && (
                <span className="text-muted-foreground">
                  ({announcement.originDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-4 w-4 text-red-600 shrink-0" />
              <span className="font-medium">{t.to}:</span>
              <span>{announcement.destinationRegions.map(r => getRegionDisplayName(r, language)).join(', ')}</span>
              {announcement.destinationDistrict && announcement.destinationDistrict.length > 0 && (
                <span className="text-muted-foreground">
                  ({announcement.destinationDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>{getTransportTypeLabel(announcement.transportType, language)}</span>
              {announcement.vehicleCount && announcement.vehicleCount > 1 && (
                <Badge variant="outline">{announcement.vehicleCount} {t.vehicles}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>{Number(announcement.weightTons)} {t.tons}</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatDateDDMMYYYY(announcement.loadDate)}, {announcement.loadingTime}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-muted-foreground">{t.payment}:</span>
            {announcement.paymentTypes.map(pt => (
              <Badge key={pt} variant="outline">
                {paymentTypeLabels[language][pt as keyof typeof paymentTypeLabels.ru]}
              </Badge>
            ))}
          </div>

          {(announcement.isDangerous || announcement.isNonstandard || announcement.isPartialLoad) && (
            <div className="flex flex-wrap gap-2">
              {announcement.isDangerous && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t.dangerous}
                </Badge>
              )}
              {announcement.isNonstandard && (
                <Badge variant="secondary">{t.nonstandard}</Badge>
              )}
              {announcement.isPartialLoad && (
                <Badge variant="secondary">{t.partial}</Badge>
              )}
            </div>
          )}

          {announcement.notes && (
            <div className="text-muted-foreground text-xs pt-1 border-t whitespace-pre-line">
              {announcement.notes}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t.customer}:</span>
              <span className="font-medium">{announcement.customerName}</span>
              {announcement.customerRating && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <Star className="h-3 w-3 fill-current" />
                  {announcement.customerRating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{announcement.contactPhone}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Helmet>
        <title>{t.title} | Yukbozor.uz</title>
        <meta name="description" content={t.metaDescription} />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header
          language={language}
          onLanguageChange={setLanguage}
          userRole={user?.roles || []}
          currentRole={user?.defaultRole || 'customer'}
          userName={user?.displayName}
          sticky={true}
        />

        <main className="container mx-auto px-4 py-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold" data-testid="text-page-title">{t.title}</h1>
            <p className="text-muted-foreground">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t.filterByOriginRegion}:</span>
              <Select value={originRegionFilter} onValueChange={setOriginRegionFilter}>
                <SelectTrigger className="w-48" data-testid="select-origin-region-filter">
                  <SelectValue placeholder={t.allRegions} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allRegions}</SelectItem>
                  {uzbekistanRegions.map(region => (
                    <SelectItem key={region.name} value={region.name}>
                      {getRegionDisplayName(region.name, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t.filterByDestinationRegion}:</span>
              <Select value={destinationRegionFilter} onValueChange={setDestinationRegionFilter}>
                <SelectTrigger className="w-48" data-testid="select-destination-region-filter">
                  <SelectValue placeholder={t.allRegions} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allRegions}</SelectItem>
                  {uzbekistanRegions.map(region => (
                    <SelectItem key={region.name} value={region.name}>
                      {getRegionDisplayName(region.name, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t.filterByTransport}:</span>
              <Select value={transportFilter} onValueChange={setTransportFilter}>
                <SelectTrigger className="w-48" data-testid="select-transport-filter">
                  <SelectValue placeholder={t.allTransports} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allTransports}</SelectItem>
                  {transportTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {language === 'ru' ? type.labelRu : type.labelUz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          ) : announcements && announcements.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {announcements.map(renderAnnouncementCard)}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">{t.noAnnouncements}</p>
            </Card>
          )}
        </main>
      </div>
    </>
  );
}
