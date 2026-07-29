import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, Truck, Send, Inbox, FileText, CheckCircle, Clock, AlertCircle, Eye } from 'lucide-react';
import { formatDate } from '@/lib/dateFormat';
import { formatMoney } from '@/lib/utils';

interface DocumentsProps {
  language: 'ru' | 'uz';
  role: 'customer' | 'carrier';
}

interface DidoxDocument {
  id: number;
  contractId: number;
  didoxDocId: string | null;
  docType: 'factura' | 'waybill';
  docNumber: string | null;
  docDate: string;
  senderId: number;
  senderTaxId: string;
  senderName: string;
  receiverId: number | null;
  receiverTaxId: string;
  receiverName: string;
  status: 'draft' | 'sent' | 'pending' | 'signed' | 'rejected' | 'deleted' | 'error';
  totalSum: number | null;
  totalSumWithVat: number | null;
  senderSignedAt: string | null;
  receiverSignedAt: string | null;
  createdAt: string;
}

export function Documents({ language, role }: DocumentsProps) {
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'factura' | 'waybill'>('all');

  const texts = {
    ru: {
      title: 'Мои документы',
      sent: 'Отправленные',
      received: 'Полученные',
      all: 'Все',
      invoice: 'Счёт-фактура',
      waybill: 'ТТН',
      noDocuments: 'Документов пока нет',
      noDocumentsDesc: 'Здесь будут отображаться ваши электронные документы',
      docNumber: 'Номер',
      date: 'Дата',
      sender: 'Отправитель',
      receiver: 'Получатель',
      amount: 'Сумма',
      status: 'Статус',
      contract: 'Договор',
      view: 'Просмотр',
      sign: 'Подписать',
      statusDraft: 'Черновик',
      statusSent: 'Отправлен',
      statusPending: 'Ожидает подписи',
      statusSigned: 'Подписан',
      statusRejected: 'Отклонён',
      statusError: 'Ошибка',
    },
    uz: {
      title: 'Mening hujjatlarim',
      sent: 'Yuborilgan',
      received: 'Qabul qilingan',
      all: 'Hammasi',
      invoice: 'Hisob-faktura',
      waybill: 'TTYu',
      noDocuments: 'Hujjatlar hali yo\'q',
      noDocumentsDesc: 'Bu yerda sizning elektron hujjatlaringiz ko\'rsatiladi',
      docNumber: 'Raqam',
      date: 'Sana',
      sender: 'Yuboruvchi',
      receiver: 'Qabul qiluvchi',
      amount: 'Summa',
      status: 'Holat',
      contract: 'Shartnoma',
      view: 'Ko\'rish',
      sign: 'Imzolash',
      statusDraft: 'Qoralama',
      statusSent: 'Yuborilgan',
      statusPending: 'Imzo kutilmoqda',
      statusSigned: 'Imzolangan',
      statusRejected: 'Rad etilgan',
      statusError: 'Xatolik',
    }
  };

  const t = texts[language];

  const { data: documents = [], isLoading } = useQuery<DidoxDocument[]>({
    queryKey: ['/api/didox/documents', activeTab, docTypeFilter !== 'all' ? docTypeFilter : undefined],
    queryFn: async () => {
      const params = new URLSearchParams({ type: activeTab });
      if (docTypeFilter !== 'all') {
        params.append('docType', docTypeFilter);
      }
      const response = await fetch(`/api/didox/documents?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{t.statusDraft}</Badge>;
      case 'sent':
        return <Badge variant="default"><Send className="h-3 w-3 mr-1" />{t.statusSent}</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{t.statusPending}</Badge>;
      case 'signed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{t.statusSigned}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t.statusRejected}</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t.statusError}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDocTypeIcon = (docType: string) => {
    return docType === 'factura' ? <Receipt className="h-4 w-4" /> : <Truck className="h-4 w-4" />;
  };

  const getDocTypeName = (docType: string) => {
    return docType === 'factura' ? t.invoice : t.waybill;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sent' | 'received')}>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="sent" className="flex items-center gap-2" data-testid="tab-sent">
              <Send className="h-4 w-4" />
              {t.sent}
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-2" data-testid="tab-received">
              <Inbox className="h-4 w-4" />
              {t.received}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button
              variant={docTypeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDocTypeFilter('all')}
              data-testid="filter-all"
            >
              {t.all}
            </Button>
            <Button
              variant={docTypeFilter === 'factura' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDocTypeFilter('factura')}
              data-testid="filter-invoice"
            >
              <Receipt className="h-4 w-4 mr-1" />
              {t.invoice}
            </Button>
            <Button
              variant={docTypeFilter === 'waybill' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDocTypeFilter('waybill')}
              data-testid="filter-waybill"
            >
              <Truck className="h-4 w-4 mr-1" />
              {t.waybill}
            </Button>
          </div>
        </div>

        <TabsContent value="sent">
          <DocumentsList
            documents={documents}
            isLoading={isLoading}
            texts={t}
            getStatusBadge={getStatusBadge}
            getDocTypeIcon={getDocTypeIcon}
            getDocTypeName={getDocTypeName}
            isSentTab={true}
          />
        </TabsContent>

        <TabsContent value="received">
          <DocumentsList
            documents={documents}
            isLoading={isLoading}
            texts={t}
            getStatusBadge={getStatusBadge}
            getDocTypeIcon={getDocTypeIcon}
            getDocTypeName={getDocTypeName}
            isSentTab={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface DocumentsListProps {
  documents: DidoxDocument[];
  isLoading: boolean;
  texts: any;
  getStatusBadge: (status: string) => JSX.Element;
  getDocTypeIcon: (docType: string) => JSX.Element;
  getDocTypeName: (docType: string) => string;
  isSentTab: boolean;
}

function DocumentsList({
  documents,
  isLoading,
  texts: t,
  getStatusBadge,
  getDocTypeIcon,
  getDocTypeName,
  isSentTab,
}: DocumentsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t.noDocuments}</h3>
            <p className="text-sm text-muted-foreground max-w-md">{t.noDocumentsDesc}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <Card key={doc.id} data-testid={`document-card-${doc.id}`}>
          <CardContent className="p-4">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  {getDocTypeIcon(doc.docType)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getDocTypeName(doc.docType)}</span>
                    <span className="text-muted-foreground">#{doc.docNumber}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(new Date(doc.docDate))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {getStatusBadge(doc.status)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs font-medium mb-1">
                  {isSentTab ? t.receiver : t.sender}
                </div>
                <div className="truncate">
                  {isSentTab ? doc.receiverName : doc.senderName}
                </div>
                <div className="text-xs text-muted-foreground">
                  ИНН: {isSentTab ? doc.receiverTaxId : doc.senderTaxId}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-xs font-medium mb-1">{t.contract}</div>
                <div>#{doc.contractId}</div>
              </div>

              <div>
                <div className="text-muted-foreground text-xs font-medium mb-1">{t.amount}</div>
                <div className="font-medium">
                  {formatMoney(doc.totalSumWithVat || doc.totalSum || 0)} UZS
                </div>
              </div>

              <div className="flex items-end justify-end">
                <Button variant="outline" size="sm" data-testid={`button-view-${doc.id}`}>
                  <Eye className="h-4 w-4 mr-1" />
                  {t.view}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
