import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, MapPin, Clock, Truck, Phone, CircleDollarSign, Edit, Trash2, AlertTriangle, Package, ArrowRight, CheckCircle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatMoney, buildTelegramMessageLink } from '@/lib/utils';
import { formatDate } from '@/lib/dateFormat';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { getTransportTypeLabel } from '@shared/transport-types';
import AnnouncementForm from './AnnouncementForm';
import type { Announcement } from '@shared/schema';

interface AnnouncementsProps {
  language: 'ru' | 'uz';
  initialTemplate?: any;
  onTemplateUsed?: () => void;
}

const paymentTypeLabels = {
  ru: { cash: 'Наличные', card: 'Карта', transfer: 'Перечисление' },
  uz: { cash: 'Naqd', card: 'Karta', transfer: 'Pul ko\'chirish' }
};

const statusLabels = {
  ru: { new: 'Новое', active: 'Активно', closed: 'Закрыто', completed: 'Завершено', cancelled: 'Отменено', deleted: 'Удалено' },
  uz: { new: 'Yangi', active: 'Faol', closed: 'Yopilgan', completed: 'Tugallangan', cancelled: 'Bekor qilingan', deleted: 'O\'chirilgan' }
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  deleted: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
};

export default function Announcements({ language, initialTemplate, onTemplateUsed }: AnnouncementsProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new'>('new');
  const [templateForCreate, setTemplateForCreate] = useState<any>(null);
  const { toast } = useToast();

  // Open create dialog with template when initialTemplate is provided
  useEffect(() => {
    if (initialTemplate) {
      setTemplateForCreate(initialTemplate);
      setIsCreateDialogOpen(true);
      onTemplateUsed?.();
    }
  }, [initialTemplate, onTemplateUsed]);

  const texts = {
    ru: {
      title: 'Мои объявления',
      createNew: 'Создать объявление',
      noAnnouncements: 'У вас пока нет объявлений',
      noNewAnnouncements: 'У вас нет новых объявлений',
      createFirst: 'Создайте своё первое объявление',
      edit: 'Редактировать',
      delete: 'Удалить',
      deleteConfirm: 'Вы уверены, что хотите удалить это объявление?',
      deleteWarning: 'Это действие нельзя отменить.',
      cancel: 'Отмена',
      confirm: 'Удалить',
      deleted: 'Объявление удалено',
      created: 'Объявление создано',
      updated: 'Объявление обновлено',
      closed: 'Объявление закрыто',
      closedBtn: 'Закрылось',
      filterAll: 'Все',
      filterNew: 'Только новые',
      announcementNumber: 'Объявление №',
      from: 'Откуда',
      to: 'Куда',
      weight: 'Вес',
      tons: 'тонн',
      date: 'Дата загрузки',
      time: 'Время',
      price: 'Цена',
      payment: 'Оплата',
      contact: 'Контакт',
      dangerous: 'Опасный груз',
      nonstandard: 'Негабаритный',
      partial: 'Догруз',
      vehicles: 'Машин'
    },
    uz: {
      title: 'Mening e\'lonlarim',
      createNew: 'E\'lon yaratish',
      noAnnouncements: 'Sizda hali e\'lonlar yo\'q',
      noNewAnnouncements: 'Sizda yangi e\'lonlar yo\'q',
      createFirst: 'Birinchi e\'loningizni yarating',
      edit: 'Tahrirlash',
      delete: 'O\'chirish',
      deleteConfirm: 'Bu e\'lonni o\'chirmoqchimisiz?',
      deleteWarning: 'Bu amalni bekor qilib bo\'lmaydi.',
      cancel: 'Bekor qilish',
      confirm: 'O\'chirish',
      deleted: 'E\'lon o\'chirildi',
      created: 'E\'lon yaratildi',
      updated: 'E\'lon yangilandi',
      closed: 'E\'lon yopildi',
      closedBtn: 'Yopildi',
      filterAll: 'Barchasi',
      filterNew: 'Faqat yangilari',
      announcementNumber: 'E\'lon №',
      from: 'Qayerdan',
      to: 'Qayerga',
      weight: 'Og\'irlik',
      tons: 'tonna',
      date: 'Yuklash sanasi',
      time: 'Vaqt',
      price: 'Narx',
      payment: 'To\'lov',
      contact: 'Aloqa',
      dangerous: 'Xavfli yuk',
      nonstandard: 'Nostandart',
      partial: 'Qo\'shimcha yuk',
      vehicles: 'Mashina'
    }
  };

  const t = texts[language];

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements/my', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const res = await fetch(`/api/announcements/my?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/my'] });
      toast({ title: t.deleted });
      setDeleteId(null);
    }
  });

  const closeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PUT', `/api/announcements/${id}/status`, { status: 'closed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/my'] });
      toast({ title: t.closed });
    }
  });

  const renderAnnouncementCard = (announcement: Announcement) => {
    const isDeleted = !!announcement.deletedAt;
    const displayStatus = isDeleted ? 'deleted' : (announcement.status as keyof typeof statusLabels.ru);
    const canClose = !isDeleted && announcement.status !== 'closed';
    const canEdit = !isDeleted && announcement.status !== 'closed';
    const canDelete = !isDeleted;
    
    return (
      <Card key={announcement.id} className={`hover-elevate ${isDeleted ? 'opacity-60' : ''}`} data-testid={`card-announcement-${announcement.id}`}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">
                E-{announcement.id.toString().padStart(6, '0')}
              </Badge>
              <CardTitle className="text-lg">{announcement.title}</CardTitle>
              {(() => {
                const link = buildTelegramMessageLink(announcement.botSourceChatId, announcement.botSourceMessageId);
                return link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" title="Оригинал в Telegram" className="text-muted-foreground hover:text-foreground shrink-0" data-testid={`link-source-${announcement.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null;
              })()}
            </div>
            <Badge className={statusColors[displayStatus]}>
              {statusLabels[language][displayStatus]}
            </Badge>
          </div>
          <div className="flex gap-1 flex-wrap">
            {canClose && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => closeMutation.mutate(announcement.id)}
                disabled={closeMutation.isPending}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
                data-testid={`button-close-announcement-${announcement.id}`}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {t.closedBtn}
              </Button>
            )}
            {canEdit && (
              <Button 
                size="icon" 
                variant="ghost"
                onClick={() => setEditingAnnouncement(announcement)}
                data-testid={`button-edit-announcement-${announcement.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button 
                size="icon" 
                variant="ghost"
                onClick={() => setDeleteId(announcement.id)}
                data-testid={`button-delete-announcement-${announcement.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-4 w-4 text-green-600 shrink-0" />
              <span className="font-medium">{t.from}:</span>
              <span>{(announcement.originRegions || []).map(r => getRegionDisplayName(r, language)).join(', ')}</span>
              {announcement.originDistrict && announcement.originDistrict.length > 0 && (
                <span className="text-muted-foreground">
                  ({announcement.originDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-4 w-4 text-red-600 shrink-0" />
              <span className="font-medium">{t.to}:</span>
              <span>{(announcement.destinationRegions || []).map(r => getRegionDisplayName(r, language)).join(', ')}</span>
              {announcement.destinationDistrict && announcement.destinationDistrict.length > 0 && (
                <span className="text-muted-foreground">
                  ({announcement.destinationDistrict.map(d => getDistrictDisplayName(d, language)).join(', ')})
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>{getTransportTypeLabel(announcement.transportType, language)}</span>
              {announcement.vehicleCount && announcement.vehicleCount > 1 && (
                <Badge variant="outline">{announcement.vehicleCount} {t.vehicles}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>{Number(announcement.weightTons)} {t.tons}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(announcement.loadDate)}, {announcement.loadingTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              {Number(announcement.price) > 0 ? (
                <span className="font-medium">{formatMoney(Number(announcement.price))} UZS</span>
              ) : (
                <span className="font-medium italic text-muted-foreground">
                  {language === 'ru' ? 'Договорная' : 'Kelishiladi'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{announcement.contactPhone}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-muted-foreground">{t.payment}:</span>
            {announcement.paymentTypes.map(pt => (
              <Badge key={pt} variant="outline">
                {paymentTypeLabels[language][pt as keyof typeof paymentTypeLabels.ru]}
              </Badge>
            ))}
          </div>

          {(announcement.isDangerous || announcement.isNonstandard || announcement.isPartialLoad) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {announcement.isDangerous && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t.dangerous}
                </Badge>
              )}
              {announcement.isNonstandard && (
                <Badge variant="secondary">{t.nonstandard}</Badge>
              )}
              {announcement.isPartialLoad && (
                <Badge variant="secondary">{t.partial}</Badge>
              )}
            </div>
          )}

          {announcement.notes && (
            <div className="text-muted-foreground pt-2 border-t">
              {announcement.notes}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const filteredAnnouncements = announcements || [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-announcements-title">{t.title}</h1>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="button-create-announcement"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.createNew}
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'new')}>
        <TabsList>
          <TabsTrigger value="new" data-testid="tab-filter-new">{t.filterNew}</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-filter-all">{t.filterAll}</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredAnnouncements.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="space-y-3">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">
              {statusFilter === 'new' ? t.noNewAnnouncements : t.noAnnouncements}
            </p>
            <p className="text-muted-foreground">{t.createFirst}</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
              <Plus className="h-4 w-4 mr-2" />
              {t.createNew}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAnnouncements.map(renderAnnouncementCard)}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) setTemplateForCreate(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.createNew}</DialogTitle>
          </DialogHeader>
          <AnnouncementForm
            language={language}
            template={templateForCreate}
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              setTemplateForCreate(null);
              queryClient.invalidateQueries({ queryKey: ['/api/announcements/my'] });
              toast({ title: t.created });
            }}
            onCancel={() => {
              setIsCreateDialogOpen(false);
              setTemplateForCreate(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editingAnnouncement !== null} onOpenChange={(open) => !open && setEditingAnnouncement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
          </DialogHeader>
          {editingAnnouncement && (
            <AnnouncementForm
              language={language}
              announcement={editingAnnouncement}
              onSuccess={() => {
                setEditingAnnouncement(null);
                queryClient.invalidateQueries({ queryKey: ['/api/announcements/my'] });
                toast({ title: t.updated });
              }}
              onCancel={() => setEditingAnnouncement(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              {t.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
