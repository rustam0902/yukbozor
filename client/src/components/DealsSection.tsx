import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Loader2, GripVertical } from "lucide-react";
import { getRegionDisplayName, getDistrictDisplayNameWithRegion } from "@shared/uzbekistan-regions";
import TableSearchFilter, { FilterState, filterData } from "@/components/TableSearchFilter";
import Pagination, { paginateData } from "@/components/Pagination";
import { formatDate } from "@/lib/dateFormat";

interface Contract {
  contract: {
    id: number;
    orderId: number;
    generatedAt: string;
  };
  order: {
    id: number;
    title: string;
    originRegion: string;
    originDistrict: string[];
    destinationRegion: string;
    destinationDistrict: string[];
    loadDate: string;
    transportType: string;
    createdAt: string;
  };
  offerPrice: string | null;
}

interface DealsSectionProps {
  language?: 'ru' | 'uz';
}

interface ColumnWidths {
  orderNumber: number;
  contractNumber: number;
  route: number;
  shippingDate: number;
  transportType: number;
  cargoName: number;
  contractAmount: number;
}

const DEFAULT_WIDTHS: ColumnWidths = {
  orderNumber: 150,
  contractNumber: 160,
  route: 220,
  shippingDate: 120,
  transportType: 130,
  cargoName: 180,
  contractAmount: 150
};

