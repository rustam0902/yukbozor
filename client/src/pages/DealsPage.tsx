import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { DealsPageSEO } from "@/components/SEO";
import { formatDate } from "@/lib/dateFormat";

interface Contract {
  contract: {
    id: number;
    orderId: number;
    status: string;
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
  };
}

export default function DealsPage() {
  const { language } = useLanguage();
  const { user } = useAuth();

  const texts = {
    ru: {
      title: 'Сделки',
      orderNumber: 'Номер заказа',
      contractNumber: 'Номер договора',
      route: 'Маршрут',
      shippingDate: 'Дата отгрузки',
      transportType: 'Тип транспорта',
      cargoName: 'Название груза',
      loading: 'Загрузка...',
      noDealFound: 'Сделок не найдено',
      routeFormat: '{from} → {to}',
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
      title: 'Shartnomalar',
      orderNumber: 'Buyurtma raqami',
      contractNumber: 'Shartnoma raqami',
      route: 'Marshrut',
      shippingDate: 'Jo\'natish sanasi',
      transportType: 'Transport turi',
      cargoName: 'Yuk nomi',
      loading: 'Yuklanmoqda...',
      noDealFound: 'Shartnomalar topilmadi',
      routeFormat: '{from} → {to}',
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

  const { data: contracts = [], isLoading, error } = useQuery<Contract[]>({
    queryKey: ['/api/contracts/my'],
    enabled: !!user
  });

  const formatRoute = (originRegion: string, originDistricts: string[], destRegion: string, destDistricts: string[]) => {
    const originDistrict = originDistricts?.[0] || '';
    const destDistrict = destDistricts?.[0] || '';
    return t.routeFormat
      .replace('{from}', `${originRegion}${originDistrict ? `, ${originDistrict}` : ''}`)
      .replace('{to}', `${destRegion}${destDistrict ? `, ${destDistrict}` : ''}`);
  };

  const getTransportTypeName = (type: string) => {
    return t.transportTypes[type as keyof typeof t.transportTypes] || type;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <DealsPageSEO lang={language} />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8" data-testid="text-deals-title">{t.title}</h1>

        {error ? (
          <Card className="p-6">
            <p className="text-destructive">{error instanceof Error ? error.message : 'Error loading deals'}</p>
          </Card>
        ) : contracts.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">{t.noDealFound}</p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.orderNumber}</TableHead>
                  <TableHead>{t.contractNumber}</TableHead>
                  <TableHead>{t.route}</TableHead>
                  <TableHead>{t.shippingDate}</TableHead>
                  <TableHead>{t.transportType}</TableHead>
                  <TableHead>{t.cargoName}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts?.map?.((item: Contract) => (
                  <TableRow key={item.contract.id} data-testid={`row-deal-${item.contract.id}`}>
                    <TableCell data-testid={`text-order-id-${item.contract.id}`}>
                      #{item.order.id}
                    </TableCell>
                    <TableCell data-testid={`text-contract-id-${item.contract.id}`}>
                      #{item.contract.id}
                    </TableCell>
                    <TableCell data-testid={`text-route-${item.contract.id}`}>
                      {formatRoute(
                        item.order.originRegion,
                        item.order.originDistrict || [],
                        item.order.destinationRegion,
                        item.order.destinationDistrict || []
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-shipping-date-${item.contract.id}`}>
                      {formatDate(item.order.loadDate)}
                    </TableCell>
                    <TableCell data-testid={`text-transport-type-${item.contract.id}`}>
                      {getTransportTypeName(item.order.transportType)}
                    </TableCell>
                    <TableCell data-testid={`text-cargo-name-${item.contract.id}`}>
                      {item.order.title}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
