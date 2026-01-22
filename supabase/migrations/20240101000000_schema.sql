-- Single-file Supabase migration: final schema only
-- Creates exactly these application tables in schema public:
--   customers, subscription_plans, subscriptions, payments
-- auth.users is managed by Supabase in schema auth.

BEGIN;

-- Extensions (pgcrypto provides gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the update_updated_at_column function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop any other public views first (optional safety cleanup)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  )
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.table_name);
  END LOOP;
END$$;

-- Drop any other public tables except the target set
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        'customers',
        'payments',
        'subscriptions',
        'subscription_plans'
      )
  )
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END$$;

-- Recreate the target tables from scratch (guarantees correct schema)
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- customers: 1:1 with auth.users
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- subscription plans (typically managed by server/service role)
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stripe_price_id text UNIQUE,
  interval text,
  amount_cents integer,
  currency text NOT NULL DEFAULT 'usd',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_amount_nonneg CHECK (amount_cents IS NULL OR amount_cents >= 0)
);
-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,

  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'active',

  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,

  stripe_payment_intent_id text UNIQUE,
  stripe_invoice_id text UNIQUE,

  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_nonneg CHECK (amount_cents >= 0)
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(subscription_id);

-- Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- customers: user can access only their row
DROP POLICY IF EXISTS customers_select_own ON public.customers;
DROP POLICY IF EXISTS customers_insert_own ON public.customers;
DROP POLICY IF EXISTS customers_update_own ON public.customers;
DROP POLICY IF EXISTS customers_delete_own ON public.customers;

CREATE POLICY customers_select_own
  ON public.customers
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY customers_insert_own
  ON public.customers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customers_update_own
  ON public.customers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY customers_delete_own
  ON public.customers
  FOR DELETE
  USING (user_id = auth.uid());

-- subscription_plans: readable by everyone; writable typically via service role (bypass RLS)
DROP POLICY IF EXISTS subscription_plans_read_all ON public.subscription_plans;
CREATE POLICY subscription_plans_read_all
  ON public.subscription_plans
  FOR SELECT
  USING (true);

-- subscriptions: user can access rows tied to their customer
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_delete_own ON public.subscriptions;

CREATE POLICY subscriptions_select_own
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY subscriptions_insert_own
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY subscriptions_update_own
  ON public.subscriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY subscriptions_delete_own
  ON public.subscriptions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

-- payments: user can access rows tied to their customer
DROP POLICY IF EXISTS payments_select_own ON public.payments;
DROP POLICY IF EXISTS payments_insert_own ON public.payments;
DROP POLICY IF EXISTS payments_update_own ON public.payments;
DROP POLICY IF EXISTS payments_delete_own ON public.payments;

CREATE POLICY payments_select_own
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY payments_insert_own
  ON public.payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY payments_update_own
  ON public.payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY payments_delete_own
  ON public.payments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_id
        AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Triggers to automatically update the updated_at timestamp

-- Customers table trigger
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

-- Subscription plans table trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'subscription_plans'
      AND trigger_name = 'update_subscription_plans_updated_at'
  ) THEN
    CREATE TRIGGER update_subscription_plans_updated_at
      BEFORE UPDATE ON subscription_plans
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- Subscriptions table trigger
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

-- Payments table trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'payments'
      AND trigger_name = 'update_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

COMMIT;
