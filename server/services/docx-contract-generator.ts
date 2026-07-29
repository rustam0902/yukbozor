/**
 * DOCX Contract Generator Service
 * Generates contract documents from templates with placeholders
 */

import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import QRCode from 'qrcode';
import { Order, User, Profile, Contract, Offer } from '@shared/schema';
import { numberToWordsRu, numberToWordsUz } from './number-to-words';
import { uzbekistanRegions } from '@shared/uzbekistan-regions';

export interface ContractDocxData {
  contract: Contract;
  order: Order;
  offer: Offer;  // Принятое предложение - используется для цены договора
  customer: User;
  customerProfile: Profile | null;
  carrier: User;
  carrierProfile: Profile | null;
}

type Language = 'ru' | 'uz';

const TEMPLATE_DIR_PROD = path.join(import.meta.dirname, '..', 'server', 'templates', 'contracts');
const TEMPLATE_DIR_DEV = path.join(import.meta.dirname, '..', 'templates', 'contracts');
const TEMPLATE_DIR = fs.existsSync(TEMPLATE_DIR_PROD) ? TEMPLATE_DIR_PROD : TEMPLATE_DIR_DEV;

const TRANSPORT_TYPES_RU: Record<string, string> = {
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
};

const TRANSPORT_TYPES_UZ: Record<string, string> = {
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
  }).join('\n');
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

