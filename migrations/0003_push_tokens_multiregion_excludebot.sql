-- Migration: replace single-value region/transport columns with arrays, add exclude_bot
-- Task #104: Push notifications — multi-region filter + excludeBot support

-- Step 1: add new array columns and exclude_bot flag
ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS origin_regions      text[],
  ADD COLUMN IF NOT EXISTS destination_regions text[],
  ADD COLUMN IF NOT EXISTS transport_types     text[],
  ADD COLUMN IF NOT EXISTS exclude_bot         boolean NOT NULL DEFAULT false;

-- Step 2: backfill arrays from existing single-value columns (where new arrays are still null)
UPDATE push_tokens SET
  origin_regions      = CASE WHEN origin_region      IS NOT NULL THEN ARRAY[origin_region]      ELSE NULL END,
  destination_regions = CASE WHEN destination_region IS NOT NULL THEN ARRAY[destination_region] ELSE NULL END,
  transport_types     = CASE WHEN transport_type      IS NOT NULL THEN ARRAY[transport_type]      ELSE NULL END
WHERE origin_regions IS NULL
  AND destination_regions IS NULL
  AND transport_types IS NULL;

-- Step 3: drop the old single-value columns
ALTER TABLE push_tokens
  DROP COLUMN IF EXISTS origin_region,
  DROP COLUMN IF EXISTS destination_region,
  DROP COLUMN IF EXISTS transport_type;
