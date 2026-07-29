import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, CheckCircle2, Clock, AlertCircle, Pen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/contexts/language-context';
import { formatDate } from '@/lib/dateFormat';
import type { Contract } from '@shared/schema';

interface ContractViewerProps {
  orderId: number;
  currentUserId: number;
  userRole: 'customer' | 'carrier';
}

const texts = {
  ru: {
    contract: 'Контракт',
    fullySigned: 'Полностью подписан',
    generatedOn: 'Создан',
    customerSignature: 'Подпись заказчика',
    carrierSignature: 'Подпись перевозчика',
    contractPreview: 'Предпросмотр контракта',
    documentHash: 'Хэш документа',
    download: 'Скачать',
    downloadPdfUzb: 'PDF (UZB)',
    downloadPdfRus: 'PDF (RUS)',
    downloadDocxUzb: 'DOCX (UZB)',
    downloadDocxRus: 'DOCX (RUS)',
    signContract: 'Подписать контракт',
    youHaveSigned: 'Вы подписали',
    signContractDescription: 'Вы собираетесь подписать этот контракт электронной подписью',
    signContractWarning: 'После подписания контракт станет юридически обязательным документом',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    signing: 'Подписание...',
    contractSigned: 'Контракт подписан',
    contractSignedSuccess: 'Контракт успешно подписан',
    error: 'Ошибка',
    contractSignFailed: 'Не удалось подписать контракт',
    contractNotGenerated: 'Контракт ещё не создан',
  },
  uz: {
    contract: 'Shartnoma',
    fullySigned: 'To\'liq imzolangan',
    generatedOn: 'Yaratilgan',
    customerSignature: 'Buyurtmachi imzosi',
    carrierSignature: 'Tashuvchi imzosi',
    contractPreview: 'Shartnoma ko\'rinishi',
    documentHash: 'Hujjat hash',
    download: 'Yuklab olish',
    downloadPdfUzb: 'PDF (UZB)',
    downloadPdfRus: 'PDF (RUS)',
    downloadDocxUzb: 'DOCX (UZB)',
    downloadDocxRus: 'DOCX (RUS)',
    signContract: 'Shartnomani imzolash',
    youHaveSigned: 'Siz imzoladingiz',
    signContractDescription: 'Siz ushbu shartnomani elektron imzo bilan imzolashingizga qaror qildingiz',
    signContractWarning: 'Imzolashdan keyin shartnoma yuridik majburiy hujjat bo\'ladi',
    cancel: 'Bekor qilish',
    confirm: 'Tasdiqlash',
    signing: 'Imzolanmoqda...',
    contractSigned: 'Shartnoma imzolandi',
    contractSignedSuccess: 'Shartnoma muvaffaqiyatli imzolandi',
    error: 'Xato',
    contractSignFailed: 'Shartnomani imzolash amalga oshmadi',
    contractNotGenerated: 'Shartnoma hali yaratilmagan',
  },
};