function formatDateTime(loadDate: string, loadingTime: string, lang: Language): string {
  const date = formatDate(loadDate, lang);
  return `${date}, ${loadingTime}`;
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

/**
 * Get template file path based on collateral requirement and language
 */
function getTemplatePath(requiresCollateral: boolean, lang: Language): string {
  const templateName = requiresCollateral 
    ? `contract_with_collateral_${lang}.docx`
    : `contract_no_collateral_${lang}.docx`;
  
  return path.join(TEMPLATE_DIR, templateName);
}

/**
 * Prepare data object for template placeholders
 */
function formatPriceWithCurrency(amount: number, lang: Language): string {
  const words = lang === 'ru' ? numberToWordsRu(amount) : numberToWordsUz(amount);
  const currency = lang === 'ru' ? 'сум' : "so'm";
  return `${words} ${currency}`;
}

function prepareTemplateData(data: ContractDocxData, lang: Language): Record<string, string> {
  const { contract, order, offer, customer, customerProfile, carrier, carrierProfile } = data;
  
  // Используем цену из принятого предложения, а не из заказа
  const priceWithVat = offer.price;
  const priceInWords = formatPriceWithCurrency(priceWithVat, lang);
  
  const transportTypes = lang === 'ru' ? TRANSPORT_TYPES_RU : TRANSPORT_TYPES_UZ;
  
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
  
  // Boolean fields - Опасный груз, Нестандартный груз, Частичная загрузка
  const isDangerousText = getYesNo(order.isDangerous, lang);
  const isNonstandardText = getYesNo(order.isNonstandard, lang);
  const isPartialLoadText = getYesNo(order.isPartialLoad, lang);
  
  return {
    // Contract info
    'НОМЕР ДОГОВОРА': `YB-${String(contract.id).padStart(6, '0')}`,
    'ДАТА ДОГОВОРА': formatDate(contract.generatedAt, lang),
    'ID_ЗАКАЗА': order.id.toString(),
    'ID ЗАКАЗА': order.id.toString(),
    
    // Customer info
    'DISPLAY_NAME ЗАКАЗЧИКА': getDisplayName(customer, customerProfile),
    'ФИО РУКОВОДИТЕЛЯ ОТ ЭЦП В СЛУЧАЯХ КОГДА ЗАКАЗЧИК БУДЕТ ИП ИЛИ ЮР ЛИЦО': getDirectorName(customerProfile),
    'АДРЕС ЗАКАЗЧИКА ОТ ЭЦП КОГДА ЗАКАЗЧИК ЮР ЛИЦО ИЛИ ИП': getAddress(customerProfile),
    'ТЕЛЕФОННЫЙ НОМЕР ЗАКАЗЧИКА': customer.phone,
    'ИНН ЗАКАЗЧИКА КОГДА ЗАКАЗЧИК ЮР ЛИЦО; ПИНФЛ КОГДА ЗАКАЗЧИК ИП ИЛИ ФИЗ ЛИЦО': getInnOrPinfl(customer, customerProfile),
    // Additional simplified placeholders for INN/PINFL - exact match from template
    'ИНН ЗАКАЗЧИКА КОГДА ЗАКАЗЧИК ЮР ЛИЦО; ПИНФЛ КОГДА ЗАКАЗЧИК ИП': getInnOrPinfl(customer, customerProfile),
    'ИНН ЗАКАЗЧИКА': customerProfile?.inn || customerProfile?.eimzoCertTin || '_________________',
    'ПИНФЛ ЗАКАЗЧИКА': customerProfile?.pinfl || customerProfile?.eimzoCertPinfl || '_________________',
    'ИНН/ПИНФЛ ЗАКАЗЧИКА': getInnOrPinfl(customer, customerProfile),
    'РАСЧЕТНЫЙ СЧЕТ ЗАКАЗЧИКА КОГДА ЗАКАЗЧИК ЮР ЛИЦО ИЛИ ИП': getBankAccount(customerProfile),
    'НАИМЕНОВАНИЕ БАНКА ЗАКАЗЧИКА КОГДА ЗАКАЗЧИК ЮР ЛИЦО ИЛИ ИП': getBankName(customerProfile),
    'МФО БАНКА ЗАКАЗЧИКА КОГДА ЗАКАЗЧИК ЮР ЛИЦО ИЛИ ИП': getBankMfo(customerProfile),
    
    // Carrier info
    'DISPLAY_NAME ПЕРЕВОЗЧИКА': getDisplayName(carrier, carrierProfile),
    'ФИО РУКОВОДИТЕЛЯ ОТ ЭЦП': getDirectorName(carrierProfile),
    'АДРЕС ПЕРЕВОЗЧИКА ОТ ЭЦП': getAddress(carrierProfile),
    'ТЕЛЕФОННЫЙ НОМЕР ПЕРЕВОЗЧИКА': carrier.phone,
    'ИНН ПЕРЕВОЗЧИКА КОГДА ПЕРЕВОЗЧИК ЮР ЛИЦО; ПИНФЛ КОГДА ПЕРЕВОЗЧИК ИП ИЛИ ФИЗ ЛИЦО': getInnOrPinfl(carrier, carrierProfile),
    // Additional simplified placeholders for INN/PINFL - exact match from template
    'ИНН ПЕРЕВОЗЧИКА КОГДА ПЕРЕВОЗЧИК ЮР ЛИЦО; ПИНФЛ КОГДА ПЕРЕВОЗЧИК ИП': getInnOrPinfl(carrier, carrierProfile),
    'ИНН ПЕРЕВОЗЧИКА': carrierProfile?.inn || carrierProfile?.eimzoCertTin || '_________________',
    'ПИНФЛ ПЕРЕВОЗЧИКА': carrierProfile?.pinfl || carrierProfile?.eimzoCertPinfl || '_________________',
    'ИНН/ПИНФЛ ПЕРЕВОЗЧИКА': getInnOrPinfl(carrier, carrierProfile),
    'РАСЧЕТНЫЙ СЧЕТ ПЕРЕВОЗЧИКА': getBankAccount(carrierProfile),
    'НАИМЕНОВАНИЕ БАНКА ПЕРЕВОЗЧИКА': getBankName(carrierProfile),
    'МФО БАНКА ПЕРЕВОЗЧИКА': getBankMfo(carrierProfile),
    
    // Order info
    'ПУНКТЫ ОТПРАВЛЕНИЯ (С НУМЕРАЦИЙ В СЛУЧАЯХ БОЛЕЕ ОДНОГО)': originPoints,
    'ПУНКТЫ НАЗНАЧЕНИЯ (С НУМЕРАЦИЙ В СЛУЧАЯХ БОЛЕЕ ОДНОГО)': destinationPoints,
    'ОПИСАНИЕ ГРУЗА ОТ НАЗВАНИЕ ЗАКАЗА': order.title,
    'ВЕС ГРУЗА': order.weightTons.toString(),
    'ТИП ТРАНСПОРТА': transportTypes[order.transportType] || order.transportType,
    'ДАТА И ВРЕМЯ ОТГРУЗКИ': formatDateTime(order.loadDate, order.loadingTime, lang),
    
    // Boolean fields - для всех трёх полей
    // Опасный груз (новый placeholder + старый для совместимости)
    'ОПАСНЫЙ ГРУЗ': isDangerousText,
    '"Да" или "Нет" из карточки заказа': isDangerousText,
    '"Ha" или "Yo\'q" из карточки заказа': isDangerousText,
    // Нестандартный (негабаритный) груз
    'НЕСТАНДАРТНЫЙ ГРУЗ': isNonstandardText,
    // Частичная загрузка
    'ЧАСТИЧНАЯ ЗАГРУЗКА': isPartialLoadText,
    
    // Price
    'ЦЕНА С НДС ЦИФРАМИ': priceWithVat.toLocaleString('ru-RU'),
    'ЦЕНА С НДС ПРОПИСЬЮ': priceInWords,
    'ЦЕНА С НДС ПРОПИСЬЮ НА УЗБЕКСКОМ ЯЗЫКЕ': formatPriceWithCurrency(priceWithVat, 'uz'),
    
    // Collateral fields
    'ПРЕДОСТАВЛЯЕТСЯ ЗАЛОГ': getYesNo(order.requiresCollateral, lang),
    'СУММА ЗАЛОГА ЦИФРАМИ': order.requiresCollateral ? Math.round(priceWithVat * 0.02).toLocaleString('ru-RU') : '0',
    'СУММА ЗАЛОГА ПРОПИСЬЮ': order.requiresCollateral ? formatPriceWithCurrency(Math.round(priceWithVat * 0.02), lang) : (lang === 'ru' ? 'ноль сум' : "nol so'm"),
    
    // Notes
    'Текст, написанный в поле Примечание из карточки заказа': order.notes || '-',
  };
}

/**
 * Generate QR code as base64 PNG image
 */
async function generateQRCodeBase64(url: string): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  // Remove data:image/png;base64, prefix
  return qrDataUrl.replace(/^data:image\/png;base64,/, '');
}

