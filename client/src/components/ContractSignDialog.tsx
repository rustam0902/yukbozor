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
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Smartphone, RefreshCw, CheckCircle, AlertTriangle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEImzo } from '@/hooks/use-eimzo';
import { EImzoKey } from '@/lib/e-imzo';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ContractSignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: number;
  language: 'ru' | 'uz';
  userType: 'individual' | 'legal' | 'ip';
  userRole: 'customer' | 'carrier';
}

export function ContractSignDialog({
  isOpen,
  onClose,
  contractId,
  language,
  userType,
  userRole
}: ContractSignDialogProps) {
  const { toast } = useToast();
  const requiresEimzo = userType === 'legal' || userType === 'ip';

  const [step, setStep] = useState<'method' | 'eimzo' | 'sms_send' | 'sms_verify'>('method');
  const [smsCode, setSmsCode] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const eimzo = useEImzo();
  const [selectedKey, setSelectedKey] = useState<EImzoKey | null>(null);

  const texts = {
    ru: {
      title: 'Подписание договора',
      descriptionEimzo: 'Для юридических лиц и ИП требуется подпись с помощью ЭЦП (E-IMZO).',
      descriptionSms: 'Для физических лиц договор подписывается с помощью SMS-подтверждения.',
      chooseMethod: 'Выберите способ подписания',
      signWithEimzo: 'Подписать с ЭЦП (E-IMZO)',
      signWithSms: 'Подписать через SMS',
      selectKey: 'Выберите ключ для подписи',
      loadingKeys: 'Загрузка ключей...',
      noKeys: 'Ключи не найдены. Убедитесь, что E-IMZO.exe запущен.',
      refreshKeys: 'Обновить ключи',
      sign: 'Подписать',
      cancel: 'Отмена',
      back: 'Назад',
      sendCode: 'Отправить код',
      resendCode: 'Отправить повторно',
      resendIn: 'Повторно через',
      enterCode: 'Введите код из SMS',
      codeSent: 'SMS код отправлен на ваш номер телефона',
      verifyCode: 'Подтвердить',
      signing: 'Подписание...',
      sendingCode: 'Отправка кода...',
      verifying: 'Проверка...',
      success: 'Договор успешно подписан',
      error: 'Ошибка',
      eimzoNotInstalled: 'E-IMZO не установлен. Для работы ЭЦП необходимо запустить программу E-IMZO.exe.',
      initEimzo: 'Инициализировать E-IMZO',
      recheckEimzo: 'Проверить снова',
      onlyIndividuals: 'SMS подписание доступно только для физических лиц',
      keyName: 'Ключ',
      keySerial: 'Серийный номер',
      keyValid: 'Действителен до',
      keyOrganization: 'Организация'
    },
    uz: {
      title: 'Shartnomani imzolash',
      descriptionEimzo: 'Yuridik shaxslar va YaTT uchun ERI (E-IMZO) orqali imzo talab qilinadi.',
      descriptionSms: 'Jismoniy shaxslar uchun shartnoma SMS tasdiqlash orqali imzolanadi.',
      chooseMethod: 'Imzolash usulini tanlang',
      signWithEimzo: 'ERI bilan imzolash (E-IMZO)',
      signWithSms: 'SMS orqali imzolash',
      selectKey: 'Imzolash uchun kalitni tanlang',
      loadingKeys: 'Kalitlar yuklanmoqda...',
      noKeys: 'Kalitlar topilmadi. E-IMZO.exe ishga tushirilganligiga ishonch hosil qiling.',
      refreshKeys: 'Kalitlarni yangilash',
      sign: 'Imzolash',
      cancel: 'Bekor qilish',
      back: 'Orqaga',
      sendCode: 'Kod yuborish',
      resendCode: 'Qayta yuborish',
      resendIn: 'Qayta yuborish',
      enterCode: 'SMS dan kodni kiriting',
      codeSent: 'SMS kod telefon raqamingizga yuborildi',
      verifyCode: 'Tasdiqlash',
      signing: 'Imzolanmoqda...',
      sendingCode: 'Kod yuborilmoqda...',
      verifying: 'Tekshirilmoqda...',
      success: 'Shartnoma muvaffaqiyatli imzolandi',
      error: 'Xato',
      eimzoNotInstalled: 'E-IMZO o\'rnatilmagan. ERI ishlashi uchun E-IMZO.exe dasturini ishga tushirish kerak.',
      initEimzo: 'E-IMZO ni ishga tushirish',
      recheckEimzo: 'Qayta tekshirish',
      onlyIndividuals: 'SMS imzolash faqat jismoniy shaxslar uchun mavjud',
      keyName: 'Kalit',
      keySerial: 'Seriya raqami',
      keyValid: 'Amal qilish muddati',
      keyOrganization: 'Tashkilot'
    }
  };

  const t = texts[language];

  useEffect(() => {
    if (isOpen) {
      setStep(requiresEimzo ? 'eimzo' : 'sms_send');
      setSmsCode('');
      setCooldownSeconds(0);
      setSelectedKey(null);

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
      const res = await fetch(`/api/contracts/${contractId}/sms-sign/send`, {
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

  const verifySmsAndSignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/sms-sign/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: smsCode, language })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify SMS');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.success });
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

  const signWithEimzoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKey) throw new Error('No key selected');
      
      const keyId = await eimzo.loadKey(selectedKey);
      
      const contractRes = await fetch(`/api/contracts/${contractId}`, {
        credentials: 'include'
      });
      if (!contractRes.ok) throw new Error('Failed to fetch contract');
      const contract = await contractRes.json();
      
      if (!contract.contractContent) throw new Error('Contract content not available');
      
      const pkcs7 = await eimzo.signDocument(contract.contractContent);
      
      const signRes = await fetch(`/api/contracts/${contractId}/eimzo-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pkcs7 })
      });
      
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || 'Failed to sign contract');
      
      return signData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deposits'], exact: false });
      toast({ title: t.success });
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

  const handleClose = () => {
    setStep(requiresEimzo ? 'eimzo' : 'sms_send');
    setSmsCode('');
    setCooldownSeconds(0);
    setSelectedKey(null);
    onClose();
  };

  const renderEimzoStep = () => {
    if (!eimzo.isInstalled) {
      return (
        <div className="space-y-4 text-center py-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
          <p className="text-muted-foreground">{t.eimzoNotInstalled}</p>
          <Button 
            onClick={() => eimzo.recheckInstallation()} 
            disabled={eimzo.isLoading}
            data-testid="button-recheck-eimzo"
          >
            {eimzo.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {t.recheckEimzo}
          </Button>
        </div>
      );
    }

    if (!eimzo.isInitialized) {
      return (
        <div className="space-y-4 text-center py-4">
          <Button 
            onClick={async () => {
              const success = await eimzo.init();
              if (success) eimzo.loadKeys();
            }} 
            disabled={eimzo.isLoading}
            data-testid="button-init-eimzo"
          >
            {eimzo.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            {t.initEimzo}
          </Button>
        </div>
      );
    }

    if (eimzo.isLoading && eimzo.keys.length === 0) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>{t.loadingKeys}</span>
        </div>
      );
    }

    if (eimzo.keys.length === 0) {
      return (
        <div className="space-y-4 text-center py-4">
          <p className="text-muted-foreground">{t.noKeys}</p>
          <Button 
            variant="outline" 
            onClick={() => eimzo.refreshKeys()} 
            disabled={eimzo.isLoading}
            data-testid="button-refresh-keys"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t.refreshKeys}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Label>{t.selectKey}</Label>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {eimzo.keys.map((key) => (
            <div
              key={key.serialNumber}
              className={`p-3 border rounded-md cursor-pointer transition-colors ${
                selectedKey?.serialNumber === key.serialNumber
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedKey(key)}
              data-testid={`key-option-${key.serialNumber}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    <KeyRound className="h-4 w-4 flex-shrink-0" />
                    {key.CN || key.name}
                  </div>
                  {key.O && (
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {t.keyOrganization}: {key.O}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.keySerial}: {key.serialNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.keyValid}: {new Date(key.validTo).toLocaleDateString()}
                  </div>
                </div>
                {selectedKey?.serialNumber === key.serialNumber && (
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => eimzo.refreshKeys()}
            disabled={eimzo.isLoading}
            data-testid="button-refresh-keys-inline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${eimzo.isLoading ? 'animate-spin' : ''}`} />
            {t.refreshKeys}
          </Button>
        </div>
        
        {eimzo.error && (
          <div className="text-sm text-destructive mt-2">{eimzo.error}</div>
        )}
      </div>
    );
  };

  const renderSmsStep = () => {
    if (step === 'sms_send') {
      return (
        <div className="space-y-4 text-center py-4">
          <div className="flex justify-center">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <p className="text-muted-foreground">{t.descriptionSms}</p>
          <Button
            onClick={() => sendSmsMutation.mutate()}
            disabled={sendSmsMutation.isPending}
            data-testid="button-send-sms-code"
          >
            {sendSmsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t.sendingCode}
              </>
            ) : (
              t.sendCode
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t.codeSent}</p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="smsCode">{t.enterCode}</Label>
          <Input
            id="smsCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="text-center text-2xl tracking-widest"
            data-testid="input-sms-code"
          />
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sendSmsMutation.mutate()}
            disabled={cooldownSeconds > 0 || sendSmsMutation.isPending}
            data-testid="button-resend-sms"
          >
            {cooldownSeconds > 0 ? (
              <span className="text-muted-foreground">
                {t.resendIn} {cooldownSeconds}s
              </span>
            ) : sendSmsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t.resendCode
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {requiresEimzo ? (
              <Shield className="h-5 w-5" />
            ) : (
              <Smartphone className="h-5 w-5" />
            )}
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {requiresEimzo ? t.descriptionEimzo : t.descriptionSms}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {requiresEimzo ? renderEimzoStep() : renderSmsStep()}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-sign">
            {t.cancel}
          </Button>
          
          {requiresEimzo ? (
            <Button
              onClick={() => signWithEimzoMutation.mutate()}
              disabled={!selectedKey || signWithEimzoMutation.isPending || eimzo.isLoading}
              data-testid="button-sign-eimzo"
            >
              {signWithEimzoMutation.isPending || eimzo.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t.signing}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {t.sign}
                </>
              )}
            </Button>
          ) : step === 'sms_verify' ? (
            <Button
              onClick={() => verifySmsAndSignMutation.mutate()}
              disabled={smsCode.length !== 6 || verifySmsAndSignMutation.isPending}
              data-testid="button-verify-sms"
            >
              {verifySmsAndSignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t.verifying}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t.verifyCode}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
