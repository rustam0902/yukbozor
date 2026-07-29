import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from '@/components/AppSidebar';
import Header from '@/components/Header';
import { formatMoney } from '@/lib/utils';
import StatsCard from '@/components/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, DollarSign, Copy, Check, Link2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { usePartnerInfo, usePartnerClients, usePartnerCommissions, usePartnerEnroll } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/language-context';
import { partnerSectionResolver, type PartnerSection } from '@/lib/partnerSections';
import { DashboardSectionError } from '@/components/DashboardSectionError';
import { Deposit } from '@/components/Deposit';
import { ProfileView } from '@/components/ProfileView';
import { formatDate } from '@/lib/dateFormat';

interface PartnerDashboardMainProps {
  language: 'ru' | 'uz';
  setLanguage: (lang: 'ru' | 'uz') => void;
  user: any;
  renderContent: () => JSX.Element;
}

function PartnerDashboardMain({ language, setLanguage, user, renderContent }: PartnerDashboardMainProps) {
  const { toggleSidebar } = useSidebar();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        userRole={user.roles}
        currentRole="partner"
        userName={user.displayName}
        onMenuClick={toggleSidebar}
        sticky={false}
      />
      <main className="flex-1 overflow-auto min-h-0">
        {renderContent()}
      </main>
    </div>
  );
}

interface PartnerDashboardProps {
  section?: string;
}

export default function PartnerDashboard({ section }: PartnerDashboardProps) {
  const { language, setLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: clients, isLoading: clientsLoading } = usePartnerClients();
  const { data: commissions, isLoading: commissionsLoading } = usePartnerCommissions();
  const { data: partnerInfo, isLoading: partnerInfoLoading, error: partnerInfoError } = usePartnerInfo();
  const enrollMutation = usePartnerEnroll();
  const resolvedSection = partnerSectionResolver.resolveSection(section);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.roles.includes('partner')) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);


  // Auto-enroll if partner info not found (404 only)
  useEffect(() => {
    if (partnerInfoError && !partnerInfoLoading && !enrollMutation.isPending) {
      // Trigger enrollment ONLY on 404 error (partner profile not found)
      // Cast error to check status - only enroll if it's specifically a 404
      const error = partnerInfoError as any;
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        enrollMutation.mutate();
      }
    }
  }, [partnerInfoError, partnerInfoLoading, enrollMutation]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (resolvedSection === null && section) {
    return (
      <DashboardSectionError
        invalidSection={section}
        validSections={partnerSectionResolver.sections}
        dashboardPath="/partner"
        dashboardName="Partner Dashboard"
      />
    );
  }

  const activeSection = resolvedSection || 'home';

  const style = {
    "--sidebar-width": "16rem",
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return <DashboardHome language={language} clients={clients} clientsLoading={clientsLoading} commissions={commissions} commissionsLoading={commissionsLoading} />;
      case 'clients':
        return <MyClients language={language} clients={clients} clientsLoading={clientsLoading} />;
      case 'commissions':
        return <Commissions language={language} commissions={commissions} commissionsLoading={commissionsLoading} />;
      case 'deposit':
        return <Deposit language={language} />;
      case 'referral':
        return <ReferralProgram language={language} partnerInfo={partnerInfo} partnerInfoLoading={partnerInfoLoading} clients={clients} />;
      case 'profile':
        return <Profile language={language} />;
      default:
        return <DashboardHome language={language} clients={clients} clientsLoading={clientsLoading} commissions={commissions} commissionsLoading={commissionsLoading} />;
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          role="partner" 
          language={language} 
          activePath={`/partner${activeSection === 'home' ? '' : '/' + activeSection}`}
          onNavigate={(path) => setLocation(path)}
        />
        <PartnerDashboardMain 
          language={language}
          setLanguage={setLanguage}
          user={user}
          renderContent={renderContent}
        />
      </div>
    </SidebarProvider>
  );
}

