import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Bell, MessageSquare, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface NotificationSetting {
  notificationType: string;
  labelRu: string;
  labelUz: string;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

interface NotificationSettingsProps {
  language: 'ru' | 'uz';
}

export function NotificationSettings({ language }: NotificationSettingsProps) {
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Настройки уведомлений',
      description: 'Управляйте способами получения уведомлений',
      notificationType: 'Тип уведомления',
      sms: 'SMS',
      inApp: 'В приложении',
      loading: 'Загрузка...',
      saved: 'Настройки сохранены',
      error: 'Ошибка при сохранении',
    },
    uz: {
      title: 'Bildirishnoma sozlamalari',
      description: 'Bildirishnomalarni qabul qilish usullarini boshqaring',
      notificationType: 'Bildirishnoma turi',
      sms: 'SMS',
      inApp: 'Ilovada',
      loading: 'Yuklanmoqda...',
      saved: 'Sozlamalar saqlandi',
      error: 'Saqlashda xatolik',
    }
  };

  const t = texts[language];

  const { data: settings, isLoading } = useQuery<NotificationSetting[]>({
    queryKey: ['/api/notification-settings'],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ type, smsEnabled, inAppEnabled }: { type: string; smsEnabled: boolean; inAppEnabled: boolean }) => {
      await apiRequest('PUT', `/api/notification-settings/${type}`, { smsEnabled, inAppEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-settings'] });
      toast({
        title: t.saved,
      });
    },
    onError: () => {
      toast({
        title: t.error,
        variant: 'destructive',
      });
    }
  });

  const handleToggle = (setting: NotificationSetting, field: 'smsEnabled' | 'inAppEnabled') => {
    const newValue = !setting[field];
    updateSettingMutation.mutate({
      type: setting.notificationType,
      smsEnabled: field === 'smsEnabled' ? newValue : setting.smsEnabled,
      inAppEnabled: field === 'inAppEnabled' ? newValue : setting.inAppEnabled,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="notification-settings-title">
          <Bell className="h-5 w-5" />
          {t.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.notificationType}</TableHead>
              <TableHead className="text-center w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {t.sms}
                </div>
              </TableHead>
              <TableHead className="text-center w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  {t.inApp}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings?.map((setting) => (
              <TableRow key={setting.notificationType} data-testid={`notification-setting-${setting.notificationType}`}>
                <TableCell className="font-medium">
                  {language === 'ru' ? setting.labelRu : setting.labelUz}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      checked={setting.smsEnabled}
                      onCheckedChange={() => handleToggle(setting, 'smsEnabled')}
                      disabled={updateSettingMutation.isPending}
                      data-testid={`switch-sms-${setting.notificationType}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      checked={setting.inAppEnabled}
                      onCheckedChange={() => handleToggle(setting, 'inAppEnabled')}
                      disabled={updateSettingMutation.isPending}
                      data-testid={`switch-inapp-${setting.notificationType}`}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