export function ContractViewer({ orderId, currentUserId, userRole }: ContractViewerProps) {
  const { language } = useLanguage();
  const t = texts[language];
  const { toast } = useToast();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  
  const { data: contract, isLoading } = useQuery<Contract>({
    queryKey: ['/api/contracts/order', orderId],
    enabled: !!orderId,
  });
  
  const signMutation = useMutation({
    mutationFn: async () => {
      // Simulated EDS signature (in real system would use actual EDS integration)
      const mockSignature = {
        certificate: `CERT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        algorithm: 'SHA256withRSA',
        signedHash: contract?.documentHash,
      };
      
      const response = await apiRequest('POST', `/api/contracts/${contract?.id}/sign`, {
        signature: JSON.stringify(mockSignature),
        role: userRole,
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/order', orderId] });
      toast({
        title: t.contractSigned,
        description: t.contractSignedSuccess,
      });
      setSignDialogOpen(false);
    },
    onError: () => {
      toast({
        title: t.error,
        description: t.contractSignFailed,
        variant: 'destructive',
      });
    },
  });
  
  if (isLoading) {
    return (
      <Card data-testid="card-contract-loading">
        <CardHeader>
          <CardTitle>{t.contract}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!contract) {
    return (
      <Card data-testid="card-contract-not-found">
        <CardHeader>
          <CardTitle>{t.contract}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t.contractNotGenerated}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  const getStatusBadge = () => {
    switch (contract.status) {
      case 'fully_signed':
        return <Badge variant="default" data-testid="badge-contract-fully-signed" className="bg-green-600 hover:bg-green-700">{t.fullySigned}</Badge>;
      default:
        return <Badge variant="outline">{contract.status}</Badge>;
    }
  };
  
  const canSign = () => {
    return false;
  };
  
  const hasUserSigned = () => {
    if (userRole === 'customer') {
      return contract.customerSignature !== null;
    } else {
      return contract.carrierSignature !== null;
    }
  };
  
  const downloadContract = () => {
    if (!contract.contractContent) return;
    
    const blob = new Blob([contract.contractContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-YB-${contract.id.toString().padStart(6, '0')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <>
      <Card data-testid="card-contract-viewer">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t.contract} #{contract.id.toString().padStart(6, '0')}
              </CardTitle>
              <CardDescription>
                {t.generatedOn}: {formatDate(contract.generatedAt)}
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Signature status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {contract.customerSignature ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" data-testid="icon-customer-signed" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" data-testid="icon-customer-pending" />
                )}
                {t.customerSignature}
              </div>
              {contract.customerSignedAt && (
                <p className="text-xs text-muted-foreground" data-testid="text-customer-signed-at">
                  {new Date(contract.customerSignedAt).toLocaleString()}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {contract.carrierSignature ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" data-testid="icon-carrier-signed" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" data-testid="icon-carrier-pending" />
                )}
                {t.carrierSignature}
              </div>
              {contract.carrierSignedAt && (
                <p className="text-xs text-muted-foreground" data-testid="text-carrier-signed-at">
                  {new Date(contract.carrierSignedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          
          <Separator />
          
          {/* Contract content preview */}
          {contract.contractContent && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t.contractPreview}</h4>
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: contract.contractContent }}
                  data-testid="content-contract-preview"
                />
              </ScrollArea>
            </div>
          )}
          
          {/* Document hash for verification */}
          {contract.documentHash && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">{t.documentHash}</h4>
              <p className="font-mono text-xs text-muted-foreground break-all" data-testid="text-document-hash">
                {contract.documentHash}
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex gap-2 flex-wrap">
          {/* Download buttons - DOCX format */}
          <Button
            variant="default"
            asChild
            data-testid="button-download-docx-uz"
          >
            <a href={`/api/contracts/${contract.id}/download/uz`} download>
              <Download className="h-4 w-4 mr-2" />
              {t.downloadDocxUzb}
            </a>
          </Button>
          <Button
            variant="default"
            asChild
            data-testid="button-download-docx-ru"
          >
            <a href={`/api/contracts/${contract.id}/download/ru`} download>
              <Download className="h-4 w-4 mr-2" />
              {t.downloadDocxRus}
            </a>
          </Button>
          
          {canSign() && !hasUserSigned() && (
            <Button
              onClick={() => setSignDialogOpen(true)}
              data-testid="button-sign-contract"
            >
              <Pen className="h-4 w-4 mr-2" />
              {t.signContract}
            </Button>
          )}
          
          {hasUserSigned() && (
            <Badge variant="outline" className="text-green-600" data-testid="badge-user-signed">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t.youHaveSigned}
            </Badge>
          )}
        </CardFooter>
      </Card>
      
      {/* Sign confirmation dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent data-testid="dialog-sign-contract">
          <DialogHeader>
            <DialogTitle>{t.signContract}</DialogTitle>
            <DialogDescription>
              {t.signContractDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t.signContractWarning}
              </AlertDescription>
            </Alert>
            
            {contract.documentHash && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium">{t.documentHash}</h4>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {contract.documentHash}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSignDialogOpen(false)}
              data-testid="button-cancel-sign"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => signMutation.mutate()}
              disabled={signMutation.isPending}
              data-testid="button-confirm-sign"
            >
              {signMutation.isPending ? t.signing : t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
