import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * How many days of chat history to retain.
 * Messages older than this are deleted during each cleanup run.
 * Override with CHAT_RETENTION_DAYS environment variable.
 */
const RETENTION_DAYS = parseInt(process.env.CHAT_RETENTION_DAYS ?? '30', 10);

/** Run once per day (24 h). */
const PROCESS_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function deleteOldMessages(): Promise<void> {
  try {
    const result = await db.execute(sql`
      DELETE FROM chat_messages
      WHERE created_at < NOW() - (${RETENTION_DAYS} || ' days')::interval
    `);
    const count = (result as any).rowCount ?? 0;
    if (count > 0) {
      console.log(`[CHAT_CLEANUP] Deleted ${count} message(s) older than ${RETENTION_DAYS} days`);
    } else {
      console.log(`[CHAT_CLEANUP] No messages older than ${RETENTION_DAYS} days found`);
    }
  } catch (error) {
    console.error('[CHAT_CLEANUP] Error deleting old messages:', error);
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startChatCleanupProcessor(): void {
  if (cleanupInterval) {
    console.log('[CHAT_CLEANUP] Processor already running');
    return;
  }

  console.log(
    `[CHAT_CLEANUP] Starting chat cleanup processor (retention: ${RETENTION_DAYS} days, interval: 24 h)`
  );

  // Run immediately on startup, then every 24 h
  deleteOldMessages();
  cleanupInterval = setInterval(deleteOldMessages, PROCESS_INTERVAL_MS);
}

export function stopChatCleanupProcessor(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[CHAT_CLEANUP] Stopped chat cleanup processor');
  }
}
