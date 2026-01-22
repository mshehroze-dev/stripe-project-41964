-- Migration: customers
-- Timestamp: 20260122122202
-- This migration creates the customers table with proper schema,
-- Row Level Security policies, indexes, and triggers.

-- DEPENDENCY VALIDATION:
-- This migration assumes the following functions exist in earlier migrations:
-- - update_updated_at_column() (created in initial schema migration)
-- If these functions are missing, the migration will fail.

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id text UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Authenticated users can view customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert customers
CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- INDEXES
-- ============================================================================


DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'customers' AND a.attname IN ('created_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at);';
END IF;
END$$;
        

DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'customers' AND a.attname IN ('updated_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS customers_updated_at_idx ON customers(updated_at);';
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
    WHERE event_object_table = 'customers'
      AND trigger_name = 'update_customers_updated_at'
) THEN
    CREATE TRIGGER update_customers_updated_at
      BEFORE UPDATE ON customers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
END IF;
END$$;
