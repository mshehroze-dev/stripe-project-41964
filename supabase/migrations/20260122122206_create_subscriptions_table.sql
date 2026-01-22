-- Migration: subscriptions
-- Timestamp: 20260122122206
-- This migration creates the subscriptions table with proper schema,
-- Row Level Security policies, indexes, and triggers.

-- DEPENDENCY VALIDATION:
-- This migration assumes the following functions exist in earlier migrations:
-- - update_updated_at_column() (created in initial schema migration)
-- If these functions are missing, the migration will fail.

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL,
  price_id text NOT NULL,
  currency text NOT NULL,
  interval text,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  ended_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Users can view own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- INDEXES
-- ============================================================================


DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'subscriptions' AND a.attname IN ('created_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS subscriptions_created_at_idx ON subscriptions(created_at);';
END IF;
END$$;
        

DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'subscriptions' AND a.attname IN ('updated_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS subscriptions_updated_at_idx ON subscriptions(updated_at);';
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
    WHERE event_object_table = 'subscriptions'
      AND trigger_name = 'update_subscriptions_updated_at'
) THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
END IF;
END$$;
