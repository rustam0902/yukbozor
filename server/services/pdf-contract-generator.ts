/**
 * PDF Contract Generator Service
 * Generates contract documents as PDF using Puppeteer with QR code
 */

import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { Order, User, Profile, Contract, Offer } from '@shared/schema';
import { numberToWordsRu, numberToWordsUz } from './number-to-words';
import { uzbekistanRegions } from '@shared/uzbekistan-regions';

export interface ContractPdfData {
  contract: Contract;
  order: Order;
  offer: Offer;
  customer: User;
  customerProfile: Profile | null;
  carrier: User;
  carrierProfile: Profile | null;
}

type Language = 'ru' | 'uz';

const TRANSPORT_TYPES: Record<Language, Record<string, string>> = {
  ru: {
    labo: 'Лабо',
    bongo: 'Бонго',
    furgon: 'Фургон',
    isuzu5: 'Исузу 5т',
    isuzu10: 'Исузу 10т',
    gruzovik: 'Грузовик',
    fura_tent: 'Фура тент',
    fura_ref: 'Фура реф',
    paravoz: 'Паровоз',
    shalanda: 'Шаланда',
    traller: 'Траллер',
  },
  uz: {
    labo: 'Labo',
    bongo: 'Bongo',
    furgon: 'Furgon',
    isuzu5: 'Isuzu 5t',
    isuzu10: 'Isuzu 10t',
    gruzovik: 'Yuk mashinasi',
    fura_tent: 'Fura tent',
    fura_ref: 'Fura ref',
    paravoz: 'Parovoz',
    shalanda: 'Shalanda',
    traller: 'Traller',
  },
};

interface LocationPoint {
  region: string;
  districts: string[];
}

function getRegionName(regionKey: string, lang: Language): string {
  const region = uzbekistanRegions.find(r => r.name === regionKey);
  if (!region) return regionKey;
  return lang === 'ru' ? region.nameRu : region.nameUz;
}

function getDistrictName(regionKey: string, districtKey: string, lang: Language): string {
  const region = uzbekistanRegions.find(r => r.name === regionKey);
  if (!region) return districtKey;
  const district = region.districts.find(d => d.name === districtKey);
  if (!district) return districtKey;
  return lang === 'ru' ? district.nameRu : district.nameUz;
}

function getDistrictsDisplay(regionKey: string, districts: string[], lang: Language): string {
  if (!districts || districts.length === 0) return '';
  return districts.map(d => getDistrictName(regionKey, d, lang)).join(', ');
}

function formatLocationPoints(points: LocationPoint[] | null | undefined, fallbackRegion: string, fallbackDistricts: string[], lang: Language): string {
  if (!points || points.length === 0) {
    const regionName = getRegionName(fallbackRegion, lang);
    const districtsArr = Array.isArray(fallbackDistricts) ? fallbackDistricts : [fallbackDistricts];
    const districtsDisplay = getDistrictsDisplay(fallbackRegion, districtsArr, lang);
    return districtsDisplay ? `${regionName}: ${districtsDisplay}` : regionName;
  }
  
  return points.map((point, index) => {
    const regionName = getRegionName(point.region, lang);
    const districtsDisplay = getDistrictsDisplay(point.region, point.districts, lang);
    const prefix = points.length > 1 ? `${index + 1}. ` : '';
    return districtsDisplay ? `${prefix}${regionName}: ${districtsDisplay}` : `${prefix}${regionName}`;
  }).join('<br>');
}

function formatDate(date: Date | string, lang: Language): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Convert to Tashkent time (UTC+5)
  const tashkentDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
  
  if (lang === 'uz') {
    const day = tashkentDate.getDate().toString().padStart(2, '0');
    const month = tashkentDate.getMonth() + 1;
    const year = tashkentDate.getFullYear();
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return `${day} ${months[month - 1]} ${year} yil`;
  }
  
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Tashkent',
  }).format(d).replace(' г.', ' года');
}

function formatPriceWithCurrency(amount: number, lang: Language): string {
  const words = lang === 'ru' ? numberToWordsRu(amount) : numberToWordsUz(amount);
  const currency = lang === 'ru' ? 'сум' : "so'm";
  return `${words} ${currency}`;
}

