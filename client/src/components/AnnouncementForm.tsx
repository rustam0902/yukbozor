import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uzbekistanRegions, getDistrictsByRegion, getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';
import { TransportTypeSelect } from '@/components/TransportTypeSelect';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, BookmarkPlus, Plus, X, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Announcement, AnnouncementTemplate } from '@shared/schema';

const announcementFormSchema = z.object({
  title: z.string().min(1, 'Обязательное поле'),
  originRegions: z.array(z.string()).min(1, 'Выберите хотя бы один регион'),
  originDistrict: z.array(z.string()).default([]),
  destinationRegions: z.array(z.string()).min(1, 'Выберите хотя бы один регион'),
  destinationDistrict: z.array(z.string()).default([]),
  transportType: z.string().min(1, 'Выберите тип транспорта'),
  vehicleCount: z.coerce.number().int().min(1, 'Минимум 1 машина').default(1),
  weightTons: z.coerce.number().positive('Должно быть положительным'),
  loadDate: z.string().min(1, 'Укажите дату'),
  loadingTime: z.string().min(1, 'Укажите время'),
  price: z.union([z.coerce.number().min(0), z.null()]).default(null),
  paymentTypes: z.array(z.string()).min(1, 'Выберите хотя бы один способ оплаты'),
  contactPhone: z.string().min(1, 'Укажите телефон'),
  notes: z.string().optional(),
  isDangerous: z.boolean().default(false),
  isNonstandard: z.boolean().default(false),
  isPartialLoad: z.boolean().default(false),
});

type AnnouncementFormData = z.infer<typeof announcementFormSchema>;

