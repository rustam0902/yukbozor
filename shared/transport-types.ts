export interface TransportType {
  value: string;
  labelRu: string;
  labelUz: string;
}

export const transportTypes: TransportType[] = [
  { value: 'labo', labelRu: 'Лабо', labelUz: 'Labo' },
  { value: 'bongo', labelRu: 'Бонго', labelUz: 'Bongo' },
  { value: 'furgon', labelRu: 'Фургон', labelUz: 'Furgon' },
  { value: 'isuzu5', labelRu: 'ISUZU 5', labelUz: 'ISUZU 5' },
  { value: 'isuzu10', labelRu: 'ISUZU 10', labelUz: 'ISUZU 10' },
  { value: 'gruzovik', labelRu: 'Грузовик', labelUz: 'Gruzovik' },
  { value: 'fura_tent', labelRu: 'Фура Тент', labelUz: 'Fura Tent' },
  { value: 'fura_ref', labelRu: 'Фура Реф', labelUz: 'Fura Ref' },
  { value: 'paravoz', labelRu: 'Паравоз', labelUz: 'Paravoz' },
  { value: 'shalanda', labelRu: 'Шаланда', labelUz: 'Shalanda' },
  { value: 'traller', labelRu: 'Траллер', labelUz: 'Traller' },
  { value: 'tonar', labelRu: 'Тонар', labelUz: 'Tonar' },
  { value: 'benzovoz', labelRu: 'Бензовоз', labelUz: 'Benzovoz' },
  { value: 'konteynerovoz', labelRu: 'Контейнеровоз', labelUz: 'Konteynerovoz' },
  { value: 'other', labelRu: 'Прочие', labelUz: 'Boshqalar' },
];

export function getTransportTypeLabel(value: string, language: 'ru' | 'uz'): string {
  const type = transportTypes.find(t => t.value === value);
  if (!type) return value;
  return language === 'ru' ? type.labelRu : type.labelUz;
}
