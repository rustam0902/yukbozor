import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Send, GripVertical } from "lucide-react";
import { getRegionDisplayName, getDistrictDisplayNameWithRegion } from "@shared/uzbekistan-regions";
import TableSearchFilter, { FilterState, filterData } from "@/components/TableSearchFilter";
import Pagination, { paginateData } from "@/components/Pagination";
import { useAuth } from "@/contexts/auth-context";
import CountdownTimer from "@/components/CountdownTimer";
import { formatDate } from "@/lib/dateFormat";

interface Order {
  id: number;
  title: string;
  originRegion: string;
  originDistrict: string[];
  destinationRegion: string;
  destinationDistrict: string[];
  loadDate: string;
  loadingTime: string;
  transportType: string;
  createdAt: string;
  priceWithVat?: number;
  priceWithoutVat?: number;
  requiresCollateral?: boolean;
  expiresAt?: string | null;
}

interface OrdersSectionProps {
  language?: 'ru' | 'uz';
}

interface ColumnWidths {
  orderNumber: number;
  route: number;
  shippingDate: number;
  shippingTime: number;
  transportType: number;
  cargoName: number;
  priceWithVat: number;
  priceWithoutVat: number;
  timeLeft: number;
  action: number;
}

const DEFAULT_WIDTHS: ColumnWidths = {
  orderNumber: 140,
  route: 200,
  shippingDate: 120,
  shippingTime: 100,
  transportType: 130,
  cargoName: 150,
  priceWithVat: 140,
  priceWithoutVat: 140,
  timeLeft: 120,
  action: 140
};

