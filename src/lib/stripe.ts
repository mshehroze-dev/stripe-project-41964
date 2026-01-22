
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { supabase } from './supabase'

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

//if (!STRIPE_PUBLISHABLE_KEY) {
//  throw new Error('Missing Stripe publishable key. Please set VITE_STRIPE_PUBLISHABLE_KEY in your environment variables.')
//}

// Stripe instance (singleton)
let stripePromise: Promise<Stripe | null>

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

/**
 * Get the Stripe instance
 * This function ensures we only load Stripe once and reuse the instance
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

/**
 * Stripe configuration object
 */
export const stripeConfig = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  currency: 'usd',
  features: ["checkout", "subscriptions"],
  collectBillingAddress: true,
  collectShippingAddress: false,
  allowPromotionCodes: true,
} as const

/**
 * Create a checkout session for one-time payments
 */
export interface CreateCheckoutSessionParams {
  amount: number
  currency?: string
  description?: string
  metadata?: Record<string, string>
  successUrl?: string
  cancelUrl?: string
  customerEmail?: string
  allowPromotionCodes?: boolean
  collectBillingAddress?: boolean
  collectShippingAddress?: boolean
}

export const createCheckoutSession = async (params: CreateCheckoutSessionParams) => {
  const {
    amount,
    currency = stripeConfig.currency,
    description = 'Payment',
    metadata = {},
    successUrl = `${window.location.origin}/payment/success`,
    cancelUrl = `${window.location.origin}/payment/cancel`,
    customerEmail,
    allowPromotionCodes = stripeConfig.allowPromotionCodes,
    collectBillingAddress = stripeConfig.collectBillingAddress,
    collectShippingAddress = stripeConfig.collectShippingAddress,
  } = params

  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('create-checkout-session', {
    body: {
      amount,
      currency,
      description,
      metadata,
      successUrl,
      cancelUrl,
      customerEmail,
      allowPromotionCodes,
      collectBillingAddress,
      collectShippingAddress,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
/**
 * Create a subscription checkout session
 */
export interface CreateSubscriptionParams {
  planId?: string
  priceLookupKey?: string
  trialDays?: number
  successUrl?: string
  cancelUrl?: string
  customerEmail?: string
  allowPromotionCodes?: boolean
  collectBillingAddress?: boolean
  promoCode?: string
}

export const createSubscription = async (params: CreateSubscriptionParams) => {
  const {
    planId,
    priceLookupKey,
    trialDays = 0,
    successUrl = `${window.location.origin}/success?type=subscription`,
    cancelUrl = `${window.location.origin}/cancel`,
    customerEmail,
    allowPromotionCodes,
    collectBillingAddress,
    promoCode,
  } = params

  const client = requireSupabase()
  if (!planId && !priceLookupKey) {
    throw new Error('Missing subscription price configuration')
  }

  const body: Record<string, any> = {
    trialDays,
    successUrl,
    cancelUrl,
    customerEmail,
    allowPromotionCodes,
    collectBillingAddress,
    promoCode,
  }

  if (planId) {
    body.priceId = planId
  }

  if (priceLookupKey) {
    body.priceLookupKey = priceLookupKey
  }

  const { data, error } = await client.functions.invoke('create-subscription', {
    body,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Validate a promo code
 */
export interface ValidatePromoCodeParams {
  code: string
}

export const validatePromoCode = async (params: ValidatePromoCodeParams) => {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('validate-promo-code', {
    body: params,
  })

  if (error) {
    throw new Error(error.message || 'Failed to validate promo code')
  }

  return data
}
/**
 * Get payment session details
 */
export const getPaymentSession = async (sessionId: string) => {
  const response = await fetch(`/api/payment-session/${sessionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to get payment session')
  }

  return response.json()
}

/**
 * Create customer portal session
 */
export interface CreateCustomerPortalParams {
  customerId: string
  returnUrl?: string
}

export const createCustomerPortal = async (params: CreateCustomerPortalParams) => {
  const {
    customerId,
    returnUrl = window.location.href,
  } = params

  // For development, return a mock portal URL
  console.log('Creating customer portal for:', customerId)
  console.log('Return URL:', returnUrl)

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Return mock portal URL
  const mockPortalUrl = `https://billing.stripe.com/session/mock_${Math.random().toString(36).substring(7)}`
  console.log('Mock portal URL generated:', mockPortalUrl)

  return { url: mockPortalUrl }
}

/**
 * Cancel subscription
 */
export interface CancelSubscriptionParams {
  subscriptionId: string
  cancelAtPeriodEnd?: boolean
}

export const cancelSubscription = async (params: CancelSubscriptionParams) => {
  const {
    subscriptionId,
    cancelAtPeriodEnd = true,
  } = params

  const response = await fetch('/api/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription_id: subscriptionId,
      cancel_at_period_end: cancelAtPeriodEnd,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to cancel subscription')
  }

  return response.json()
}
/**
 * Get available subscription plans
 */
export const getAvailablePlans = async () => {
  const response = await fetch('/api/subscription-plans', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to get subscription plans')
  }

  return response.json()
}

/**
 * Get current user subscription
 */
export const getCurrentSubscription = async (userId: string) => {
  const response = await fetch(`/api/subscription/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to get current subscription')
  }

  return response.json()
}

/**
 * Update subscription plan
 */
export interface UpdateSubscriptionParams {
  subscriptionId: string
  newPlanId: string
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
}

export const updateSubscription = async (params: UpdateSubscriptionParams) => {
  const response = await fetch('/api/update-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to update subscription')
  }

  return response.json()
}

/**
 * Reactivate canceled subscription
 */
export const reactivateSubscription = async (subscriptionId: string) => {
  const response = await fetch('/api/reactivate-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription_id: subscriptionId,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to reactivate subscription')
  }

  return response.json()
}
/**
 * Get subscription invoices
 */
export const getSubscriptionInvoices = async (customerId: string, limit: number = 10) => {
  const response = await fetch(`/api/invoices/${customerId}?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to get invoices')
  }

  return response.json()
}

/**
 * Redirect to Stripe Checkout
 */
export const redirectToCheckout = async (sessionId: string) => {
  const stripe = await getStripe()

  if (!stripe) {
    throw new Error('Failed to load Stripe')
  }

  const { error } = await stripe.redirectToCheckout({ sessionId })

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Format currency amount for display
 */
export const formatAmount = (amount: number, currency: string = stripeConfig.currency) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

/**
 * Validate amount (must be positive and within Stripe limits)
 */
export const validateAmount = (amount: number, currency: string = stripeConfig.currency) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  // Stripe minimum amounts by currency
  const minimums: Record<string, number> = {
    usd: 50, // $0.50
    eur: 50, // €0.50
    gbp: 30, // £0.30
    cad: 50, // CA$0.50
    aud: 50, // A$0.50
  }

  const minimum = minimums[currency.toLowerCase()] || 50

  if (amount < minimum) {
    throw new Error(`Amount must be at least ${formatAmount(minimum, currency)}`)
  }

  // Stripe maximum amount (adjust as needed)
  const maximum = 99999999 // $999,999.99

  if (amount > maximum) {
    throw new Error(`Amount cannot exceed ${formatAmount(maximum, currency)}`)
  }

  return true
}
/**
 * Error handling utility for Stripe operations
 */
export const handleStripeError = (error: any): string => {
  if (error?.type === 'card_error') {
    return error.message || 'Your card was declined'
  }

  if (error?.type === 'validation_error') {
    return error.message || 'Invalid payment information'
  }

  if (error?.type === 'api_error') {
    return 'Payment processing error. Please try again.'
  }

  if (error?.type === 'authentication_error') {
    return 'Authentication error. Please contact support.'
  }

  if (error?.type === 'rate_limit_error') {
    return 'Too many requests. Please try again in a moment.'
  }

  return error?.message || 'An unexpected error occurred'
}

/**
 * Analytics and reporting functions
 */
export interface AnalyticsRequest {
  type: 'promo_usage' | 'payment_summary' | 'subscription_metrics' | 'customer_analytics'
  startDate?: string
  endDate?: string
  promoCode?: string
  limit?: number
}

export interface PromoUsageAnalytics {
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

export interface PaymentSummaryAnalytics {
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

export interface SubscriptionMetrics {
  activeSubscriptions: number
  newSubscriptions: number
  canceledSubscriptions: number
  churnRate: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  lifetimeValue: number
}

export interface CustomerAnalytics {
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

export interface AnalyticsResponse {
  type: string
  dateRange: {
    start: string
    end: string
  }
  data: PromoUsageAnalytics | PaymentSummaryAnalytics | SubscriptionMetrics | CustomerAnalytics
}
/**
 * Get promotional code usage analytics
 */
export const getPromoUsageAnalytics = async (params: {
  startDate?: string
  endDate?: string
  promoCode?: string
  limit?: number
}): Promise<AnalyticsResponse> => {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('payment-analytics', {
    body: {
      type: 'promo_usage',
      ...params,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to get promo usage analytics')
  }

  return data
}

/**
 * Get payment summary analytics
 */
export const getPaymentSummaryAnalytics = async (params: {
  startDate?: string
  endDate?: string
}): Promise<AnalyticsResponse> => {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('payment-analytics', {
    body: {
      type: 'payment_summary',
      ...params,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to get payment summary analytics')
  }

  return data
}

/**
 * Get subscription metrics
 */
export const getSubscriptionMetrics = async (params: {
  startDate?: string
  endDate?: string
}): Promise<AnalyticsResponse> => {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('payment-analytics', {
    body: {
      type: 'subscription_metrics',
      ...params,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to get subscription metrics')
  }

  return data
}
/**
 * Get customer analytics
 */
export const getCustomerAnalytics = async (params: {
  startDate?: string
  endDate?: string
  limit?: number
}): Promise<AnalyticsResponse> => {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('payment-analytics', {
    body: {
      type: 'customer_analytics',
      ...params,
    },
  })

  if (error) {
    throw new Error(error.message || 'Failed to get customer analytics')
  }

  return data
}

/**
 * Track promo code usage (for internal tracking)
 */
export const trackPromoCodeUsage = async (params: {
  promoCode: string
  customerId?: string
  orderValue: number
  discountAmount: number
  currency?: string
}): Promise<void> => {
  // This would typically be called after a successful checkout
  // to track promo code usage for analytics purposes
  try {
    const client = requireSupabase()
    await client.functions.invoke('track-promo-usage', {
      body: {
        promo_code: params.promoCode,
        customer_id: params.customerId,
        order_value: params.orderValue,
        discount_amount: params.discountAmount,
        currency: params.currency || 'usd',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Don't throw errors for tracking failures
    console.warn('Failed to track promo code usage:', error)
  }
}
