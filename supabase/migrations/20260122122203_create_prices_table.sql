-- Migration: prices
-- Timestamp: 20260122122203
-- This migration creates the prices table with proper schema,
-- Row Level Security policies, indexes, and triggers.

-- DEPENDENCY VALIDATION:
-- This migration assumes the following functions exist in earlier migrations:
-- - update_updated_at_column() (created in initial schema migration)
-- If these functions are missing, the migration will fail.

-- ============================================================================
-- PRICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS prices (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  unit_amount bigint NOT NULL,
  currency text NOT NULL,
  type text NOT NULL,
  interval text,
  interval_count integer,
  trial_period_days integer,
  metadata jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Authenticated users can view prices
CREATE POLICY "Authenticated users can view prices"
  ON prices FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert prices
CREATE POLICY "Authenticated users can insert prices"
  ON prices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- INDEXES
-- ============================================================================


DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'prices' AND a.attname IN ('created_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS prices_created_at_idx ON prices(created_at);';
END IF;
END$$;
        

DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'prices' AND a.attname IN ('updated_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS prices_updated_at_idx ON prices(updated_at);';
END IF;
END$$;
        

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to automatically update the updated_at timestamp
-- NOTE: This trigger assumes the update_updated_at_column() function exists
-- The function should be created in the initial schema migration (20240101000000_initial_schema.sql)
DO $$
BEGIN
IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'prices'
      AND trigger_name = 'update_prices_updated_at'
) THEN
    CREATE TRIGGER update_prices_updated_at
      BEFORE UPDATE ON prices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
END IF;
END$$;
