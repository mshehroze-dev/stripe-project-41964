-- Migration: products
-- Timestamp: 20260122122204
-- This migration creates the products table with proper schema,
-- Row Level Security policies, indexes, and triggers.

-- DEPENDENCY VALIDATION:
-- This migration assumes the following functions exist in earlier migrations:
-- - update_updated_at_column() (created in initial schema migration)
-- If these functions are missing, the migration will fail.

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  description text,
  image text,
  metadata jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Policy: Authenticated users can view products
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert products
CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- INDEXES
-- ============================================================================


DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'products' AND a.attname IN ('created_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS products_created_at_idx ON products(created_at);';
END IF;
END$$;
        

DO $$
BEGIN
IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'products' AND a.attname IN ('updated_at')
) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS products_updated_at_idx ON products(updated_at);';
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
    WHERE event_object_table = 'products'
      AND trigger_name = 'update_products_updated_at'
) THEN
    CREATE TRIGGER update_products_updated_at
      BEFORE UPDATE ON products
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
END IF;
END$$;