function getYesNo(value: boolean, lang: Language): string {
  if (lang === 'uz') {
    return value ? 'Ha' : "Yo'q";
  }
  return value ? 'Да' : 'Нет';
}

function getDisplayName(user: User, profile: Profile | null): string {
  if (user.userType === 'individual') {
    return user.displayName;
  }
  return profile?.companyName || user.displayName;
}

function getDirectorName(profile: Profile | null): string {
  if (!profile) return '_________________';
  return profile.eimzoCertCn || '_________________';
}

function getAddress(profile: Profile | null): string {
  return profile?.legalAddress || '_________________';
}

function getInnOrPinfl(user: User, profile: Profile | null): string {
  // Legal entities show INN (STIR)
  if (user.userType === 'legal') {
    return profile?.inn || profile?.eimzoCertTin || '_________________';
  }
  // IPs and Individuals show PINFL
  return profile?.pinfl || profile?.eimzoCertPinfl || '_________________';
}

function getBankAccount(profile: Profile | null): string {
  return profile?.bankAccount || '_________________';
}

function getBankName(profile: Profile | null): string {
  return profile?.bankName || '_________________';
}

function getBankMfo(profile: Profile | null): string {
  return profile?.bankCode || '_________________';
}

const TRANSLATIONS = {
  ru: {
    title: 'ДОГОВОР ПЕРЕВОЗКИ ГРУЗА',
    contractNo: 'Договор №',
    city: 'г. Ташкент',
    customer: 'Заказчик',
    carrier: 'Перевозчик',
    subject: '1. ПРЕДМЕТ ДОГОВОРА',
    subjectText: '1.1. Заказчик поручает, а Перевозчик принимает на себя обязательство осуществить перевозку груза по следующему маршруту:',
    origin: 'Пункт отправления',
    destination: 'Пункт назначения',
    cargoName: 'Наименование груза',
    weight: 'Вес груза',
    tons: 'тонн',
    transportType: 'Тип транспорта',
    loadDate: 'Дата и время погрузки',
    isDangerous: 'Опасный груз',
    isNonstandard: 'Нестандартный груз',
    isPartialLoad: 'Частичная загрузка',
    cost: '2. СТОИМОСТЬ УСЛУГ И ПОРЯДОК РАСЧЕТОВ',
    costText: '2.1. Стоимость услуг по перевозке груза составляет:',
    withVat: '(включая НДС)',
    collateral: '3. ЗАЛОГОВОЕ ОБЕСПЕЧЕНИЕ',
    collateralProvided: 'Залог предоставляется',
    collateralAmount: 'Сумма залога (2%)',
    rights: '4. ПРАВА И ОБЯЗАННОСТИ СТОРОН',
    customerObligations: '4.1. Заказчик обязуется:',
    customerObl1: 'Предоставить груз к погрузке в указанное время и место',
    customerObl2: 'Обеспечить надлежащую упаковку груза',
    customerObl3: 'Произвести оплату в установленные сроки',
    carrierObligations: '4.2. Перевозчик обязуется:',
    carrierObl1: 'Доставить груз в сохранности в пункт назначения',
    carrierObl2: 'Соблюдать правила перевозки грузов',
    carrierObl3: 'Незамедлительно информировать Заказчика о задержках',
    liability: '5. ОТВЕТСТВЕННОСТЬ СТОРОН',
    liabilityText: '5.1. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с законодательством Республики Узбекистан.',
    dispute: '6. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ',
    disputeText: '6.1. Все споры разрешаются путем переговоров. При недостижении согласия споры передаются в суд по месту нахождения ответчика.',
    final: '7. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ',
    finalText: '7.1. Настоящий договор вступает в силу с момента подписания и действует до полного исполнения сторонами своих обязательств.',
    notes: '8. ДОПОЛНИТЕЛЬНЫЕ УСЛОВИЯ',
    signatures: '9. ПОДПИСИ СТОРОН',
    phone: 'Телефон',
    inn: 'ИНН/ПИНФЛ',
    bankAccount: 'Р/С',
    bankName: 'Банк',
    mfo: 'МФО',
    director: 'Руководитель',
    signature: 'Подпись',
    publicOffer: 'Стороны приняли условия публичной оферты платформы Yukbor.uz',
    acceptedVia: 'Способ принятия оферты',
    acceptedDate: 'Дата принятия',
    qrCodeTitle: 'Скачать договор',
    qrCodeDesc: 'Отсканируйте QR-код для скачивания договора',
  },
  uz: {
    title: 'YUK TASHISH SHARTNOMASI',
    contractNo: 'Shartnoma №',
    city: 'Toshkent sh.',
    customer: 'Buyurtmachi',
    carrier: 'Tashuvchi',
    subject: '1. SHARTNOMA PREDMETI',
    subjectText: "1.1. Buyurtmachi topshiriq beradi, Tashuvchi esa quyidagi yo'nalish bo'yicha yuk tashishni o'z zimmasiga oladi:",
    origin: "Jo'natish punkti",
    destination: 'Yetkazish punkti',
    cargoName: 'Yuk nomi',
    weight: 'Yuk vazni',
    tons: 'tonna',
    transportType: 'Transport turi',
    loadDate: 'Yuklash sanasi va vaqti',
    isDangerous: 'Xavfli yuk',
    isNonstandard: "Nostandart yuk",
    isPartialLoad: "Qisman yuklash",
    cost: "2. XIZMAT NARXI VA HISOB-KITOB TARTIBI",
    costText: "2.1. Yuk tashish xizmati narxi:",
    withVat: "(QQS bilan)",
    collateral: "3. GAROV TA'MINOTI",
    collateralProvided: "Garov taqdim etiladi",
    collateralAmount: "Garov summasi (2%)",
    rights: "4. TOMONLARNING HUQUQ VA MAJBURIYATLARI",
    customerObligations: "4.1. Buyurtmachi majburiyatlari:",
    customerObl1: "Yukni belgilangan vaqt va joyda yuklashga taqdim etish",
    customerObl2: "Yukning tegishli qadoqlanishini ta'minlash",
    customerObl3: "Belgilangan muddatlarda to'lovni amalga oshirish",
    carrierObligations: "4.2. Tashuvchi majburiyatlari:",
    carrierObl1: "Yukni saqlab yetkazish punktiga yetkazish",
    carrierObl2: "Yuk tashish qoidalariga rioya qilish",
    carrierObl3: "Kechikishlar haqida Buyurtmachini darhol xabardor qilish",
    liability: "5. TOMONLARNING JAVOBGARLIGI",
    liabilityText: "5.1. Majburiyatlarni bajarmaslik yoki lozim darajada bajarmaslik uchun tomonlar O'zbekiston Respublikasi qonunchiligiga muvofiq javobgar bo'ladilar.",
    dispute: "6. NIZOLARNI HAL QILISH TARTIBI",
    disputeText: "6.1. Barcha nizolar muzokara yo'li bilan hal qilinadi. Kelishuvga erishilmasa, nizolar javobgarning joylashuvi bo'yicha sudga topshiriladi.",
    final: "7. YAKUNIY QOIDALAR",
    finalText: "7.1. Ushbu shartnoma imzolangan paytdan boshlab kuchga kiradi va tomonlar o'z majburiyatlarini to'liq bajarguncha amal qiladi.",
    notes: "8. QO'SHIMCHA SHARTLAR",
    signatures: "9. TOMONLARNING IMZOLARI",
    phone: 'Telefon',
    inn: 'STIR/JShShIR',
    bankAccount: 'H/R',
    bankName: 'Bank',
    mfo: 'MFO',
    director: 'Rahbar',
    signature: 'Imzo',
    publicOffer: "Tomonlar Yukbor.uz platformasining ommaviy oferta shartlarini qabul qildilar",
    acceptedVia: "Ofertani qabul qilish usuli",
    acceptedDate: "Qabul qilish sanasi",
    qrCodeTitle: "Shartnomani yuklab olish",
    qrCodeDesc: "Shartnomani yuklab olish uchun QR-kodni skanerlang",
  },
};

