import TelegramBot from 'node-telegram-bot-api';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { parseCargoMessage, isAiParserConfigured, type ParseCargoResult } from './cargo-parser-service';
import { notifyNewAnnouncement, getBotPostToChannels } from './push-notification-service';
import { sendAnnouncementNotification } from './telegram-announcement-service';

/**
 * Fast pre-filter: returns true if the message is clearly an international route.
 * Runs BEFORE any OpenAI call to avoid spending credits on non-Uzbekistan cargo.
 *
 * Heuristics:
 *  1. Explicit foreign country names (Cyrillic and Latin).
 *  2. Major foreign capitals / hub cities that don't exist in Uzbekistan.
 *  3. Phone-number heuristic: only +7 numbers, no +998 numbers.
 */
function isLikelyInternational(text: string): boolean {
  // Note: \b word boundaries work only with ASCII chars in JS regex.
  // For Cyrillic patterns we use simple substring match (the words are specific enough).
  // For Latin patterns \b is used to avoid partial matches.
  const COUNTRY_RE = [
    /россия|рф|москв[аеу]?|мск|спб|питер|санкт.петербург|\brussia\b|\bmoscow\b|\bspb\b|\bmsk\b/i,
    /казахстан|алматы|нур.?султан|шымкент|\bkazakhstan\b|\balmaty\b|\bastana\b|\bnursultan\b/i,
    /китай|пекин|\bchina\b|\bbeijing\b|\burumqi\b|\burumchi\b/i,
    /таджикистан|душанбе|худжанд|\btajikistan\b|\bdushanbe\b/i,
    /кыргызстан|киргизстан|бишкек|\bkyrgyzstan\b|\bkirgizstan\b|\bbishkek\b/i,
    /туркменистан|ашхабад|ашгабат|\bturkmenistan\b|\bashgabat\b/i,
    /афганистан|кабул|\bafghanistan\b|\bkabul\b/i,
    /азербайджан|баку|\bazerbaijan\b|\bbaku\b/i,
    /иран|тегеран|\biran\b|\btehran\b/i,
    /грузия|тбилиси|\bgeorgia\b|\btbilisi\b/i,
  ];

  for (const re of COUNTRY_RE) {
    if (re.test(text)) return true;
  }

  // Phone heuristic: +7 numbers present but no +998 numbers → likely Russia/Kazakhstan
  const hasUzPhone = /(?:\+?998|\b998)\d{9}\b/.test(text);
  const hasRuKzPhone = /\+7[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/.test(text);
  if (hasRuKzPhone && !hasUzPhone) return true;

  return false;
}

/**
 * Content-level dedup key: same normalized text from the same source chat
 * within a 24-hour window is treated as a duplicate (handles reposts/forwards
 * with new message IDs).
 */
function buildContentKey(chatId: string, text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return `content:${chatId}:${dayBucket}:${hash}`;
}

const TOKEN = process.env.TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN;
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+998939698899';

// Digest alert thresholds
const DIGEST_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const DIGEST_THRESHOLD = 5; // failures within window
const DIGEST_COOLDOWN_MS = 60 * 60 * 1000; // don't ping more than once an hour

const recentFailureTimes: number[] = [];
let lastDigestSentAt = 0;

let bot: TelegramBot | null = null;
let notifyBot: TelegramBot | null = null;

async function sendAdminDigest(): Promise<void> {
  if (!TOKEN) return;
  const ownerId = cachedOwnerId || (await getBotOwnerUserId());
  if (!ownerId) return;
  const owner = await storage.getUserById(ownerId);
  const adminTelegramId = owner?.telegramId;
  if (!adminTelegramId) return;
  if (!notifyBot) notifyBot = new TelegramBot(TOKEN, { polling: false });
  const total = await storage.countTelegramSkippedMessages();
  const recent = await storage.countTelegramSkippedMessages(DIGEST_WINDOW_MS);
  const text =
    `⚠️ Yukbozor: AI-разбор объявлений сбоит\n` +
    `За последние 30 мин: ${recent} неудачных сообщений\n` +
    `Всего в очереди на проверку: ${total}\n\n` +
    `Откройте админ-панель → Telegram каналы → «Не разобранные сообщения».`;
  try {
    await notifyBot.sendMessage(adminTelegramId, text);
    lastDigestSentAt = Date.now();
    console.log('[TG-Source] Digest sent to admin Telegram');
  } catch (err: any) {
    console.error('[TG-Source] Failed to send admin digest:', err?.message || err);
  }
}

function trackFailureAndMaybeNotify(): void {
  const now = Date.now();
  recentFailureTimes.push(now);
  // Drop entries older than the window to keep the list bounded
  while (recentFailureTimes.length && now - recentFailureTimes[0] > DIGEST_WINDOW_MS) {
    recentFailureTimes.shift();
  }
  if (recentFailureTimes.length < DIGEST_THRESHOLD) return;
  if (now - lastDigestSentAt < DIGEST_COOLDOWN_MS) return;
  // Fire and forget — don't block the message handler
  sendAdminDigest().catch(err =>
    console.error('[TG-Source] sendAdminDigest error:', err?.message || err),
  );
}

/** Find admin user to use as createdByBot announcement owner. */
async function getBotOwnerUserId(): Promise<number | null> {
  // Look up admin user once
  try {
    const cleaned = ADMIN_PHONE.replace(/\D/g, '');
    const phoneCandidates = [ADMIN_PHONE, '+' + cleaned, cleaned];
    for (const p of phoneCandidates) {
      const u = await storage.getUserByPhone(p);
      if (u) return u.id;
    }
  } catch (err) {
    console.error('[TG-Source] Failed to resolve bot owner user:', err);
  }
  return null;
}

let cachedOwnerId: number | null = null;

export async function startTelegramSourceListener(): Promise<void> {
  if (!TOKEN) {
    console.log('[TG-Source] No TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN — listener not started');
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log('[TG-Source] Dev mode — polling skipped (only runs in production)');
    return;
  }
  if (bot) {
    console.log('[TG-Source] Listener already running');
    return;
  }

  cachedOwnerId = await getBotOwnerUserId();
  if (!cachedOwnerId) {
    console.warn('[TG-Source] Bot owner user not found — AI announcements cannot be created. Will retry per-message.');
  }

  bot = new TelegramBot(TOKEN, {
    polling: {
      interval: 1000,
      autoStart: true,
      params: {
        timeout: 10,
        allowed_updates: JSON.stringify(['message', 'channel_post']),
      },
    },
  });

  // Log the actual bot username so it's easy to verify the correct bot is connected
  bot.getMe().then(me => {
    console.log(`[TG-Source] Listener started. Bot: @${me.username}`);
  }).catch(() => {
    console.log('[TG-Source] Listener started (could not resolve bot username)');
  });

  bot.on('message', async (msg) => {
    try {
      await handleMessage(msg);
    } catch (err) {
      console.error('[TG-Source] handleMessage error:', err);
    }
  });

  // channel_post is the update type for posts in Telegram channels (distinct from groups)
  bot.on('channel_post', async (msg) => {
    try {
      await handleMessage(msg);
    } catch (err) {
      console.error('[TG-Source] handleMessage (channel_post) error:', err);
    }
  });

  bot.on('polling_error', (err: any) => {
    console.error('[TG-Source] Polling error:', err?.message || err);
  });
}

async function handleMessage(msg: TelegramBot.Message): Promise<void> {
  const chatId = String(msg.chat.id);
  const text = msg.text || msg.caption || '';
  if (!text || text.length < 10) return;

  // Only process messages from configured ai_source channels
  const channel = await storage.getTelegramChannelByChatId(chatId, 'ai_source');
  if (!channel || !channel.isActive) {
    console.log(`[TG-Source] Message from unregistered/inactive chat ${chatId} — skipped`);
    return;
  }

  // Check blocked user IDs / usernames
  const fromId = msg.from?.id ? String(msg.from.id) : null;
  const fromUsername = msg.from?.username ? msg.from.username.toLowerCase().replace(/^@/, '') : null;
  const blockedList = (channel.blockedUserIds || []).map(s => s.toLowerCase().replace(/^@/, ''));
  if (blockedList.length > 0) {
    const isBlocked =
      (fromId && blockedList.includes(fromId)) ||
      (fromUsername && blockedList.includes(fromUsername));
    if (isBlocked) {
      console.log(`[TG-Source] Message from blocked user ${fromId}/@${fromUsername} in ${chatId} — skipped`);
      return;
    }
  }

  // Transport-level dedup (same Telegram update id retried)
  const updateKey = `${chatId}:${msg.message_id}`;
  if (await storage.isTelegramUpdateProcessed(updateKey)) return;

  // Content-level dedup (same/forwarded text within 24h from the same source chat)
  const contentKey = buildContentKey(chatId, text);
  if (await storage.isTelegramUpdateProcessed(contentKey)) {
    await storage.markTelegramUpdateProcessed(updateKey);
    console.log(`[TG-Source] Duplicate content from ${chatId} — skipped`);
    return;
  }

  if (!isAiParserConfigured()) {
    console.log('[TG-Source] OPENAI_API_KEY not set — skipping AI parse');
    return;
  }

  // International pre-filter: skip obvious non-Uzbekistan routes before hitting OpenAI
  if (isLikelyInternational(text)) {
    await storage.markTelegramUpdateProcessed(updateKey);
    await storage.markTelegramUpdateProcessed(contentKey);
    console.log(`[TG-Source] International pre-filter: ${chatId} — skipped without API call`);
    return;
  }

  const chatTitle = (msg.chat as any).title || (msg.chat as any).username || null;
  const senderUsername = msg.from?.username || null;

  const result = await processCargoText({
    chatId,
    chatTitle,
    messageId: msg.message_id,
    text,
    senderUsername,
  });

  // Always mark the message-level key processed.
  await storage.markTelegramUpdateProcessed(updateKey);
  // Mark content key for silent skips so forwarded duplicates don't consume OpenAI credits.
  // Error reasons (parser_error, insert_error) are NOT marked so the admin can retry.
  const isSilentSkip = result.ok ||
    (result.ok === false && result.reason !== 'parser_error' && result.reason !== 'insert_error');
  if (isSilentSkip) {
    await storage.markTelegramUpdateProcessed(contentKey);
  }
}

type ProcessInput = {
  chatId: string;
  chatTitle: string | null;
  messageId: number;
  text: string;
  senderUsername?: string | null;
};
type SkipReason = 'not_cargo' | 'no_route' | 'no_phone' | 'international' | 'insufficient_data' | 'missing_fields' | 'duplicate';
type ProcessResult =
  | { ok: true }
  | { ok: false; reason: SkipReason | 'parser_error' | 'insert_error'; error?: string };

/**
 * Parse + insert all cargo items from one message text. A single message may produce
 * multiple announcements. Returns the outcome so the caller can decide whether to mark dedup keys.
 * - not_cargo / no_route / insufficient data: silent skip (no DB record) to reduce noise
 * - parser_error / insert_error: recorded for admin review
 * - partial success (≥1 item created): returns ok=true, logs a warning for failed items
 */
async function processCargoText(input: ProcessInput): Promise<ProcessResult> {
  const { chatId, chatTitle, messageId, text, senderUsername } = input;

  let parseResults: Awaited<ReturnType<typeof parseCargoMessage>>;
  try {
    parseResults = await parseCargoMessage(text);
  } catch (err: any) {
    const detail = err?.message || String(err);
    console.error('[TG-Source] Parser error:', detail);
    await storage.recordTelegramSkippedMessage({
      chatId, chatTitle, messageId, text,
      reason: 'parser_error',
      errorDetail: detail.slice(0, 1000),
    });
    trackFailureAndMaybeNotify();
    return { ok: false, reason: 'parser_error', error: detail };
  }

  if (parseResults === null) {
    // OpenAI not configured or API call threw — log for admin review
    const detail = 'OpenAI call failed or not configured';
    console.error('[TG-Source]', detail);
    await storage.recordTelegramSkippedMessage({
      chatId, chatTitle, messageId, text,
      reason: 'parser_error',
      errorDetail: detail,
    });
    trackFailureAndMaybeNotify();
    return { ok: false, reason: 'parser_error', error: detail };
  }

  // Filter to valid cargo items only
  const validItems = parseResults.filter(r => r.ok === true) as Array<{ ok: true; data: import('./cargo-parser-service').ParsedCargo }>;

  // If nothing was valid — check if it was a silent skip or a parse issue
  if (validItems.length === 0) {
    const firstResult = parseResults[0];
    if (!firstResult || !firstResult.ok) {
      const skipReason = (!firstResult || !firstResult.ok ? firstResult?.reason : undefined) as SkipReason | undefined;
      // Silent skips (not_cargo, no_route, international, etc.) — no DB record
      if (skipReason && skipReason !== 'missing_fields') {
        console.log(`[TG-Source] Message from ${chatId} skipped (${skipReason})`);
        return { ok: false, reason: skipReason };
      }
      // missing_fields — also skip silently (common for incomplete posts)
      console.log(`[TG-Source] Message from ${chatId} skipped (missing_fields)`);
      return { ok: false, reason: 'missing_fields' };
    }
  }

  if (!cachedOwnerId) cachedOwnerId = await getBotOwnerUserId();
  if (!cachedOwnerId) {
    const detail = 'Bot owner user not found — cannot create announcement';
    console.error('[TG-Source]', detail);
    await storage.recordTelegramSkippedMessage({
      chatId, chatTitle, messageId, text,
      reason: 'insert_error',
      errorDetail: detail,
    });
    trackFailureAndMaybeNotify();
    return { ok: false, reason: 'insert_error', error: detail };
  }

  let createdCount = 0;
  const insertErrors: string[] = [];

  for (const result of validItems) {
    const parsed = result.data;

    // Per-item duplicate check: same route + phone + transport
    const isDuplicate = await storage.findDuplicateActiveAnnouncement(
      parsed.originRegions[0],
      parsed.destinationRegions[0],
      parsed.transportType,
      parsed.contactPhone,
    );
    if (isDuplicate) {
      console.log(`[TG-Source] Duplicate item skipped (${parsed.originRegions[0]}→${parsed.destinationRegions[0]}, ${parsed.contactPhone})`);
      continue;
    }

    try {
      const [inserted] = await db.insert(schema.announcements).values({
        customerId: cachedOwnerId,
        title: parsed.title,
        originRegions: parsed.originRegions,
        originDistrict: parsed.originDistricts,
        destinationRegions: parsed.destinationRegions,
        destinationDistrict: parsed.destinationDistricts,
        transportType: parsed.transportType,
        vehicleCount: parsed.vehicleCount,
        weightTons: String(parsed.weightTons),
        loadDate: parsed.loadDate,
        loadingTime: parsed.loadingTime,
        price: String(parsed.price),
        paymentTypes: ['cash'],
        contactPhone: parsed.contactPhone,
        notes: text.slice(0, 1000),
        isDangerous: false,
        isNonstandard: false,
        isPartialLoad: false,
        status: 'active',
        createdByBot: true,
        botSourceChatId: chatId,
        botSourceUsername: senderUsername || null,
        botSourceMessageId: messageId,
      }).returning();
      createdCount++;
      console.log(`[TG-Source] Created announcement from ${chatId}${senderUsername ? '/@' + senderUsername : ''}: ${parsed.title}`);
      // Fire-and-forget push notification + Telegram announcement channel
      if (inserted) {
        notifyNewAnnouncement(inserted).catch((err: any) =>
          console.error('[TG-Source] Failed to send push notification:', err?.message || err),
        );
        getBotPostToChannels().then((enabled) => {
          if (!enabled) {
            console.log(`[TG-Source] Skipping announcement channel post (bot_post_to_channels=false)`);
            return;
          }
          sendAnnouncementNotification(inserted).then(async (result) => {
            if (result.success && result.messageId && result.chatId) {
              await storage.updateAnnouncement(inserted.id, {
                telegramMessageId: String(result.messageId),
                telegramChatId: result.chatId,
              }).catch(() => {});
            }
          }).catch((err: any) =>
            console.error('[TG-Source] Failed to send announcement to Telegram channel:', err?.message || err),
          );
        }).catch((err: any) =>
          console.error('[TG-Source] Failed to check bot_post_to_channels setting:', err?.message || err),
        );
      }
    } catch (err: any) {
      const detail = err?.message || String(err);
      console.error('[TG-Source] Failed to insert announcement:', detail);
      insertErrors.push(detail.slice(0, 200));
      trackFailureAndMaybeNotify();
    }
  }

  // Partial success: if at least one announcement was created, consider it ok
  if (createdCount > 0) {
    if (insertErrors.length > 0) {
      console.warn(`[TG-Source] ${chatId}: created ${createdCount}/${validItems.length} announcements (${insertErrors.length} failed)`);
    } else {
      console.log(`[TG-Source] ${chatId}: created ${createdCount} announcement(s) from one message`);
    }
    return { ok: true };
  }

  // All inserts failed
  if (insertErrors.length > 0) {
    const detail = insertErrors[0];
    await storage.recordTelegramSkippedMessage({
      chatId, chatTitle, messageId, text,
      reason: 'insert_error',
      errorDetail: detail,
    });
    return { ok: false, reason: 'insert_error', error: detail };
  }

  // All were duplicates — silent skip
  return { ok: false, reason: 'duplicate' };
}

/**
 * Retry a previously-skipped message: re-runs the parser + insert flow with
 * the original text. On success, deletes the skipped record. On failure, the
 * record is updated in-place with the latest reason/error.
 */
export async function retrySkippedTelegramMessage(
  id: number,
  textOverride?: string,
): Promise<{
  ok: boolean;
  reason?: string;
  error?: string;
}> {
  const entry = await storage.getTelegramSkippedMessage(id);
  if (!entry) return { ok: false, error: 'not_found' };

  // Allow admins to fix small issues in the original text (missing region,
  // garbled phone) and retry the corrected version.
  const effectiveText = (typeof textOverride === 'string' && textOverride.trim().length >= 10)
    ? textOverride.trim()
    : entry.text;

  const result = await processCargoText({
    chatId: entry.chatId,
    chatTitle: entry.chatTitle,
    messageId: entry.messageId,
    text: effectiveText,
  });

  if (result.ok) {
    await storage.deleteTelegramSkippedMessage(id);
    // Mark dedup so a future re-delivery of the same Telegram update — or a
    // forwarded copy of the same (original or edited) content within 24h —
    // won't produce a duplicate announcement.
    await storage.markTelegramUpdateProcessed(`${entry.chatId}:${entry.messageId}`);
    await storage.markTelegramUpdateProcessed(buildContentKey(entry.chatId, entry.text));
    if (effectiveText !== entry.text) {
      await storage.markTelegramUpdateProcessed(buildContentKey(entry.chatId, effectiveText));
    }
    return { ok: true };
  }
  return { ok: false, reason: result.reason, error: result.error };
}

export function stopTelegramSourceListener(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
    console.log('[TG-Source] Listener stopped');
  }
}