export default function OrdersSection({ language = 'ru' }: OrdersSectionProps) {
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
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);
  const [resizing, setResizing] = useState<keyof ColumnWidths | null>(null);
  
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const tableRef = useRef<HTMLDivElement>(null);

  const texts = {
    ru: {
      title: 'Новые заказы',
      orderNumber: 'Номер и дата заказа',
      route: 'Маршрут',
      shippingDate: 'Дата отгрузки',
      shippingTime: 'Время отгрузки',
      transportType: 'Тип транспорта',
      cargoName: 'Название груза',
      priceWithVat: 'Цена с НДС',
      priceWithoutVat: 'Цена без НДС',
      timeLeft: 'Осталось',
      action: 'Действие',
      submitOffer: 'Отправить предложение',
      loading: 'Загрузка...',
      noOrdersFound: 'Заказов не найдено',
      loginRequired: 'Войдите для отправки предложения',
      transportTypes: {
        labo: 'Лабо',
        bongo: 'Бонго',
        furgon: 'Фургон',
        isuzu5: 'Исузу-5',
        isuzu10: 'Исузу-10',
        gruzovik: 'Грузовик',
        fura_tent: 'Фура тент',
        fura_ref: 'Фура рефрижератор',
        paravoz: 'Паравоз',
        shalanda: 'Шаланда',
        traller: 'Трейлер',
        tonar: 'Тонар',
        benzovoz: 'Бензовоз',
        konteynerovoz: 'Контейнеровоз',
        other: 'Другой'
      }
    },
    uz: {
      title: 'Yangi buyurtmalar',
      orderNumber: 'Buyurtma raqami va sanasi',
      route: 'Marshrut',
      shippingDate: 'Jo\'natish sanasi',
      shippingTime: 'Jo\'natish vaqti',
      transportType: 'Transport turi',
      cargoName: 'Yuk nomi',
      priceWithVat: 'QQS bilan narx',
      priceWithoutVat: 'QQS\'siz narx',
      timeLeft: 'Qolgan',
      action: 'Harakat',
      submitOffer: 'Taklif yuborish',
      loading: 'Yuklanmoqda...',
      noOrdersFound: 'Buyurtmalar topilmadi',
      loginRequired: 'Taklif yuborish uchun tizimga kiring',
      transportTypes: {
        labo: 'Labo',
        bongo: 'Bongo',
        furgon: 'Furgon',
        isuzu5: 'Isuzu-5',
        isuzu10: 'Isuzu-10',
        gruzovik: 'Yuklarli avtomobil',
        fura_tent: 'Fura tent',
        fura_ref: 'Fura muzlagich',
        paravoz: 'Paravoz',
        shalanda: 'Shalanda',
        traller: 'Treyler',
        tonar: 'Tonar',
        benzovoz: 'Benzovoz',
        konteynerovoz: 'Konteynerovoz',
        other: 'Boshqa'
      }
    }
  };

  const t = texts[language];

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders/public/new']
  });

  const handleResizeStart = useCallback((column: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(column);
    
    const startX = e.clientX;
    const startWidth = columnWidths[column];
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const handleSubmitOfferClick = (order: Order) => {
    if (!user) {
      setLocation('/login');
      return;
    }
    
    if (!user.roles.includes('carrier')) {
      setLocation('/login');
      return;
    }
    
    // Redirect to Carrier Dashboard orders section
    setLocation('/carrier');
  };

  const formatRoute = (originRegion: string, originDistricts: any, destRegion: string, destDistricts: any) => {
    let originDistrict = '';
    let destDistrict = '';
    
    if (Array.isArray(originDistricts) && originDistricts.length > 0) {
      originDistrict = String(originDistricts[0]).trim();
    } else if (typeof originDistricts === 'string') {
      originDistrict = originDistricts.trim();
    }
    
    if (Array.isArray(destDistricts) && destDistricts.length > 0) {
      destDistrict = String(destDistricts[0]).trim();
    } else if (typeof destDistricts === 'string') {
      destDistrict = destDistricts.trim();
    }
    
    const originRegionName = getRegionDisplayName(originRegion, language);
    const originDistrictName = originDistrict ? getDistrictDisplayNameWithRegion(originRegion, originDistrict, language) : '';
    const destRegionName = getRegionDisplayName(destRegion, language);
    const destDistrictName = destDistrict ? getDistrictDisplayNameWithRegion(destRegion, destDistrict, language) : '';
    
    const from = originDistrictName ? `${originDistrictName}, ${originRegionName}` : originRegionName;
    const to = destDistrictName ? `${destDistrictName}, ${destRegionName}` : destRegionName;
    
    return `${from} → ${to}`;
  };

  const getTransportTypeName = (type: string) => {
    return t.transportTypes[type as keyof typeof t.transportTypes] || type;
  };

  if (isLoading) {
    return (
      <section className="py-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t.loading}</span>
          </div>
        </div>
      </section>
    );
  }

  const getSearchableText = (order: any) => {
    const originRegionName = getRegionDisplayName(order.originRegion, language);
    const originDistrictName = Array.isArray(order.originDistrict) && order.originDistrict.length > 0
      ? getDistrictDisplayNameWithRegion(order.originRegion, order.originDistrict[0], language)
      : '';
    const destRegionName = getRegionDisplayName(order.destinationRegion, language);
    const destDistrictName = Array.isArray(order.destinationDistrict) && order.destinationDistrict.length > 0
      ? getDistrictDisplayNameWithRegion(order.destinationRegion, order.destinationDistrict[0], language)
      : '';
    const transportTypeName = getTransportTypeName(order.transportType);
    
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

  const filteredOrders = filterData(
    orders,
    filters,
    getSearchableText,
    (order) => [order.originRegion].filter(Boolean),
    (order) => order.transportType,
    (order) => order.loadDate,
    undefined,
    undefined,
    (order) => [order.destinationRegion].filter(Boolean)
  );

  const paginatedOrders = paginateData(filteredOrders, currentPage, pageSize);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const ResizeHandle = ({ column }: { column: keyof ColumnWidths }) => (
    <div
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 ${
        resizing === column ? 'bg-primary' : 'bg-transparent'
      }`}
      onMouseDown={(e) => handleResizeStart(column, e)}
      style={{ cursor: 'col-resize' }}
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <section className="py-16 px-6 md:px-12">
      <div className="w-full">
        <h2 className="text-3xl font-bold mb-8 text-center">{t.title}</h2>
        
        <TableSearchFilter
          language={language}
          onFilterChange={handleFilterChange}
          showRegionFilter={true}
          showTransportFilter={true}
          showDateFilter={true}
        />
        
        {filteredOrders.length === 0 ? (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">{t.noOrdersFound}</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto" ref={tableRef}>
              <Table className="min-w-full" style={{ tableLayout: 'fixed' }}>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.orderNumber }}
                    >
                      {t.orderNumber}
                      <ResizeHandle column="orderNumber" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.route }}
                    >
                      {t.route}
                      <ResizeHandle column="route" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.shippingDate }}
                    >
                      {t.shippingDate}
                      <ResizeHandle column="shippingDate" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.shippingTime }}
                    >
                      {t.shippingTime}
                      <ResizeHandle column="shippingTime" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.transportType }}
                    >
                      {t.transportType}
                      <ResizeHandle column="transportType" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.cargoName }}
                    >
                      {t.cargoName}
                      <ResizeHandle column="cargoName" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.priceWithVat }}
                    >
                      {t.priceWithVat}
                      <ResizeHandle column="priceWithVat" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.priceWithoutVat }}
                    >
                      {t.priceWithoutVat}
                      <ResizeHandle column="priceWithoutVat" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.timeLeft }}
                    >
                      {t.timeLeft}
                      <ResizeHandle column="timeLeft" />
                    </TableHead>
                    <TableHead 
                      className="relative select-none"
                      style={{ width: columnWidths.action }}
                    >
                      {t.action}
                      <ResizeHandle column="action" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                      <TableCell 
                        className="font-medium align-top"
                        style={{ width: columnWidths.orderNumber }}
                      >
                        <div className="break-words">#{order.id}</div>
                        <div className="text-sm text-muted-foreground break-words">{formatDate(order.createdAt)}</div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.route }}>
                        <div className="break-words">
                          {formatRoute(
                            order.originRegion,
                            order.originDistrict,
                            order.destinationRegion,
                            order.destinationDistrict
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.shippingDate }}>
                        <div className="break-words">{formatDate(order.loadDate)}</div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.shippingTime }}>
                        <div className="break-words">{order.loadingTime}</div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.transportType }}>
                        <div className="break-words">{getTransportTypeName(order.transportType)}</div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.cargoName }}>
                        <div className="break-words">{order.title}</div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.priceWithVat }}>
                        <div className="break-words font-medium">
                          {order.priceWithVat ? `${Number(order.priceWithVat).toLocaleString('ru-RU')} сум` : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.priceWithoutVat }}>
                        <div className="break-words">
                          {order.priceWithoutVat ? `${Math.round(Number(order.priceWithoutVat)).toLocaleString('ru-RU')} сум` : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.timeLeft }}>
                        {order.expiresAt && (
                          <CountdownTimer expiresAt={order.expiresAt} language={language} />
                        )}
                      </TableCell>
                      <TableCell className="align-top" style={{ width: columnWidths.action }}>
                        <Button
                          size="sm"
                          onClick={() => handleSubmitOfferClick(order)}
                          data-testid={`button-submit-offer-${order.id}`}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">{t.submitOffer}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              language={language}
              totalItems={filteredOrders.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </Card>
        )}
      </div>
    </section>
  );
}
