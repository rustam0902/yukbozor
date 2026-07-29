-- Add photo_urls column to announcements and orders tables
-- Idempotent: safe to run multiple times

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
