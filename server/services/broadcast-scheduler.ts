import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import {
  formatAnnouncementHtml as formatAnnouncementHtmlShared,
  BOT_FOOTER,
} from './announcement-format-helpers';

const TOKEN = process.env.TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN;
const TICK_MS = 60 * 1000; // check every minute

let bot: TelegramBot | null = null;
let intervalRef: ReturnType<typeof setInterval> | null = null;
let isTickRunning = false;

// Re-export footer for consumers that reference BROADCAST_FOOTER
export const BROADCAST_FOOTER = BOT_FOOTER;

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

function formatAnnouncementHtml(a: Parameters<typeof formatAnnouncementHtmlShared>[0]): string {
  return formatAnnouncementHtmlShared(a, { showSource: true, showFooter: false });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tick(): Promise<void> {
  if (!bot) return;
  if (isTickRunning) {
    console.log('[Broadcast] Tick skipped — previous tick still running');
    return;
  }
  isTickRunning = true;
  try {
    await tickInner();
  } finally {
    isTickRunning = false;
  }
}

async function tickInner(): Promise<void> {
  if (!bot) return;
  const channels = await storage.getActiveTelegramChannels('broadcast');
  if (!channels.length) return;
  const now = new Date();

  for (const ch of channels) {
    try {
      if (!isInActiveWindow(now, ch.activeHoursFrom, ch.activeHoursTo, ch.timezone || 'Asia/Tashkent')) continue;

      // Interval-based: get non-bot announcements not sent to this channel within intervalMinutes
      const intervalMinutes = ch.intervalMinutes || 60;
      const pending = await storage.getAnnouncementsForBroadcast(ch.id, intervalMinutes);
      if (!pending.length) continue;

      let sent = 0;
      for (const ann of pending) {
        try {
          const text = formatAnnouncementHtml(ann);
          await bot.sendMessage(ch.chatId, text, { parse_mode: 'HTML' });
          await storage.insertBroadcastLog(ch.id, ann.id);
          sent++;
          await sleep(1000); // 1s rate-limit between messages
        } catch (msgErr: any) {
          console.error(`[Broadcast] Failed to send ann #${ann.id} to ${ch.chatId}:`, msgErr?.message || msgErr);
        }
      }

      if (sent > 0) {
        console.log(`[Broadcast] Sent ${sent} announcements to ${ch.name} (${ch.chatId})`);
      }
    } catch (err: any) {
      console.error(`[Broadcast] Error for channel ${ch.id}:`, err?.message || err);
    }
  }
}

export function startBroadcastScheduler(): void {
  if (!TOKEN) {
    console.log('[Broadcast] No TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN — scheduler not started');
    return;
  }
  if (intervalRef) return;
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log('[Broadcast] Scheduler started (tick: 60s, per-announcement mode)');
  tick();
  intervalRef = setInterval(tick, TICK_MS);
}

export function stopBroadcastScheduler(): void {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
  bot = null;
}
