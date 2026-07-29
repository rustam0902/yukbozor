import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Search, X, Filter, Save, Trash2 } from "lucide-react";
import { uzbekistanRegions } from "@shared/uzbekistan-regions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Filter value can be a single string or an array of strings for multi-select
export type FilterValue = string | string[];

export interface FilterState {
  search: string;
  region: FilterValue;
  regionFrom: FilterValue;
  regionTo: FilterValue;
  transportType: FilterValue;
  dateFrom: string;
  dateTo: string;
  status: FilterValue;
  offerStatus: string;
  priceFrom: string;
  priceTo: string;
}

// Helper to check if a filter value is empty
export function isFilterEmpty(value: FilterValue): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 || (value.length === 1 && value[0] === '');
  }
  return !value || value === '' || value === 'all';
}

// Helper to check if a filter matches an item value
export function filterMatches(filterValue: FilterValue, itemValue: string | string[]): boolean {
  if (isFilterEmpty(filterValue)) return true;
  
  const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue];
  const itemArray = Array.isArray(itemValue) ? itemValue : [itemValue];
  
  // Check if any of the filter values match any of the item values
  return filterArray.some(fv => {
    if (fv === 'all' || fv === '') return true;
    return itemArray.some(iv => iv === fv);
  });
}

// Helper to get filter display value as string (for inputs)
export function getFilterDisplayValue(value: FilterValue): string {
  if (Array.isArray(value)) {
    return value.filter(v => v && v !== 'all').join(', ');
  }
  return value || '';
}

// Helper to normalize a value to an array (for backward compatibility with old string values)
export function normalizeToArray(value: FilterValue | undefined): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.filter(v => v && v !== 'all');
  if (value === '' || value === 'all') return [];
  return [value];
}

// Helper to normalize old FilterState (with string values) to new format (with array values)
export function normalizeFilterState(filters: Partial<FilterState>): FilterState {
  return {
    search: filters.search || '',
    region: normalizeToArray(filters.region),
    regionFrom: normalizeToArray(filters.regionFrom),
    regionTo: normalizeToArray(filters.regionTo),
    transportType: normalizeToArray(filters.transportType),
    dateFrom: filters.dateFrom || '',
    dateTo: filters.dateTo || '',
    status: normalizeToArray(filters.status),
    offerStatus: filters.offerStatus || '',
    priceFrom: filters.priceFrom || '',
    priceTo: filters.priceTo || ''
  };
}

interface TableSearchFilterProps {
  language: 'ru' | 'uz';
  onFilterChange: (filters: FilterState) => void;
  showRegionFilter?: boolean;
  showTransportFilter?: boolean;
  showDateFilter?: boolean;
  showStatusFilter?: boolean;
  showOfferStatusFilter?: boolean;
  showPriceFilter?: boolean;
  statusOptions?: Array<{ value: string; label: string }>;
  placeholder?: string;
  storageKey?: string;
  initialFilters?: FilterState;
}

const transportTypes = {
  ru: [
    { value: 'labo', label: 'Лабо' },
    { value: 'bongo', label: 'Бонго' },
    { value: 'furgon', label: 'Фургон' },
    { value: 'isuzu5', label: 'Исузу-5' },
    { value: 'isuzu10', label: 'Исузу-10' },
    { value: 'gruzovik', label: 'Грузовик' },
    { value: 'fura_tent', label: 'Фура тент' },
    { value: 'fura_ref', label: 'Фура рефрижератор' },
    { value: 'paravoz', label: 'Паравоз' },
    { value: 'shalanda', label: 'Шаланда' },
    { value: 'traller', label: 'Трейлер' },
    { value: 'tonar', label: 'Тонар' },
    { value: 'other', label: 'Другой' }
  ],
  uz: [
    { value: 'labo', label: 'Labo' },
    { value: 'bongo', label: 'Bongo' },
    { value: 'furgon', label: 'Furgon' },
    { value: 'isuzu5', label: 'Isuzu-5' },
    { value: 'isuzu10', label: 'Isuzu-10' },
    { value: 'gruzovik', label: 'Yuk avtomobili' },
    { value: 'fura_tent', label: 'Fura tent' },
    { value: 'fura_ref', label: 'Fura muzlatgich' },
    { value: 'paravoz', label: 'Paravoz' },
    { value: 'shalanda', label: 'Shalanda' },
    { value: 'traller', label: 'Treyler' },
    { value: 'tonar', label: 'Tonar' },
    { value: 'other', label: 'Boshqa' }
  ]
};

const emptyFilters: FilterState = {
  search: '',
  region: [],
  regionFrom: [],
  regionTo: [],
  transportType: [],
  dateFrom: '',
  dateTo: '',
  status: [],
  offerStatus: '',
  priceFrom: '',
  priceTo: ''
};

