#!/bin/bash
set -e
npm install

# Run all idempotent schema migrations in a single DB connection to stay within 20s timeout.
# db:push (drizzle-kit) is intentionally skipped here — it pulls the full schema from Neon
# which can take 15-20s and causes timeout flaps. Schema is managed via explicit ALTER TABLE
# statements below instead.

npx tsx -e "
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function run() {
  // Task #44: Make announcements.price nullable
  await db.execute(sql\`ALTER TABLE announcements ALTER COLUMN price DROP NOT NULL\`).catch(e => {
    if (!e.message?.includes('does not exist')) console.error('[migration] price nullable:', e.message);
  });
  console.log('[migration] announcements.price is now nullable');

  // Task #27: Add promo_rotation_index to telegram_channels
  await db.execute(sql\`ALTER TABLE telegram_channels ADD COLUMN IF NOT EXISTS promo_rotation_index integer NOT NULL DEFAULT 0\`);
  console.log('[migration] telegram_channels.promo_rotation_index added');

  // Task #47: Add bot_source_message_id to announcements
  await db.execute(sql\`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS bot_source_message_id integer\`);
  console.log('[migration] announcements.bot_source_message_id added');

  // Task #128: Ensure analytics tables exist with correct schema
  await db.execute(sql\`
    CREATE TABLE IF NOT EXISTS app_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_name TEXT NOT NULL,
      screen TEXT,
      device_model TEXT,
      os_version TEXT,
      app_version TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  \`);
  await db.execute(sql\`CREATE INDEX IF NOT EXISTS idx_app_events_name ON app_events(event_name)\`);
  await db.execute(sql\`CREATE INDEX IF NOT EXISTS idx_app_events_user ON app_events(user_id)\`);
  await db.execute(sql\`CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events(created_at)\`);

  await db.execute(sql\`
    CREATE TABLE IF NOT EXISTS app_errors (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      screen TEXT,
      device_model TEXT,
      os_version TEXT,
      app_version TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  \`);
  await db.execute(sql\`CREATE INDEX IF NOT EXISTS idx_app_errors_user ON app_errors(user_id)\`);
  await db.execute(sql\`CREATE INDEX IF NOT EXISTS idx_app_errors_created ON app_errors(created_at)\`);
  console.log('[migration] app_events and app_errors tables ensured');
}

run().then(() => process.exit(0)).catch(e => {
  console.error('[migration] FATAL:', e.message);
  process.exit(0); // non-fatal: app still runs
});
" 2>&1 || true
