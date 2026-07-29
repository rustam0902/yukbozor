import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN = process.env.TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN;
const TICK_MS = 60 * 1000;

let bot: TelegramBot | null = null;
let intervalRef: ReturnType<typeof setInterval> | null = null;

function getHourInTimezone(d: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'Asia/Tashkent', hour: 'numeric', hour12: false });
    return parseInt(fmt.format(d), 10) % 24;
  } catch {
    return (d.getUTCHours() + 5) % 24;
  }
}
function isInActiveWindow(now: Date, fromH: number, toH: number, tz: string): boolean {
  const h = getHourInTimezone(now, tz);
  if (fromH === toH) return true;
  if (fromH < toH) return h >= fromH && h < toH;
  return h >= fromH || h < toH;
}

const PROMO_FOOTER =
  '📲 <a href="https://play.google.com/store/apps/details?id=uz.yukbozor.app">Mobil ilova</a>' +
  ' | <a href="https://t.me/yukbozor_elonlar">Telegram</a>' +
  ' | <a href="https://yukbozor.uz">Web-sayt</a>' +
  ' | <a href="https://instagram.com/yukbozor_uz">Instagram</a>';

async function tick(): Promise<void> {
  if (!bot) return;
  const channels = await storage.getActiveTelegramChannels('promo');
  if (!channels.length) return;
  const promos = await storage.getActiveTelegramPromoMessages();
  if (!promos.length) return;

  const now = new Date();
  for (const ch of channels) {
    try {
      if (!isInActiveWindow(now, ch.activeHoursFrom, ch.activeHoursTo, ch.timezone || 'Asia/Tashkent')) continue;
      const intervalMs = Math.max(1, ch.intervalMinutes) * 60 * 1000;
      if (ch.lastSentAt && now.getTime() - new Date(ch.lastSentAt).getTime() < intervalMs) continue;

      // Use persisted rotation index so restart doesn't reset to first template
      const currentIdx = ch.promoRotationIndex ?? 0;
      const promo = promos[currentIdx % promos.length];
      const nextIdx = (currentIdx + 1) % promos.length;

      const text = `${escHtml(promo.textRu)}\n\n${escHtml(promo.textUz)}\n\n${PROMO_FOOTER}`;
      await bot.sendMessage(ch.chatId, text, { parse_mode: 'HTML' });
      await storage.markTelegramChannelSent(ch.id);
      await storage.updateTelegramChannelPromoIndex(ch.id, nextIdx);
      console.log(`[Promo] Sent to ${ch.name} promo #${promo.id} (next idx: ${nextIdx})`);
      // Rate-limit between channel sends to avoid Telegram 429
      await sleep(1000);
    } catch (err: any) {
      console.error(`[Promo] Error for channel ${ch.id}:`, err?.message || err);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function startPromoScheduler(): void {
  if (!TOKEN) {
    console.log('[Promo] No TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN — scheduler not started');
    return;
  }
  if (intervalRef) return;
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log('[Promo] Scheduler started (tick: 60s)');
  tick();
  intervalRef = setInterval(tick, TICK_MS);
}

export function stopPromoScheduler(): void {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
  bot = null;
}

export async function peekNextPromoForChannel(channelId: number) {
  const promos = await storage.getActiveTelegramPromoMessages();
  if (!promos.length) return null;
  const ch = await storage.getTelegramChannelById(channelId);
  if (!ch) return null;
  const currentIdx = ch.promoRotationIndex ?? 0;
  return promos[currentIdx % promos.length];
}

export async function sendTestPromoToChannel(channelId: number) {
  if (!bot) throw new Error('Promo bot is not configured (TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN missing)');
  const ch = await storage.getTelegramChannelById(channelId);
  if (!ch || ch.channelType !== 'promo') throw new Error('Promo channel not found');
  const promos = await storage.getActiveTelegramPromoMessages();
  if (!promos.length) throw new Error('No active promo messages');

  const currentIdx = ch.promoRotationIndex ?? 0;
  const promo = promos[currentIdx % promos.length];
  const nextIdx = (currentIdx + 1) % promos.length;

  const text = `${escHtml(promo.textRu)}\n\n${escHtml(promo.textUz)}\n\n${PROMO_FOOTER}`;
  await bot.sendMessage(ch.chatId, text, { parse_mode: 'HTML' });
  await storage.markTelegramChannelSent(channelId);
  await storage.updateTelegramChannelPromoIndex(channelId, nextIdx);
  console.log(`[Promo] Test send to ${ch.name} promo #${promo.id} (next idx: ${nextIdx})`);
  return promo;
}