export default function TableSearchFilter({
  language,
  onFilterChange,
  showRegionFilter = true,
  showTransportFilter = true,
  showDateFilter = true,
  showStatusFilter = false,
  showOfferStatusFilter = false,
  showPriceFilter = false,
  statusOptions = [],
  placeholder,
  storageKey,
  initialFilters
}: TableSearchFilterProps) {
  const [filters, setFilters] = useState<FilterState>(() => 
    initialFilters ? normalizeFilterState(initialFilters) : emptyFilters
  );
  const [isOpen, setIsOpen] = useState(false);
  const [hasSavedFilter, setHasSavedFilter] = useState(false);

  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const savedFilters = JSON.parse(saved);
          // Normalize saved filters for backward compatibility with old string-based filters
          const normalizedFilters = normalizeFilterState(savedFilters);
          setFilters(normalizedFilters);
          setHasSavedFilter(true);
          onFilterChange(normalizedFilters);
        } catch (e) {
          console.error('Failed to parse saved filters', e);
        }
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (initialFilters) {
      // Normalize initial filters for backward compatibility
      setFilters(normalizeFilterState(initialFilters));
    }
  }, [initialFilters]);

  const handleSaveFilter = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(filters));
      setHasSavedFilter(true);
    }
  };

  const handleClearSavedFilter = () => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setHasSavedFilter(false);
      const cleared = emptyFilters;
      setFilters(cleared);
      onFilterChange(cleared);
    }
  };

  const texts = {
    ru: {
      search: 'Поиск по названию, маршруту, региону, району...',
      filters: 'Фильтры',
      region: 'Регион',
      regionFrom: 'Откуда',
      regionTo: 'Куда',
      allRegions: 'Все регионы',
      transportType: 'Тип транспорта',
      allTypes: 'Все типы',
      dateFrom: 'Дата от',
      dateTo: 'Дата до',
      status: 'Статус',
      allStatuses: 'Все статусы',
      offerStatus: 'Мои предложения',
      allOffers: 'Все',
      onlyOffered: 'Только предложенные',
      onlyNotOffered: 'Только не предложенные',
      priceFrom: 'Сумма от',
      priceTo: 'Сумма до',
      clear: 'Сбросить',
      apply: 'Применить',
      saveFilter: 'Сохранить фильтр',
      clearSavedFilter: 'Убрать сохранение',
      filterSaved: 'Фильтр сохранён'
    },
    uz: {
      search: 'Nomi, marshrut, viloyat, tuman bo\'yicha qidirish...',
      filters: 'Filtrlar',
      region: 'Viloyat',
      regionFrom: 'Qayerdan',
      regionTo: 'Qayerga',
      allRegions: 'Barcha viloyatlar',
      transportType: 'Transport turi',
      allTypes: 'Barcha turlar',
      dateFrom: 'Sanadan',
      dateTo: 'Sanagacha',
      status: 'Holat',
      allStatuses: 'Barcha holatlar',
      offerStatus: 'Mening takliflarim',
      allOffers: 'Barchasi',
      onlyOffered: 'Faqat taklif qilinganlar',
      onlyNotOffered: 'Faqat taklif qilinmaganlar',
      priceFrom: 'Summadan',
      priceTo: 'Summagacha',
      clear: 'Tozalash',
      apply: 'Qo\'llash',
      saveFilter: 'Filtrni saqlash',
      clearSavedFilter: 'Saqlashni olib tashlash',
      filterSaved: 'Filtr saqlandi'
    }
  };

  const t = texts[language];

  const handleFilterChange = (key: keyof FilterState, value: FilterValue) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClear = () => {
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = !isFilterEmpty(filters.region) || 
    !isFilterEmpty(filters.regionFrom) || 
    !isFilterEmpty(filters.regionTo) || 
    !isFilterEmpty(filters.transportType) || 
    filters.dateFrom || 
    filters.dateTo || 
    !isFilterEmpty(filters.status) || 
    filters.offerStatus || 
    filters.priceFrom || 
    filters.priceTo;

  return (
    <div className="space-y-3 mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder || t.search}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-toggle-filters">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{t.filters}</span>
              {hasActiveFilters && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </CollapsibleTrigger>
          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={handleClear} data-testid="button-clear-filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg">
            {showRegionFilter && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t.regionFrom}</label>
                  <MultiSelect
                    options={uzbekistanRegions.map((region) => ({
                      value: region.name,
                      label: language === 'ru' ? region.nameRu : region.nameUz
                    }))}
                    value={Array.isArray(filters.regionFrom) ? filters.regionFrom : (filters.regionFrom ? [filters.regionFrom] : [])}
                    onChange={(value) => handleFilterChange('regionFrom', value)}
                    placeholder={t.allRegions}
                    allLabel={t.allRegions}
                    data-testid="select-filter-region-from"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t.regionTo}</label>
                  <MultiSelect
                    options={uzbekistanRegions.map((region) => ({
                      value: region.name,
                      label: language === 'ru' ? region.nameRu : region.nameUz
                    }))}
                    value={Array.isArray(filters.regionTo) ? filters.regionTo : (filters.regionTo ? [filters.regionTo] : [])}
                    onChange={(value) => handleFilterChange('regionTo', value)}
                    placeholder={t.allRegions}
                    allLabel={t.allRegions}
                    data-testid="select-filter-region-to"
                  />
                </div>
              </>
            )}

            {showTransportFilter && (
              <div className="space-y-1">
                <label className="text-sm font-medium">{t.transportType}</label>
                <MultiSelect
                  options={transportTypes[language]}
                  value={Array.isArray(filters.transportType) ? filters.transportType : (filters.transportType ? [filters.transportType] : [])}
                  onChange={(value) => handleFilterChange('transportType', value)}
                  placeholder={t.allTypes}
                  allLabel={t.allTypes}
                  data-testid="select-filter-transport"
                />
              </div>
            )}

            {showDateFilter && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t.dateFrom}</label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    data-testid="input-filter-date-from"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t.dateTo}</label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    data-testid="input-filter-date-to"
                  />
                </div>
              </>
            )}

            {showStatusFilter && statusOptions.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium">{t.status}</label>
                <MultiSelect
                  options={statusOptions}
                  value={Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : [])}
                  onChange={(value) => handleFilterChange('status', value)}
                  placeholder={t.allStatuses}
                  allLabel={t.allStatuses}
                  data-testid="select-filter-status"
                />
              </div>
            )}

            {showOfferStatusFilter && (
              <div className="space-y-1">
                <label className="text-sm font-medium">{t.offerStatus}</label>
                <Select
                  value={filters.offerStatus}
                  onValueChange={(value) => handleFilterChange('offerStatus', value)}
                >
                  <SelectTrigger data-testid="select-filter-offer-status">
                    <SelectValue placeholder={t.allOffers} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allOffers}</SelectItem>
                    <SelectItem value="offered">{t.onlyOffered}</SelectItem>
                    <SelectItem value="not_offered">{t.onlyNotOffered}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {showPriceFilter && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t.priceFrom}</label>
                  <Input
                    type="number"
                    value={filters.priceFrom}
                    onChange={(e) => handleFilterChange('priceFrom', e.target.value)}
                    placeholder="0"
                    data-testid="input-filter-price-from"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t.priceTo}</label>
                  <Input
                    type="number"
                    value={filters.priceTo}
                    onChange={(e) => handleFilterChange('priceTo', e.target.value)}
                    placeholder="999 999 999"
                    data-testid="input-filter-price-to"
                  />
                </div>
              </>
            )}
          </div>
          
          {storageKey && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {hasSavedFilter && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Save className="h-3 w-3" />
                  {t.filterSaved}
                </span>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveFilter}
                  className="gap-1"
                  data-testid="button-save-filter"
                >
                  <Save className="h-4 w-4" />
                  {t.saveFilter}
                </Button>
                {hasSavedFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSavedFilter}
                    className="gap-1 text-destructive hover:text-destructive"
                    data-testid="button-clear-saved-filter"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.clearSavedFilter}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function filterData<T>(
  data: T[],
  filters: FilterState,
  getSearchableText: (item: T) => string,
  getOriginRegions?: (item: T) => string[],
  getTransportType?: (item: T) => string,
  getDate?: (item: T) => string,
  getStatus?: (item: T) => string,
  getPrice?: (item: T) => number,
  getDestinationRegions?: (item: T) => string[]
): T[] {
  return data.filter((item) => {
    // Text search filter
    if (filters.search) {
      const searchText = getSearchableText(item).toLowerCase();
      if (!searchText.includes(filters.search.toLowerCase())) {
        return false;
      }
    }

    // Region from filter (supports multi-select)
    if (!isFilterEmpty(filters.regionFrom) && getOriginRegions) {
      const originRegions = getOriginRegions(item);
      if (!filterMatches(filters.regionFrom, originRegions)) {
        return false;
      }
    }

    // Region to filter (supports multi-select)
    if (!isFilterEmpty(filters.regionTo) && getDestinationRegions) {
      const destRegions = getDestinationRegions(item);
      if (!filterMatches(filters.regionTo, destRegions)) {
        return false;
      }
    }

    // Transport type filter (supports multi-select)
    if (!isFilterEmpty(filters.transportType) && getTransportType) {
      const itemType = getTransportType(item);
      if (!filterMatches(filters.transportType, itemType)) {
        return false;
      }
    }

    // Date range filter
    if (getDate) {
      const itemDate = new Date(getDate(item));
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        if (itemDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }
    }

    // Price range filter
    if (getPrice) {
      const itemPrice = getPrice(item);
      if (filters.priceFrom) {
        const priceFrom = parseInt(filters.priceFrom);
        if (!isNaN(priceFrom) && itemPrice < priceFrom) return false;
      }
      if (filters.priceTo) {
        const priceTo = parseInt(filters.priceTo);
        if (!isNaN(priceTo) && itemPrice > priceTo) return false;
      }
    }

    // Status filter (supports multi-select)
    if (!isFilterEmpty(filters.status) && getStatus) {
      const itemStatus = getStatus(item);
      if (!filterMatches(filters.status, itemStatus)) {
        return false;
      }
    }

    return true;
  });
}
