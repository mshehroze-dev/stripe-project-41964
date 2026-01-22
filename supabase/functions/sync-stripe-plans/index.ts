
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || ""
const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const syncSecret = Deno.env.get("SYNC_STRIPE_PLANS_SECRET") || ""

const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" })

type PlanInput = {
  lookupKey: string
  name: string
  description?: string
  unitAmount: number
  currency?: string
  interval?: "day" | "week" | "month" | "year"
  nickname?: string
}

const defaultPlans: PlanInput[] = [
  {
    lookupKey: "starter_monthly",
    name: "Starter",
    description: "Perfect for getting started",
    unitAmount: 900,
    currency: "usd",
    interval: "month",
    nickname: "Starter Monthly",
  },
  {
    lookupKey: "pro_monthly",
    name: "Professional",
    description: "Best for growing businesses",
    unitAmount: 2900,
    currency: "usd",
    interval: "month",
    nickname: "Professional Monthly",
  },
]

const normalizePlan = (plan: any): PlanInput => {
  return {
    lookupKey: plan?.lookupKey || plan?.lookup_key || plan?.priceLookupKey || plan?.price_lookup_key,
    name: plan?.name,
    description: plan?.description,
    unitAmount: plan?.unitAmount ?? plan?.unit_amount ?? plan?.amount ?? plan?.amount_cents,
    currency: plan?.currency || "usd",
    interval: plan?.interval || "month",
    nickname: plan?.nickname,
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!stripeSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing environment configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (syncSecret) {
    const providedSecret = req.headers.get("x-sync-secret") || ""
    if (providedSecret !== syncSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } else {
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch (_) {
    body = {}
  }

  const plansInput = Array.isArray(body?.plans) && body.plans.length > 0 ? body.plans : defaultPlans
  const plans = plansInput.map(normalizePlan)

  for (const plan of plans) {
    if (!plan.lookupKey || !plan.name || !plan.unitAmount) {
      return new Response(JSON.stringify({ error: "Invalid plan configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  const results: Array<Record<string, any>> = []

  for (const plan of plans) {
    let price = null as Stripe.Price | null
    let created = false

    const lookup = await stripe.prices.list({
      lookup_keys: [plan.lookupKey],
      active: true,
      limit: 1,
      expand: ["data.product"],
    })

    if (lookup.data?.length) {
      price = lookup.data[0]
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { lookup_key: plan.lookupKey },
      })

      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.unitAmount,
        currency: plan.currency || "usd",
        recurring: { interval: plan.interval || "month" },
        lookup_key: plan.lookupKey,
        nickname: plan.nickname,
      })
      created = true
    }

    if (!price?.recurring?.interval || !price.active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive subscription plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const product = price.product
    const productName =
      plan.name || (typeof product === "string" ? "Subscription Plan" : product?.name || "Subscription Plan")
    const productDescription =
      plan.description || (typeof product === "string" ? null : product?.description || null)

    const { data: upsertedPlan, error: upsertError } = await supabase
      .from("subscription_plans")
      .upsert(
        {
          name: productName,
          description: productDescription,
          stripe_price_id: price.id,
          interval: price.recurring.interval,
          amount_cents: price.unit_amount ?? plan.unitAmount,
          currency: price.currency || plan.currency || "usd",
          is_active: price.active ?? true,
        },
        { onConflict: "stripe_price_id" }
      )
      .select("id, stripe_price_id, is_active")
      .maybeSingle()

    if (upsertError || !upsertedPlan) {
      console.error("Subscription plan upsert error:", upsertError)
      return new Response(JSON.stringify({ error: "Failed to sync subscription plan" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    results.push({
      lookupKey: plan.lookupKey,
      priceId: price.id,
      created,
      planId: upsertedPlan.id,
      active: upsertedPlan.is_active,
    })
  }

  return new Response(JSON.stringify({ synced: results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
