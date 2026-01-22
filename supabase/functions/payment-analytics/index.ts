
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import {
  retryRateLimitedCall,
  createErrorResponse,
  validateStripeEnvironment,
  CircuitBreaker
} from '../_shared/stripe-retry-utils.ts'
import {
  notifyCriticalError,
  notifyRateLimitExceeded
} from '../_shared/admin-notifications.ts'

// Define TypeScript types for function inputs and outputs
interface AnalyticsRequest {
  type: 'promo_usage' | 'payment_summary' | 'subscription_metrics' | 'customer_analytics'
  startDate?: string
  endDate?: string
  promoCode?: string
  limit?: number
}

interface PromoUsageAnalytics {
  promoCode: string
  totalRedemptions: number
  totalDiscountAmount: number
  currency: string
  averageOrderValue: number
  conversionRate: number
  revenueImpact: number
  topCustomers: Array<{
    customerId: string
    email?: string
    redemptions: number
    totalSpent: number
  }>
}

interface PaymentSummaryAnalytics {
  totalRevenue: number
  totalTransactions: number
  averageTransactionValue: number
  currency: string
  successRate: number
  refundRate: number
  topPaymentMethods: Array<{
    type: string
    count: number
    percentage: number
  }>
}

interface SubscriptionMetrics {
  activeSubscriptions: number
  newSubscriptions: number
  canceledSubscriptions: number
  churnRate: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  lifetimeValue: number
}

interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  topCustomers: Array<{
    customerId: string
    email?: string
    totalSpent: number
    orderCount: number
    lifetimeValue: number
  }>
}

interface AnalyticsResponse {
  type: string
  dateRange: {
    start: string
    end: string
  }
  data: PromoUsageAnalytics | PaymentSummaryAnalytics | SubscriptionMetrics | CustomerAnalytics
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

// Validate environment variables
const envValidation = validateStripeEnvironment()
if (!envValidation.isValid) {
  console.error('Missing required environment variables:', envValidation.missingVars)
}

// Initialize Stripe with secret key from environment
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

// Circuit breaker for Stripe API calls (more lenient for analytics)
const stripeCircuitBreaker = new CircuitBreaker(10, 120000) // 10 failures, 2 minute timeout

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
    // Parse and validate request body
    const requestData: AnalyticsRequest = await req.json()

