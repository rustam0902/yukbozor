import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePhoneInput } from '@/hooks/use-phone-input';
import { useEImzo } from '@/hooks/use-eimzo';
import { KeyRound, MessageSquare, Lock, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { LoginPageSEO } from '@/components/SEO';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  
  const phoneInput = usePhoneInput();
  const smsPhoneInput = usePhoneInput();
  
  const eimzo = useEImzo();
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // SMS login state
  const [smsCode, setSmsCode] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  
  // E-IMZO login state
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [eimzoLoading, setEimzoLoading] = useState(false);
  
  // E-IMZO account selection state (when multiple accounts exist for same PINFL)
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<Array<{
    userId: number;
    userType: string;
    companyName: string;
    inn: string;
    fullName: string;
  }>>([]);
  const [selectionToken, setSelectionToken] = useState<string>('');
  
  // Tab state for controlled switching
  const [activeTab, setActiveTab] = useState('password');

  // Auto-load E-IMZO keys when EDS tab is selected
  useEffect(() => {
    if (activeTab === 'eds' && eimzo.isInstalled && eimzo.keys.length === 0 && !eimzo.isLoading) {
      eimzo.loadKeys();
    }
  }, [activeTab, eimzo.isInstalled, eimzo.keys.length, eimzo.isLoading]);

  const texts = {
    ru: {
      title: 'Войти в систему',
      description: 'Введите ваши данные для входа',
      phone: 'Телефон',
      password: 'Пароль',
      submit: 'Войти',
      submitting: 'Вход...',
      noAccount: 'Нет аккаунта?',
      register: 'Зарегистрироваться',
      success: 'Вход выполнен успешно!',
      failed: 'Вы неправильно ввели телефонный номер или пароль',
      loginWithPassword: 'Пароль',
      loginWithSms: 'СМС код',
      loginWithEds: 'ЭЦП ключ',
      smsCode: 'Код из СМС',
      sendCode: 'Отправить код',
      resendCode: 'Отправить повторно',
      verify: 'Войти',
      smsDescription: 'Введите номер телефона и мы отправим вам код для входа',
      edsDescription: 'Выберите ваш ключ ЭЦП (E-IMZO) для входа в систему',
      selectEdsKey: 'Выбрать ключ ЭЦП',
      comingSoon: 'В разработке',
      smsSent: 'Код отправлен на ваш номер',
      enterCode: 'Введите 6-значный код из СМС',
      cooldownText: 'Повторная отправка через',
      seconds: 'сек',
      edsComingSoon: 'Интеграция с E-IMZO в разработке. Пожалуйста, используйте вход по паролю.',
      eimzoNotInstalled: 'E-IMZO не установлен. Пожалуйста, установите E-IMZO.exe и подключите ключ.',
      eimzoLoading: 'Загрузка ключей...',
      eimzoNoKeys: 'Ключи не найдены. Подключите USB ключ или смарт-карту.',
      eimzoSelectKey: 'Выберите ключ',
      eimzoRefreshKeys: 'Обновить список',
      eimzoSignIn: 'Войти с ЭЦП',
      eimzoSigning: 'Подписание...',
      eimzoUserNotFound: 'Пользователь не найден. Сначала зарегистрируйтесь и заполните профиль с ИНН/ПИНФЛ.',
      eimzoError: 'Ошибка при входе через ЭЦП',
      selectAccount: 'Выберите аккаунт',
      selectAccountDesc: 'У вас несколько аккаунтов. Выберите, в какой хотите войти:',
      accountTypeIp: 'ИП',
      accountTypeIndividual: 'Физ.лицо',
      accountTypeLegal: 'Юр.лицо',
      back: 'Назад'
    },
    uz: {
      title: 'Tizimga kirish',
      description: 'Kirish uchun ma\'lumotlaringizni kiriting',
      phone: 'Telefon',
      password: 'Parol',
      submit: 'Kirish',
      submitting: 'Kirish...',
      noAccount: 'Hisobingiz yo\'qmi?',
      register: 'Ro\'yxatdan o\'tish',
      success: 'Muvaffaqiyatli kirdingiz!',
      failed: 'Telefon raqami yoki parol noto\'g\'ri kiritildi',
      loginWithPassword: 'Parol',
      loginWithSms: 'SMS kod',
      loginWithEds: 'ERI kalit',
      smsCode: 'SMS dan kod',
      sendCode: 'Kod yuborish',
      resendCode: 'Qayta yuborish',
      verify: 'Kirish',
      smsDescription: 'Telefon raqamingizni kiriting va biz sizga kirish uchun kod yuboramiz',
      edsDescription: 'Tizimga kirish uchun ERI (E-IMZO) kalitingizni tanlang',
      selectEdsKey: 'ERI kalitini tanlash',
      comingSoon: 'Ishlab chiqilmoqda',
      smsSent: 'Kod raqamingizga yuborildi',
      enterCode: 'SMS dan 6 xonali kodni kiriting',
      cooldownText: 'Qayta yuborish',
      seconds: 'son',
      edsComingSoon: 'E-IMZO bilan integratsiya ishlab chiqilmoqda. Iltimos, parol bilan kirishni ishlating.',
      eimzoNotInstalled: 'E-IMZO o\'rnatilmagan. Iltimos, E-IMZO.exe dasturini o\'rnating va kalitni ulang.',
      eimzoLoading: 'Kalitlar yuklanmoqda...',
      eimzoNoKeys: 'Kalitlar topilmadi. USB kalit yoki smart-kartani ulang.',
      eimzoSelectKey: 'Kalitni tanlang',
      eimzoRefreshKeys: 'Ro\'yxatni yangilash',
      eimzoSignIn: 'ERI bilan kirish',
      eimzoSigning: 'Imzolanmoqda...',
      eimzoUserNotFound: 'Foydalanuvchi topilmadi. Avval ro\'yxatdan o\'ting va profilni INN/PINFL bilan to\'ldiring.',
      eimzoError: 'ERI orqali kirishda xatolik',
      selectAccount: 'Hisobni tanlang',
      selectAccountDesc: 'Sizda bir nechta hisob mavjud. Qaysi hisobga kirishni tanlang:',
      accountTypeIp: 'YaTT',
      accountTypeIndividual: 'Jismoniy shaxs',
      accountTypeLegal: 'Yuridik shaxs',
      back: 'Orqaga'
    }
  };

  const t = texts[language];

  useEffect(() => {
    if (user) {
      setLocation(`/${user.defaultRole}`);
    }
  }, [user, setLocation]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phoneInput.getFullPhone(),
          password,
          language
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ title: t.success });
        window.location.reload();
      } else {
        // Show server's error message (e.g., certificate expired message)
        toast({ 
          title: data.error || t.failed,
          variant: 'destructive'
        });
        
        // If certificate expired, auto-switch to E-IMZO tab
        if (data.code === 'EIMZO_CERT_EXPIRED') {
          setActiveTab('eds');
        }
        
        setLoading(false);
      }
    } catch (error: any) {
      toast({ 
        title: t.failed,
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const handleSendSms = async () => {
    setSmsSending(true);
    try {
      const response = await fetch('/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: smsPhoneInput.getFullPhone(),
          purpose: 'login',
          language
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSmsSent(true);
        setCooldown(60);
        toast({ title: t.smsSent });
      } else {
        if (data.lockoutRemaining) {
          setCooldown(data.lockoutRemaining);
        } else if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        toast({ 
          title: data.error || t.failed,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({ 
        title: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка',
        variant: 'destructive'
      });
    } finally {
      setSmsSending(false);
    }
  };

  const handleSmsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsVerifying(true);

    try {
      const response = await fetch('/api/auth/login-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: smsPhoneInput.getFullPhone(),
          code: smsCode,
          language
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ title: t.success });
        window.location.reload();
      } else {
        toast({ 
          title: data.error || t.failed,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({ 
        title: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка',
        variant: 'destructive'
      });
    } finally {
      setSmsVerifying(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'uz' : 'ru');
  };

  // E-IMZO login handler
  const handleEimzoLogin = async () => {
    if (!selectedKeyId) {
      toast({
        title: t.eimzoSelectKey,
        variant: 'destructive'
      });
      return;
    }

    setEimzoLoading(true);
    try {
      // Sign E-IMZO server-provided challenge with the selected key
      // Challenge comes from e-imzo-server and is validated by it during /backend/auth
      const signResult = await eimzo.signForAuth(selectedKeyId);
      
      if (!signResult.success || !signResult.pkcs7) {
        toast({
          title: signResult.error || t.eimzoError,
          variant: 'destructive'
        });
        return;
      }

      console.log('[E-IMZO Login] Sending PKCS7 to server for verification...');
      
      // Send to backend for verification and login
      // E-IMZO server validates both signature AND challenge (no challengeId needed on our side)
      const response = await fetch('/api/auth/login-eimzo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pkcs7: signResult.pkcs7,
          language
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Check if account selection is needed (multiple accounts for same PINFL)
        if (data.needAccountSelection && data.accounts && data.selectionToken) {
          setAvailableAccounts(data.accounts);
          setSelectionToken(data.selectionToken);
          setShowAccountSelection(true);
          return;
        }
        toast({ title: t.success });
        window.location.reload();
      } else if (response.status === 404) {
        // User not found - show info about registering first
        toast({
          title: t.eimzoUserNotFound,
          description: data.signerInfo ? `${data.signerInfo.CN}` : undefined,
          variant: 'destructive'
        });
      } else {
        toast({
          title: data.error || t.eimzoError,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('E-IMZO login error:', error);
      toast({
        title: t.eimzoError,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setEimzoLoading(false);
    }
  };

  // Handle account selection after E-IMZO verification
  const handleSelectAccount = async (userId: number) => {
    setEimzoLoading(true);
    try {
      const response = await fetch('/api/auth/eimzo-select-account', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept-Language': language 
        },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          selectionToken
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: t.success });
        window.location.reload();
      } else {
        toast({
          title: data.error || t.eimzoError,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('E-IMZO select account error:', error);
      toast({
        title: t.eimzoError,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setEimzoLoading(false);
    }
  };

  // Get user type label
  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case 'ip': return t.accountTypeIp;
      case 'individual': return t.accountTypeIndividual;
      case 'legal': return t.accountTypeLegal;
      default: return userType;
    }
  };

  // If showing account selection, render that instead of login form
  if (showAccountSelection) {
    return (
      <div className="min-h-screen flex flex-col p-4 bg-muted/30">
        <LoginPageSEO lang={language} />
        <div className="mb-4">
          <button 
            onClick={() => setLocation('/')} 
            className="flex items-center cursor-pointer" 
            data-testid="link-logo"
          >
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-primary">YUK</span>
              <span className="mx-1"></span>
              <span className="text-destructive">BOZOR</span>
            </span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">{t.selectAccount}</CardTitle>
              <CardDescription>{t.selectAccountDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableAccounts.map((account) => (
                <Button
                  key={account.userId}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleSelectAccount(account.userId)}
                  disabled={eimzoLoading}
                  data-testid={`button-select-account-${account.userId}`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">{account.companyName || account.fullName}</span>
                    <span className="text-sm text-muted-foreground">
                      {getUserTypeLabel(account.userType)} • ИНН: {account.inn}
                    </span>
                  </div>
                </Button>
              ))}
              
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowAccountSelection(false);
                  setAvailableAccounts([]);
                  setSelectionToken('');
                }}
                disabled={eimzoLoading}
                data-testid="button-back-to-login"
              >
                {t.back}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 bg-muted/30">
      <LoginPageSEO lang={language} />
      <div className="mb-4">
        <button 
          onClick={() => setLocation('/')} 
          className="flex items-center cursor-pointer" 
          data-testid="link-logo"
        >
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-primary">YUK</span>
            <span className="mx-1"></span>
            <span className="text-destructive">BOZOR</span>
          </span>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{t.title}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={toggleLanguage}
              data-testid="button-toggle-language"
            >
              {language === 'ru' ? 'RU' : 'UZ'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="password" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-password">
                <Lock className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.loginWithPassword}</span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-sms">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.loginWithSms}</span>
              </TabsTrigger>
              <TabsTrigger value="eds" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-eds">
                <KeyRound className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.loginWithEds}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phone}</Label>
                  <Input
                    id="phone"
                    {...phoneInput.inputProps}
                    required
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                  {loading ? t.submitting : t.submit}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sms">
              <form onSubmit={handleSmsLogin} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {smsSent ? t.enterCode : t.smsDescription}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="phone-sms">{t.phone}</Label>
                  <Input
                    id="phone-sms"
                    {...smsPhoneInput.inputProps}
                    disabled={smsSent}
                    required
                    data-testid="input-phone-sms"
                  />
                </div>

                {!smsSent ? (
                  <Button 
                    type="button"
                    className="w-full" 
                    onClick={handleSendSms}
                    disabled={smsSending || !smsPhoneInput.isComplete || cooldown > 0}
                    data-testid="button-send-sms"
                  >
                    {smsSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t.sendCode}...
                      </>
                    ) : cooldown > 0 ? (
                      `${t.cooldownText} ${cooldown} ${t.seconds}`
                    ) : (
                      t.sendCode
                    )}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="sms-code">{t.smsCode}</Label>
                      <Input
                        id="sms-code"
                        type="text"
                        inputMode="numeric"
                        placeholder="______"
                        maxLength={6}
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="text-center text-2xl tracking-widest"
                        data-testid="input-sms-code"
                      />
                    </div>
                    <Button 
                      type="submit"
                      className="w-full" 
                      disabled={smsVerifying || smsCode.length !== 6}
                      data-testid="button-verify-sms"
                    >
                      {smsVerifying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t.verify}...
                        </>
                      ) : (
                        t.verify
                      )}
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost"
                      className="w-full" 
                      onClick={handleSendSms}
                      disabled={smsSending || cooldown > 0}
                      data-testid="button-resend-sms"
                    >
                      {cooldown > 0 ? (
                        `${t.cooldownText} ${cooldown} ${t.seconds}`
                      ) : (
                        t.resendCode
                      )}
                    </Button>
                  </>
                )}
              </form>
            </TabsContent>

            <TabsContent value="eds">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t.edsDescription}</p>
                
                {/* E-IMZO Status */}
                {!eimzo.isInstalled ? (
                  <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-destructive font-medium">
                        {t.eimzoNotInstalled}
                      </p>
                      <a 
                        href="https://e-imzo.uz/main/download" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Download E-IMZO
                      </a>
                    </div>
                  </div>
                ) : eimzo.isLoading ? (
                  <div className="p-4 rounded-md bg-muted/50 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t.eimzoLoading}</span>
                  </div>
                ) : eimzo.keys.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-md bg-muted/50 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{t.eimzoNoKeys}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => eimzo.loadKeys()}
                      data-testid="button-refresh-eimzo-keys"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t.eimzoRefreshKeys}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Key selector */}
                    <div className="space-y-2">
                      <Label>{t.eimzoSelectKey}</Label>
                      <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                        <SelectTrigger data-testid="select-eimzo-key">
                          <SelectValue placeholder={t.eimzoSelectKey} />
                        </SelectTrigger>
                        <SelectContent>
                          {eimzo.keys.filter(key => key.serialNumber || key.id).map((key) => (
                            <SelectItem key={key.serialNumber || key.id} value={key.serialNumber || key.id}>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{key.CN}</span>
                                <span className="text-xs text-muted-foreground">
                                  {key.O && `${key.O} • `}
                                  {key.TIN && `ИНН: ${key.TIN}`}
                                  {key.PINFL && ` • ПИНФЛ: ${key.PINFL}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selected key info */}
                    {selectedKeyId && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/10 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="text-sm">
                          {eimzo.keys.find(k => k.serialNumber === selectedKeyId)?.CN}
                        </div>
                      </div>
                    )}

                    {/* Login button */}
                    <Button 
                      className="w-full"
                      onClick={handleEimzoLogin}
                      disabled={!selectedKeyId || eimzoLoading}
                      data-testid="button-eimzo-login"
                    >
                      {eimzoLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t.eimzoSigning}
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 h-4 w-4" />
                          {t.eimzoSignIn}
                        </>
                      )}
                    </Button>

                    {/* Refresh keys button */}
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => eimzo.loadKeys()}
                      data-testid="button-refresh-keys"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t.eimzoRefreshKeys}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm text-muted-foreground mt-6">
            {t.noAccount}{' '}
            <a href="/register" className="text-primary hover:underline">
              {t.register}
            </a>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
