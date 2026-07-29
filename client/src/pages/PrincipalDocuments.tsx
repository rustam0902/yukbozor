import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { FolderOpen, Loader2, AlertTriangle, UserCheck, FileText, Receipt } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/dateFormat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Document {
  id: number;
  documentType: 'factura' | 'waybill';
  didoxDocId: string;
  status: string;
  contractId: number;
  createdAt: string;
  contract?: {
    id: number;
    order?: {
      title: string;
    };
  };
}

export default function PrincipalDocuments() {
  const { representativeMode, representativeModeEnabled, representativeModeInitialized } = useAuth();
  const { language } = useLanguage();

  const texts = {
    ru: {
      title: 'Документы доверителей',
      description: 'Документы организации, от имени которой вы работаете',
      selectPrincipal: 'Выберите доверителя',
      selectPrincipalDesc: 'Перейдите в раздел "Мои доверители" и активируйте работу от имени организации',
      goToPrincipals: 'Мои доверители',
      currentPrincipal: 'Текущий доверитель',
      noDocuments: 'Нет документов',
      noDocumentsDesc: 'У этой организации пока нет документов',
      loading: 'Загрузка...',
      modeDisabled: 'Режим представителя отключён',
      enableInProfile: 'Включите режим представителя в настройках профиля',
      goToProfile: 'Перейти в профиль',
      sent: 'Отправленные',
      received: 'Полученные',
      documentId: 'ID',
      type: 'Тип',
      contract: 'Договор',
      date: 'Дата',
      status: 'Статус',
      factura: 'Счёт-фактура',
      waybill: 'ТТН',
      statuses: {
        sent: 'Отправлен',
        received: 'Получен',
        signed: 'Подписан',
        rejected: 'Отклонён',
        draft: 'Черновик',
      }
    },
    uz: {
      title: 'Ishonch beruvchilar hujjatlari',
      description: 'Nomidan ishlayotgan tashkilot hujjatlari',
      selectPrincipal: 'Ishonch beruvchini tanlang',
      selectPrincipalDesc: '"Ishonch beruvchilarim" bo\'limiga o\'ting va tashkilot nomidan ishlashni faollashtiring',
      goToPrincipals: 'Ishonch beruvchilarim',
      currentPrincipal: 'Joriy ishonch beruvchi',
      noDocuments: 'Hujjatlar yo\'q',
      noDocumentsDesc: 'Bu tashkilotda hali hujjatlar yo\'q',
      loading: 'Yuklanmoqda...',
      modeDisabled: 'Vakil rejimi o\'chirilgan',
      enableInProfile: 'Profil sozlamalarida vakil rejimini yoqing',
      goToProfile: 'Profilga o\'tish',
      sent: 'Yuborilgan',
      received: 'Qabul qilingan',
      documentId: 'ID',
      type: 'Turi',
      contract: 'Shartnoma',
      date: 'Sana',
      status: 'Holat',
      factura: 'Hisob-faktura',
      waybill: 'TTYu',
      statuses: {
        sent: 'Yuborilgan',
        received: 'Qabul qilingan',
        signed: 'Imzolangan',
        rejected: 'Rad etilgan',
        draft: 'Qoralama',
      }
    }
  };
  const t = texts[language];

  const { data: sentDocuments, isLoading: sentLoading } = useQuery<Document[]>({
    queryKey: ['/api/representatives/principal-documents/sent', { customerId: representativeMode?.customerId }],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch('/api/representatives/principal-documents/sent', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to fetch principal sent documents');
      }
      return res.json();
    },
    enabled: representativeModeEnabled && representativeMode?.active && !!representativeMode?.customerId,
  });

  const { data: receivedDocuments, isLoading: receivedLoading } = useQuery<Document[]>({
    queryKey: ['/api/representatives/principal-documents/received', { customerId: representativeMode?.customerId }],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const representativeCustomerId = representativeMode?.customerId;
      if (representativeCustomerId) {
        headers['X-Representative-Customer-Id'] = String(representativeCustomerId);
      }
      const res = await fetch('/api/representatives/principal-documents/received', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        throw new Error('Failed to fetch principal received documents');
      }
      return res.json();
    },
    enabled: representativeModeEnabled && representativeMode?.active && !!representativeMode?.customerId,
  });

  const isLoading = sentLoading || receivedLoading;

  if (!representativeModeInitialized) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center" data-testid="page-principal-documents-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!representativeModeEnabled) {
    return (
      <div className="container mx-auto p-6" data-testid="page-principal-documents-disabled">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {t.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">{t.modeDisabled}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.enableInProfile}</p>
              <Link href="/customer/profile">
                <Button variant="outline" className="mt-4" data-testid="button-go-to-profile">
                  {t.goToProfile}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!representativeMode?.active) {
    return (
      <div className="container mx-auto p-6" data-testid="page-principal-documents-no-principal">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {t.title}
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">{t.selectPrincipal}</p>
              <p className="text-sm text-muted-foreground mt-2">{t.selectPrincipalDesc}</p>
              <Link href="/customer/principals">
                <Button variant="default" className="mt-4" data-testid="button-go-to-principals">
                  {t.goToPrincipals}
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
      <div className="container mx-auto p-6" data-testid="page-principal-documents-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      sent: { variant: 'default', label: t.statuses.sent },
      received: { variant: 'secondary', label: t.statuses.received },
      signed: { variant: 'outline', label: t.statuses.signed },
      rejected: { variant: 'destructive', label: t.statuses.rejected },
      draft: { variant: 'secondary', label: t.statuses.draft },
    };
    const statusInfo = statusMap[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getDocTypeIcon = (type: string) => {
    return type === 'factura' ? <Receipt className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  };

  const renderDocumentsTable = (documents: Document[] | undefined) => {
    if (!documents || documents.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t.noDocuments}</p>
          <p className="text-sm mt-2">{t.noDocumentsDesc}</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.documentId}</TableHead>
            <TableHead>{t.type}</TableHead>
            <TableHead>{t.contract}</TableHead>
            <TableHead>{t.date}</TableHead>
            <TableHead>{t.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
              <TableCell className="font-medium">#{doc.id}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getDocTypeIcon(doc.documentType)}
                  <span>{doc.documentType === 'factura' ? t.factura : t.waybill}</span>
                </div>
              </TableCell>
              <TableCell>{doc.contract?.order?.title || `#${doc.contractId}`}</TableCell>
              <TableCell>{formatDate(doc.createdAt)}</TableCell>
              <TableCell>{getStatusBadge(doc.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto p-6" data-testid="page-principal-documents">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
          <div className="mt-2 p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <span className="font-medium text-primary">
              {t.currentPrincipal}: {representativeMode?.companyName || representativeMode?.customerName}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sent" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="sent" data-testid="tab-sent">{t.sent}</TabsTrigger>
              <TabsTrigger value="received" data-testid="tab-received">{t.received}</TabsTrigger>
            </TabsList>
            <TabsContent value="sent">
              {renderDocumentsTable(sentDocuments)}
            </TabsContent>
            <TabsContent value="received">
              {renderDocumentsTable(receivedDocuments)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
