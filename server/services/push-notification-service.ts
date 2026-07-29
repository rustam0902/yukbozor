import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, or, isNull, inArray, SQL, sql } from 'drizzle-orm';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Global send queue — serializes all Expo API calls so concurrent announcements
// don't exceed Expo's 600 notifications/second limit.
let _sendQueue: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendBatchToExpo(
  batch: object[],
): Promise<{ tickets: ExpoTicket[]; error?: string }> {
  let resp: Response;
  try {
    resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(batch),
    });
  } catch (fetchErr: any) {
    return { tickets: [], error: fetchErr?.message || String(fetchErr) };
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { tickets: [], error: `HTTP ${resp.status}: ${text.slice(0, 300)}` };
  }
  const json = await resp.json().catch(() => null);
  return { tickets: json?.data ?? [] };
}

/**
 * Enqueue batches for sending through Expo Push API sequentially with a 300 ms
 * gap between each batch. This prevents concurrent announcement processing from
 * exceeding Expo's 600 notifications/second rate limit.
 */
function enqueueBatches(
  batches: object[][],
  onBatchResult: (tickets: ExpoTicket[], batchIndex: number, error?: string) => void,
): Promise<void> {
  const job = _sendQueue.then(async () => {
    for (let i = 0; i < batches.length; i++) {
      if (i > 0) await sleep(300); // stay under 600/s across concurrent callers
      const { tickets, error } = await sendBatchToExpo(batches[i]);
      onBatchResult(tickets, i, error);
    }
  });
  _sendQueue = job.catch(() => {}); // keep queue alive on errors
  return job;
}

const REGION_NAMES: Record<string, string> = {
  tashkent_city: "Toshkent shahri",
  karakalpakstan: "Qoraqalpog'iston",
  andijan: "Andijon viloyati",
  bukhara: "Buxoro viloyati",
  fergana: "Farg'ona viloyati",
  jizzakh: "Jizzax viloyati",
  namangan: "Namangan viloyati",
  navoi: "Navoiy viloyati",
  kashkadarya: "Qashqadaryo viloyati",
  samarkand: "Samarqand viloyati",
  sirdarya: "Sirdaryo viloyati",
  surkhandarya: "Surxondaryo viloyati",
  tashkent: "Toshkent viloyati",
  khorezm: "Xorazm viloyati",
  andijan_city: "Andijon shahri",
  bukhara_city: "Buxoro shahri",
  fergana_city: "Farg'ona shahri",
  jizzakh_city: "Jizzax shahri",
  namangan_city: "Namangan shahri",
  navoi_city: "Navoiy shahri",
  samarkand_city: "Samarqand shahri",
  nukus: "Nukus shahri",
  kogon_city: "Kogon shahri",
  xonobod: "Xonobod shahri",
};

const TRANSPORT_LABELS: Record<string, string> = {
  labo: 'Labo',
  bongo: 'Bongo',
  furgon: 'Furgon',
  isuzu5: 'ISUZU 5',
  isuzu10: 'ISUZU 10',
  gruzovik: 'Gruzovik',
  fura_tent: 'Fura Tent',
  fura_ref: 'Fura Ref',
  paravoz: 'Paravoz',
  shalanda: 'Shalanda',
  traller: 'Traller',
  tonar: 'Tonar',
  benzovoz: 'Benzovoz',
  konteynerovoz: 'Konteynerovoz',
  other: 'Boshqa',
};

function regionLabel(name: string): string {
  return REGION_NAMES[name] ?? name;
}

function transportLabel(type: string): string {
  return TRANSPORT_LABELS[type] ?? type;
}

const DEFAULT_MAX_PER_HOUR = 100; // 0 = unlimited
const SETTINGS_KEY_MAX_PER_HOUR = 'push_max_per_hour';
const SETTINGS_KEY_BOT_POST_TO_CHANNELS = 'bot_post_to_channels';
const HOUR_MS = 60 * 60 * 1000;

type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export type PushFilters = {
  originRegions?: string[] | null;
  destinationRegions?: string[] | null;
  transportTypes?: string[] | null;
  excludeBot?: boolean;
};

export async function getPushMaxPerHour(): Promise<number> {
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, SETTINGS_KEY_MAX_PER_HOUR))
      .limit(1);
    if (rows.length > 0) {
      const val = parseInt(rows[0].value, 10);
      if (!isNaN(val) && val >= 0) return val; // 0 = unlimited
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_MAX_PER_HOUR;
}

