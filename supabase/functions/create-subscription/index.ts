
// Supabase Edge Function: create-subscription
// Creates a Stripe Checkout session for subscriptions and records the customer in Supabase.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || ""
const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" })

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

  try {
    const {
      priceId: rawPriceId,
      priceLookupKey,
      trialDays = 0,
      successUrl,
      cancelUrl,
      metadata = {},
    } = await req.json()
    let priceId = rawPriceId

    if (!priceId && priceLookupKey) {
      const prices = await stripe.prices.list({
        lookup_keys: [priceLookupKey],
        active: true,
        limit: 1,
        expand: ["data.product"],
      })
      const lookupPrice = prices.data?.[0]
      if (!lookupPrice) {
        return new Response(JSON.stringify({ error: "Invalid or inactive subscription plan" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      priceId = lookupPrice.id
    }

    if (!priceId) {
      return new Response(JSON.stringify({ error: "Missing priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Create Supabase client with service role to write to DB; auth header used to identify user
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get the signed-in user to associate the customer record
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || ""
    const { data: userResult, error: userError } = await supabase.auth.getUser(token)

    if (userError || !userResult?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const user = userResult.user

    const userEmail = user.email
    if (!userEmail) {
      return new Response(JSON.stringify({ error: "User email is required to create a customer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Look up existing customer for this user using new schema structure
    const { data: existingCustomer, error: customerLookupError } = await supabase
      .from("customers")
      .select("id, stripe_customer_id, email")
      .eq("user_id", user.id)
      .maybeSingle()

    if (customerLookupError) {
      console.error("Customer lookup error:", customerLookupError)
      return new Response(JSON.stringify({ error: "Failed to lookup customer" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let stripeCustomerId = existingCustomer?.stripe_customer_id
    let customerRowId = existingCustomer?.id

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id

      // Insert new customer record with proper structure
      const { data: newCustomer, error: customerInsertError } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          email: userEmail,
        })
        .select("id")
        .single()

      if (customerInsertError) {
        console.error("Customer insert error:", customerInsertError)
        return new Response(JSON.stringify({ error: "Failed to create customer record" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      customerRowId = newCustomer?.id
    }

    // Validate that the priceId corresponds to an active subscription plan
    let { data: subscriptionPlan, error: planLookupError } = await supabase
      .from("subscription_plans")
      .select("id, name, stripe_price_id, is_active")
      .eq("stripe_price_id", priceId)
      .maybeSingle()

    if (planLookupError) {
      console.error("Subscription plan lookup error:", planLookupError)
      return new Response(JSON.stringify({ error: "Failed to lookup subscription plan" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!subscriptionPlan || !subscriptionPlan.is_active) {
      try {
        const stripePrice = await stripe.prices.retrieve(priceId, { expand: ["product"] })
        const recurring = stripePrice.recurring

        if (!stripePrice.active || !recurring?.interval) {
          console.error("Stripe price inactive or not recurring:", stripePrice?.id)
          return new Response(JSON.stringify({ error: "Invalid or inactive subscription plan" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        const product = stripePrice.product
        const productName = typeof product === "string" ? "" : product?.name || ""
        const productDescription = typeof product === "string" ? "" : product?.description || ""
        const planName = stripePrice.nickname || productName || "Subscription Plan"
        const planDescription = productDescription || stripePrice.nickname || null

        const { data: upsertedPlan, error: upsertError } = await supabase
          .from("subscription_plans")
          .upsert(
            {
              name: planName,
              description: planDescription,
              stripe_price_id: priceId,
              interval: recurring.interval,
              amount_cents: stripePrice.unit_amount ?? null,
              currency: stripePrice.currency || "usd",
              is_active: stripePrice.active ?? true,
            },
            { onConflict: "stripe_price_id" }
          )
          .select("id, name, stripe_price_id, is_active")
          .maybeSingle()

        if (upsertError || !upsertedPlan) {
          console.error("Subscription plan upsert error:", upsertError)
          return new Response(JSON.stringify({ error: "Failed to sync subscription plan" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        subscriptionPlan = upsertedPlan
      } catch (stripeError) {
        console.error("Stripe price lookup error:", stripeError)
        return new Response(JSON.stringify({ error: "Invalid or inactive subscription plan" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    if (!subscriptionPlan?.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive subscription plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Create Stripe Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: trialDays
        ? { trial_period_days: trialDays }
        : undefined,
      success_url: successUrl || `${req.headers.get("origin") || ""}/payment/success?type=subscription`,
      cancel_url: cancelUrl || `${req.headers.get("origin") || ""}/payment/cancel`,
      metadata: {
        plan_id: subscriptionPlan.id,
        price_id: priceId,
        supabase_user_id: user.id,
        customer_row_id: customerRowId,
        ...(metadata || {}),
      },
    })

    // Create placeholder subscription record with new schema structure
    // Final status will be handled via webhooks
    if (session.subscription && customerRowId) {
      const currentTime = new Date().toISOString()
      const trialEndTime = trialDays 
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { error: subscriptionInsertError } = await supabase
        .from("subscriptions")
        .insert({
          customer_id: customerRowId,
          stripe_subscription_id: session.subscription as string,
          plan_id: subscriptionPlan.id,
          status: trialDays ? "trialing" : "incomplete",
          current_period_start: currentTime,
          current_period_end: trialEndTime || currentTime,
          trial_start: trialDays ? currentTime : null,
          trial_end: trialEndTime,
          metadata: {
            created_via: "create-subscription",
            checkout_session_id: session.id,
            ...(metadata || {}),
          },
        })

      if (subscriptionInsertError) {
        console.error("Subscription insert error:", subscriptionInsertError)
        // Don't fail the request since Stripe session was created successfully
        // Webhooks will handle the final subscription creation
      }
    }

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Create subscription error", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
