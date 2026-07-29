// Uzbekistan Banks MFO Directory
// МФО код - Межфилиальный оборот (Bank Identification Code)

export interface BankInfo {
  name: string;
  nameUz: string;
  mfo: string;
}

// Main MFO codes for Uzbekistan banks
// Most banks now use a single unified MFO code (consolidated in 2023-2024)
export const uzbekistanBanks: Record<string, BankInfo> = {
  // Central Bank
  '00000': { name: 'Центральный банк Республики Узбекистан', nameUz: 'O\'zbekiston Respublikasi Markaziy banki', mfo: '00000' },
  
  // Major Commercial Banks
  '00014': { name: 'Национальный банк ВЭД (NBU)', nameUz: 'Tashqi iqtisodiy faoliyat milliy banki', mfo: '00014' },
  '00084': { name: 'Народный банк', nameUz: 'Xalq banki', mfo: '00084' },
  '00440': { name: 'Узпромстройбанк (SQB)', nameUz: 'O\'zsanoatqurilishbank', mfo: '00440' },
  '00873': { name: 'Асака банк', nameUz: 'Asaka bank', mfo: '00873' },
  '00395': { name: 'Зироат Банк Узбекистан', nameUz: 'Ziraat Bank O\'zbekiston', mfo: '00395' },
  '00491': { name: 'Трастбанк', nameUz: 'Trustbank', mfo: '00491' },
  '01095': { name: 'Азия Альянс Банк', nameUz: 'Asia Alliance Bank', mfo: '01095' },
  '00450': { name: 'Ипотека-банк', nameUz: 'Ipoteka-bank', mfo: '00450' },
  '01018': { name: 'Алокабанк', nameUz: 'Aloqabank', mfo: '01018' },
  '00966': { name: 'Микрокредитбанк', nameUz: 'Mikrokreditbank', mfo: '00966' },
  '01041': { name: 'Ориентфинансбанк (OFB)', nameUz: 'Orientfinansbank', mfo: '01041' },
  '01074': { name: 'Ипак Йули банк', nameUz: 'Ipak Yo\'li bank', mfo: '01074' },
  '01158': { name: 'Капиталбанк', nameUz: 'Kapitalbank', mfo: '01158' },
  '00498': { name: 'Хамкорбанк', nameUz: 'Hamkorbank', mfo: '00498' },
  '01136': { name: 'Давр банк', nameUz: 'Davr bank', mfo: '01136' },
  '00614': { name: 'Агробанк', nameUz: 'Agrobank', mfo: '00614' },
  '00862': { name: 'Кишлок курилиш банк', nameUz: 'Qishloq qurilish bank', mfo: '00862' },
  '00976': { name: 'Универсал банк', nameUz: 'Universal bank', mfo: '00976' },
  '00425': { name: 'Туронбанк', nameUz: 'Turonbank', mfo: '00425' },
  '01110': { name: 'Савдогар банк', nameUz: 'Savdogar bank', mfo: '01110' },
  '01067': { name: 'Hi-Tech Bank', nameUz: 'Hi-Tech Bank', mfo: '01067' },
  '00904': { name: 'Узавтосаноат банк', nameUz: 'O\'zavtosanoat bank', mfo: '00904' },
  '01165': { name: 'TBC Bank Узбекистан', nameUz: 'TBC Bank O\'zbekiston', mfo: '01165' },
  '01127': { name: 'Tengebank', nameUz: 'Tengebank', mfo: '01127' },
  '01182': { name: 'Anorbank', nameUz: 'Anorbank', mfo: '01182' },
  '01149': { name: 'Infinbank', nameUz: 'Infinbank', mfo: '01149' },
  '00999': { name: 'КДБ Банк Узбекистан', nameUz: 'KDB Bank O\'zbekiston', mfo: '00999' },
  '00957': { name: 'Ravnaq bank', nameUz: 'Ravnaq bank', mfo: '00957' },
  '00939': { name: 'Madad Invest Bank', nameUz: 'Madad Invest Bank', mfo: '00939' },
  '00985': { name: 'Turkiston bank', nameUz: 'Turkiston bank', mfo: '00985' },
  '00930': { name: 'Poytaxt bank', nameUz: 'Poytaxt bank', mfo: '00930' },
  '01101': { name: 'Universalbank', nameUz: 'Universalbank', mfo: '01101' },
};

// Get bank name by MFO code
export function getBankNameByMfo(mfo: string, lang: 'ru' | 'uz' = 'ru'): string | null {
  // Normalize MFO to 5 digits with leading zeros
  const normalizedMfo = mfo.padStart(5, '0');
  
  const bank = uzbekistanBanks[normalizedMfo];
  if (bank) {
    return lang === 'uz' ? bank.nameUz : bank.name;
  }
  
  // Try without leading zeros
  const bank2 = uzbekistanBanks[mfo];
  if (bank2) {
    return lang === 'uz' ? bank2.nameUz : bank2.name;
  }
  
  return null;
}

// Get full bank info by MFO
export function getBankInfoByMfo(mfo: string): BankInfo | null {
  const normalizedMfo = mfo.padStart(5, '0');
  return uzbekistanBanks[normalizedMfo] || uzbekistanBanks[mfo] || null;
}
