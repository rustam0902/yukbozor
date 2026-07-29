import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import OrderCard from '@/components/OrderCard';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { OrderPageSEO } from '@/components/SEO';

interface OrderPageProps {
  params: {
    id: string;
  };
}

export default function OrderPage({ params }: OrderPageProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [location, setLocation] = useLocation() as any;
  const orderId = parseInt(params.id);

  const handleGoBack = () => {
    // Try to go back to previous path, or default to carrier offers
    if (location && location.includes('carrier')) {
      setLocation('/carrier/offers');
    } else if (location && location.includes('customer')) {
      setLocation('/customer/home');
    } else {
      setLocation('/carrier/offers');
    }
  };

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['/api/orders', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Order not found');
      }
      return res.json();
    },
    enabled: !!orderId,
  });

  const texts = {
    ru: {
      back: 'Вернуться',
      orderNotFound: 'Заказ не найден',
      loading: 'Загрузка...'
    },
    uz: {
      back: 'Ortga qaytish',
      orderNotFound: 'Buyurtma topilmadi',
      loading: 'Yuklanmoqda...'
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
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
                {t.orderNotFound}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <OrderPageSEO orderId={params.id} title={order?.title} lang={language as 'uz' | 'ru'} />
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <Button variant="outline" onClick={handleGoBack} className="gap-2" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Button>

        <OrderCard
          id={order.id.toString()}
          title={order.title}
          originRegion={order.originRegion}
          originDistrict={order.originDistrict}
          destinationRegion={order.destinationRegion}
          destinationDistrict={order.destinationDistrict}
          originPoints={order.originPoints}
          destinationPoints={order.destinationPoints}
          transportType={order.transportType}
          weight={Number(order.weightTons)}
          loadDate={order.loadDate}
          loadingTime={order.loadingTime}
          price={order.priceWithVat}
          priceWithoutVat={order.priceWithoutVat}
          prepaymentAmount={order.prepaymentAmount}
          notes={order.notes}
          status={order.status}
          deletedAt={order.deletedAt}
          isNonstandard={order.isNonstandard}
          isDangerous={order.isDangerous}
          isPartialLoad={order.isPartialLoad}
          language={language as 'ru' | 'uz'}
        />
      </div>
    </div>
  );
}
