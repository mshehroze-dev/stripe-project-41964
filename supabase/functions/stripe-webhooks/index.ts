
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import {
  retryStripeCall,
  createErrorResponse,
  validateStripeEnvironment
} from '../_shared/stripe-retry-utils.ts'
import {
  notifyWebhookFailure,
  notifyCriticalError,
  notifyPaymentFailure,
  notifySubscriptionFailure
} from '../_shared/admin-notifications.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Validate environment variables
const envValidation = validateStripeEnvironment()
if (!envValidation.isValid) {
  console.error('Missing required environment variables:', envValidation.missingVars)
}

// Initialize Stripe with secret key from environment
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Webhook endpoint secret for signature verification
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

// Idempotency tracking to prevent duplicate processing
const processedEvents = new Set<string>()

// Track retry attempts for webhook events
const retryAttempts = new Map<string, number>()

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      },
    )
  }

  let event: Stripe.Event
  let eventId = 'unknown'

  try {
    // Get the raw body and signature header
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return new Response(
        JSON.stringify({
          error: 'Missing signature',
          details: 'Stripe-Signature header is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    if (!webhookSecret) {
      console.error('Webhook secret not configured')
      return new Response(
        JSON.stringify({
          error: 'Webhook not configured',
          details: 'STRIPE_WEBHOOK_SECRET environment variable is not set'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    // Verify webhook signature (use async for Edge runtime)
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
      eventId = event.id
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          details: 'Webhook signature verification failed'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Idempotency check - prevent duplicate processing
    if (processedEvents.has(eventId)) {
      console.log(`Event ${ eventId } already processed, skipping`)
      return new Response(
        JSON.stringify({
          received: true,
          processed: false,
          eventId: eventId,
          eventType: event.type,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Mark event as being processed
    processedEvents.add(eventId)

    console.log(`Processing webhook event: ${ event.type } (${ eventId })`)

    // Track retry attempts
    const currentAttempts = retryAttempts.get(eventId) || 0
    retryAttempts.set(eventId, currentAttempts + 1)

    // Process different event types
    let processed = false

    switch (event.type) {
      // Payment completion events
      case 'checkout.session.completed':
        processed = await handleCheckoutSessionCompleted(event)
        break

      case 'payment_intent.succeeded':
        processed = await handlePaymentIntentSucceeded(event)
        break

      case 'payment_intent.payment_failed':
        processed = await handlePaymentIntentFailed(event)
        break

      // Subscription lifecycle events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        processed = await handleSubscriptionUpdated(event)
        break

      case 'customer.subscription.deleted':
        processed = await handleSubscriptionDeleted(event)
        break

      // Invoice events
      case 'invoice.payment_succeeded':
        processed = await handleInvoicePaymentSucceeded(event)
        break

      case 'invoice.payment_failed':
        processed = await handleInvoicePaymentFailed(event)
        break

      default:
        console.log(`Unhandled event type: ${ event.type }`)
        break
    }

    return new Response(
      JSON.stringify({
        received: true,
        processed,
        eventId: event.id,
        eventType: event.type,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Webhook processing error:', error)

    // Remove from processed set to allow retry on error
    if (eventId !== 'unknown') {
      processedEvents.delete(eventId)
    }

    // Send notifications for errors
    await notifyWebhookFailure(error, eventId)
    await notifyCriticalError(error, {
      context: 'stripe-webhooks',
      eventId,
    })

    return createErrorResponse(
      error,
      'stripe_webhook',
      { ...corsHeaders, 'Content-Type': 'application/json' },
    )
  }
})

// =============================================================================
// Event Handlers
// =============================================================================

async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<boolean> {
  const session = event.data.object as Stripe.Checkout.Session
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string | null
  const email = session.customer_details?.email
  const name = session.customer_details?.name
  const supabaseUserId = (session.metadata?.supabase_user_id as string) || null

  try {
    // If we don't have a customer or user, we cannot safely upsert (customers.user_id NOT NULL)
    if (!customerId) {
      console.warn(`checkout.session.completed missing customerId for event ${event.id}`)
      return false
    }

    // Try to reuse existing customer to get user_id when metadata is missing
    let userId = supabaseUserId
    if (!userId) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()
      userId = existingCustomer?.user_id || null
    }

    if (!userId) {
      console.warn(`checkout.session.completed missing supabase_user_id for customer ${customerId}`)
      return false
    }

    // Upsert customer
    const { data: customerRow, error: customerError } = await supabase
      .from('customers')
      .upsert({
        stripe_customer_id: customerId,
        email: email || '',
        name: name || null,
        user_id: userId,
      })
      .select('id, user_id')
      .single()

    if (customerError) {
      throw customerError
    }

    // Upsert subscription if present
    if (subscriptionId) {
      await supabase
        .from('subscriptions')
        .upsert({
          stripe_subscription_id: subscriptionId,
          customer_id: customerRow.id,
          plan_id: session.metadata?.plan_id || session.metadata?.price_id || 'unknown',
          status: 'active',
        })
    }

    return true
  } catch (error) {
    await notifySubscriptionFailure(error, {
      eventId: event.id,
      subscriptionId,
      customerId,
    })
    return false
  }
}

async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<boolean> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent

  try {
    await supabase
      .from('payments')
      .upsert({
        stripe_payment_intent_id: paymentIntent.id,
        amount: paymentIntent.amount_received || paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customer_id: paymentIntent.customer as string,
        description: paymentIntent.description || '',
        metadata: paymentIntent.metadata || {},
        created_at: new Date(paymentIntent.created * 1000).toISOString(),
      })

    return true
  } catch (error) {
    await notifyPaymentFailure(error, {
      eventId: event.id,
      paymentIntentId: paymentIntent.id,
    })
    return false
  }
}

async function handlePaymentIntentFailed(event: Stripe.Event): Promise<boolean> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent

  await notifyPaymentFailure('Payment failed', {
    eventId: event.id,
    paymentIntentId: paymentIntent.id,
    failureCode: paymentIntent.last_payment_error?.code,
    failureMessage: paymentIntent.last_payment_error?.message,
  })

  return true
}

async function handleSubscriptionUpdated(event: Stripe.Event): Promise<boolean> {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = subscription.customer as string

  try {
    // Find customer row
    const { data: customerRow, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (customerError) {
      throw customerError
    }

    await supabase
      .from('subscriptions')
      .upsert({
        stripe_subscription_id: subscription.id,
        customer_id: customerRow.id,
        plan_id: subscription.items.data[0]?.price.id || 'unknown',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      })

    return true
  } catch (error) {
    await notifySubscriptionFailure(error, {
      eventId: event.id,
      subscriptionId: subscription.id,
      customerId,
    })
    return false
  }
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<boolean> {
  const subscription = event.data.object as Stripe.Subscription
  const customerId = subscription.customer as string

  try {
    const { data: customerRow, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (customerError) {
      throw customerError
    }

    await supabase
      .from('subscriptions')
      .upsert({
        stripe_subscription_id: subscription.id,
        customer_id: customerRow.id,
        plan_id: subscription.items.data[0]?.price.id || 'unknown',
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      })

    return true
  } catch (error) {
    await notifySubscriptionFailure(error, {
      eventId: event.id,
      subscriptionId: subscription.id,
      customerId,
    })
    return false
  }
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<boolean> {
  const invoice = event.data.object as Stripe.Invoice

  try {
    await supabase
      .from('invoices')
      .upsert({
        stripe_invoice_id: invoice.id,
        customer_id: invoice.customer as string,
        subscription_id: invoice.subscription as string,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        status: invoice.status,
        invoice_pdf: invoice.invoice_pdf || null,
        metadata: invoice.metadata || {},
        created_at: new Date(invoice.created * 1000).toISOString(),
      })

    return true
  } catch (error) {
    await notifyPaymentFailure(error, {
      eventId: event.id,
      invoiceId: invoice.id,
    })
    return false
  }
}

async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<boolean> {
  const invoice = event.data.object as Stripe.Invoice

  await notifyPaymentFailure('Invoice payment failed', {
    eventId: event.id,
    invoiceId: invoice.id,
  })

  return true
}


