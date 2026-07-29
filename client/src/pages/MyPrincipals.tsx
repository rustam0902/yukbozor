import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Building2, Loader2, UserCheck, LogOut, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { PERMISSION_LABELS, type RepresentativePermission } from '@shared/schema';

interface Principal {
  id: number;
  customerId: number;
  permissions: RepresentativePermission[];
  isActive: boolean;
  customer: {
    id: number;
    displayName: string;
    phone: string;
    userType: string;
    companyName?: string;
    inn?: string;
  } | null;
}

export default function MyPrincipals() {
  const { representativeMode, activateRepresentativeMode, deactivateRepresentativeMode, representativeModeEnabled, representativeModeInitialized } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [activatingCustomerId, setActivatingCustomerId] = useState<number | null>(null);

  const texts = {
    ru: {
      title: 'Мои доверители',
      description: 'Организации, от имени которых вы можете работать',
      noPrincipals: 'Вы не являетесь представителем ни одной организации',
      company: 'Организация',
      permissions: 'Права',
      status: 'Статус',
      action: 'Действие',
      active: 'Активен',
      inactive: 'Неактивен',
      activate: 'Работать от имени',
      deactivate: 'Выйти из режима',
      currentlyActive: 'Сейчас активен',
      activateSuccess: 'Режим представителя активирован',
      activateError: 'Не удалось активировать режим представителя',
      deactivateSuccess: 'Режим представителя деактивирован',
      loading: 'Загрузка...',
      back: 'Назад',
      modeDisabled: 'Режим представителя отключён',
      enableInProfile: 'Включите режим представителя в настройках профиля',
    },
    uz: {
      title: 'Mening ishonch bildiruvchilarim',
      description: 'Nomidan ishlashingiz mumkin bo\'lgan tashkilotlar',
      noPrincipals: 'Siz hech qaysi tashkilotning vakili emassiz',
      company: 'Tashkilot',
      permissions: 'Huquqlar',
      status: 'Holat',
      action: 'Amal',
      active: 'Faol',
      inactive: 'Faol emas',
      activate: 'Nomidan ishlash',
      deactivate: 'Rejimdan chiqish',
      currentlyActive: 'Hozir faol',
      activateSuccess: 'Vakil rejimi faollashtirildi',
      activateError: 'Vakil rejimini faollashtirib bo\'lmadi',
      deactivateSuccess: 'Vakil rejimi o\'chirildi',
      loading: 'Yuklanmoqda...',
      back: 'Orqaga',
      modeDisabled: 'Vakil rejimi o\'chirilgan',
      enableInProfile: 'Profil sozlamalarida vakil rejimini yoqing',
    }
  };
  const t = texts[language];
  const permLabels = PERMISSION_LABELS[language];

  const { data: principals, isLoading } = useQuery<Principal[]>({
    queryKey: ['/api/representatives/my-principals'],
    enabled: representativeModeEnabled,
  });

  const handleActivate = async (customerId: number) => {
    setActivatingCustomerId(customerId);
    try {
      await activateRepresentativeMode(customerId);
      toast({
        title: t.activateSuccess,
      });
    } catch (error: any) {
      toast({
        title: t.activateError,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActivatingCustomerId(null);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateRepresentativeMode();
      toast({
        title: t.deactivateSuccess,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (!representativeModeInitialized) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center" data-testid="page-my-principals-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!representativeModeEnabled) {
    return (
      <div className="container mx-auto p-6" data-testid="page-my-principals-disabled">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-lg font-medium text-muted-foreground">{t.modeDisabled}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.enableInProfile}</p>
              <Link href="/customer/profile">
                <Button variant="outline" className="mt-4" data-testid="button-go-to-profile">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t.back}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="page-my-principals-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!principals || principals.length === 0) {
    return (
      <div className="container mx-auto p-6" data-testid="page-my-principals-empty">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              {t.noPrincipals}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="page-my-principals">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {representativeMode?.active && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">
                  {t.currentlyActive}: {representativeMode.customerName}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDeactivate}
                data-testid="button-deactivate-rep-mode"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.deactivate}
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.company}</TableHead>
                <TableHead>{t.permissions}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="text-right">{t.action}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {principals.map((principal) => {
                const isCurrentlyActive = representativeMode?.active && representativeMode.customerId === principal.customerId;
                return (
                  <TableRow key={principal.id} data-testid={`row-principal-${principal.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{principal.customer?.companyName || principal.customer?.displayName}</div>
                        {principal.customer?.inn && (
                          <div className="text-sm text-muted-foreground">
                            {language === 'ru' ? 'ИНН' : 'INN'}: {principal.customer.inn}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {principal.permissions.length > 0 ? (
                          principal.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {permLabels[perm]}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={principal.isActive ? "default" : "secondary"}>
                        {principal.isActive ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {principal.isActive && (
                        isCurrentlyActive ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleDeactivate}
                            data-testid={`button-deactivate-${principal.customerId}`}
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            {t.deactivate}
                          </Button>
                        ) : (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleActivate(principal.customerId)}
                            disabled={activatingCustomerId === principal.customerId || representativeMode?.active}
                            data-testid={`button-activate-${principal.customerId}`}
                          >
                            {activatingCustomerId === principal.customerId ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <UserCheck className="h-4 w-4 mr-2" />
                            )}
                            {t.activate}
                          </Button>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
