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

const waybillItemSchema = z.object({
  name: z.string().min(1),
  unitCode: z.string().default('796'),
  unitName: z.string().default('шт'),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
});

const waybillFormSchema = z.object({
  docNumber: z.string().min(1),
  docDate: z.string().min(1),
  loadingPoint: z.string().min(1),
  unloadingPoint: z.string().min(1),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  items: z.array(waybillItemSchema).min(1),
});

type WaybillFormData = z.infer<typeof waybillFormSchema>;

interface WaybillFormProps {
  language: 'ru' | 'uz';
  contractId: number;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WaybillForm({ language, contractId, open, onClose, onSuccess }: WaybillFormProps) {
  const { toast } = useToast();

  const texts = {
    ru: {
      title: 'Оформить товарно-транспортную накладную',
      description: 'Заполните данные ТТН для отправки в Didox',
      docNumber: 'Номер документа',
      docDate: 'Дата документа',
      loadingPoint: 'Пункт погрузки',
      unloadingPoint: 'Пункт разгрузки',
      vehicleNumber: 'Номер транспорта',
      driverName: 'ФИО водителя',
      items: 'Груз',
      itemName: 'Наименование груза',
      quantity: 'Кол-во',
      price: 'Стоимость',
      total: 'Итого',
      addItem: 'Добавить позицию',
      submit: 'Отправить ТТН',
      cancel: 'Отмена',
      success: 'ТТН успешно отправлена',
      error: 'Ошибка при отправке ТТН',
      authRequired: 'Требуется авторизация в Didox',
      loading: 'Загрузка данных...',
      consignor: 'Грузоотправитель',
      consignee: 'Грузополучатель',
    },
    uz: {
      title: 'Tovar-transport yukxatini rasmiylashtirish',
      description: 'Didox ga yuborish uchun TTYu ma\'lumotlarini kiriting',
      docNumber: 'Hujjat raqami',
      docDate: 'Hujjat sanasi',
      loadingPoint: 'Yuklash punkti',
      unloadingPoint: 'Tushirish punkti',
      vehicleNumber: 'Transport raqami',
      driverName: 'Haydovchi FISh',
      items: 'Yuk',
      itemName: 'Yuk nomi',
      quantity: 'Miqdor',
      price: 'Qiymat',
      total: 'Jami',
      addItem: 'Pozitsiya qo\'shish',
      submit: 'TTYu yuborish',
      cancel: 'Bekor qilish',
      success: 'TTYu muvaffaqiyatli yuborildi',
      error: 'TTYu yuborishda xatolik',
      authRequired: 'Didox avtorizatsiya talab qilinadi',
      loading: 'Ma\'lumotlar yuklanmoqda...',
      consignor: 'Yuk yuboruvchi',
      consignee: 'Yuk oluvchi',
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

  const form = useForm<WaybillFormData>({
    resolver: zodResolver(waybillFormSchema),
    defaultValues: {
      docNumber: `TTN-${contractId}-${Date.now()}`,
      docDate: new Date().toISOString().split('T')[0],
      loadingPoint: '',
      unloadingPoint: '',
      vehicleNumber: '',
      driverName: '',
      items: [{
        name: '',
        unitCode: '796',
        unitName: 'шт',
        quantity: 1,
        price: 0,
      }],
    },
  });

  const items = form.watch('items');

  useEffect(() => {
    if (prefillData && open) {
      const itemName = prefillData.order?.title || (language === 'ru' ? 'Груз' : 'Yuk');
      const itemPrice = prefillData.offerPrice || prefillData.order?.priceWithVat || 0;
      
      form.reset({
        docNumber: `TTN-${contractId}-${Date.now()}`,
        docDate: new Date().toISOString().split('T')[0],
        loadingPoint: prefillData.order?.originRegion || '',
        unloadingPoint: prefillData.order?.destinationRegion || '',
        vehicleNumber: '',
        driverName: '',
        items: [{
          name: itemName,
          unitCode: '796',
          unitName: 'шт',
          quantity: 1,
          price: itemPrice,
        }],
      });
    }
  }, [prefillData, open, contractId, language, form]);

  const createWaybillMutation = useMutation({
    mutationFn: async (data: WaybillFormData) => {
      return apiRequest('POST', '/api/didox/waybills', {
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

  const onSubmit = (data: WaybillFormData) => {
    createWaybillMutation.mutate(data);
  };

  const addItem = () => {
    const currentItems = form.getValues('items');
    form.setValue('items', [...currentItems, {
      name: '',
      unitCode: '796',
      unitName: 'шт',
      quantity: 1,
      price: 0,
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
              <div className="text-sm font-medium text-muted-foreground">{t.consignor}</div>
              <div className="font-medium">{prefillData.customer?.profile?.companyName || prefillData.customer?.displayName}</div>
              <div className="text-sm text-muted-foreground">ИНН: {prefillData.customer?.profile?.inn}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t.consignee}</div>
              <div className="font-medium">{prefillData.carrier?.profile?.companyName || prefillData.carrier?.displayName}</div>
              <div className="text-sm text-muted-foreground">ИНН: {prefillData.carrier?.profile?.inn}</div>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="loadingPoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.loadingPoint}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-loading-point" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unloadingPoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.unloadingPoint}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-unloading-point" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.vehicleNumber}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="01 A 123 AA" data-testid="input-vehicle-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.driverName}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-driver-name" />
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
                  <div className="col-span-5">
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
                  <div className="col-span-4">
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

            <div className="flex justify-end p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">{t.total}</div>
                <div className="font-bold text-lg">{calculateTotal().toLocaleString()} UZS</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                {t.cancel}
              </Button>
              <Button type="submit" disabled={createWaybillMutation.isPending} data-testid="button-submit-waybill">
                {createWaybillMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t.submit}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
