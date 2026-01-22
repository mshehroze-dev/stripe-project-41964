-- Seed data for subscription_plans table
-- This file populates the subscription_plans table with the plans used in the application

INSERT INTO subscription_plans (name, description, stripe_price_id, interval, amount_cents, currency, is_active) VALUES
  (
    'Starter',
    'Perfect for getting started',
    'price_1SfIsmRrMKHLRgh7MTZscu1y',
    'month',
    900,
    'usd',
    true
  ),
  (
    'Professional',
    'Best for growing businesses',
    'price_1SfIqORrMKHLRgh7kuPqrvtS',
    'month',
    2900,
    'usd',
    true
  ),
  (
    'Enterprise',
    'For large-scale applications',
    'price_enterprise_monthly',
    'month',
    9900,
    'usd',
    true
  )
ON CONFLICT (stripe_price_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  interval = EXCLUDED.interval,
  amount_cents = EXCLUDED.amount_cents,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  updated_at = now();
