
/**
 * Payment-related TypeScript type definitions
 */

// Stripe Configuration Types
export interface StripeConfig {
  publishableKey: string
  currency: string
  features: string[]
  collectBillingAddress: boolean
  collectShippingAddress: boolean
  allowPromotionCodes: boolean
}

// Payment Plan Types
export interface PaymentPlan {
  id: string
  name: string
  description: string
  price: number // Price in cents
  interval: 'month' | 'year' | 'week' | 'day'
  intervalCount?: number // Default: 1
  trialDays: number
  features: string[]
  popular?: boolean
  metadata?: Record<string, string>
}

// Enhanced Subscription Plan Types for Management
export interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price: number // Price in cents
  currency: string
  interval: 'month' | 'year'
  intervalCount: number
  trialPeriodDays?: number
  features: string[]
  popular?: boolean
  stripePriceId: string
  stripeProductId?: string
  metadata?: Record<string, string>
  active: boolean
  tier: number // For upgrade/downgrade logic
}

// Customer Types
export interface Customer {
  id: string
  userId: string
  stripeCustomerId: string
  email: string
  name?: string
  phone?: string
  address?: CustomerAddress
  createdAt: string
  updatedAt: string
}

export interface CustomerAddress {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
}

// Subscription Types
export interface Subscription {
  id: string
  customerId: string
  stripeSubscriptionId: string
  planId: string
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  trialStart?: string
  trialEnd?: string
  canceledAt?: string
  cancelAtPeriodEnd: boolean
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Enhanced User Subscription for Management
export interface UserSubscription {
  id: string
  userId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  planId: string
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt?: Date
  trialStart?: Date
  trialEnd?: Date
  createdAt: Date
  updatedAt: Date
  plan?: SubscriptionPlan
}

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'

// Payment Types
export interface Payment {
  id: string
  customerId: string
  stripePaymentIntentId: string
  amount: number // Amount in cents
  currency: string
  status: PaymentStatus
  description?: string
  receiptEmail?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export type PaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded'
  | 'pending'
  | 'failed'

// Payment history items returned from billing history APIs
export interface PaymentHistory {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  description?: string
  stripe_payment_intent_id?: string
  created_at: string
  customer_id?: string
}

// Simplified payment error response
export interface PaymentError {
  message: string
  code?: string
}

// Invoice Types
export interface Invoice {
  id: string
  customerId: string
  subscriptionId?: string
  stripeInvoiceId: string
  amountPaid: number // Amount in cents
  amountDue: number // Amount in cents
  currency: string
  status: InvoiceStatus
  description?: string
  invoicePdf?: string
  hostedInvoiceUrl?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void'

// Promo Code Types
export interface PromoCode {
  id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number // Percentage (0-100) or amount in cents
  currency?: string // Required for fixed amount discounts
  valid: boolean
  expiresAt?: string
  maxRedemptions?: number
  timesRedeemed?: number
  metadata?: Record<string, any>
  error?: string
}

// Checkout Types
export interface CheckoutItem {
  id: string
  name: string
  description: string
  price: number // Price in cents
  quantity: number
  metadata?: Record<string, any>
}

export interface CheckoutSession {
  id: string
  sessionId: string
  customerId?: string
  amount: number // Total amount in cents
  currency: string
  status: CheckoutSessionStatus
  paymentStatus: PaymentStatus
  items: CheckoutItem[]
  metadata?: Record<string, any>
  successUrl: string
  cancelUrl: string
  createdAt: string
  expiresAt: string
}

export type CheckoutSessionStatus =
  | 'open'
  | 'complete'
  | 'expired'

// API Request/Response Types
export interface CreateCheckoutSessionRequest {
  amount: number
  currency?: string
  description?: string
  metadata?: Record<string, string>
  success_url?: string
  cancel_url?: string
  customer_email?: string
  allow_promotion_codes?: boolean
  collect_billing_address?: boolean
  collect_shipping_address?: boolean
}

export interface CreateCheckoutSessionResponse {
  sessionId: string
  url: string
}

export interface CreateSubscriptionRequest {
  plan_id: string
  trial_days?: number
  success_url?: string
  cancel_url?: string
  customer_email?: string
  allow_promotion_codes?: boolean
  collect_billing_address?: boolean
}

export interface CreateSubscriptionResponse {
  sessionId: string
  url: string
  subscriptionId?: string
}

export interface ValidatePromoCodeRequest {
  code: string
}

export interface ValidatePromoCodeResponse {
  valid: boolean
  id?: string
  code?: string
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  currency?: string
  error?: string
}

export interface CreateCustomerPortalRequest {
  customer_id: string
  return_url?: string
}

export interface CreateCustomerPortalResponse {
  url: string
}

export interface CancelSubscriptionRequest {
  subscription_id: string
  cancel_at_period_end?: boolean
}

export interface CancelSubscriptionResponse {
  subscription: Subscription
  canceled_at?: string
}

// Subscription Management Service Types
export interface CreateSubscriptionParams {
  planId: string
  userId: string
  customerId?: string
  trialPeriodDays?: number
  promoCode?: string
  metadata?: Record<string, string>
}

export interface UpdateSubscriptionParams {
  planId?: string
  cancelAtPeriodEnd?: boolean
  promoCode?: string
  metadata?: Record<string, string>
}

export interface SubscriptionChangeRequest {
  subscriptionId: string
  newPlanId: string
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'
  billingCycleAnchor?: 'now' | 'unchanged'
}

export interface SubscriptionChangeResponse {
  subscription: UserSubscription
  prorationAmount?: number
  effectiveDate: string
  changeType: 'upgrade' | 'downgrade' | 'lateral'
}

// Service Interfaces
export interface SubscriptionService {
  getAvailablePlans(): Promise<SubscriptionPlan[]>
  getCurrentSubscription(userId: string): Promise<UserSubscription | null>
  createSubscription(params: CreateSubscriptionParams): Promise<UserSubscription>
  updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<UserSubscription>
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<void>
  reactivateSubscription(subscriptionId: string): Promise<UserSubscription>
  createCustomerPortalSession(customerId: string, returnUrl?: string): Promise<{ url: string }>
}

export interface StripeIntegrationService {
  createCheckoutSession(params: CheckoutSessionParams): Promise<{ sessionId: string, url: string }>
  retrieveSubscription(subscriptionId: string): Promise<any>
  updateSubscription(subscriptionId: string, params: any): Promise<any>
  createCustomerPortal(customerId: string, returnUrl: string): Promise<{ url: string }>
  validatePromoCode(code: string): Promise<PromoCodeValidation>
}

export interface CheckoutSessionParams {
  mode: 'payment' | 'subscription'
  lineItems: Array<{
    price: string
    quantity: number
  }>
  customerId?: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  allowPromotionCodes?: boolean
  metadata?: Record<string, string>
}

export interface PromoCodeValidation {
  valid: boolean
  code?: string
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  currency?: string
  error?: string
}

// Webhook Event Types
export interface WebhookEvent {
  id: string
  type: WebhookEventType
  data: {
    object: any
    previous_attributes?: any
  }
  created: number
  livemode: boolean
  pending_webhooks: number
  request?: {
    id: string
    idempotency_key?: string
  }
}

export type WebhookEventType =
  // Payment events
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'payment_intent.requires_action'