function getSignatureMethod(user: User, lang: Language): string {
  if (user.userType === 'individual') {
    return lang === 'ru' ? 'SMS-верификация' : 'SMS-verifikatsiya';
  }
  return lang === 'ru' ? 'ЭЦП (E-IMZO)' : 'ERI (E-IMZO)';
}

async function generateQRCodeDataUrl(contractId: number, lang: Language): Promise<string> {
  const downloadUrl = `https://yukbozor.uz/api/contracts/${contractId}/download/${lang}`;
  try {
    return await QRCode.toDataURL(downloadUrl, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return '';
  }
}

function generateContractHtml(data: ContractPdfData, lang: Language, qrCodeDataUrl: string): string {
  const { contract, order, offer, customer, customerProfile, carrier, carrierProfile } = data;
  const t = TRANSLATIONS[lang];
  const transportTypes = TRANSPORT_TYPES[lang];
  
  const priceWithVat = offer.price;
  const collateralAmount = Math.round(priceWithVat * 0.02);
  const contractNumber = `YB-${String(contract.id).padStart(6, '0')}`;
  
  const originPoints = formatLocationPoints(
    order.originPoints as LocationPoint[] | null,
    order.originRegion,
    order.originDistrict as string[],
    lang
  );
  
  const destinationPoints = formatLocationPoints(
    order.destinationPoints as LocationPoint[] | null,
    order.destinationRegion,
    order.destinationDistrict as string[],
    lang
  );

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }
    body {
      font-family: 'DejaVu Sans', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 14pt;
      margin: 0 0 10px 0;
    }
    .header-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      font-size: 10pt;
    }
    .party {
      width: 48%;
    }
    h2 {
      font-size: 12pt;
      margin: 15px 0 10px 0;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    td {
      padding: 5px;
      vertical-align: top;
    }
    td:first-child {
      width: 40%;
      font-weight: bold;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      page-break-inside: avoid;
    }
    .signature-block {
      width: 45%;
      font-size: 10pt;
    }
    .signature-block h3 {
      font-size: 11pt;
      margin-bottom: 10px;
      border-bottom: 1px solid #000;
      padding-bottom: 5px;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      height: 30px;
      margin: 10px 0;
    }
    .public-offer {
      margin-top: 20px;
      padding: 10px;
      background: #f5f5f5;
      font-size: 9pt;
      border-radius: 4px;
    }
    ul {
      margin: 5px 0;
      padding-left: 20px;
    }
    li {
      margin: 3px 0;
    }
    .notes {
      background: #fffde7;
      padding: 10px;
      border-left: 3px solid #ffc107;
      margin: 10px 0;
    }
    .qr-section {
      margin-top: 30px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
      background: #fafafa;
    }
    .qr-section h3 {
      margin: 0 0 10px 0;
      font-size: 12pt;
    }
    .qr-section p {
      margin: 10px 0 0 0;
      font-size: 9pt;
      color: #666;
    }
    .qr-section img {
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${t.title}</h1>
    <div class="header-info">
      <span>${t.contractNo} ${contractNumber}</span>
      <span>${t.city}, ${formatDate(contract.generatedAt, lang)}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <strong>${t.customer}:</strong><br>
      ${getDisplayName(customer, customerProfile)}<br>
      ${t.phone}: ${customer.phone}
    </div>
    <div class="party">
      <strong>${t.carrier}:</strong><br>
      ${getDisplayName(carrier, carrierProfile)}<br>
      ${t.phone}: ${carrier.phone}
    </div>
  </div>

  <h2>${t.subject}</h2>
  <p>${t.subjectText}</p>
  <table>
    <tr><td>${t.origin}:</td><td>${originPoints}</td></tr>
    <tr><td>${t.destination}:</td><td>${destinationPoints}</td></tr>
    <tr><td>${t.cargoName}:</td><td>${order.title}</td></tr>
    <tr><td>${t.weight}:</td><td>${order.weightTons} ${t.tons}</td></tr>
    <tr><td>${t.transportType}:</td><td>${transportTypes[order.transportType] || order.transportType}</td></tr>
    <tr><td>${t.loadDate}:</td><td>${formatDate(order.loadDate, lang)}, ${order.loadingTime}</td></tr>
    <tr><td>${t.isDangerous}:</td><td>${getYesNo(order.isDangerous, lang)}</td></tr>
    <tr><td>${t.isNonstandard}:</td><td>${getYesNo(order.isNonstandard, lang)}</td></tr>
    <tr><td>${t.isPartialLoad}:</td><td>${getYesNo(order.isPartialLoad, lang)}</td></tr>
  </table>

  <h2>${t.cost}</h2>
  <p>${t.costText} <strong>${priceWithVat.toLocaleString('ru-RU')} ${lang === 'ru' ? 'сум' : "so'm"}</strong> (${formatPriceWithCurrency(priceWithVat, lang)}) ${t.withVat}</p>

  ${order.requiresCollateral ? `
  <h2>${t.collateral}</h2>
  <table>
    <tr><td>${t.collateralProvided}:</td><td>${getYesNo(true, lang)}</td></tr>
    <tr><td>${t.collateralAmount}:</td><td>${collateralAmount.toLocaleString('ru-RU')} ${lang === 'ru' ? 'сум' : "so'm"} (${formatPriceWithCurrency(collateralAmount, lang)})</td></tr>
  </table>
  ` : ''}

  <h2>${t.rights}</h2>
  <p><strong>${t.customerObligations}</strong></p>
  <ul>
    <li>${t.customerObl1}</li>
    <li>${t.customerObl2}</li>
    <li>${t.customerObl3}</li>
  </ul>
  <p><strong>${t.carrierObligations}</strong></p>
  <ul>
    <li>${t.carrierObl1}</li>
    <li>${t.carrierObl2}</li>
    <li>${t.carrierObl3}</li>
  </ul>

  <h2>${t.liability}</h2>
  <p>${t.liabilityText}</p>

  <h2>${t.dispute}</h2>
  <p>${t.disputeText}</p>

  <h2>${t.final}</h2>
  <p>${t.finalText}</p>

  ${order.notes ? `
  <h2>${t.notes}</h2>
  <div class="notes">${order.notes}</div>
  ` : ''}

  <h2>${t.signatures}</h2>
  <div class="signatures">
    <div class="signature-block">
      <h3>${t.customer}</h3>
      <p><strong>${getDisplayName(customer, customerProfile)}</strong></p>
      <p>${t.phone}: ${customer.phone}</p>
      <p>${t.inn}: ${getInnOrPinfl(customer, customerProfile)}</p>
      <p>${t.bankAccount}: ${getBankAccount(customerProfile)}</p>
      <p>${t.bankName}: ${getBankName(customerProfile)}</p>
      <p>${t.mfo}: ${getBankMfo(customerProfile)}</p>
      <p>${t.director}: ${getDirectorName(customerProfile)}</p>
      <div class="signature-line"></div>
      <p>${t.signature}</p>
    </div>
    <div class="signature-block">
      <h3>${t.carrier}</h3>
      <p><strong>${getDisplayName(carrier, carrierProfile)}</strong></p>
      <p>${t.phone}: ${carrier.phone}</p>
      <p>${t.inn}: ${getInnOrPinfl(carrier, carrierProfile)}</p>
      <p>${t.bankAccount}: ${getBankAccount(carrierProfile)}</p>
      <p>${t.bankName}: ${getBankName(carrierProfile)}</p>
      <p>${t.mfo}: ${getBankMfo(carrierProfile)}</p>
      <p>${t.director}: ${getDirectorName(carrierProfile)}</p>
      <div class="signature-line"></div>
      <p>${t.signature}</p>
    </div>
  </div>

  <div class="public-offer">
    <strong>${t.publicOffer}</strong><br>
    <strong>${t.customer}:</strong> ${t.acceptedVia}: ${getSignatureMethod(customer, lang)} | ${t.acceptedDate}: ${formatDate(customer.createdAt!, lang)}<br>
    <strong>${t.carrier}:</strong> ${t.acceptedVia}: ${getSignatureMethod(carrier, lang)} | ${t.acceptedDate}: ${formatDate(carrier.createdAt!, lang)}
  </div>

  ${qrCodeDataUrl ? `
  <div class="qr-section">
    <h3>${t.qrCodeTitle}</h3>
    <img src="${qrCodeDataUrl}" alt="QR Code" width="150" height="150" />
    <p>${t.qrCodeDesc}</p>
  </div>
  ` : ''}
</body>
</html>
`;
}

export async function generateContractPdf(data: ContractPdfData, lang: Language): Promise<Buffer> {
  const qrCodeDataUrl = await generateQRCodeDataUrl(data.contract.id, lang);
  const html = generateContractHtml(data, lang, qrCodeDataUrl);
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export function getContractPdfFilename(contractId: number, lang: Language): string {
  return `Contract_YB-${String(contractId).padStart(6, '0')}_${lang.toUpperCase()}.pdf`;
}