interface AnnouncementFormProps {
  language: 'ru' | 'uz';
  announcement?: Announcement;
  template?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const paymentTypeOptions = [
  { value: 'cash', labelRu: 'Наличные', labelUz: 'Naqd' },
  { value: 'card', labelRu: 'Карта', labelUz: 'Karta' },
  { value: 'transfer', labelRu: 'Перечисление', labelUz: 'Pul ko\'chirish' },
];

export default function AnnouncementForm({ language, announcement, template, onSuccess, onCancel }: AnnouncementFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [priceNegotiable, setPriceNegotiable] = useState(() => {
    // For new announcements (no source): price required by default → not negotiable
    // For editing/template: negotiable if price is null or 0
    if (!announcement && !template) return false;
    const src = announcement || template;
    return src.price === null || src.price === undefined || Number(src.price) === 0;
  });
  const [originDistrictSearch, setOriginDistrictSearch] = useState('');
  const [destinationDistrictSearch, setDestinationDistrictSearch] = useState('');

  const texts = {
    ru: {
      title: 'Название груза',
      titlePlaceholder: 'Например: Мебель',
      originRegion: 'Регион отправления',
      originDistrict: 'Район отправления',
      destinationRegion: 'Регион назначения',
      destinationDistrict: 'Район назначения',
      selectRegion: 'Выберите регион',
      selectDistrict: 'Выберите район',
      addRegion: 'Добавить регион',
      removeRegion: 'Удалить',
      transportType: 'Тип транспорта',
      vehicleCount: 'Количество машин',
      weight: 'Вес груза (тонн)',
      loadDate: 'Дата загрузки',
      loadingTime: 'Время загрузки',
      price: 'Цена (UZS)',
      priceNegotiable: 'Договорная цена',
      paymentTypes: 'Способы оплаты',
      contactPhone: 'Контактный телефон',
      notes: 'Примечания',
      notesPlaceholder: 'Дополнительная информация о грузе...',
      isDangerous: 'Опасный груз',
      isNonstandard: 'Негабаритный груз',
      isPartialLoad: 'Догруз (частичная загрузка)',
      submit: 'Опубликовать',
      update: 'Сохранить изменения',
      cancel: 'Отмена',
      loadTemplate: 'Загрузить из шаблона',
      selectTemplate: 'Выберите шаблон',
      noTemplates: 'Нет сохраненных шаблонов',
      saveAsTemplate: 'Сохранить как шаблон',
      templateName: 'Название шаблона',
      creating: 'Создание...',
      updating: 'Сохранение...',
      searchDistrict: 'Поиск района...',
      loadTimeError: 'Время загрузки не может быть раньше текущего'
    },
    uz: {
      title: 'Yuk nomi',
      titlePlaceholder: 'Masalan: Mebel',
      originRegion: 'Jo\'nash viloyati',
      originDistrict: 'Jo\'nash tumani',
      destinationRegion: 'Manzil viloyati',
      destinationDistrict: 'Manzil tumani',
      selectRegion: 'Viloyatni tanlang',
      selectDistrict: 'Tumanni tanlang',
      addRegion: 'Viloyat qo\'shish',
      removeRegion: 'O\'chirish',
      transportType: 'Transport turi',
      vehicleCount: 'Mashinalar soni',
      weight: 'Yuk og\'irligi (tonna)',
      loadDate: 'Yuklash sanasi',
      loadingTime: 'Yuklash vaqti',
      price: 'Narx (UZS)',
      priceNegotiable: 'Kelishiladigan narx',
      paymentTypes: 'To\'lov usullari',
      contactPhone: 'Aloqa telefoni',
      notes: 'Izohlar',
      notesPlaceholder: 'Yuk haqida qo\'shimcha ma\'lumot...',
      isDangerous: 'Xavfli yuk',
      isNonstandard: 'Nostandart yuk',
      isPartialLoad: 'Qo\'shimcha yuk (qisman yuklash)',
      submit: 'E\'lon qilish',
      update: 'O\'zgarishlarni saqlash',
      cancel: 'Bekor qilish',
      loadTemplate: 'Shablondan yuklash',
      selectTemplate: 'Shablonni tanlang',
      noTemplates: 'Saqlangan shablonlar yo\'q',
      saveAsTemplate: 'Shablon sifatida saqlash',
      templateName: 'Shablon nomi',
      creating: 'Yaratilmoqda...',
      updating: 'Saqlanmoqda...',
      searchDistrict: 'Tumanni qidirish...',
      loadTimeError: 'Yuklash vaqti joriy vaqtdan oldin bo\'lishi mumkin emas'
    }
  };

  const t = texts[language];

  // Use template or announcement as source for default values
  const source = template || announcement;

  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: source?.title || '',
      originRegions: source?.originRegions || [],
      originDistrict: source?.originDistrict || [],
      destinationRegions: source?.destinationRegions || [],
      destinationDistrict: source?.destinationDistrict || [],
      transportType: source?.transportType || '',
      vehicleCount: source?.vehicleCount || 1,
      weightTons: source ? Number(source.weightTons) : 0,
      loadDate: template ? '' : (announcement?.loadDate || ''), // Don't prefill date from template
      loadingTime: template ? '' : (announcement?.loadingTime || ''), // Don't prefill time from template
      price: source?.price != null ? Number(source.price) : null,
      paymentTypes: source?.paymentTypes || [],
      contactPhone: source?.contactPhone || (user?.phone?.startsWith('tg_') ? '' : (user?.phone || '')),
      notes: source?.notes || '',
      isDangerous: source?.isDangerous || false,
      isNonstandard: source?.isNonstandard || false,
      isPartialLoad: source?.isPartialLoad || false,
    }
  });

  const originRegions = form.watch('originRegions');
  const destinationRegions = form.watch('destinationRegions');
  const watchedOriginDistricts = form.watch('originDistrict');
  const watchedDestinationDistricts = form.watch('destinationDistrict');
  
  // Collect districts from all selected regions
  const originDistricts = originRegions.flatMap(region => getDistrictsByRegion(region));
  const destinationDistricts = destinationRegions.flatMap(region => getDistrictsByRegion(region));

  const { data: templates } = useQuery<AnnouncementTemplate[]>({
    queryKey: ['/api/announcement-templates']
  });

  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      console.log('[AnnouncementForm] Sending POST /api/announcements with:', JSON.stringify(data, null, 2));
      try {
        const response = await apiRequest('POST', '/api/announcements', data);
        console.log('[AnnouncementForm] POST success, response:', response);
        return response;
      } catch (error) {
        console.error('[AnnouncementForm] POST failed:', error);
        throw error;
      }
    },
    onSuccess: async () => {
      if (saveAsTemplate && templateName) {
        const formData = form.getValues();
        await apiRequest('POST', '/api/announcement-templates', {
          name: templateName,
          ...formData
        });
        queryClient.invalidateQueries({ queryKey: ['/api/announcement-templates'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/my'] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Create announcement error:', error);
      const errorMessage = error?.message || (language === 'ru' ? 'Ошибка при создании объявления' : 'E\'lon yaratishda xatolik');
      toast({
        title: language === 'ru' ? 'Ошибка' : 'Xatolik',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      return apiRequest('PUT', `/api/announcements/${announcement?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements/my'] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Update announcement error:', error);
      const errorMessage = error?.message || (language === 'ru' ? 'Ошибка при обновлении объявления' : 'E\'lonni yangilashda xatolik');
      toast({
        title: language === 'ru' ? 'Ошибка' : 'Xatolik',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find(t => t.id.toString() === templateId);
    if (template) {
      if (template.title) form.setValue('title', template.title);
      if (template.originRegions) form.setValue('originRegions', template.originRegions);
      if (template.originDistrict) form.setValue('originDistrict', template.originDistrict);
      if (template.destinationRegions) form.setValue('destinationRegions', template.destinationRegions);
      if (template.destinationDistrict) form.setValue('destinationDistrict', template.destinationDistrict);
      if (template.transportType) form.setValue('transportType', template.transportType);
      if (template.vehicleCount) form.setValue('vehicleCount', template.vehicleCount);
      if (template.weightTons) form.setValue('weightTons', Number(template.weightTons));
      if (template.loadingTime) form.setValue('loadingTime', template.loadingTime);
      {
        const tplNegotiable = template.price === null || template.price === undefined || Number(template.price) === 0;
        setPriceNegotiable(tplNegotiable);
        form.setValue('price', tplNegotiable ? null : Number(template.price));
      }
      if (template.paymentTypes) form.setValue('paymentTypes', template.paymentTypes);
      if (template.contactPhone) form.setValue('contactPhone', template.contactPhone);
      if (template.notes) form.setValue('notes', template.notes);
      if (template.isDangerous !== null) form.setValue('isDangerous', template.isDangerous || false);
      if (template.isNonstandard !== null) form.setValue('isNonstandard', template.isNonstandard || false);
      if (template.isPartialLoad !== null) form.setValue('isPartialLoad', template.isPartialLoad || false);
    }
    setSelectedTemplate(templateId);
  };

  const onSubmit = (data: AnnouncementFormData) => {
    console.log('[AnnouncementForm] onSubmit called with data:', JSON.stringify(data, null, 2));
    console.log('[AnnouncementForm] Form errors:', form.formState.errors);

    // If price is not negotiable, ensure it's positive
    if (!priceNegotiable && data.price <= 0) {
      form.setError('price', { message: language === 'ru' ? 'Укажите цену или выберите "Договорная"' : 'Narx kiriting yoki "Kelishiladi" ni tanlang' });
      return;
    }

    // Send null price when negotiable
    const submitData = { ...data, price: priceNegotiable ? null : data.price };
    
    // Validate load date and time against Tashkent time (UTC+5)
    // Parse the input as Tashkent time and convert to UTC for comparison
    const [hours, minutes] = data.loadingTime.split(':').map(Number);
    const loadDateParts = data.loadDate.split('-').map(Number);
    // Create UTC timestamp from Tashkent time (subtract 5 hours)
    const loadDateTimeUTC = Date.UTC(
      loadDateParts[0], // year
      loadDateParts[1] - 1, // month (0-indexed)
      loadDateParts[2], // day
      hours - 5, // hours in UTC (Tashkent is UTC+5)
      minutes
    );
    
    // Current UTC time
    const nowUTC = Date.now();
    
    if (loadDateTimeUTC < nowUTC) {
      toast({
        title: t.loadTimeError,
        variant: 'destructive'
      });
      return;
    }
    
    if (announcement) {
      console.log('[AnnouncementForm] Updating announcement:', announcement.id);
      updateMutation.mutate(submitData);
    } else {
      console.log('[AnnouncementForm] Creating new announcement');
      createMutation.mutate(submitData);
    }
  };
  
  // Debug: Log form errors on every render
  const formErrors = form.formState.errors;
  if (Object.keys(formErrors).length > 0) {
    console.log('[AnnouncementForm] Current form errors:', formErrors);
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {!announcement && templates && templates.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.loadTemplate}</label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger data-testid="select-template">
                <SelectValue placeholder={t.selectTemplate} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.title}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t.titlePlaceholder} data-testid="input-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Origin regions - dropdown style with + button */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="originRegions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.originRegion}</FormLabel>
                <div className="space-y-2">
                  {field.value.map((regionName, index) => {
                    const regionDistricts = getDistrictsByRegion(regionName);
                    const selectedDistricts = watchedOriginDistricts.filter(d => 
                      regionDistricts.some(rd => rd.name === d)
                    );
                    return (
                      <div key={`origin-${index}-${regionName}`} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={regionName}
                            onValueChange={(newRegion) => {
                              const newRegions = [...field.value];
                              // Remove districts from old region
                              const oldDistricts = getDistrictsByRegion(regionName).map(d => d.name);
                              const currentDistricts = form.getValues('originDistrict');
                              form.setValue('originDistrict', currentDistricts.filter(d => !oldDistricts.includes(d)));
                              newRegions[index] = newRegion;
                              field.onChange(newRegions);
                            }}
                          >
                            <SelectTrigger className="flex-1" data-testid={`select-origin-region-${index}`}>
                              <SelectValue placeholder={t.selectRegion} />
                            </SelectTrigger>
                            <SelectContent>
                              {uzbekistanRegions.map(region => (
                                <SelectItem 
                                  key={region.name} 
                                  value={region.name}
                                  disabled={field.value.includes(region.name) && region.name !== regionName}
                                >
                                  {getRegionDisplayName(region.name, language)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {field.value.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newRegions = field.value.filter((_, i) => i !== index);
                                // Remove districts from this region
                                const oldDistricts = getDistrictsByRegion(regionName).map(d => d.name);
                                const currentDistricts = form.getValues('originDistrict');
                                form.setValue('originDistrict', currentDistricts.filter(d => !oldDistricts.includes(d)));
                                field.onChange(newRegions);
                              }}
                              data-testid={`button-remove-origin-region-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {regionDistricts.length > 0 && (
                          <div className="pl-2 border-l-2 border-muted">
                            <span className="text-xs text-muted-foreground mb-1 block">{t.originDistrict}:</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between text-left font-normal"
                                  data-testid="dropdown-origin-districts"
                                >
                                  <span className="truncate">
                                    {selectedDistricts.length > 0
                                      ? `${language === 'ru' ? 'Выбрано' : 'Tanlangan'}: ${selectedDistricts.length}`
                                      : t.selectDistrict}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-0" align="start">
                                <div className="p-2 border-b">
                                  <Input
                                    placeholder={t.searchDistrict}
                                    value={originDistrictSearch}
                                    onChange={(e) => setOriginDistrictSearch(e.target.value)}
                                    className="h-8 text-sm"
                                    data-testid="input-origin-district-search"
                                  />
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  {regionDistricts
                                    .filter(district => {
                                      if (!originDistrictSearch) return true;
                                      const displayName = getDistrictDisplayName(district.name, language).toLowerCase();
                                      return displayName.includes(originDistrictSearch.toLowerCase());
                                    })
                                    .map(district => {
                                    const isChecked = selectedDistricts.includes(district.name);
                                    return (
                                      <label
                                        key={district.name}
                                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-muted/50 ${
                                          isChecked ? 'bg-green-50 dark:bg-green-950/30' : ''
                                        }`}
                                        data-testid={`checkbox-origin-district-${district.name}`}
                                      >
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const currentDistricts = form.getValues('originDistrict');
                                            if (checked) {
                                              form.setValue('originDistrict', [...currentDistricts, district.name]);
                                            } else {
                                              form.setValue('originDistrict', currentDistricts.filter(d => d !== district.name));
                                            }
                                          }}
                                        />
                                        <span className={isChecked ? 'font-medium' : ''}>
                                          {getDistrictDisplayName(district.name, language)}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {selectedDistricts.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {selectedDistricts.map(districtName => (
                                  <span
                                    key={districtName}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-xs rounded-full border border-green-300 dark:border-green-700"
                                  >
                                    {getDistrictDisplayName(districtName, language)}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentDistricts = form.getValues('originDistrict');
                                        form.setValue('originDistrict', currentDistricts.filter(d => d !== districtName));
                                      }}
                                      className="hover:text-red-600 dark:hover:text-red-400"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {field.value.length === 0 && (
                    <Select
                      value=""
                      onValueChange={(region) => {
                        field.onChange([region]);
                      }}
                    >
                      <SelectTrigger data-testid="select-origin-region-initial">
                        <SelectValue placeholder={t.selectRegion} />
                      </SelectTrigger>
                      <SelectContent>
                        {uzbekistanRegions.map(region => (
                          <SelectItem key={region.name} value={region.name}>
                            {getRegionDisplayName(region.name, language)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.value.length > 0 && field.value.length < uzbekistanRegions.length && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // Find first available region
                        const usedRegions = field.value;
                        const availableRegion = uzbekistanRegions.find(r => !usedRegions.includes(r.name));
                        if (availableRegion) {
                          field.onChange([...field.value, availableRegion.name]);
                        }
                      }}
                      data-testid="button-add-origin-region"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t.addRegion}
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Destination regions - dropdown style with + button */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="destinationRegions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.destinationRegion}</FormLabel>
                <div className="space-y-2">
                  {field.value.map((regionName, index) => {
                    const regionDistricts = getDistrictsByRegion(regionName);
                    const selectedDistricts = watchedDestinationDistricts.filter(d => 
                      regionDistricts.some(rd => rd.name === d)
                    );
                    return (
                      <div key={`dest-${index}-${regionName}`} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={regionName}
                            onValueChange={(newRegion) => {
                              const newRegions = [...field.value];
                              // Remove districts from old region
                              const oldDistricts = getDistrictsByRegion(regionName).map(d => d.name);
                              const currentDistricts = form.getValues('destinationDistrict');
                              form.setValue('destinationDistrict', currentDistricts.filter(d => !oldDistricts.includes(d)));
                              newRegions[index] = newRegion;
                              field.onChange(newRegions);
                            }}
                          >
                            <SelectTrigger className="flex-1" data-testid={`select-destination-region-${index}`}>
                              <SelectValue placeholder={t.selectRegion} />
                            </SelectTrigger>
                            <SelectContent>
                              {uzbekistanRegions.map(region => (
                                <SelectItem 
                                  key={region.name} 
                                  value={region.name}
                                  disabled={field.value.includes(region.name) && region.name !== regionName}
                                >
                                  {getRegionDisplayName(region.name, language)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {field.value.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newRegions = field.value.filter((_, i) => i !== index);
                                // Remove districts from this region
                                const oldDistricts = getDistrictsByRegion(regionName).map(d => d.name);
                                const currentDistricts = form.getValues('destinationDistrict');
                                form.setValue('destinationDistrict', currentDistricts.filter(d => !oldDistricts.includes(d)));
                                field.onChange(newRegions);
                              }}
                              data-testid={`button-remove-destination-region-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {regionDistricts.length > 0 && (
                          <div className="pl-2 border-l-2 border-muted">
                            <span className="text-xs text-muted-foreground mb-1 block">{t.destinationDistrict}:</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between text-left font-normal"
                                  data-testid="dropdown-destination-districts"
                                >
                                  <span className="truncate">
                                    {selectedDistricts.length > 0
                                      ? `${language === 'ru' ? 'Выбрано' : 'Tanlangan'}: ${selectedDistricts.length}`
                                      : t.selectDistrict}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-0" align="start">
                                <div className="p-2 border-b">
                                  <Input
                                    placeholder={t.searchDistrict}
                                    value={destinationDistrictSearch}
                                    onChange={(e) => setDestinationDistrictSearch(e.target.value)}
                                    className="h-8 text-sm"
                                    data-testid="input-destination-district-search"
                                  />
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                  {regionDistricts
                                    .filter(district => {
                                      if (!destinationDistrictSearch) return true;
                                      const displayName = getDistrictDisplayName(district.name, language).toLowerCase();
                                      return displayName.includes(destinationDistrictSearch.toLowerCase());
                                    })
                                    .map(district => {
                                    const isChecked = selectedDistricts.includes(district.name);
                                    return (
                                      <label
                                        key={district.name}
                                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-muted/50 ${
                                          isChecked ? 'bg-green-50 dark:bg-green-950/30' : ''
                                        }`}
                                        data-testid={`checkbox-destination-district-${district.name}`}
                                      >
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const currentDistricts = form.getValues('destinationDistrict');
                                            if (checked) {
                                              form.setValue('destinationDistrict', [...currentDistricts, district.name]);
                                            } else {
                                              form.setValue('destinationDistrict', currentDistricts.filter(d => d !== district.name));
                                            }
                                          }}
                                        />
                                        <span className={isChecked ? 'font-medium' : ''}>
                                          {getDistrictDisplayName(district.name, language)}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {selectedDistricts.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {selectedDistricts.map(districtName => (
                                  <span
                                    key={districtName}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-xs rounded-full border border-green-300 dark:border-green-700"
                                  >
                                    {getDistrictDisplayName(districtName, language)}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentDistricts = form.getValues('destinationDistrict');
                                        form.setValue('destinationDistrict', currentDistricts.filter(d => d !== districtName));
                                      }}
                                      className="hover:text-red-600 dark:hover:text-red-400"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {field.value.length === 0 && (
                    <Select
                      value=""
                      onValueChange={(region) => {
                        field.onChange([region]);
                      }}
                    >
                      <SelectTrigger data-testid="select-destination-region-initial">
                        <SelectValue placeholder={t.selectRegion} />
                      </SelectTrigger>
                      <SelectContent>
                        {uzbekistanRegions.map(region => (
                          <SelectItem key={region.name} value={region.name}>
                            {getRegionDisplayName(region.name, language)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.value.length > 0 && field.value.length < uzbekistanRegions.length && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // Find first available region
                        const usedRegions = field.value;
                        const availableRegion = uzbekistanRegions.find(r => !usedRegions.includes(r.name));
                        if (availableRegion) {
                          field.onChange([...field.value, availableRegion.name]);
                        }
                      }}
                      data-testid="button-add-destination-region"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t.addRegion}
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="transportType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.transportType}</FormLabel>
                <FormControl>
                  <TransportTypeSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    language={language}
                    data-testid="select-transport-type"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicleCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.vehicleCount}</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1"
                    step="1"
                    {...field} 
                    data-testid="input-vehicle-count"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="weightTons"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.weight}</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1" 
                    {...field} 
                    data-testid="input-weight"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t.price}</FormLabel>
                  <label className="flex items-center gap-1.5 cursor-pointer" data-testid="label-negotiable">
                    <Checkbox
                      checked={priceNegotiable}
                      onCheckedChange={(checked) => {
                        setPriceNegotiable(!!checked);
                        if (checked) {
                          field.onChange(0);
                          form.clearErrors('price');
                        }
                      }}
                      data-testid="checkbox-negotiable"
                    />
                    <span className="text-sm text-muted-foreground">{t.priceNegotiable}</span>
                  </label>
                </div>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    disabled={priceNegotiable}
                    placeholder={priceNegotiable ? (t.priceNegotiable ?? 'Договорная / Kelishiladi') : ''}
                    value={priceNegotiable ? '' : (field.value ?? '')}
                    className={priceNegotiable ? 'opacity-40 pointer-events-none' : ''}
                    data-testid="input-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="loadDate"
            render={({ field }) => {
              // Get today's date in YYYY-MM-DD format for min attribute
              const today = new Date();
              const minDate = today.toISOString().split('T')[0];
              return (
                <FormItem>
                  <FormLabel>{t.loadDate}</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      min={minDate}
                      data-testid="input-load-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="loadingTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.loadingTime}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-loading-time">
                      <SelectValue placeholder={t.loadingTime} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Array.from({ length: 48 }, (_, i) => {
                      const hours = Math.floor(i / 2).toString().padStart(2, '0');
                      const minutes = i % 2 === 0 ? '00' : '30';
                      const time = `${hours}:${minutes}`;
                      return (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="paymentTypes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.paymentTypes}</FormLabel>
              <div className="flex flex-wrap gap-4">
                {paymentTypeOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.value.includes(option.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          field.onChange([...field.value, option.value]);
                        } else {
                          field.onChange(field.value.filter(v => v !== option.value));
                        }
                      }}
                      data-testid={`checkbox-payment-${option.value}`}
                    />
                    <span>{language === 'ru' ? option.labelRu : option.labelUz}</span>
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.contactPhone}</FormLabel>
              <FormControl>
                <Input {...field} placeholder="+998" data-testid="input-contact-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.notes}</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  placeholder={t.notesPlaceholder}
                  rows={3}
                  data-testid="textarea-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-4 pt-2">
          <FormField
            control={form.control}
            name="isDangerous"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-dangerous"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer !mt-0">{t.isDangerous}</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isNonstandard"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-nonstandard"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer !mt-0">{t.isNonstandard}</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isPartialLoad"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-partial"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer !mt-0">{t.isPartialLoad}</FormLabel>
              </FormItem>
            )}
          />
        </div>

        {!announcement && (
          <div className="flex items-center gap-4 pt-2 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={saveAsTemplate}
                onCheckedChange={(checked) => setSaveAsTemplate(!!checked)}
                data-testid="checkbox-save-template"
              />
              <span className="text-sm">{t.saveAsTemplate}</span>
            </label>
            {saveAsTemplate && (
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t.templateName}
                className="flex-1"
                data-testid="input-template-name"
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            {t.cancel}
          </Button>
          <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {announcement ? t.updating : t.creating}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {announcement ? t.update : t.submit}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
