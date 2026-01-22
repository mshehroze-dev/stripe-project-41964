
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import {
  retryStripeCall,
  createErrorResponse,
  validateStripeEnvironment,
  CircuitBreaker
} from '../_shared/stripe-retry-utils.ts'
import {
  notifyPaymentFailure,
  notifyCriticalError,
  notifyRateLimitExceeded
} from '../_shared/admin-notifications.ts'
import {
  validateCheckoutSessionRequest,
  sanitizeRequestBody
} from '../_shared/payment-validation.ts'

// Define TypeScript types for function inputs and outputs
interface CheckoutSessionRequest {
  priceId?: string
  quantity?: number
  customerId?: string
  successUrl: string
  cancelUrl: string
  mode?: 'payment' | 'subscription'
  currency?: string
  allowPromotionCodes?: boolean
  promoCode?: string
  collectBillingAddress?: boolean
  collectShippingAddress?: boolean
  metadata?: Record<string, string>
}

interface CheckoutSessionResponse {
  sessionId: string
  url: string
}

interface ErrorResponse {
  error: string
  details?: string
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Validate environment variables
const envValidation = validateStripeEnvironment()
if (!envValidation.isValid) {
  console.error('Missing required environment variables:', envValidation.missingVars)
}

// Initialize Stripe with secret key from environment
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
})

// Circuit breaker for Stripe API calls
const stripeCircuitBreaker = new CircuitBreaker(5, 60000) // 5 failures, 1 minute timeout

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

  try {
    if (!stripeSecret || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment configuration' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const token = req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    const { data: userResult, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userResult?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }
    const user = userResult.user
    const customerEmail = user.email || undefined

    // Parse request body
    const rawRequestData = await req.json()

    // Sanitize input to prevent injection attacks
    const sanitizedInput = sanitizeRequestBody(rawRequestData)

    // Comprehensive validation of checkout session parameters
    const validation = validateCheckoutSessionRequest(sanitizedInput)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request parameters',
          details: validation.error
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    const requestData = validation.sanitized
    const mode = requestData.mode || 'payment'

    // Look up existing customer for this user
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let stripeCustomerId = existingCustomer?.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id

      await supabase
        .from('customers')
        .upsert({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          email: customerEmail || '',
          name: customer.name ?? undefined,
        })
    }

    // Build checkout session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: mode,
      success_url: requestData.successUrl,
      cancel_url: requestData.cancelUrl,
      currency: requestData.currency || 'usd',
      allow_promotion_codes: requestData.allowPromotionCodes ?? true,
      billing_address_collection: requestData.collectBillingAddress ? 'required' : 'auto',
      shipping_address_collection: requestData.collectShippingAddress ? {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'LU', 'GR', 'CZ', 'PL', 'HU', 'SK', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'BG', 'RO', 'HR'],
      } : undefined,
      metadata: requestData.metadata || {},
      customer: stripeCustomerId,
    }

    // Handle promo code application
    if (requestData.promoCode) {
      const promoCode = requestData.promoCode.trim().toUpperCase()

      // Validate promo code format
      const validCodePattern = /^[A-Z0-9\-_]+$/
      if (!validCodePattern.test(promoCode)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid promo code format',
            details: 'Promo code contains invalid characters'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
      }

      try {
        // Validate the coupon exists and is active with retry logic
        const coupon = await retryStripeCall(
          () => stripe.coupons.retrieve(promoCode),
          'retrieve_coupon',
          { promoCode }
        )

        if (!coupon.valid) {
          return new Response(
            JSON.stringify({
              error: 'Invalid promo code',
              details: 'Promo code has expired or is no longer valid'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            },
          )
        }

        // Check redemption limits
        if (coupon.max_redemptions &&
            coupon.times_redeemed >= coupon.max_redemptions) {
          return new Response(
            JSON.stringify({
              error: 'Promo code unavailable',
              details: 'Promo code has reached its usage limit'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            },
          )
        }

        // Check validity dates
        const now = Math.floor(Date.now() / 1000)
        if (coupon.redeem_by && now > coupon.redeem_by) {
          return new Response(
            JSON.stringify({
              error: 'Promo code expired',
              details: 'Promo code has expired'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            },
          )
        }

        // Apply the discount to the session
        sessionParams.discounts = [{
          coupon: promoCode,
        }]

        // Disable general promotion codes if a specific one is applied
        sessionParams.allow_promotion_codes = false

      } catch (stripeError) {
        if (stripeError instanceof Stripe.errors.StripeError) {
          if (stripeError.code === 'resource_missing') {
            return new Response(
              JSON.stringify({
                error: 'Invalid promo code',
                details: 'Promo code not found'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
              },
            )
          }

          return new Response(
            JSON.stringify({
              error: 'Promo code validation failed',
              details: stripeError.message
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            },
          )
        }

        throw stripeError
      }
    }

    // Add customer if provided
    if (requestData.customerId) {
      sessionParams.customer = requestData.customerId
    }

    // Add line items based on mode
    if (mode === 'payment') {
      if (!requestData.priceId) {
        return new Response(
          JSON.stringify({
            error: 'Missing price ID',
            details: 'priceId is required for payment mode'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
      }

      sessionParams.line_items = [{
        price: requestData.priceId,
        quantity: requestData.quantity || 1,
      }]
    } else if (mode === 'subscription') {
      if (!requestData.priceId) {
        return new Response(
          JSON.stringify({
            error: 'Missing price ID',
            details: 'priceId is required for subscription mode'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
      }

      sessionParams.line_items = [{
        price: requestData.priceId,
        quantity: requestData.quantity || 1,
      }]
    }

    // Create checkout session with Stripe using circuit breaker and retry logic
    const session = await stripeCircuitBreaker.execute(async () => {
      return await retryStripeCall(
        () => stripe.checkout.sessions.create(sessionParams),
        'create_checkout_session',
        {
          mode: sessionParams.mode,
          priceId: requestData.priceId,
          customerId: requestData.customerId
        }
      )
    })

    if (!session.id || !session.url) {
      throw new Error('Failed to create checkout session')
    }

    // Return successful response
    const responseData: CheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url,
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Checkout session creation error:', error)

    // Send admin notification for critical errors
    if (error instanceof Stripe.errors.StripeRateLimitError) {
      await notifyRateLimitExceeded('create_checkout_session', error.headers?.['x-ratelimit-reset-after'])
    } else if (error instanceof Stripe.errors.StripeError &&
               ['authentication_error', 'api_error'].includes(error.type)) {
      await notifyCriticalError(
        'create_checkout_session',
        error.message,
        {
          errorType: error.type,
          errorCode: error.code,
          requestData: {
            mode: requestData.mode,
            priceId: requestData.priceId,
            customerId: requestData.customerId
          }
        }
      )
    }

    // Return standardized error response
    return createErrorResponse(error, 'create_checkout_session', corsHeaders)
  }
})