export async function setPushMaxPerHour(maxPerHour: number): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({ key: SETTINGS_KEY_MAX_PER_HOUR, value: String(maxPerHour), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: String(maxPerHour), updatedAt: new Date() },
    });
}

export async function getBotPostToChannels(): Promise<boolean> {
  try {
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, SETTINGS_KEY_BOT_POST_TO_CHANNELS))
      .limit(1);
    if (rows.length > 0) {
      return rows[0].value !== 'false';
    }
  } catch {
    // fall through to default
  }
  return true; // default: enabled
}

export async function setBotPostToChannels(enabled: boolean): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({ key: SETTINGS_KEY_BOT_POST_TO_CHANNELS, value: String(enabled), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: String(enabled), updatedAt: new Date() },
    });
}

export async function registerPushToken(
  expoToken: string,
  userId: number | null,
  filters: PushFilters,
): Promise<void> {
  const originRegions = filters.originRegions?.length ? filters.originRegions : null;
  const destinationRegions = filters.destinationRegions?.length ? filters.destinationRegions : null;
  const transportTypes = filters.transportTypes?.length ? filters.transportTypes : null;
  const excludeBot = filters.excludeBot ?? false;

  await db
    .insert(schema.pushTokens)
    .values({
      expoToken,
      userId,
      originRegions,
      destinationRegions,
      transportTypes,
      excludeBot,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.pushTokens.expoToken,
      set: {
        userId,
        originRegions,
        destinationRegions,
        transportTypes,
        excludeBot,
        updatedAt: new Date(),
      },
    });
}

export async function unregisterPushToken(expoToken: string): Promise<void> {
  await db.delete(schema.pushTokens).where(eq(schema.pushTokens.expoToken, expoToken));
}

export type AnnouncementForPush = {
  id: number;
  title: string;
  originRegions?: string[] | null;
  destinationRegions?: string[] | null;
  transportType?: string | null;
  weightTons?: string | number | null;
  createdByBot?: boolean | null;
};

/**
 * Rate-limit logic (fixed-window approach):
 *
 * maxPerHour = 0  → unlimited (all tokens are always eligible, no tracking).
 * maxPerHour > 0  → at most N notifications per 1-hour fixed window per device.
 *
 * `lastNotifiedAt` marks when the CURRENT window opened (first send).
 * `dailyCount` is the number of pushes sent in that window.
 *
 * A device is eligible when:
 *   a) maxPerHour = 0 (unlimited), OR
 *   b) No window exists yet (lastNotifiedAt is null), OR
 *   c) The current window is older than 1 hour (window expired), OR
 *   d) The window is still active AND dailyCount < maxPerHour.
 */
