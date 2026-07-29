import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useOrderOffers, useAcceptOffer, useRejectOffer } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import OfferCard from '@/components/OfferCard';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { formatDate } from '@/lib/dateFormat';

interface OffersDialogProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: 'ru' | 'uz';
  canAccept?: boolean;
  canReject?: boolean;
}

export function OffersDialog({ orderId, open, onOpenChange, language, canAccept = true, canReject = true }: OffersDialogProps) {
  const { toast } = useToast();
  const { data: offers, isLoading } = useOrderOffers(orderId || 0);
  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();

  const texts = {
    ru: {
      offers: 'Предложения',
      offersForOrder: 'Предложения для заказа',
      noOffers: 'Нет предложений для этого заказа',
      offerAccepted: 'Предложение принято',
      offerRejected: 'Предложение отклонено',
      error: 'Ошибка',
      loadingOffers: 'Загрузка предложений...'
    },
    uz: {
      offers: 'Takliflar',
      offersForOrder: 'Buyurtma uchun takliflar',
      noOffers: 'Bu buyurtma uchun takliflar yo\'q',
      offerAccepted: 'Taklif qabul qilindi',
      offerRejected: 'Taklif rad etildi',
      error: 'Xato',
      loadingOffers: 'Takliflar yuklanmoqda...'
    }
  };

  const t = texts[language];

  const handleAccept = async (offerId: number) => {
    try {
      await acceptOffer.mutateAsync(offerId);
      queryClient.invalidateQueries({ queryKey: ['/api/orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/representatives/principal-orders'], exact: false });
      toast({
        title: t.offerAccepted,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t.error,
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (offerId: number) => {
    try {
      await rejectOffer.mutateAsync(offerId);
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId, 'offers'] });
      toast({
        title: t.offerRejected,
      });
    } catch (error) {
      toast({
        title: t.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-offers">
        <DialogHeader>
          <DialogTitle>{t.offers}</DialogTitle>
          <DialogDescription>{t.offersForOrder}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : offers && offers.length > 0 ? (
            offers.map((offer: any) => {
              console.log('Offer data:', { id: offer.id, orderTitle: offer.order?.title, offer });
              return (
                <OfferCard
                  key={offer.id}
                  id={offer.id.toString()}
                  carrierName={offer.carrierName || `Carrier ${offer.carrierId}`}
                  carrierPhone={offer.carrierPhone}
                  carrierRating={offer.carrierRating || 4.5}
                  price={offer.price}
                  priceWithoutVat={offer.priceWithoutVat}
                  status={offer.status}
                  createdAt={formatDate(offer.createdAt)}
                  orderId={offer.orderId}
                  orderTitle={offer.order?.title}
                  onAccept={canAccept ? () => handleAccept(offer.id) : undefined}
                  onReject={canReject ? () => handleReject(offer.id) : undefined}
                  language={language}
                />
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-offers">
              {t.noOffers}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
