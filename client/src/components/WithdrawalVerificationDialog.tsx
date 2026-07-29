import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Smartphone, RefreshCw, KeyRound, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEImzo } from '@/hooks/use-eimzo';
import { EImzoKey } from '@/lib/e-imzo';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatMoney } from '@/lib/utils';

interface WithdrawalVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language: 'ru' | 'uz';
  userType: 'individual' | 'legal' | 'ip';
  amount: number;
  sourceAccountType: 'main' | 'partner_reward';
  bankName?: string;
  bankAccount?: string;
}

export function WithdrawalVerificationDialog({
  isOpen,
  onClose,
  onSuccess,
  language,
  userType,
  amount,
  sourceAccountType,
  bankName,
  bankAccount,
}: WithdrawalVerificationDialogProps) {
  const { toast } = useToast();
  const requiresEimzo = userType === 'legal' || userType === 'ip';

  const [step, setStep] = useState<'card_input' | 'eimzo' | 'sms_verify'>('card_input');
  const [smsCode, setSmsCode] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');

  const eimzo = useEImzo();
  const [selectedKey, setSelectedKey] = useState<EImzoKey | null>(null);

  const texts = {
    ru: {
      title: 'Подтверждение вывода средств',
      descriptionEimzo: 'Для юридических лиц и ИП требуется подпись с помощью ЭЦП (E-IMZO).',
      descriptionSms: 'Подтвердите вывод средств с помощью SMS-кода.',
      selectKey: 'Выберите ключ для подписи',
      loadingKeys: 'Загрузка ключей...',
      noKeys: 'Ключи не найдены. Убедитесь, что E-IMZO.exe запущен.',
      refreshKeys: 'Обновить ключи',
      confirm: 'Подтвердить',
      cancel: 'Отмена',
      back: 'Назад',
      sendCode: 'Отправить код',
      resendCode: 'Отправить повторно',
      resendIn: 'Повторно через',
      enterCode: 'Введите код из SMS',
      codeSent: 'SMS код отправлен на ваш номер телефона',
      verifyCode: 'Подтвердить вывод',
      signing: 'Подписание...',
      sendingCode: 'Отправка кода...',
      verifying: 'Проверка...',
      success: 'Заявка на вывод создана',
      error: 'Ошибка',
      eimzoNotInstalled: 'E-IMZO не установлен. Для работы ЭЦП необходимо запустить программу E-IMZO.exe.',
      initEimzo: 'Инициализировать E-IMZO',
      recheckEimzo: 'Проверить снова',
      keyName: 'Ключ',
      keySerial: 'Серийный номер',
      keyValid: 'Действителен до',
      keyOrganization: 'Организация',
      withdrawalDetails: 'Детали вывода',
      amountLabel: 'Сумма',
      bankLabel: 'Банк',
      accountLabel: 'Счёт',
      sum: 'сум',
      cardNumberLabel: 'Номер пластиковой карты',
      cardExpiryLabel: 'Срок действия',
      cardNumberPlaceholder: 'XXXX XXXX XXXX XXXX',
      cardExpiryPlaceholder: 'ММ/ГГ',
      enterCardDetails: 'Введите данные пластиковой карты для получения средств',
      next: 'Далее',
      cardNumberError: 'Номер карты должен содержать 16 цифр',
      cardExpiryError: 'Срок действия должен быть в формате ММ/ГГ',
    },
    uz: {
      title: 'Mablag\' yechib olishni tasdiqlash',
      descriptionEimzo: 'Yuridik shaxslar va YaTT uchun ERI (E-IMZO) orqali imzo talab qilinadi.',
      descriptionSms: 'SMS kod orqali mablag\' yechib olishni tasdiqlang.',
      selectKey: 'Imzolash uchun kalitni tanlang',
      loadingKeys: 'Kalitlar yuklanmoqda...',
      noKeys: 'Kalitlar topilmadi. E-IMZO.exe ishga tushirilganligiga ishonch hosil qiling.',
      refreshKeys: 'Kalitlarni yangilash',
      confirm: 'Tasdiqlash',
      cancel: 'Bekor qilish',
      back: 'Orqaga',
      sendCode: 'Kod yuborish',
      resendCode: 'Qayta yuborish',
      resendIn: 'Qayta yuborish',
      enterCode: 'SMS dan kodni kiriting',
      codeSent: 'SMS kod telefon raqamingizga yuborildi',
      verifyCode: 'Yechib olishni tasdiqlash',
      signing: 'Imzolanmoqda...',
      sendingCode: 'Kod yuborilmoqda...',
      verifying: 'Tekshirilmoqda...',
      success: 'Yechib olish so\'rovi yaratildi',
      error: 'Xato',
      eimzoNotInstalled: 'E-IMZO o\'rnatilmagan. ERI ishlashi uchun E-IMZO.exe dasturini ishga tushirish kerak.',
      initEimzo: 'E-IMZO ni ishga tushirish',
      recheckEimzo: 'Qayta tekshirish',
      keyName: 'Kalit',
      keySerial: 'Seriya raqami',
      keyValid: 'Amal qilish muddati',
      keyOrganization: 'Tashkilot',
      withdrawalDetails: 'Yechib olish tafsilotlari',
      amountLabel: 'Summa',
      bankLabel: 'Bank',
      accountLabel: 'Hisob',
      sum: 'so\'m',
      cardNumberLabel: 'Plastik karta raqami',
      cardExpiryLabel: 'Amal qilish muddati',
      cardNumberPlaceholder: 'XXXX XXXX XXXX XXXX',
      cardExpiryPlaceholder: 'OO/YY',
      enterCardDetails: 'Mablag\' olish uchun plastik karta ma\'lumotlarini kiriting',
      next: 'Keyingisi',
      cardNumberError: 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak',
      cardExpiryError: 'Amal qilish muddati OO/YY formatida bo\'lishi kerak',
    }
  };

  const t = texts[language];

  const isIndividual = userType === 'individual';

  useEffect(() => {
    if (isOpen) {
      // For individuals: start with card input, for legal/IP: start with E-IMZO
      setStep(requiresEimzo ? 'eimzo' : 'card_input');
      setSmsCode('');
      setCooldownSeconds(0);
      setSelectedKey(null);
      setCardNumber('');
      setCardExpiry('');

      if (requiresEimzo && !eimzo.isInitialized && eimzo.isInstalled) {
        eimzo.init().then((success) => {
          if (success) {
            eimzo.loadKeys();
          }
        });
      }
    }
  }, [isOpen, requiresEimzo]);

  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/withdrawals/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS');
      return data;
    },
    onSuccess: () => {
      setCooldownSeconds(60);
      setStep('sms_verify');
    },
    onError: (error: any) => {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const submitWithdrawalMutation = useMutation({
    mutationFn: async (params: { smsCode?: string; eimzoSignature?: string }) => {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          sourceAccountType,
          language,
          smsCode: params.smsCode,
          eimzoSignature: params.eimzoSignature,
          // Card details for individuals
          cardNumber: isIndividual ? cardNumber : undefined,
          cardExpiry: isIndividual ? cardExpiry : undefined,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create withdrawal');
      return data;
    },
    onSuccess: () => {
      toast({
        title: t.success,
        variant: 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleEimzoSign = async () => {
    if (!selectedKey) return;

    try {
      // Step 1: Load the selected key (this prompts for password)
      console.log('[E-IMZO Withdrawal] Loading key:', selectedKey.CN);
      const keyId = await eimzo.loadKey(selectedKey);
      
      // Step 2: Create data to sign and sign it
      // Pass keyId directly because React setState is async
      const dataToSign = JSON.stringify({
        amount,
        sourceAccountType,
        timestamp: new Date().toISOString(),
      });

      console.log('[E-IMZO Withdrawal] Signing document with keyId...');
      const signature = await eimzo.signDocument(dataToSign, keyId);
      
      if (signature) {
        console.log('[E-IMZO Withdrawal] Signature created, submitting...');
        submitWithdrawalMutation.mutate({ eimzoSignature: signature });
      }
    } catch (error: any) {
      console.error('[E-IMZO Withdrawal] Error:', error);
      toast({
        title: t.error,
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const renderWithdrawalDetails = () => (
    <div className="bg-muted/50 p-4 rounded-lg space-y-2 mb-4">
      <p className="text-sm font-medium text-muted-foreground">{t.withdrawalDetails}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">{t.amountLabel}:</span>
        <span className="font-medium">{formatMoney(amount)} {t.sum}</span>
        {bankName && (
          <>
            <span className="text-muted-foreground">{t.bankLabel}:</span>
            <span className="font-medium">{bankName}</span>
          </>
        )}
        {bankAccount && (
          <>
            <span className="text-muted-foreground">{t.accountLabel}:</span>
            <span className="font-mono">{bankAccount}</span>
          </>
        )}
      </div>
    </div>
  );

  // Format card number with spaces (XXXX XXXX XXXX XXXX)
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  // Format card expiry (MM/YY)
  const formatCardExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      return digits.slice(0, 2) + '/' + digits.slice(2);
    }
    return digits;
  };

  // Validate card data
  const isCardValid = () => {
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    const validNumber = /^\d{16}$/.test(cleanCardNumber);
    const validExpiry = /^\d{2}\/\d{2}$/.test(cardExpiry);
    return validNumber && validExpiry;
  };

  const renderCardInputStep = () => (
    <div className="space-y-4">
      {renderWithdrawalDetails()}
      
      <div className="text-center py-2">
        <CreditCard className="h-12 w-12 text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t.enterCardDetails}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cardNumber">{t.cardNumberLabel}</Label>
          <Input
            id="cardNumber"
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder={t.cardNumberPlaceholder}
            className="text-center text-lg tracking-widest font-mono"
            maxLength={19}
            data-testid="input-card-number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardExpiry">{t.cardExpiryLabel}</Label>
          <Input
            id="cardExpiry"
            type="text"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
            placeholder={t.cardExpiryPlaceholder}
            className="text-center text-lg font-mono w-32"
            maxLength={5}
            data-testid="input-card-expiry"
          />
        </div>
      </div>

      <div className="text-center pt-2">
        <Smartphone className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">{t.descriptionSms}</p>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel">
          {t.cancel}
        </Button>
        <Button
          onClick={() => sendSmsMutation.mutate()}
          disabled={!isCardValid() || sendSmsMutation.isPending}
          data-testid="button-send-sms"
        >
          {sendSmsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.sendingCode}
            </>
          ) : (
            <>
              <Smartphone className="mr-2 h-4 w-4" />
              {t.sendCode}
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );

  const renderEimzoStep = () => (
    <div className="space-y-4">
      {renderWithdrawalDetails()}
      
      {!eimzo.isInstalled ? (
        <div className="text-center space-y-4 py-4">
          <Shield className="h-12 w-12 text-yellow-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{t.eimzoNotInstalled}</p>
          <Button 
            onClick={() => eimzo.recheckInstallation()}
            variant="outline"
            data-testid="button-check-eimzo"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.recheckEimzo}
          </Button>
        </div>
      ) : !eimzo.isInitialized ? (
        <div className="text-center space-y-4 py-4">
          <Shield className="h-12 w-12 text-blue-500 mx-auto" />
          <Button 
            onClick={async () => {
              const success = await eimzo.init();
              if (success) await eimzo.loadKeys();
            }}
            disabled={eimzo.isLoading}
            data-testid="button-init-eimzo"
          >
            {eimzo.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.loadingKeys}
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                {t.initEimzo}
              </>
            )}
          </Button>
        </div>
      ) : eimzo.isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">{t.loadingKeys}</p>
        </div>
      ) : eimzo.keys.length === 0 ? (
        <div className="text-center space-y-4 py-4">
          <Shield className="h-12 w-12 text-yellow-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{t.noKeys}</p>
          <Button 
            onClick={() => eimzo.loadKeys()}
            variant="outline"
            data-testid="button-refresh-keys"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.refreshKeys}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Label>{t.selectKey}</Label>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {eimzo.keys.map((key, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedKey === key ? 'border-primary bg-primary/5' : 'border-border hover-elevate'
                }`}
                onClick={() => setSelectedKey(key)}
                data-testid={`key-option-${idx}`}
              >
                <div className="font-medium text-sm">{key.CN}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {key.O && <span>{key.O}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.keyValid}: {key.validTo ? new Date(key.validTo).toLocaleDateString() : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel">
          {t.cancel}
        </Button>
        {eimzo.keys.length > 0 && (
          <Button
            onClick={handleEimzoSign}
            disabled={!selectedKey || submitWithdrawalMutation.isPending || eimzo.isLoading}
            data-testid="button-sign-eimzo"
          >
            {(submitWithdrawalMutation.isPending || eimzo.isLoading) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.signing}
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                {t.confirm}
              </>
            )}
          </Button>
        )}
      </DialogFooter>
    </div>
  );

  const renderSmsVerifyStep = () => (
    <div className="space-y-4">
      {renderWithdrawalDetails()}
      
      <div className="text-center">
        <Smartphone className="h-10 w-10 text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t.codeSent}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="smsCode">{t.enterCode}</Label>
        <Input
          id="smsCode"
          type="text"
          maxLength={6}
          value={smsCode}
          onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="text-center text-2xl tracking-widest font-mono"
          data-testid="input-sms-code"
        />
      </div>

      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => sendSmsMutation.mutate()}
          disabled={cooldownSeconds > 0 || sendSmsMutation.isPending}
          data-testid="button-resend-sms"
        >
          {cooldownSeconds > 0 ? (
            `${t.resendIn} ${cooldownSeconds} сек`
          ) : sendSmsMutation.isPending ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {t.sendingCode}
            </>
          ) : (
            t.resendCode
          )}
        </Button>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => setStep('card_input')} data-testid="button-back">
          {t.back}
        </Button>
        <Button
          onClick={() => submitWithdrawalMutation.mutate({ smsCode })}
          disabled={smsCode.length !== 6 || submitWithdrawalMutation.isPending}
          data-testid="button-verify-sms"
        >
          {submitWithdrawalMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.verifying}
            </>
          ) : (
            t.verifyCode
          )}
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-withdrawal-verification">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            {requiresEimzo ? t.descriptionEimzo : t.descriptionSms}
          </DialogDescription>
        </DialogHeader>

        {step === 'card_input' && renderCardInputStep()}
        {step === 'eimzo' && renderEimzoStep()}
        {step === 'sms_verify' && renderSmsVerifyStep()}
      </DialogContent>
    </Dialog>
  );
}
