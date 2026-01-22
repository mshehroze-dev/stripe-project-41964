
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Define TypeScript types for function inputs and outputs
interface ManageSubscriptionRequest {
  action: 'update' | 'cancel' | 'pause' | 'resume' | 'get'
  subscriptionId: string
  newPriceId?: string
  cancelAtPeriodEnd?: boolean
  pauseCollection?: 'mark_uncollectible' | 'keep_as_draft' | 'void'
  metadata?: Record<string, string>
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}

interface SubscriptionResponse {
  subscriptionId: string
  customerId: string
  status: string
  currentPeriodStart: number
  currentPeriodEnd: number
  trialEnd?: number
  cancelAt?: number
  cancelAtPeriodEnd: boolean
  pauseCollection?: {
    behavior: string
    resumesAt?: number
  }
  items: Array<{
    id: string
    priceId: string
    quantity: number
  }>
}

interface ErrorResponse {
  error: string
  details?: string
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Allow both GET and POST requests
  if (!['GET', 'POST'].includes(req.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      },
    )
  }

  try {
    let requestData: ManageSubscriptionRequest

    // Parse request data based on method
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const subscriptionId = url.searchParams.get('subscriptionId')

      if (!subscriptionId) {
        return new Response(
          JSON.stringify({
            error: 'Missing subscription ID',
            details: 'subscriptionId query parameter is required'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
      }

      requestData = {
        action: 'get',
        subscriptionId: subscriptionId,
      }
    } else {
      requestData = await req.json()
    }

    // Validate required fields
    if (!requestData.subscriptionId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'subscriptionId is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Validate action
    const validActions = ['update', 'cancel', 'pause', 'resume', 'get']
    if (!validActions.includes(requestData.action)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid action',
          details: `Action must be one of: ${ validActions.join(', ') }`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    let subscription: Stripe.Subscription

    // Handle different actions
    switch (requestData.action) {
      case 'get':
        // Retrieve subscription
        subscription = await stripe.subscriptions.retrieve(requestData.subscriptionId)
        break

      case 'update':
        // Update subscription
        if (!requestData.newPriceId) {
          return new Response(
            JSON.stringify({
              error: 'Missing price ID',
              details: 'newPriceId is required for update action'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            },
          )
        }

        // Get current subscription to find the subscription item
        const currentSub = await stripe.subscriptions.retrieve(requestData.subscriptionId)
        const subscriptionItem = currentSub.items.data[0]

        if (!subscriptionItem) {
          throw new Error('No subscription items found')
        }

        // Update the subscription
        subscription = await stripe.subscriptions.update(requestData.subscriptionId, {
          items: [{
            id: subscriptionItem.id,
            price: requestData.newPriceId,
          }],
          proration_behavior: requestData.prorationBehavior || 'create_prorations',
          metadata: requestData.metadata,
        })
        break

      case 'cancel':
        // Cancel subscription
        const cancelParams: Stripe.SubscriptionUpdateParams = {}

        if (requestData.cancelAtPeriodEnd !== undefined) {
          cancelParams.cancel_at_period_end = requestData.cancelAtPeriodEnd
        }

        if (requestData.metadata) {
          cancelParams.metadata = requestData.metadata
        }

        if (requestData.cancelAtPeriodEnd) {
          // Cancel at period end
          subscription = await stripe.subscriptions.update(requestData.subscriptionId, cancelParams)
        } else {
          // Cancel immediately
          subscription = await stripe.subscriptions.cancel(requestData.subscriptionId, {
            metadata: requestData.metadata,
          })
        }
        break

      case 'pause':
        // Pause subscription
        if (!requestData.pauseCollection) {
          return new Response(
            JSON.stringify({
              error: 'Missing pause behavior',
              details: 'pauseCollection is required for pause action'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            },
          )
        }

        subscription = await stripe.subscriptions.update(requestData.subscriptionId, {
          pause_collection: {
            behavior: requestData.pauseCollection,
          },
          metadata: requestData.metadata,
        })
        break

      case 'resume':
        // Resume subscription
        subscription = await stripe.subscriptions.update(requestData.subscriptionId, {
          pause_collection: null,
          metadata: requestData.metadata,
        })
        break

      default:
        throw new Error('Invalid action')
    }

    // Update subscription in Supabase database if not just retrieving
    if (requestData.action !== 'get') {
      const { error: dbError } = await supabase
        .from('subscriptions')
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        })
        .eq('stripe_subscription_id', subscription.id)

      if (dbError) {
        console.error('Database error updating subscription:', dbError)
        // Continue with response even if database update fails
      }
    }

    // Prepare response data
    const responseData: SubscriptionResponse = {
      subscriptionId: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      trialEnd: subscription.trial_end || undefined,
      cancelAt: subscription.cancel_at || undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      pauseCollection: subscription.pause_collection ? {
        behavior: subscription.pause_collection.behavior,
        resumesAt: subscription.pause_collection.resumes_at || undefined,
      } : undefined,
      items: subscription.items.data.map(item => ({
        id: item.id,
        priceId: item.price.id,
        quantity: item.quantity || 1,
      })),
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Subscription management error:', error)

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          error: 'Stripe API error',
          details: error.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Handle general errors
    const errorData: ErrorResponse = {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unknown error occurred',
    }

    return new Response(
      JSON.stringify(errorData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})


