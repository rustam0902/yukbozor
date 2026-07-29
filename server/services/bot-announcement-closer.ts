import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import TelegramBot from 'node-telegram-bot-api';

const TICK_MS = 5 * 60 * 1000; // every 5 minutes
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

let intervalRef: ReturnType<typeof setInterval> | null = null;
let deleterBot: TelegramBot | null = null;

function getDeleterBot(): TelegramBot | null {
  if (deleterBot) return deleterBot;
  const token = process.env.TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN;
  if (!token) return null;
  deleterBot = new TelegramBot(token, { polling: false });
  return deleterBot;
}

async function tick(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_MS);
    const rows = await storage.getExpiredBotAnnouncements(cutoff);
    if (!rows.length) return;
    const bot = getDeleterBot();
    for (const row of rows) {
      // Best-effort delete of the broadcast Telegram message if known
      if (bot && row.telegramChatId && row.telegramMessageId) {
        try {
          await bot.deleteMessage(row.telegramChatId, Number(row.telegramMessageId));
        } catch (err: any) {
          console.warn(`[BotCloser] deleteMessage failed for #${row.id}:`, err?.message || err);
        }
      }
      await db.update(schema.announcements)
        .set({ status: 'closed' })
        .where(eq(schema.announcements.id, row.id));
    }
    console.log(`[BotCloser] Closed ${rows.length} expired bot-created announcements`);
  } catch (err) {
    console.error('[BotCloser] tick error:', err);
  }
}

export function startBotAnnouncementCloser(): void {
  if (intervalRef) return;
  console.log('[BotCloser] Started (tick: 5min, max age: 2h)');
  tick();
  intervalRef = setInterval(tick, TICK_MS);
}

export function stopBotAnnouncementCloser(): void {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}