export default function DealsSection({ language = 'ru' }: DealsSectionProps) {
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
  const tableRef = useRef<HTMLDivElement>(null);

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

  const ResizeHandle = ({ column }: { column: keyof ColumnWidths }) => (
    <div
      className={`absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center group ${
        resizing === column ? 'bg-primary/10' : 'hover:bg-muted/50'
      }`}
      onMouseDown={(e) => handleResizeStart(column, e)}
    >
      <div className={`h-6 w-0.5 rounded transition-colors ${
        resizing === column ? 'bg-primary' : 'bg-transparent group-hover:bg-muted-foreground/30'
      }`} />
    </div>
  );

  const texts = {
    ru: {
      title: 'Заключённые сделки',
      orderNumber: 'Номер и дата заказа',
      contractNumber: 'Номер и дата договора',
      route: 'Маршрут',
      shippingDate: 'Дата отгрузки',
      transportType: 'Тип транспорта',
      cargoName: 'Название груза',
      contractAmount: 'Сумма договора',
      loading: 'Загрузка...',
      noDealFound: 'Сделок не найдено',
      routeFormat: '{from} → {to}',
      fromCity: 'Из',
      toCity: 'В',
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
        other: 'Другой'
      }
    },
    uz: {
      title: 'Tuzilgan shartnomalar',
      orderNumber: 'Buyurtma raqami va sanasi',
      contractNumber: 'Shartnoma raqami va sanasi',
      route: 'Marshrut',
      shippingDate: 'Jo\'natish sanasi',
      transportType: 'Transport turi',
      cargoName: 'Yuk nomi',
      contractAmount: 'Shartnoma summasi',
      loading: 'Yuklanmoqda...',
      noDealFound: 'Shartnomalar topilmadi',
      routeFormat: '{from} → {to}',
      fromCity: 'Dan',
      toCity: 'Gacha',
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
        other: 'Boshqa'
      }
    }
  };

  const t = texts[language];

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['/api/contracts/public/concluded']
  });

  // Debug: log first contract to see data structure
  useEffect(() => {
    if (contracts.length > 0) {
      console.log('First contract data:', {
        originRegion: contracts[0].order.originRegion,
        originDistrict: contracts[0].order.originDistrict,
        destinationRegion: contracts[0].order.destinationRegion,
        destinationDistrict: contracts[0].order.destinationDistrict,
      });
    }
  }, [contracts]);

  const formatRoute = (originRegion: string, originDistricts: any, destRegion: string, destDistricts: any) => {
    // Extract first district - handle array or string
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
    
    // Get display names using shared functions
    const originRegionName = getRegionDisplayName(originRegion, language);
    const originDistrictName = originDistrict ? getDistrictDisplayNameWithRegion(originRegion, originDistrict, language) : '';
    const destRegionName = getRegionDisplayName(destRegion, language);
    const destDistrictName = destDistrict ? getDistrictDisplayNameWithRegion(destRegion, destDistrict, language) : '';
    
    // Format: "District, Region" or just "Region" if no district
    const from = originDistrictName ? `${originDistrictName}, ${originRegionName}` : originRegionName;
    const to = destDistrictName ? `${destDistrictName}, ${destRegionName}` : destRegionName;
    
    return `${from} → ${to}`;
  };

  const getTransportTypeName = (type: string) => {
    return t.transportTypes[type as keyof typeof t.transportTypes] || type;
  };

  if (isLoading) {
    return (
      <section className="py-16 px-6 md:px-12 bg-muted/30">
        <div className="w-full flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.loading}</span>
        </div>
      </section>
    );
  }

  const getSearchableText = (item: Contract) => {
    const order = item.order;
    const originRegionName = getRegionDisplayName(order.originRegion, language);
    const originDistrictNames = Array.isArray(order.originDistrict) 
      ? order.originDistrict.map(d => getDistrictDisplayNameWithRegion(order.originRegion, d, language)).join(' ')
      : '';
    const destRegionName = getRegionDisplayName(order.destinationRegion, language);
    const destDistrictNames = Array.isArray(order.destinationDistrict)
      ? order.destinationDistrict.map(d => getDistrictDisplayNameWithRegion(order.destinationRegion, d, language)).join(' ')
      : '';
    const transportTypeName = getTransportTypeName(order.transportType);
    
    return [
      item.contract.id,
      order.id,
      order.title,
      order.originRegion,
      order.destinationRegion,
      originRegionName,
      originDistrictNames,
      destRegionName,
      destDistrictNames,
      transportTypeName
    ].filter(Boolean).join(' ');
  };

  const filteredContracts = filterData(
    contracts,
    filters,
    getSearchableText,
    (item) => [item.order.originRegion].filter(Boolean),
    (item) => item.order.transportType,
    (item) => item.order.loadDate,
    undefined,
    undefined,
    (item) => [item.order.destinationRegion].filter(Boolean)
  );

  const paginatedContracts = paginateData(filteredContracts, currentPage, pageSize);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  return (
    <section className="py-16 px-6 md:px-12">
      <div className="w-full">
        <h2 className="text-3xl font-bold text-center mb-12" data-testid="text-deals-title">
          {t.title}
        </h2>

        <TableSearchFilter
          language={language}
          onFilterChange={handleFilterChange}
          showRegionFilter={true}
          showTransportFilter={true}
          showDateFilter={true}
        />

        {filteredContracts.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">{t.noDealFound}</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto" ref={tableRef}>
              <Table className="min-w-full table-fixed">
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
                      style={{ width: columnWidths.contractNumber }}
                    >
                      {t.contractNumber}
                      <ResizeHandle column="contractNumber" />
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
                      style={{ width: columnWidths.contractAmount }}
                    >
                      {t.contractAmount}
                      <ResizeHandle column="contractAmount" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContracts.map((item: Contract) => (
                    <TableRow key={item.contract.id} data-testid={`row-deal-${item.contract.id}`}>
                      <TableCell 
                        data-testid={`text-order-id-${item.contract.id}`} 
                        className="text-sm"
                        style={{ width: columnWidths.orderNumber }}
                      >
                        <div className="font-semibold">#{item.order.id}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(item.order.createdAt)}</div>
                      </TableCell>
                      <TableCell 
                        data-testid={`text-contract-id-${item.contract.id}`} 
                        className="text-sm"
                        style={{ width: columnWidths.contractNumber }}
                      >
                        <div className="font-semibold">#{item.contract.id}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(item.contract.generatedAt)}</div>
                      </TableCell>
                      <TableCell 
                        data-testid={`text-route-${item.contract.id}`}
                        style={{ width: columnWidths.route }}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium">
                            {formatRoute(
                              item.order.originRegion,
                              item.order.originDistrict || [],
                              item.order.destinationRegion,
                              item.order.destinationDistrict || []
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell 
                        data-testid={`text-shipping-date-${item.contract.id}`}
                        style={{ width: columnWidths.shippingDate }}
                      >
                        {formatDate(item.order.loadDate)}
                      </TableCell>
                      <TableCell 
                        data-testid={`text-transport-type-${item.contract.id}`}
                        style={{ width: columnWidths.transportType }}
                      >
                        {getTransportTypeName(item.order.transportType)}
                      </TableCell>
                      <TableCell 
                        data-testid={`text-cargo-name-${item.contract.id}`}
                        style={{ width: columnWidths.cargoName }}
                      >
                        {item.order.title}
                      </TableCell>
                      <TableCell 
                        data-testid={`text-contract-amount-${item.contract.id}`}
                        style={{ width: columnWidths.contractAmount }}
                        className="font-medium"
                      >
                        {item.offerPrice 
                          ? `${Number(item.offerPrice).toLocaleString('ru-RU')} сум`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              language={language}
              totalItems={filteredContracts.length}
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
