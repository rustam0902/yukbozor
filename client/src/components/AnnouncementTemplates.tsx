import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Truck, Package, Trash2, LayoutTemplate, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/utils';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel } from '@shared/transport-types';
import type { AnnouncementTemplate } from '@shared/schema';

interface AnnouncementTemplatesProps {
  language: 'ru' | 'uz';
  onUseTemplate?: (template: AnnouncementTemplate) => void;
}

export default function AnnouncementTemplates({ language, onUseTemplate }: AnnouncementTemplatesProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Мои шаблоны',
      noTemplates: 'У вас пока нет сохранённых шаблонов',
      noTemplatesHint: 'Шаблоны создаются автоматически при создании объявлений',
      delete: 'Удалить',
      deleteConfirm: 'Удалить этот шаблон?',
      deleteWarning: 'Это действие нельзя отменить.',
      cancel: 'Отмена',
      confirm: 'Удалить',
      deleted: 'Шаблон удалён',
      use: 'Создать объявление',
      from: 'Откуда',
      to: 'Куда',
      weight: 'Вес',
      tons: 'тонн',
      price: 'Цена',
      vehicles: 'Машин'
    },
    uz: {
      title: 'Shablonlarim',
      noTemplates: 'Sizda hali saqlangan shablonlar yo\'q',
      noTemplatesHint: 'Shablonlar e\'lon yaratishda avtomatik saqlanadi',
      delete: 'O\'chirish',
      deleteConfirm: 'Bu shablonni o\'chirmoqchimisiz?',
      deleteWarning: 'Bu amalni bekor qilib bo\'lmaydi.',
      cancel: 'Bekor qilish',
      confirm: 'O\'chirish',
      deleted: 'Shablon o\'chirildi',
      use: 'E\'lon yaratish',
      from: 'Qayerdan',
      to: 'Qayerga',
      weight: 'Og\'irlik',
      tons: 'tonna',
      price: 'Narx',
      vehicles: 'Mashina'
    }
  };

  const t = texts[language];

  const { data: templates, isLoading } = useQuery<AnnouncementTemplate[]>({
    queryKey: ['/api/announcement-templates'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/announcement-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcement-templates'] });
      toast({ title: t.deleted });
      setDeleteId(null);
    }
  });

  const renderTemplateCard = (template: AnnouncementTemplate) => {
    return (
      <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            {template.title && (
              <p className="text-sm text-muted-foreground">{template.title}</p>
            )}
          </div>
          <div className="flex gap-1">
            {onUseTemplate && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onUseTemplate(template)}
                data-testid={`button-use-template-${template.id}`}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t.use}
              </Button>
            )}
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => setDeleteId(template.id)}
              data-testid={`button-delete-template-${template.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(template.originRegions && template.originRegions.length > 0) && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="h-4 w-4 text-green-600 shrink-0" />
                <span className="font-medium">{t.from}:</span>
                <span>{template.originRegions.map(r => getRegionDisplayName(r, language)).join(', ')}</span>
                {template.originDistrict && template.originDistrict.length > 0 && (
                  <span className="text-muted-foreground">
                    ({template.originDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                  </span>
                )}
              </div>
              {template.destinationRegions && template.destinationRegions.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="font-medium">{t.to}:</span>
                  <span>{template.destinationRegions.map(r => getRegionDisplayName(r, language)).join(', ')}</span>
                  {template.destinationDistrict && template.destinationDistrict.length > 0 && (
                    <span className="text-muted-foreground">
                      ({template.destinationDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {template.transportType && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>{getTransportTypeLabel(template.transportType, language)}</span>
                {template.vehicleCount && template.vehicleCount > 1 && (
                  <Badge variant="outline">{template.vehicleCount} {t.vehicles}</Badge>
                )}
              </div>
            )}
            {template.weightTons && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>{Number(template.weightTons)} {t.tons}</span>
              </div>
            )}
            {template.price && (
              <Badge variant="secondary" className="font-mono">
                {formatMoney(Number(template.price))} UZS
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const templateList = templates || [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-templates-title">{t.title}</h1>

      {templateList.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="space-y-3">
            <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">{t.noTemplates}</p>
            <p className="text-muted-foreground">{t.noTemplatesHint}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templateList.map(renderTemplateCard)}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-template">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-template"
            >
              {t.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
