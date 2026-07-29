import { AlertCircle, LogIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';

interface ExpiredCertificateModalProps {
  open: boolean;
  onLogoutAndLogin: () => void;
  validTo?: string | null;
}

export function ExpiredCertificateModal({ open, onLogoutAndLogin, validTo }: ExpiredCertificateModalProps) {
  const { language } = useLanguage();
  
  const texts = {
    ru: {
      title: 'Срок действия сертификата ЭЦП истёк',
      description: 'Срок действия вашего сертификата E-IMZO истёк. Пожалуйста, войдите с новой ЭЦП для продолжения работы на платформе.',
      expiredOn: 'Сертификат истёк',
      noCertificate: 'Сертификат E-IMZO не привязан к аккаунту',
      loginWithNewKey: 'Войти с новой ЭЦП',
    },
    uz: {
      title: 'ERI sertifikati muddati tugagan',
      description: 'E-IMZO sertifikatingiz muddati tugagan. Platformada ishlashni davom ettirish uchun yangi ERI bilan kiring.',
      expiredOn: 'Sertifikat muddati tugagan',
      noCertificate: 'E-IMZO sertifikati akkauntga bog\'lanmagan',
      loginWithNewKey: 'Yangi ERI bilan kirish',
    }
  };

  const t = texts[language];

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-lg">{t.title}</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-muted-foreground mb-4">{t.description}</p>
          
          {validTo ? (
            <div className="bg-destructive/10 rounded-md p-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive font-medium">
                {t.expiredOn}: {formatDate(validTo)}
              </span>
            </div>
          ) : (
            <div className="bg-amber-500/10 rounded-md p-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                {t.noCertificate}
              </span>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            onClick={onLogoutAndLogin}
            className="w-full"
            data-testid="button-logout-login-new-cert"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {t.loginWithNewKey}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
