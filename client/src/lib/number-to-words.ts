const ONES_RU = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_RU_FEM = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS_RU = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS_RU = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS_RU = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

const ONES_UZ = ['', 'bir', 'ikki', 'uch', 'to\'rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to\'qqiz'];
const TENS_UZ = ['', 'o\'n', 'yigirma', 'o\'ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', 'to\'qson'];

const SCALES_RU = [
  { singular: 'тысяча', plural2_4: 'тысячи', plural5_0: 'тысяч', feminine: true },
  { singular: 'миллион', plural2_4: 'миллиона', plural5_0: 'миллионов', feminine: false },
  { singular: 'миллиард', plural2_4: 'миллиарда', plural5_0: 'миллиардов', feminine: false },
  { singular: 'триллион', plural2_4: 'триллиона', plural5_0: 'триллионов', feminine: false },
];

const SCALES_UZ = ['ming', 'million', 'milliard', 'trillion'];

function getScaleWordRu(n: number, scale: typeof SCALES_RU[0]): string {
  const lastTwo = n % 100;
  const lastOne = n % 10;
  
  if (lastTwo >= 11 && lastTwo <= 19) {
    return scale.plural5_0;
  }
  if (lastOne === 1) {
    return scale.singular;
  }
  if (lastOne >= 2 && lastOne <= 4) {
    return scale.plural2_4;
  }
  return scale.plural5_0;
}

function convertHundredsRu(n: number, feminine: boolean = false): string {
  const parts: string[] = [];
  
  if (n >= 100) {
    parts.push(HUNDREDS_RU[Math.floor(n / 100)]);
    n %= 100;
  }
  
  if (n >= 10 && n <= 19) {
    parts.push(TEENS_RU[n - 10]);
    return parts.join(' ');
  }
  
  if (n >= 20) {
    parts.push(TENS_RU[Math.floor(n / 10)]);
    n %= 10;
  }
  
  if (n > 0) {
    parts.push(feminine ? ONES_RU_FEM[n] : ONES_RU[n]);
  }
  
  return parts.join(' ');
}

function convertHundredsUz(n: number): string {
  const parts: string[] = [];
  
  if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    parts.push(hundreds === 1 ? 'yuz' : `${ONES_UZ[hundreds]} yuz`);
    n %= 100;
  }
  
  if (n >= 10) {
    parts.push(TENS_UZ[Math.floor(n / 10)]);
    n %= 10;
  }
  
  if (n > 0) {
    parts.push(ONES_UZ[n]);
  }
  
  return parts.join(' ');
}

export function numberToWordsRu(num: number): string {
  if (num === 0) return 'ноль';
  if (num < 0) return 'минус ' + numberToWordsRu(-num);
  
  const parts: string[] = [];
  let remaining = Math.floor(num);
  
  for (let i = SCALES_RU.length - 1; i >= 0; i--) {
    const divisor = Math.pow(1000, i + 1);
    const quotient = Math.floor(remaining / divisor);
    
    if (quotient > 0) {
      const scale = SCALES_RU[i];
      parts.push(convertHundredsRu(quotient, scale.feminine) + ' ' + getScaleWordRu(quotient, scale));
      remaining %= divisor;
    }
  }
  
  if (remaining > 0 || parts.length === 0) {
    parts.push(convertHundredsRu(remaining, false));
  }
  
  return parts.join(' ').trim().replace(/\s+/g, ' ');
}

export function numberToWordsUz(num: number): string {
  if (num === 0) return 'nol';
  if (num < 0) return 'minus ' + numberToWordsUz(-num);
  
  const parts: string[] = [];
  let remaining = Math.floor(num);
  
  for (let i = SCALES_UZ.length - 1; i >= 0; i--) {
    const divisor = Math.pow(1000, i + 1);
    const quotient = Math.floor(remaining / divisor);
    
    if (quotient > 0) {
      if (quotient === 1) {
        parts.push(SCALES_UZ[i]);
      } else {
        parts.push(convertHundredsUz(quotient) + ' ' + SCALES_UZ[i]);
      }
      remaining %= divisor;
    }
  }
  
  if (remaining > 0 || parts.length === 0) {
    parts.push(convertHundredsUz(remaining));
  }
  
  return parts.join(' ').trim().replace(/\s+/g, ' ');
}

export function formatAmountWithSpaces(value: string, allowDecimals: boolean = true): string {
  // Support both comma and period as decimal separator
  const normalized = value.replace(',', '.');
  const cleanValue = normalized.replace(/[^\d.]/g, '');
  
  // Split by decimal point
  const parts = cleanValue.split('.');
  const integerPart = parts[0] || '';
  let decimalPart = parts.length > 1 ? parts.slice(1).join('') : '';
  
  if (decimalPart.length > 2) {
    decimalPart = decimalPart.slice(0, 2);
  }
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  // Show decimal part only if original value had decimal separator
  if (parts.length > 1) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}

export function parseFormattedAmount(value: string, allowDecimals: boolean = true): number {
  // Always support both comma and period as decimal separator
  const cleanValue = value.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
}

export function extractDigitsWithDecimal(value: string): string {
  return value.replace(/[^\d,]/g, '');
}

export function getAmountInWords(amount: number, lang: 'ru' | 'uz'): string {
  if (!amount || amount <= 0) return '';
  const words = lang === 'ru' ? numberToWordsRu(amount) : numberToWordsUz(amount);
  const currency = lang === 'ru' ? 'сум' : 'so\'m';
  return `${words} ${currency}`;
}