/**
 * Add QR code image to DOCX document at the end
 */
function addQRCodeToDocx(zip: PizZip, qrBase64: string, contractId: number, lang: Language): void {
  // 1. Add image to word/media folder
  const imageBuffer = Buffer.from(qrBase64, 'base64');
  zip.file('word/media/qrcode.png', imageBuffer);
  
  // 2. Update [Content_Types].xml to include PNG type
  const contentTypesXml = zip.file('[Content_Types].xml')?.asText() || '';
  if (!contentTypesXml.includes('image/png')) {
    const updatedContentTypes = contentTypesXml.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>'
    );
    zip.file('[Content_Types].xml', updatedContentTypes);
  }
  
  // 3. Update word/_rels/document.xml.rels to add image relationship
  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml = zip.file(relsPath)?.asText() || '';
  
  // Find the highest rId and add new one
  const rIdMatches = relsXml.match(/rId(\d+)/g) || [];
  const maxRId = rIdMatches.reduce((max, rid) => {
    const num = parseInt(rid.replace('rId', ''));
    return num > max ? num : max;
  }, 0);
  const newRId = `rId${maxRId + 1}`;
  
  const newRelationship = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qrcode.png"/>`;
  relsXml = relsXml.replace('</Relationships>', newRelationship + '</Relationships>');
  zip.file(relsPath, relsXml);
  
  // 4. Add image paragraph to document.xml at the end
  const documentPath = 'word/document.xml';
  let documentXml = zip.file(documentPath)?.asText() || '';
  
  const labelText = lang === 'ru' 
    ? `Договор YB-${String(contractId).padStart(6, '0')} - сканируйте для скачивания:`
    : `Shartnoma YB-${String(contractId).padStart(6, '0')} - yuklash uchun skanerlang:`;
  
  // Create paragraph with QR code image (centered)
  const qrParagraph = `
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>${labelText}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="1428750" cy="1428750"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="1" name="QR Code"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="qrcode.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${newRId}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="1428750" cy="1428750"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
  
  // Insert before </w:body>
  documentXml = documentXml.replace('</w:body>', qrParagraph + '</w:body>');
  zip.file(documentPath, documentXml);
}

/**
 * Generate DOCX contract document from template
 * @param data - Contract data
 * @param lang - Language: 'ru' or 'uz'
 * @returns Buffer containing the generated DOCX file
 */
export async function generateContractDocx(data: ContractDocxData, lang: Language): Promise<Buffer> {
  const templatePath = getTemplatePath(data.order.requiresCollateral, lang);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  
  const templateContent = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(templateContent);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });
  
  const templateData = prepareTemplateData(data, lang);
  
  doc.render(templateData);
  
  // Generate QR code with public download URL (no auth required)
  const contractUrl = `https://yukbozor.uz/api/contracts/public/${data.contract.id}/download/${lang}`;
  const qrBase64 = await generateQRCodeBase64(contractUrl);
  
  // Add QR code to the end of the document
  const resultZip = doc.getZip();
  addQRCodeToDocx(resultZip, qrBase64, data.contract.id, lang);
  
  const buffer = resultZip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  
  return buffer;
}

/**
 * Get contract filename for download
 */
export function getContractFilename(contractId: number, lang: Language): string {
  return `Contract_YB-${contractId}_${lang.toUpperCase()}.docx`;
}