function DashboardHome({ language, clients, clientsLoading, commissions, commissionsLoading }: { language: 'ru' | 'uz'; clients: any; clientsLoading: boolean; commissions: any; commissionsLoading: boolean }) {
  const texts = {
    ru: {
      myClients: 'Приглашённые',
      totalClients: 'Всего приглашённых',
      monthlyCommission: 'Комиссия за месяц',
      totalEarnings: 'Всего заработано',
      clients: 'Приглашённые',
      registrationPartner: 'Партнёр при регистрации',
      permanentPartner: 'Постоянный партнёр',
      active: 'Активен',
      monthlyCommissions: 'Помесячные комиссии',
      currency: 'сум',
      noClients: 'Нет приглашённых',
      noCommissions: 'Нет комиссий',
      attachedSince: 'Прикреплен с:'
    },
    uz: {
      myClients: 'Taklif etilganlar',
      totalClients: 'Jami taklif etilganlar',
      monthlyCommission: 'Oylik komissiya',
      totalEarnings: 'Jami daromad',
      clients: 'Taklif etilganlar',
      registrationPartner: 'Ro\'yxatdan o\'tish hamkori',
      permanentPartner: 'Doimiy hamkor',
      active: 'Faol',
      monthlyCommissions: 'Oylik komissiyalar',
      currency: 'so\'m',
      noClients: 'Taklif etilganlar yo\'q',
      noCommissions: 'Komissiyalar yo\'q',
      attachedSince: 'Biriktirilgan sana:'
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  const totalClients = clients?.length || 0;
  const currentMonthCommission = commissions?.filter((c: any) => c.status === 'calculated').reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
  const totalEarnings = commissions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{t.myClients}</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            title={t.totalClients}
            value={totalClients}
            icon={Users}
          />
          <StatsCard
            title={t.monthlyCommission}
            value={`${Math.round(currentMonthCommission / 1000)}K`}
            icon={TrendingUp}
          />
          <StatsCard
            title={t.totalEarnings}
            value={`${(totalEarnings / 1000000).toFixed(2)}M`}
            icon={DollarSign}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.clients}</CardTitle>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="space-y-4">
                {clients.map((client: any) => (
                  <div 
                    key={client.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-md"
                    data-testid={`client-${client.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{client.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {client.type === 'permanent_partner' ? t.permanentPartner : t.registrationPartner}
                      </div>
                      {client.createdAt && (
                        <div className="text-xs text-muted-foreground mt-1" data-testid={`client-date-${client.id}`}>
                          {t.attachedSince} {formatDate(client.createdAt)}
                        </div>
                      )}
                    </div>
                    <Badge className="bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">
                      {t.active}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noClients}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.monthlyCommissions}</CardTitle>
          </CardHeader>
          <CardContent>
            {commissionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : commissions && commissions.length > 0 ? (
              <div className="space-y-3">
                {commissions.map((commission: any) => (
                  <div 
                    key={commission.periodMonth}
                    className="flex items-center justify-between p-3 bg-muted rounded-md"
                    data-testid={`commission-${commission.periodMonth}`}
                  >
                    <span className="text-sm font-medium">{commission.periodMonth}</span>
                    <span className="font-semibold">
                      {formatMoney(commission.amount)} {t.currency}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noCommissions}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MyClients({ language, clients, clientsLoading }: { language: 'ru' | 'uz'; clients: any; clientsLoading: boolean }) {
  const texts = {
    ru: {
      myClients: 'Приглашённые',
      registrationPartner: 'Партнёр при регистрации',
      permanentPartner: 'Постоянный партнёр',
      active: 'Активен',
      noClients: 'Нет приглашённых',
      attachedSince: 'Прикреплен с:'
    },
    uz: {
      myClients: 'Taklif etilganlar',
      registrationPartner: 'Ro\'yxatdan o\'tish hamkori',
      permanentPartner: 'Doimiy hamkor',
      active: 'Faol',
      noClients: 'Taklif etilganlar yo\'q',
      attachedSince: 'Biriktirilgan sana:'
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{t.myClients}</h1>
        <Card>
          <CardContent className="pt-6">
            {clientsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="space-y-4">
                {clients.map((client: any) => (
                  <div 
                    key={client.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-md"
                    data-testid={`client-${client.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{client.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {client.type === 'permanent_partner' ? t.permanentPartner : t.registrationPartner}
                      </div>
                      {client.createdAt && (
                        <div className="text-xs text-muted-foreground mt-1" data-testid={`client-date-${client.id}`}>
                          {t.attachedSince} {formatDate(client.createdAt)}
                        </div>
                      )}
                    </div>
                    <Badge className="bg-green-500 text-white no-default-hover-elevate no-default-active-elevate">
                      {t.active}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noClients}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Commissions({ language, commissions, commissionsLoading }: { language: 'ru' | 'uz'; commissions: any; commissionsLoading: boolean }) {
  const texts = {
    ru: {
      commissions: 'Комиссии',
      monthlyCommissions: 'Помесячные комиссии',
      currency: 'сум',
      noCommissions: 'Нет комиссий',
      total: 'Всего за месяц:'
    },
    uz: {
      commissions: 'Komissiyalar',
      monthlyCommissions: 'Oylik komissiyalar',
      currency: 'so\'m',
      noCommissions: 'Komissiyalar yo\'q',
      total: 'Oylik jami:'
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  const monthNames = {
    ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
  };

  const formatMonthName = (periodMonth: string): string => {
    // periodMonth format: "2025-11" or similar
    try {
      const [year, month] = periodMonth.split('-');
      const monthNum = parseInt(month) - 1;
      const monthName = (monthNames[language as 'ru' | 'uz'] || monthNames.ru)[monthNum];
      return `${monthName} ${year}`;
    } catch {
      return periodMonth;
    }
  };

  // API already groups and sums by month, just sort and format
  const groupedByMonth = commissions && commissions.length > 0 
    ? [...commissions].sort((a: any, b: any) => b.month.localeCompare(a.month))
    : [];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{t.commissions}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{t.monthlyCommissions}</CardTitle>
          </CardHeader>
          <CardContent>
            {commissionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : groupedByMonth.length > 0 ? (
              <div className="space-y-3">
                {groupedByMonth.map((commission: any) => (
                  <div 
                    key={commission.month}
                    className="flex items-center justify-between p-4 bg-muted rounded-md"
                    data-testid={`commission-${commission.month}`}
                  >
                    <span className="text-sm font-medium">{formatMonthName(commission.month)}</span>
                    <span className="font-semibold text-lg">
                      {formatMoney(commission.amount)} {t.currency}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t.noCommissions}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReferralProgram({ language, partnerInfo, partnerInfoLoading, clients }: { language: 'ru' | 'uz'; partnerInfo: any; partnerInfoLoading: boolean; clients: any }) {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const texts = {
    ru: {
      referralProgram: 'Реферальная программа',
      yourReferralCode: 'Ваш реферальный код',
      referralLink: 'Реферальная ссылка',
      copyCode: 'Копировать код',
      copyLink: 'Копировать ссылку',
      copied: 'Скопировано!',
      registeredClients: 'Зарегистрированных клиентов',
      shareText: 'Поделитесь этой ссылкой или кодом с клиентами для получения комиссий с их заказов.',
      howItWorks: 'Как это работает',
      step1: 'Поделитесь ссылкой или кодом с клиентом',
      step2: 'Клиент регистрируется используя вашу ссылку или код',
      step3: 'Получайте 30% от комиссии Платформы с каждого завершенного заказа',
    },
    uz: {
      referralProgram: 'Referal dasturi',
      yourReferralCode: 'Sizning referal kodingiz',
      referralLink: 'Referal havola',
      copyCode: 'Kodni nusxalash',
      copyLink: 'Havolani nusxalash',
      copied: 'Nusxalandi!',
      registeredClients: 'Ro\'yxatdan o\'tgan mijozlar',
      shareText: 'Ularning buyurtmalaridan komissiya olish uchun mijozlar bilan ushbu havola yoki kodni baham ko\'ring.',
      howItWorks: 'Qanday ishlaydi',
      step1: 'Mijoz bilan havola yoki kodni baham ko\'ring',
      step2: 'Mijoz sizning havolangiz yoki kodingizdan foydalanib ro\'yxatdan o\'tadi',
      step3: 'Har bir tugallangan buyurtmadan Platforma komissiyasining 30% miqdorida bonus oling',
    }
  };

  const t = texts[language as 'ru' | 'uz'];

  const handleCopyCode = async () => {
    if (partnerInfo?.referralCode) {
      await navigator.clipboard.writeText(partnerInfo.referralCode);
      setCopiedCode(true);
      toast({
        title: t.copied,
        description: t.yourReferralCode,
      });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (partnerInfo?.referralCode) {
      const link = `${window.location.origin}/register?ref=${partnerInfo.referralCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({
        title: t.copied,
        description: t.referralLink,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const registeredClientsCount = clients?.filter((c: any) => c.type === 'registration_partner').length || 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{t.referralProgram}</h1>

        <Card>
          <CardHeader>
            <CardTitle>{t.yourReferralCode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t.shareText}</p>
            </div>

            {partnerInfoLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-1">{t.yourReferralCode}</div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <code className="text-lg font-mono font-bold flex-1" data-testid="text-referral-code">
                        {partnerInfo?.referralCode || 'N/A'}
                      </code>
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    size="default"
                    className="shrink-0"
                    data-testid="button-copy-code"
                  >
                    {copiedCode ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedCode ? t.copied : t.copyCode}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-1">{t.referralLink}</div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <code className="text-sm font-mono flex-1 truncate" data-testid="text-referral-link">
                        {partnerInfo?.referralCode 
                          ? `${window.location.origin}/register?ref=${partnerInfo.referralCode}`
                          : 'N/A'}
                      </code>
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    size="default"
                    className="shrink-0"
                    data-testid="button-copy-link"
                  >
                    {copiedLink ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedLink ? t.copied : t.copyLink}
                  </Button>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{t.registeredClients}: {registeredClientsCount}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.howItWorks}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <p>{t.step1}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <p>{t.step2}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <p>{t.step3}</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Profile({ language }: { language: 'ru' | 'uz' }) {
  return <ProfileView language={language} />;
}

