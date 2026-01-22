-- Migration: profiles
-- Timestamp: 20260122122205
-- This migration creates the profiles table with proper schema,
-- Row Level Security policies, indexes, and triggers.

-- DEPENDENCY VALIDATION:
-- This migration assumes the following functions exist in earlier migrations:
-- - update_updated_at_column() (created in initial schema migration)
-- If these functions are missing, the migration will fail.

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  avatar_url text,
  billing_address jsonb,
  payment_method jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Authenticated users can view profiles
CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert profiles
CREATE POLICY "Authenticated users can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- INDEXES
-- ============================================================================


DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'profiles' AND a.attname IN ('created_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);';
END IF;
END$$;
        

DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'profiles' AND a.attname IN ('updated_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON profiles(updated_at);';
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
    WHERE event_object_table = 'profiles'
      AND trigger_name = 'update_profiles_updated_at'
) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
END IF;
END$$;
