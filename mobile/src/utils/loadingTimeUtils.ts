export const ALL_DAY_VALUE = 'kun davomida';
export const ALL_DAY_VALUE_RU = 'в течение дня';

export function localizeLoadingTime(value: string | undefined | null, language: string): string {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === ALL_DAY_VALUE || normalized === ALL_DAY_VALUE_RU || normalized === 'all_day') {
    return language === 'uz' ? 'kun davomida' : 'в течение дня';
  }
  return value;
}
