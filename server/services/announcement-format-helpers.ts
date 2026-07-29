import type { Announcement } from '@shared/schema';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';

export const TRANSPORT_TYPE_NAMES: Record<string, string> = {
  labo: 'Labo',
  bongo: 'Bongo',
  furgon: 'Furgon',
  isuzu5: 'Isuzu 5t',
  isuzu10: 'Isuzu 10t',
  gruzovik: 'Gruzovik',
  fura_tent: 'Fura (tent)',
  fura_ref: 'Fura (ref)',
  paravoz: 'Paravoz',
  shalanda: 'Shalanda',
  traller: 'Traller',
  tonar: 'Tonar',
  benzovoz: 'Benzovoz',
  konteynerovoz: 'Konteynerovoz',
  other: 'Boshqa',
};

export const PAYMENT_TYPE_NAMES: Record<string, string> = {
  cash: 'Naqd',
  card: 'Karta',
  transfer: "Pul ko'chirish",
};

export const STATUS_NAMES: Record<string, string> = {
  new: 'Yangi',
  active: 'Faol',
  closed: 'Yopilgan',
  completed: 'Yakunlangan',
  cancelled: "O'chirilgan",
};

export const BOT_FOOTER =
  '📲 <a href="https://play.google.com/store/apps/details?id=uz.yukbozor.app">Mobil ilova</a>' +
  ' | <a href="https://t.me/yukbozor_elonlar">Telegram</a>' +
  ' | <a href="https://yukbozor.uz">Web-sayt</a>' +
  ' | <a href="https://instagram.com/yukbozor_uz">Instagram</a>';

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatDate(dateStr: string): string {
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

export function formatMoney(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(num)
    .replace(/\s/g, ' ');
}

export function getRouteDescription(a: Announcement, lang = 'uz'): string {
  const originRegions = (a.originRegions || []).map(r => getRegionDisplayName(r, lang)).join(', ');
  const destRegions = (a.destinationRegions || []).map(r => getRegionDisplayName(r, lang)).join(', ');
  const originDistricts = (a.originDistrict || []).map(d => getDistrictDisplayName(d, lang)).join(', ');
  const destDistricts = (a.destinationDistrict || []).map(d => getDistrictDisplayName(d, lang)).join(', ');
  let origin = originRegions;
  if (originDistricts) origin += ` (${originDistricts})`;
  let dest = destRegions;
  if (destDistricts) dest += ` (${destDistricts})`;
  return `${origin} → ${dest}`;
}

export function buildTelegramMessageLink(
  chatId: string | null | undefined,
  messageId: number | null | undefined,
): string | null {
  if (!chatId || !messageId) return null;
  // Numeric supergroup/channel IDs like "-1001234567890" → t.me/c/1234567890/messageId
  const numericId = chatId.replace(/^-100/, '');
  if (/^\d+$/.test(numericId)) {
    return `https://t.me/c/${numericId}/${messageId}`;
  }
  // Username-based: "@channelname" or "channelname"
  const username = chatId.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

export function formatAnnouncementHtml(
  a: Announcement,
  opts: { showStatus?: boolean; showCustomer?: string; showSource?: boolean; showFooter?: boolean } = {},
): string {
  const transport = escHtml(TRANSPORT_TYPE_NAMES[a.transportType] || a.transportType || '');
  const route = escHtml(getRouteDescription(a));
  const priceNum = a.price ? parseFloat(a.price) : 0;
  const price = priceNum > 0 ? `${formatMoney(priceNum)} so'm` : 'kelishiladi';
  const paymentTypes = (a.paymentTypes || []).map(pt => PAYMENT_TYPE_NAMES[pt] || pt).join(', ');

  const sourceLink = buildTelegramMessageLink(a.botSourceChatId, a.botSourceMessageId);
  const titleHtml = sourceLink
    ? `${escHtml(a.title)} <a href="${sourceLink}">[original]</a>`
    : escHtml(a.title);

  let msg = `📢 <b>YANGI E'LON #${a.id}</b>\n\n`;
  msg += `📦 <b>Yuk:</b> ${titleHtml}\n`;
  msg += `📍 <b>Yo'nalish:</b> ${route}\n\n`;
  msg += `🚗 <b>Transport turi:</b> ${transport}\n`;
  if ((a.vehicleCount || 1) > 1) msg += `🚛 <b>Mashinalar soni:</b> ${a.vehicleCount} ta\n`;
  const weightStr = parseFloat(String(a.weightTons)) > 0 ? `${a.weightTons} tonna` : 'ko\'rsatilmagan';
  msg += `⚖️ <b>Vazn:</b> ${weightStr}\n`;
  msg += `📅 <b>Yuklash sanasi:</b> ${escHtml(formatDate(a.loadDate))}\n`;
  msg += `🕐 <b>Yuklash vaqti:</b> ${escHtml(a.loadingTime)}\n`;
  msg += `💰 <b>Narx:</b> ${price}\n`;
  if (paymentTypes) msg += `💳 <b>To'lov:</b> ${escHtml(paymentTypes)}\n`;
  if (opts.showCustomer) msg += `👤 <b>Buyurtmachi:</b> ${escHtml(opts.showCustomer)}\n`;
  msg += `📞 <b>Telefon:</b> ${escHtml(a.contactPhone)}\n`;
  if (opts.showStatus) msg += `📊 <b>Holati:</b> ${escHtml(STATUS_NAMES[a.status] || a.status)}\n`;
  // Skip notes for bot-sourced announcements — the [original] link in the title already points to the source
  const hasSourceLink = !!(a.botSourceChatId && a.botSourceMessageId);
  if (a.notes && !hasSourceLink) msg += `📝 <b>Izoh:</b> ${escHtml(a.notes)}\n`;

  const flags: string[] = [];
  if (a.isDangerous) flags.push('⚠️ Xavfli yuk');
  if (a.isNonstandard) flags.push('📐 Nostandart');
  if (a.isPartialLoad) flags.push('📦 Qisman yuk');
  if (flags.length > 0) msg += `\n${flags.join(' | ')}\n`;

  if (opts.showSource && a.botSourceUsername) msg += `\n📢 Manbaa: @${escHtml(a.botSourceUsername)}\n`;

  if (opts.showFooter !== false) msg += `\n${BOT_FOOTER}`;
  return msg;
}
