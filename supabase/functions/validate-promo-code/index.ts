
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import {
  validatePromoCode,
  sanitizeRequestBody
} from '../_shared/payment-validation.ts'

// Define TypeScript types for function inputs and outputs
interface PromoCodeRequest {
  code: string
}

interface PromoCodeResponse {
  valid: boolean
  id?: string
  code?: string
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  currency?: string
  error?: string
}

interface ErrorResponse {
  error: string
  details?: string
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Stripe with secret key from environment
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

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
    // Parse request body
    const rawRequestData = await req.json()

    // Sanitize input to prevent injection attacks
    const sanitizedInput = sanitizeRequestBody(rawRequestData)

    // Validate promo code format
    const codeValidation = validatePromoCode(sanitizedInput.code)
    if (!codeValidation.valid) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: codeValidation.error
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    const promoCode = codeValidation.sanitized

    if (!promoCode) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Promo code is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    try {
      // Search for the coupon in Stripe
      const coupons = await stripe.coupons.list({
        limit: 100, // Stripe's maximum
      })

      // Find matching coupon by ID (case-insensitive)
      const matchingCoupon = coupons.data.find(coupon =>
        coupon.id.toUpperCase() === promoCode
      )

      if (!matchingCoupon) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Invalid promo code'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      // Check if coupon is valid (not deleted and within validity period)
      if (!matchingCoupon.valid) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Promo code has expired or is no longer valid'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      // Check redemption limits
      if (matchingCoupon.max_redemptions &&
          matchingCoupon.times_redeemed >= matchingCoupon.max_redemptions) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Promo code has reached its usage limit'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      // Check validity dates
      const now = Math.floor(Date.now() / 1000)

      if (matchingCoupon.redeem_by && now > matchingCoupon.redeem_by) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Promo code has expired'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      // Determine discount type and value
      let discountType: 'percentage' | 'fixed'
      let discountValue: number
      let currency: string | undefined

      if (matchingCoupon.percent_off) {
        discountType = 'percentage'
        discountValue = matchingCoupon.percent_off
      } else if (matchingCoupon.amount_off) {
        discountType = 'fixed'
        discountValue = matchingCoupon.amount_off
        currency = matchingCoupon.currency?.toUpperCase()
      } else {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Invalid discount configuration'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      // Return successful validation response
      const responseData: PromoCodeResponse = {
        valid: true,
        id: matchingCoupon.id,
        code: matchingCoupon.id,
        discount_type: discountType,
        discount_value: discountValue,
        currency: currency,
      }

      return new Response(
        JSON.stringify(responseData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )

    } catch (stripeError) {
      console.error('Stripe API error during coupon validation:', stripeError)

      if (stripeError instanceof Stripe.errors.StripeError) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Unable to validate promo code at this time'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      }

      throw stripeError
    }

  } catch (error) {
    console.error('Promo code validation error:', error)

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

