import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const invoiceItemSchema = z.object({
  name: z.string().min(1),
  unitCode: z.string().default('796'),
  unitName: z.string().default('шт'),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
  vatRate: z.coerce.number().default(12),
});

const invoiceFormSchema = z.object({
  docNumber: z.string().min(1),
  docDate: z.string().min(1),
  items: z.array(invoiceItemSchema).min(1),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  language: 'ru' | 'uz';
  contractId: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InvoiceForm({ language, contractId, open, onClose, onSuccess }: InvoiceFormProps) {
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Выставить счёт-фактуру',
      description: 'Заполните данные счёт-фактуры для отправки в Didox',
      docNumber: 'Номер документа',
      docDate: 'Дата документа',
      items: 'Товары/услуги',
      itemName: 'Наименование',
      quantity: 'Кол-во',
      price: 'Цена',
      vatRate: 'НДС %',
      total: 'Итого',
      totalWithVat: 'Итого с НДС',
      addItem: 'Добавить позицию',
      submit: 'Отправить счёт-фактуру',
      cancel: 'Отмена',
      success: 'Счёт-фактура успешно отправлена',
      error: 'Ошибка при отправке счёт-фактуры',
      authRequired: 'Требуется авторизация в Didox',
      loading: 'Загрузка данных...',
      seller: 'Продавец',
      buyer: 'Покупатель',
    },
    uz: {
      title: 'Hisob-faktura yuborish',
      description: 'Didox ga yuborish uchun hisob-faktura ma\'lumotlarini kiriting',
      docNumber: 'Hujjat raqami',
      docDate: 'Hujjat sanasi',
      items: 'Tovarlar/xizmatlar',
      itemName: 'Nomi',
      quantity: 'Miqdor',
      price: 'Narx',
      vatRate: 'QQS %',
      total: 'Jami',
      totalWithVat: 'QQS bilan jami',
      addItem: 'Pozitsiya qo\'shish',
      submit: 'Hisob-faktura yuborish',
      cancel: 'Bekor qilish',
      success: 'Hisob-faktura muvaffaqiyatli yuborildi',
      error: 'Hisob-faktura yuborishda xatolik',
      authRequired: 'Didox avtorizatsiya talab qilinadi',
      loading: 'Ma\'lumotlar yuklanmoqda...',
      seller: 'Sotuvchi',
      buyer: 'Xaridor',
    }
  };

  const t = texts[language];

  const { data: prefillData, isLoading: isPrefillLoading } = useQuery({
    queryKey: ['/api/didox/contracts', contractId, 'prefill'],
    queryFn: async () => {
      const response = await fetch(`/api/didox/contracts/${contractId}/prefill`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch prefill data');
      return response.json();
    },
    enabled: open,
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      docNumber: `SF-${contractId}-${Date.now()}`,
      docDate: new Date().toISOString().split('T')[0],
      items: [{
        name: '',
        unitCode: '796',
        unitName: 'шт',
        quantity: 1,
        price: 0,
        vatRate: 12,
      }],
    },
  });

  const items = form.watch('items');

  useEffect(() => {
    if (prefillData && open) {
      const itemName = `${language === 'ru' ? 'Транспортные услуги по договору' : 'Shartnoma bo\'yicha transport xizmatlari'} №${prefillData.order?.id}`;
      const itemPrice = prefillData.offerPrice || prefillData.order?.priceWithVat || 0;
      
      form.reset({
        docNumber: `SF-${contractId}-${Date.now()}`,
        docDate: new Date().toISOString().split('T')[0],
        items: [{
          name: itemName,
          unitCode: '796',
          unitName: 'шт',
          quantity: 1,
          price: itemPrice,
          vatRate: 12,
        }],
      });
    }
  }, [prefillData, open, contractId, language, form]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      return apiRequest('POST', '/api/didox/invoices', {
        contractId,
        ...data,
      });
    },
    onSuccess: () => {
      toast({
        title: language === 'ru' ? 'Успех' : 'Muvaffaqiyat',
        description: t.success,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/didox/documents'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      if (error?.code === 'DIDOX_AUTH_REQUIRED') {
        toast({
          title: language === 'ru' ? 'Ошибка' : 'Xatolik',
          description: t.authRequired,
          variant: 'destructive',
        });
      } else {
        toast({
          title: language === 'ru' ? 'Ошибка' : 'Xatolik',
          description: error?.message || t.error,
          variant: 'destructive',
        });
      }
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    createInvoiceMutation.mutate(data);
  };

  const addItem = () => {
    const currentItems = form.getValues('items');
    form.setValue('items', [...currentItems, {
      name: '',
      unitCode: '796',
      unitName: 'шт',
      quantity: 1,
      price: 0,
      vatRate: 12,
    }]);
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues('items');
    if (currentItems.length > 1) {
      form.setValue('items', currentItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const calculateTotalWithVat = () => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.price;
      return sum + itemTotal * (1 + item.vatRate / 100);
    }, 0);
  };

  if (isPrefillLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t.loading}</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {prefillData && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg mb-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t.seller}</div>
              <div className="font-medium">{prefillData.carrier?.profile?.companyName || prefillData.carrier?.displayName}</div>
              <div className="text-sm text-muted-foreground">ИНН: {prefillData.carrier?.profile?.inn}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t.buyer}</div>
              <div className="font-medium">{prefillData.customer?.profile?.companyName || prefillData.customer?.displayName}</div>
              <div className="text-sm text-muted-foreground">ИНН: {prefillData.customer?.profile?.inn}</div>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="docNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.docNumber}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doc-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="docDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.docDate}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-doc-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="font-medium">{t.items}</div>
              {items.map((_, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-2 bg-muted/50 rounded">
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>{t.itemName}</FormLabel>}
                          <FormControl>
                            <Input {...field} data-testid={`input-item-name-${index}`} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>{t.quantity}</FormLabel>}
                          <FormControl>
                            <Input type="number" {...field} data-testid={`input-item-qty-${index}`} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.price`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>{t.price}</FormLabel>}
                          <FormControl>
                            <Input type="number" {...field} data-testid={`input-item-price-${index}`} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.vatRate`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>{t.vatRate}</FormLabel>}
                          <FormControl>
                            <Input type="number" {...field} data-testid={`input-item-vat-${index}`} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        data-testid={`button-remove-item-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addItem} className="w-full" data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" />
                {t.addItem}
              </Button>
            </div>

            <div className="flex justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">{t.total}</div>
                <div className="font-medium">{calculateTotal().toLocaleString()} UZS</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t.totalWithVat}</div>
                <div className="font-bold text-lg">{calculateTotalWithVat().toLocaleString()} UZS</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                {t.cancel}
              </Button>
              <Button type="submit" disabled={createInvoiceMutation.isPending} data-testid="button-submit-invoice">
                {createInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.submit}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
