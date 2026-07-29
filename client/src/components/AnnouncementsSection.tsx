import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Truck, Phone, Package, AlertTriangle, Filter, Star, ExternalLink } from 'lucide-react';
import { formatMoney, buildTelegramMessageLink } from '@/lib/utils';
import { getRegionDisplayName, getDistrictDisplayName, uzbekistanRegions } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel, transportTypes } from '@shared/transport-types';
import Pagination, { paginateData } from '@/components/Pagination';
import type { Announcement } from '@shared/schema';

interface AnnouncementsSectionProps {
  language?: 'ru' | 'uz';
}

interface PublicAnnouncement extends Announcement {
  customerName: string;
  customerRating: number | null;
}

const paymentTypeLabels = {
  ru: { cash: 'Наличные', card: 'Карта', transfer: 'Перечисление' },
  uz: { cash: 'Naqd', card: 'Karta', transfer: 'Pul ko\'chirish' }
};

function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  }
  return dateStr;
}

export default function AnnouncementsSection({ language = 'ru' }: AnnouncementsSectionProps) {
  const [originRegionFilter, setOriginRegionFilter] = useState<string>('all');
  const [destinationRegionFilter, setDestinationRegionFilter] = useState<string>('all');
  const [transportFilter, setTransportFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const texts = {
    ru: {
      title: 'Объявления о грузах',
      subtitle: 'Грузы от частных лиц',
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
      negotiable: 'Договорная',
      weightNotSpecified: 'Не указан',
      vehicles: 'машин'
    },
    uz: {
      title: 'Yuklar haqida e\'lonlar',
      subtitle: 'Jismoniy shaxslardan yuklar',
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
      negotiable: 'Kelishiladi',
      weightNotSpecified: 'Ko\'rsatilmagan',
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

  // Reset to first page when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Paginate announcements
  const paginatedAnnouncements = paginateData(announcements || [], currentPage, pageSize);
  const totalItems = announcements?.length || 0;

  const renderAnnouncementCard = (announcement: PublicAnnouncement) => {
    return (
      <Card key={announcement.id} className="hover-elevate" data-testid={`card-announcement-${announcement.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit text-xs">
                {t.announcementNumber}-{announcement.id}
              </Badge>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">{announcement.title}</CardTitle>
                {(() => {
                  const link = buildTelegramMessageLink(announcement.botSourceChatId, announcement.botSourceMessageId);
                  return link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" title="Оригинал в Telegram" className="text-muted-foreground hover:text-foreground shrink-0" data-testid={`link-source-${announcement.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="text-right shrink-0">
              {Number(announcement.price) > 0 ? (
                <span className="text-xl font-bold text-primary">
                  {formatMoney(Number(announcement.price))} UZS
                </span>
              ) : (
                <span className="text-base font-medium text-muted-foreground italic">
                  {t.negotiable}
                </span>
              )}
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
              <span>{Number(announcement.weightTons) > 0 ? `${Number(announcement.weightTons)} ${t.tons}` : t.weightNotSpecified}</span>
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
    <section className="py-12 bg-muted/50">
      <div className="container mx-auto px-4 space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold" data-testid="text-announcements-title">{t.title}</h2>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t.filterByOriginRegion}:</span>
            <Select value={originRegionFilter} onValueChange={(v) => handleFilterChange(setOriginRegionFilter, v)}>
              <SelectTrigger className="w-48" data-testid="select-origin-region">
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
            <Select value={destinationRegionFilter} onValueChange={(v) => handleFilterChange(setDestinationRegionFilter, v)}>
              <SelectTrigger className="w-48" data-testid="select-destination-region">
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
            <Select value={transportFilter} onValueChange={(v) => handleFilterChange(setTransportFilter, v)}>
              <SelectTrigger className="w-48" data-testid="select-transport-type">
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
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginatedAnnouncements.map(renderAnnouncementCard)}
            </div>
            {totalItems > pageSize && (
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[12, 24, 36]}
                language={language}
              />
            )}
          </>
        ) : (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">{t.noAnnouncements}</p>
          </Card>
        )}
      </div>
    </section>
  );
}