export async function notifyNewAnnouncement(announcement: AnnouncementForPush): Promise<void> {
  try {
    const originRegions = (announcement.originRegions ?? []).filter(Boolean);
    const destinationRegions = (announcement.destinationRegions ?? []).filter(Boolean);
    const transportType = announcement.transportType ?? null;
    const isBot = announcement.createdByBot === true;

    console.log(
      `[PushService] notifyNewAnnouncement #${announcement.id}: origin=${JSON.stringify(originRegions)}, dest=${JSON.stringify(destinationRegions)}, transport=${transportType}, createdByBot=${isBot}`,
    );

    // Helper: detect token type for diagnostics (Expo vs FCM-native)
    const tokenType = (tok: string) =>
      tok.startsWith('ExponentPushToken') ? 'expo' : 'fcm-native';

    const conditions: SQL[] = [];

    // Origin region filter:
    // - If announcement HAS origin regions → token matches if it has no origin pref (NULL) OR overlaps
    // - If announcement has NO origin → token must have no origin pref (NULL); tokens with preferences
    //   should NOT receive untagged announcements (they only want cargo from specific regions)
    if (originRegions.length > 0) {
      const clause = or(
        isNull(schema.pushTokens.originRegions),
        sql`${schema.pushTokens.originRegions} && ARRAY[${sql.join(
          originRegions.map((r) => sql`${r}`),
          sql`, `,
        )}]::text[]`,
      );
      if (clause) conditions.push(clause);
    } else {
      conditions.push(isNull(schema.pushTokens.originRegions));
    }

    // Destination region filter: same logic
    if (destinationRegions.length > 0) {
      const clause = or(
        isNull(schema.pushTokens.destinationRegions),
        sql`${schema.pushTokens.destinationRegions} && ARRAY[${sql.join(
          destinationRegions.map((r) => sql`${r}`),
          sql`, `,
        )}]::text[]`,
      );
      if (clause) conditions.push(clause);
    } else {
      conditions.push(isNull(schema.pushTokens.destinationRegions));
    }

    // Transport type filter: same logic
    // NOTE: transportType is nullable in the DB — many announcements may have it null.
    // Tokens with a transport preference must NOT receive untagged (null transport) announcements.
    if (transportType) {
      const clause = or(
        isNull(schema.pushTokens.transportTypes),
        sql`${schema.pushTokens.transportTypes} && ARRAY[${sql`${transportType}`}]::text[]`,
      );
      if (clause) conditions.push(clause);
    } else {
      conditions.push(isNull(schema.pushTokens.transportTypes));
    }

    // excludeBot: skip tokens that opted out of bot-created announcements
    if (isBot) {
      conditions.push(eq(schema.pushTokens.excludeBot, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const tokens = await db.select().from(schema.pushTokens).where(whereClause);

    const expoCount = tokens.filter((t) => t.expoToken.startsWith('ExponentPushToken')).length;
    const fcmNativeCount = tokens.length - expoCount;
    console.log(
      `[PushService] Found ${tokens.length} token(s) matching announcement #${announcement.id} (expo=${expoCount}, fcm-native=${fcmNativeCount})`,
    );

    if (tokens.length === 0) return;

    const maxPerHour = await getPushMaxPerHour();
    const unlimited = maxPerHour === 0;
    const now = new Date();
    const windowStart = new Date(now.getTime() - HOUR_MS);

    // Classify each token
    const eligibleFresh: typeof tokens = [];   // window expired / no window → will reset counter
    const eligibleActive: typeof tokens = [];  // window active, count < limit

    for (const tok of tokens) {
      if (unlimited) {
        eligibleFresh.push(tok);
        continue;
      }
      const windowExpired = !tok.lastNotifiedAt || tok.lastNotifiedAt < windowStart;
      if (windowExpired) {
        eligibleFresh.push(tok);
      } else if (tok.dailyCount < maxPerHour) {
        eligibleActive.push(tok);
      }
      // else: rate-limited — skip
    }

    const eligibleTokens = [...eligibleFresh, ...eligibleActive];
    const skippedCount = tokens.length - eligibleTokens.length;
    if (skippedCount > 0) {
      console.log(
        `[PushService] Rate-limited ${skippedCount} device(s) for announcement #${announcement.id} (limit: ${maxPerHour}/hr)`,
      );
    }

    if (eligibleTokens.length === 0) return;

    // Build a readable push body
    const bodyParts: string[] = [];
    const originName = originRegions[0] ? regionLabel(originRegions[0]) : null;
    const destName = destinationRegions[0] ? regionLabel(destinationRegions[0]) : null;
    if (originName && destName) {
      bodyParts.push(`${originName} → ${destName}`);
    } else if (originName) {
      bodyParts.push(originName);
    } else if (destName) {
      bodyParts.push(destName);
    }
    if (transportType) {
      bodyParts.push(transportLabel(transportType));
    }
    const weight = announcement.weightTons ? Number(announcement.weightTons) : 0;
    if (weight > 0) bodyParts.push(`${weight} t`);

    const body = bodyParts.length > 0 ? bodyParts.join(', ') : announcement.title;

    const messages = eligibleTokens.map((tok) => ({
      to: tok.expoToken,
      title: 'Yukbozor — yangi yuk',
      body,
      data: { type: 'new_announcement', id: announcement.id },
      sound: 'default',
    }));

    // Only remove tokens that Expo explicitly marks as unregistered/invalid device.
    const STALE_ERRORS = new Set(['DeviceNotRegistered']);
    const staleTokens: string[] = [];

    const freshSuccessIds = new Set<number>();
    const activeSuccessIds = new Set<number>();
    const freshIdSet = new Set(eligibleFresh.map((t) => t.id));

    const batches: object[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      batches.push(messages.slice(i, i + 100));
    }

    await enqueueBatches(batches, (tickets, batchIndex, error) => {
      const batchTokens = eligibleTokens.slice(batchIndex * 100, (batchIndex + 1) * 100);
      const batchNum = batchIndex + 1;
      console.log(
        `[PushService] Batch ${batchNum}: sending ${batchTokens.length} message(s) for announcement #${announcement.id}`,
      );
      if (error) {
        console.error(`[PushService] Expo API error for announcement #${announcement.id} batch ${batchNum}: ${error}`);
        return;
      }
      let batchSent = 0;
      let batchErrors = 0;
      tickets.forEach((ticket, idx) => {
        const tok = batchTokens[idx];
        if (!tok) return;
        if (ticket.status === 'error') {
          batchErrors++;
          const errorCode = ticket.details?.error;
          console.warn(
            `[PushService] Ticket error for ${tokenType(tok.expoToken)} token …${tok.expoToken.slice(-8)}: [${errorCode ?? 'unknown'}] ${ticket.message}`,
          );
          if (STALE_ERRORS.has(errorCode ?? '')) {
            staleTokens.push(tok.expoToken);
          }
        } else {
          batchSent++;
          if (freshIdSet.has(tok.id)) {
            freshSuccessIds.add(tok.id);
          } else {
            activeSuccessIds.add(tok.id);
          }
        }
      });
      console.log(
        `[PushService] Batch ${batchNum} result: sent=${batchSent} errors=${batchErrors}`,
      );
    });

    const allSuccessCount = freshSuccessIds.size + activeSuccessIds.size;

    if (freshSuccessIds.size > 0) {
      await db
        .update(schema.pushTokens)
        .set({ lastNotifiedAt: now, dailyCount: 1 })
        .where(inArray(schema.pushTokens.id, [...freshSuccessIds]));
    }

    if (activeSuccessIds.size > 0) {
      await db
        .update(schema.pushTokens)
        .set({ dailyCount: sql`${schema.pushTokens.dailyCount} + 1` })
        .where(inArray(schema.pushTokens.id, [...activeSuccessIds]));
    }

    const uniqueStaleTokens = [...new Set(staleTokens)];
    if (uniqueStaleTokens.length > 0) {
      await Promise.all(uniqueStaleTokens.map((t) => unregisterPushToken(t)));
      console.log(
        `[PushService] Removed ${uniqueStaleTokens.length} stale token(s) for announcement #${announcement.id}`,
      );
    }

    console.log(
      `[PushService] Sent push notification for announcement #${announcement.id} to ${allSuccessCount} device(s)`,
    );
  } catch (err: any) {
    console.error('[PushService] Failed to send notification:', err?.message || err);
  }
}

export type TestPushResult = {
  totalTokens: number;
  sent: number;
  errors: Array<{ token: string; error: string; code?: string }>;
  staleRemoved: number;
  expoApiError?: string;
};

/**
 * Admin diagnostic: sends a test push to all registered tokens (bypasses rate limit).
 */
export async function sendTestPush(title: string, body: string): Promise<TestPushResult> {
  const tokens = await db.select().from(schema.pushTokens);
  const result: TestPushResult = {
    totalTokens: tokens.length,
    sent: 0,
    errors: [],
    staleRemoved: 0,
  };

  if (tokens.length === 0) return result;

  const messages = tokens.map((tok) => ({
    to: tok.expoToken,
    title,
    body,
    data: { type: 'test_push' },
    sound: 'default',
  }));

  const STALE_ERRORS = new Set(['DeviceNotRegistered']);
  const staleTokens: string[] = [];

  const batches: object[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    batches.push(messages.slice(i, i + 100));
  }

  await enqueueBatches(batches, (tickets, batchIndex, error) => {
    const batchTokens = tokens.slice(batchIndex * 100, (batchIndex + 1) * 100);
    if (error) {
      result.expoApiError = error;
      return;
    }
    tickets.forEach((ticket, idx) => {
      const tok = batchTokens[idx];
      if (!tok) return;
      if (ticket.status === 'error') {
        const code = ticket.details?.error;
        result.errors.push({
          token: tok.expoToken.slice(0, 20) + '…',
          error: ticket.message,
          code,
        });
        if (STALE_ERRORS.has(code ?? '')) {
          staleTokens.push(tok.expoToken);
        }
      } else {
        result.sent++;
      }
    });
  });

  const uniqueStale = [...new Set(staleTokens)];
  if (uniqueStale.length > 0) {
    await Promise.all(uniqueStale.map((t) => unregisterPushToken(t)));
    result.staleRemoved = uniqueStale.length;
  }

  console.log(`[PushService] Test push: totalTokens=${result.totalTokens} sent=${result.sent} errors=${result.errors.length} staleRemoved=${result.staleRemoved}`);
  return result;
}
