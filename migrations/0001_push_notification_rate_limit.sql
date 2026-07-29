-- Migration: add rate-limit columns to push_tokens and create app_settings table
-- Task #61: Limit notification frequency to avoid overwhelming users

ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS daily_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