  // Subscription events
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'

  // Invoice events
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.payment_action_required'

  // Customer events
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'

  // Checkout events
  | 'checkout.session.completed'
  | 'checkout.session.expired'

// Error Types
export interface StripeError {
  type: 'card_error' | 'validation_error' | 'api_error' | 'authentication_error' | 'rate_limit_error'
  code?: string
  message: string
  param?: string
  decline_code?: string
}

// Utility Types
export interface PaginationParams {
  limit?: number
  starting_after?: string
  ending_before?: string
}

export interface DateRangeFilter {
  gte?: string // ISO date string
  lte?: string // ISO date string
}

export interface PaymentHistoryFilter {
  status?: PaymentStatus
  date_range?: DateRangeFilter
  customer_id?: string
}

export interface SubscriptionHistoryFilter {
  status?: SubscriptionStatus
  date_range?: DateRangeFilter
  customer_id?: string
}

// Component Props Types
export interface CheckoutButtonProps {
  priceId?: string
  priceLookupKey?: string
  amount?: number
  currency?: string
  description?: string
  metadata?: Record<string, string>
  className?: string
  children?: React.ReactNode
  onSuccess?: () => void
  onError?: (error: string) => void
  disabled?: boolean
}

export interface SubscriptionPlanProps {
  planId: string
  name: string
  description: string
  price: number
  interval: 'month' | 'year'
  trialDays?: number
  features: string[]
  popular?: boolean
  className?: string
  onSubscribe?: (planId: string) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export interface PaymentHistoryProps {
  className?: string
  limit?: number
  showFilters?: boolean
  customerId?: string
  showPagination?: boolean
}

export interface PromoCodeInputProps {
  onCodeApplied?: (promoCode: PromoCode) => void
  onCodeRemoved?: () => void
  className?: string
  placeholder?: string
  disabled?: boolean
  appliedCode?: PromoCode | null
}

// Subscription Management Component Props
export interface SubscriptionPlansViewProps {
  plans: SubscriptionPlan[]
  currentPlan?: string
  onPlanSelect: (planId: string) => void
  loading?: boolean
  className?: string
}

export interface BillingDashboardProps {
  subscription?: UserSubscription
  customer?: Customer
  onManageBilling: () => void
  onCancelSubscription: (subscriptionId: string) => void
  className?: string
}

export interface SubscriptionManagerProps {
  userId: string
  stripeCustomerId?: string
  onSubscriptionChange: (subscription: UserSubscription) => void
  onError: (error: Error) => void
}

export interface SubscriptionCancellationProps {
  subscription: UserSubscription
  onCancel: (subscriptionId: string, cancelAtPeriodEnd: boolean) => void
  onClose: () => void
  loading?: boolean
}

export interface PlanComparisonProps {
  plans: SubscriptionPlan[]
  currentPlanId?: string
  onSelectPlan: (planId: string) => void
  className?: string
}

// Database Table Types (matching Supabase schema)
export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
        Update: Partial<Omit<Customer, 'id' | 'createdAt'>>
      }
      subscriptions: {
        Row: Subscription
        Insert: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
        Update: Partial<Omit<Subscription, 'id' | 'createdAt'>>
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>
        Update: Partial<Omit<Payment, 'id' | 'createdAt'>>
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
        Update: Partial<Omit<Invoice, 'id' | 'createdAt'>>
      }
    }
  }
}

// Analytics and reporting types
export interface PromoCodeUsageEvent {
  id: string
  promo_code: string
  customer_id?: string
  order_value: number
  discount_amount: number
  currency: string
  timestamp: string
  session_id?: string
  subscription_id?: string
}

export interface PromoCodeAnalytics {
  code: string
  total_redemptions: number
  total_discount_amount: number
  total_revenue_impact: number
  average_order_value: number
  conversion_rate: number
  top_customers: Array<{
    customer_id: string
    email?: string
    redemptions: number
    total_spent: number
  }>
  usage_over_time: Array<{
    date: string
    redemptions: number
    discount_amount: number
  }>
}

export interface AnalyticsDateRange {
  start_date: string
  end_date: string
}

export interface AnalyticsFilters {
  promo_code?: string
  customer_id?: string
  currency?: string
  min_order_value?: number
  max_order_value?: number
}