    // Validate required fields
    if (!requestData.type) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'type is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Set default date range (last 30 days)
    const endDate = requestData.endDate ? new Date(requestData.endDate) : new Date()
    const startDate = requestData.startDate ? new Date(requestData.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Validate date range
    if (startDate >= endDate) {
      return new Response(
        JSON.stringify({
          error: 'Invalid date range',
          details: 'startDate must be before endDate'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    let analyticsData: PromoUsageAnalytics | PaymentSummaryAnalytics | SubscriptionMetrics | CustomerAnalytics

    switch (requestData.type) {
      case 'promo_usage':
        analyticsData = await getPromoUsageAnalytics(startDate, endDate, requestData.promoCode, requestData.limit)
        break
      case 'payment_summary':
        analyticsData = await getPaymentSummaryAnalytics(startDate, endDate)
        break
      case 'subscription_metrics':
        analyticsData = await getSubscriptionMetrics(startDate, endDate)
        break
      case 'customer_analytics':
        analyticsData = await getCustomerAnalytics(startDate, endDate, requestData.limit)
        break
      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid analytics type',
            details: 'type must be one of: promo_usage, payment_summary, subscription_metrics, customer_analytics'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
    }

    // Return successful response
    const responseData: AnalyticsResponse = {
      type: requestData.type,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      data: analyticsData,
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Analytics error:', error)

    // Send admin notification for analytics failures
    if (error instanceof Stripe.errors.StripeRateLimitError) {
      await notifyRateLimitExceeded('payment_analytics', error.headers?.['x-ratelimit-reset-after'])
    } else if (error instanceof Stripe.errors.StripeError &&
               ['authentication_error', 'api_error'].includes(error.type)) {
      await notifyCriticalError(
        'payment_analytics',
        error.message,
        {
          errorType: error.type,
          errorCode: error.code,
          requestData: {
            type: requestData.type,
            startDate: requestData.startDate,
            endDate: requestData.endDate
          }
        }
      )
    }

    // Return standardized error response
    return createErrorResponse(error, 'payment_analytics', corsHeaders)
  }
})

/**
 * Get promotional code usage analytics
 */
async function getPromoUsageAnalytics(
  startDate: Date,
  endDate: Date,
  promoCode?: string,
  limit: number = 10
): Promise<PromoUsageAnalytics> {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  // Get all coupons if no specific promo code is provided
  let coupons: Stripe.Coupon[] = []

  if (promoCode) {
    try {
      const coupon = await retryRateLimitedCall(
        () => stripe.coupons.retrieve(promoCode),
        'retrieve_coupon_analytics',
        { promoCode }
      )
      coupons = [coupon]
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        // Return empty analytics for non-existent promo code
        return {
          promoCode: promoCode,
          totalRedemptions: 0,
          totalDiscountAmount: 0,
          currency: 'usd',
          averageOrderValue: 0,
          conversionRate: 0,
          revenueImpact: 0,
          topCustomers: [],
        }
      }
      throw error
    }
  } else {
    const couponList = await retryRateLimitedCall(
      () => stripe.coupons.list({ limit: 100 }),
      'list_coupons_analytics'
    )
    coupons = couponList.data
  }

  // Aggregate analytics for all relevant coupons
  let totalRedemptions = 0
  let totalDiscountAmount = 0
  let totalRevenue = 0
  const customerUsage = new Map<string, { email?: string, redemptions: number, totalSpent: number }>()

  for (const coupon of coupons) {
    // Get invoices that used this coupon with retry logic
    const invoices = await retryRateLimitedCall(
      () => stripe.invoices.list({
        created: {
          gte: startTimestamp,
          lte: endTimestamp,
        },
        limit: 100,
      }),
      'list_invoices_analytics',
      { couponId: coupon.id }
    )

    for (const invoice of invoices.data) {
      if (invoice.discount && invoice.discount.coupon.id === coupon.id) {
        totalRedemptions++

        // Calculate discount amount
        const discountAmount = invoice.discount.coupon.amount_off ||
          Math.round((invoice.total * (invoice.discount.coupon.percent_off || 0)) / 100)

        totalDiscountAmount += discountAmount
        totalRevenue += invoice.total

        // Track customer usage
        const customerId = invoice.customer as string
        if (customerId) {
          const existing = customerUsage.get(customerId) || { redemptions: 0, totalSpent: 0 }
          existing.redemptions++
          existing.totalSpent += invoice.total
          customerUsage.set(customerId, existing)
        }
      }
    }

    // Also check checkout sessions for more recent data
    const sessions = await stripe.checkout.sessions.list({
      created: {
        gte: startTimestamp,
        lte: endTimestamp,
      },
      limit: 100,
    })

    for (const session of sessions.data) {
      if (session.total_details?.breakdown?.discounts) {
        for (const discount of session.total_details.breakdown.discounts) {
          if (discount.discount.coupon?.id === coupon.id) {
            totalRedemptions++
            totalDiscountAmount += discount.amount
            totalRevenue += session.amount_total || 0

            // Track customer usage
            const customerId = session.customer as string
            if (customerId) {
              const existing = customerUsage.get(customerId) || { redemptions: 0, totalSpent: 0 }
              existing.redemptions++
              existing.totalSpent += session.amount_total || 0
              customerUsage.set(customerId, existing)
            }
          }
        }
      }
    }
  }

  // Get customer details for top customers
  const topCustomers = Array.from(customerUsage.entries())
    .sort(([, a], [, b]) => b.totalSpent - a.totalSpent)
    .slice(0, limit)

  const topCustomersWithDetails = await Promise.all(
    topCustomers.map(async ([customerId, usage]) => {
      try {
        const customer = await stripe.customers.retrieve(customerId)
        return {
          customerId,
          email: typeof customer !== 'string' ? customer.email || undefined : undefined,
          redemptions: usage.redemptions,
          totalSpent: usage.totalSpent,
        }
      } catch {
        return {
          customerId,
          redemptions: usage.redemptions,
          totalSpent: usage.totalSpent,
        }
      }
    })
  )

  // Calculate metrics
  const averageOrderValue = totalRedemptions > 0 ? Math.round(totalRevenue / totalRedemptions) : 0
  const revenueImpact = totalRevenue - totalDiscountAmount

  return {
    promoCode: promoCode || 'ALL_CODES',
    totalRedemptions,
    totalDiscountAmount,
    currency: 'usd', // Default currency, could be made configurable
    averageOrderValue,
    conversionRate: 0, // Would need additional data to calculate properly
    revenueImpact,
    topCustomers: topCustomersWithDetails,
  }
}

/**
 * Get payment summary analytics
 */
async function getPaymentSummaryAnalytics(startDate: Date, endDate: Date): Promise<PaymentSummaryAnalytics> {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  // Get payment intents for the date range
  const paymentIntents = await stripe.paymentIntents.list({
    created: {
      gte: startTimestamp,
      lte: endTimestamp,
    },
    limit: 100,
  })

  let totalRevenue = 0
  let totalTransactions = 0
  let successfulTransactions = 0
  let refundedAmount = 0
  const paymentMethodCounts = new Map<string, number>()

  for (const paymentIntent of paymentIntents.data) {
    totalTransactions++

    if (paymentIntent.status === 'succeeded') {
      successfulTransactions++
      totalRevenue += paymentIntent.amount
    }

    // Track payment methods
    if (paymentIntent.charges.data.length > 0) {
      const charge = paymentIntent.charges.data[0]
      const paymentMethod = charge.payment_method_details?.type || 'unknown'
      paymentMethodCounts.set(paymentMethod, (paymentMethodCounts.get(paymentMethod) || 0) + 1)
    }

    // Calculate refunded amount
    refundedAmount += paymentIntent.amount - (paymentIntent.amount_received || 0)
  }

  // Calculate metrics
  const averageTransactionValue = successfulTransactions > 0 ? Math.round(totalRevenue / successfulTransactions) : 0
  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0
  const refundRate = totalRevenue > 0 ? (refundedAmount / totalRevenue) * 100 : 0

  // Top payment methods
  const topPaymentMethods = Array.from(paymentMethodCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalTransactions > 0 ? Math.round((count / totalTransactions) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    totalRevenue,
    totalTransactions,
    averageTransactionValue,
    currency: 'usd',
    successRate: Math.round(successRate * 100) / 100,
    refundRate: Math.round(refundRate * 100) / 100,
    topPaymentMethods,
  }
}

/**
 * Get subscription metrics
 */
async function getSubscriptionMetrics(startDate: Date, endDate: Date): Promise<SubscriptionMetrics> {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  // Get all subscriptions
  const subscriptions = await stripe.subscriptions.list({
    created: {
      gte: startTimestamp,
      lte: endTimestamp,
    },
    limit: 100,
  })

  let activeSubscriptions = 0
  let newSubscriptions = 0
  let canceledSubscriptions = 0
  let monthlyRecurringRevenue = 0

  for (const subscription of subscriptions.data) {
    newSubscriptions++

    if (subscription.status === 'active') {
      activeSubscriptions++

      // Calculate MRR (convert to monthly if needed)
      for (const item of subscription.items.data) {
        const price = item.price
        let monthlyAmount = price.unit_amount || 0

        // Convert to monthly amount based on interval
        if (price.recurring?.interval === 'year') {
          monthlyAmount = Math.round(monthlyAmount / 12)
        } else if (price.recurring?.interval === 'week') {
          monthlyAmount = monthlyAmount * 4
        } else if (price.recurring?.interval === 'day') {
          monthlyAmount = monthlyAmount * 30
        }

        monthlyRecurringRevenue += monthlyAmount * item.quantity
      }
    }

    if (subscription.status === 'canceled' || subscription.canceled_at) {
      canceledSubscriptions++
    }
  }

  // Calculate churn rate
  const totalSubscriptions = activeSubscriptions + canceledSubscriptions
  const churnRate = totalSubscriptions > 0 ? (canceledSubscriptions / totalSubscriptions) * 100 : 0

  // Calculate ARPU (Average Revenue Per User)
  const averageRevenuePerUser = activeSubscriptions > 0 ? Math.round(monthlyRecurringRevenue / activeSubscriptions) : 0

  // Estimate LTV (simplified calculation: ARPU * 12 / churn rate)
  const lifetimeValue = churnRate > 0 ? Math.round((averageRevenuePerUser * 12) / (churnRate / 100)) : averageRevenuePerUser * 12

  return {
    activeSubscriptions,
    newSubscriptions,
    canceledSubscriptions,
    churnRate: Math.round(churnRate * 100) / 100,
    monthlyRecurringRevenue,
    averageRevenuePerUser,
    lifetimeValue,
  }
}

/**
 * Get customer analytics
 */
async function getCustomerAnalytics(startDate: Date, endDate: Date, limit: number = 10): Promise<CustomerAnalytics> {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  // Get customers created in the date range
  const customers = await stripe.customers.list({
    created: {
      gte: startTimestamp,
      lte: endTimestamp,
    },
    limit: 100,
  })

  const newCustomers = customers.data.length

  // Get all customers to calculate returning customers
  const allCustomers = await stripe.customers.list({ limit: 100 })
  const totalCustomers = allCustomers.data.length
  const returningCustomers = totalCustomers - newCustomers

  // Calculate top customers by spending
  const customerSpending = new Map<string, { email?: string, totalSpent: number, orderCount: number }>()

  // Get payment intents to calculate customer spending
  const paymentIntents = await stripe.paymentIntents.list({
    created: {
      gte: startTimestamp,
      lte: endTimestamp,
    },
    limit: 100,
  })

  for (const paymentIntent of paymentIntents.data) {
    if (paymentIntent.status === 'succeeded' && paymentIntent.customer) {
      const customerId = paymentIntent.customer as string
      const existing = customerSpending.get(customerId) || { totalSpent: 0, orderCount: 0 }
      existing.totalSpent += paymentIntent.amount
      existing.orderCount++
      customerSpending.set(customerId, existing)
    }
  }

  // Get top customers with details
  const topCustomerIds = Array.from(customerSpending.entries())
    .sort(([, a], [, b]) => b.totalSpent - a.totalSpent)
    .slice(0, limit)

  const topCustomers = await Promise.all(
    topCustomerIds.map(async ([customerId, spending]) => {
      try {
        const customer = await stripe.customers.retrieve(customerId)
        return {
          customerId,
          email: typeof customer !== 'string' ? customer.email || undefined : undefined,
          totalSpent: spending.totalSpent,
          orderCount: spending.orderCount,
          lifetimeValue: spending.totalSpent, // Simplified LTV calculation
        }
      } catch {
        return {
          customerId,
          totalSpent: spending.totalSpent,
          orderCount: spending.orderCount,
          lifetimeValue: spending.totalSpent,
        }
      }
    })
  )

  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    topCustomers,
  }
}

