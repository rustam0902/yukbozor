import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCreateOffer, useAllDeposits } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { formatAmountWithSpaces, parseFormattedAmount } from '@/lib/number-to-words';
import { formatMoney } from '@/lib/utils';

interface SubmitOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderTitle: string;
  orderPrice: number;
  requiresCollateral?: boolean;
  language: 'ru' | 'uz';
}

export function SubmitOfferDialog({ 
  isOpen, 
  onClose, 
  orderId, 
  orderTitle, 
  orderPrice, 
  requiresCollateral = false, 
  language 
}: SubmitOfferDialogProps) {
  const [price, setPrice] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: deposits } = useAllDeposits();
  const createOfferMutation = useCreateOffer();
  
  const mainDeposit = deposits?.find(d => d.accountType === 'main');
  const bonusDeposit = deposits?.find(d => d.accountType === 'registration_bonus');

  const isNdsPayer = user?.ndsPayer || false;

  const texts = {
    ru: {
      submitOffer: 'Отправить предложение',
      offerFor: 'Предложение для',
      enterPrice: 'Введите вашу цену',
      priceLabel: 'Цена с НДС (сум)',
      priceWithoutVat: 'Цена без НДС',
      collateral: 'Залог (2%)',
      commission: 'Комиссия платформы (0%)',
      totalBlocked: 'Итого блокируется',
      cancel: 'Отмена',
      submit: 'Отправить',
      success: 'Предложение успешно отправлено',
      error: 'Ошибка при отправке предложения',
      insufficientFunds: 'Недостаточно средств на депозите',
      blacklisted: 'Вы не можете отправить предложение, так как находитесь в чёрном списке заказчика',
      sum: 'сум'
    },
    uz: {
      submitOffer: 'Taklif yuborish',
      offerFor: 'Taklif',
      enterPrice: 'Narxingizni kiriting',
      priceLabel: 'QQS bilan narx (so\'m)',
      priceWithoutVat: 'QQSsiz narx',
      collateral: 'Garov (2%)',
      commission: 'Platforma komissiyasi (0%)',
      totalBlocked: 'Jami bloklanadi',
      cancel: 'Bekor qilish',
      submit: 'Yuborish',
      success: 'Taklif muvaffaqiyatli yuborildi',
      error: 'Taklif yuborishda xatolik',
      insufficientFunds: 'Depozitda mablag\' yetarli emas',
      blacklisted: 'Siz taklif yubora olmaysiz, chunki buyurtmachining qora ro\'yxatidasiz',
      sum: 'so\'m'
    }
  };

  const t = texts[language];
  
  const calculatePriceWithoutVat = (priceWithVat: number): string => {
    if (isNdsPayer) {
      // Divide by 1.12 and keep 2 decimal places for tiyin support
      return (priceWithVat / 1.12).toFixed(2);
    } else {
      return priceWithVat.toFixed(2);
    }
  };

  // Platform commission rate: 0% (change to 0.02 when billing resumes)
  const COMMISSION_RATE = 0;

  const handleSubmit = async () => {
    const priceValue = parseFloat(price.replace(',', '.'));
    if (!priceValue || priceValue <= 0 || isNaN(priceValue)) {
      toast({
        variant: "destructive",
        title: t.error,
        description: t.enterPrice
      });
      return;
    }

    try {
      const priceWithoutVatStr = calculatePriceWithoutVat(priceValue);
      await createOfferMutation.mutateAsync({
        orderId,
        data: { 
          price: priceValue.toString(),
          priceWithoutVat: priceWithoutVatStr,
          carrierId: user?.id
        }
      });
      
      toast({
        title: t.success,
      });
      setPrice('');
      onClose();
    } catch (error: any) {
      const errorMessage = error.message || '';
      let isBlacklisted = false;
      
      // Try to parse JSON from error message (format: "403: {...}")
      const jsonMatch = errorMessage.match(/^\d+:\s*(.+)$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.error === 'BLACKLISTED') {
            isBlacklisted = true;
          }
        } catch {}
      }
      
      // Fallback checks
      if (!isBlacklisted) {
        isBlacklisted = errorMessage.toUpperCase().includes('BLACKLISTED') || 
                        errorMessage.toLowerCase().includes('черн');
      }
      
      toast({
        variant: "destructive",
        title: isBlacklisted ? t.blacklisted : t.error,
        description: isBlacklisted ? undefined : errorMessage
      });
    }
  };

  const priceValue = price ? parseFloat(price.replace(',', '.')) || 0 : 0;
  const collateral = requiresCollateral ? Math.floor(orderPrice * 0.02) : 0;
  const commission = priceValue ? Math.floor(priceValue * COMMISSION_RATE) : 0;
  const totalBlocked = collateral + commission;
  const priceWithoutVatStr = priceValue ? calculatePriceWithoutVat(priceValue) : '0.00';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-submit-offer">
        <DialogHeader>
          <DialogTitle>{t.submitOffer}</DialogTitle>
          <DialogDescription>
            {t.offerFor}: {orderTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offer-price">{t.priceLabel}</Label>
            <Input
              id="offer-price"
              type="text"
              placeholder="1 000 000.00"
              value={formatAmountWithSpaces(price)}
              onChange={(e) => {
                // Allow digits, comma, and period for decimal input
                const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                // Only keep one decimal point
                const parts = cleaned.split('.');
                const formatted = parts.length > 1 
                  ? parts[0] + '.' + parts.slice(1).join('').slice(0, 2)
                  : parts[0];
                setPrice(formatted);
              }}
              data-testid="input-offer-price"
            />
          </div>
          {price && parseFormattedAmount(price) > 0 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t.priceWithoutVat}:</span>
                <span className="font-medium" data-testid="text-price-without-vat">{formatMoney(priceWithoutVatStr)} {t.sum}</span>
              </div>
              <div className="border-t pt-2 space-y-1">
                {requiresCollateral && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.collateral}:</span>
                    <span className="font-medium text-orange-600">{formatMoney(collateral)} {t.sum}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.commission}:</span>
                  <span className="font-medium text-green-600">{formatMoney(commission)} {t.sum}</span>
                </div>
                {totalBlocked > 0 && (
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>{t.totalBlocked}:</span>
                    <span className="text-orange-600" data-testid="text-total-blocked">{formatMoney(totalBlocked)} {t.sum}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-offer">
            {t.cancel}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createOfferMutation.isPending}
            data-testid="button-submit-offer"
          >
            {t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
