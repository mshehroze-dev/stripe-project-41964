
/**
 * Subscription management validation utilities
 */

import { SubscriptionPlan, UserSubscription, SubscriptionStatus } from './payment-types'

// Subscription Status Enums and Utilities
export const SUBSCRIPTION_STATUSES = {
  INCOMPLETE: 'incomplete' as const,
  INCOMPLETE_EXPIRED: 'incomplete_expired' as const,
  TRIALING: 'trialing' as const,
  ACTIVE: 'active' as const,
  PAST_DUE: 'past_due' as const,
  CANCELED: 'canceled' as const,
  UNPAID: 'unpaid' as const,
} as const

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SUBSCRIPTION_STATUSES.TRIALING,
  SUBSCRIPTION_STATUSES.ACTIVE,
  SUBSCRIPTION_STATUSES.PAST_DUE,
]

export const INACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SUBSCRIPTION_STATUSES.INCOMPLETE,
  SUBSCRIPTION_STATUSES.INCOMPLETE_EXPIRED,
  SUBSCRIPTION_STATUSES.CANCELED,
  SUBSCRIPTION_STATUSES.UNPAID,
]

// Validation Functions
export const isActiveSubscription = (subscription: UserSubscription): boolean => {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)
}

export const isCanceledSubscription = (subscription: UserSubscription): boolean => {
  return subscription.status === SUBSCRIPTION_STATUSES.CANCELED
}

export const isTrialSubscription = (subscription: UserSubscription): boolean => {
  return subscription.status === SUBSCRIPTION_STATUSES.TRIALING
}

export const isPastDueSubscription = (subscription: UserSubscription): boolean => {
  return subscription.status === SUBSCRIPTION_STATUSES.PAST_DUE
}

export const canCancelSubscription = (subscription: UserSubscription): boolean => {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) && !subscription.cancelAtPeriodEnd
}

export const canReactivateSubscription = (subscription: UserSubscription): boolean => {
  return subscription.status === SUBSCRIPTION_STATUSES.CANCELED && subscription.cancelAtPeriodEnd
}

export const isSubscriptionExpired = (subscription: UserSubscription): boolean => {
  const now = new Date()
  return subscription.currentPeriodEnd < now && !isActiveSubscription(subscription)
}

export const getSubscriptionTimeRemaining = (subscription: UserSubscription): number => {
  const now = new Date()
  const endDate = new Date(subscription.currentPeriodEnd)
  return Math.max(0, endDate.getTime() - now.getTime())
}

export const getDaysUntilRenewal = (subscription: UserSubscription): number => {
  const timeRemaining = getSubscriptionTimeRemaining(subscription)
  return Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))
}

// Plan Comparison Utilities
export const isUpgrade = (currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean => {
  return newPlan.tier > currentPlan.tier
}

export const isDowngrade = (currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean => {
  return newPlan.tier < currentPlan.tier
}

export const isLateralMove = (currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean => {
  return newPlan.tier === currentPlan.tier && newPlan.id !== currentPlan.id
}

export const getChangeType = (currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): 'upgrade' | 'downgrade' | 'lateral' => {
  if (isUpgrade(currentPlan, newPlan)) return 'upgrade'
  if (isDowngrade(currentPlan, newPlan)) return 'downgrade'
  return 'lateral'
}

// Plan Validation
export const validatePlanChange = (
  currentSubscription: UserSubscription,
  newPlan: SubscriptionPlan
): { valid: boolean; error?: string } => {
  if (!isActiveSubscription(currentSubscription)) {
    return { valid: false, error: 'Cannot change plan for inactive subscription' }
  }

  if (currentSubscription.planId === newPlan.id) {
    return { valid: false, error: 'Cannot change to the same plan' }
  }

  if (!newPlan.active) {
    return { valid: false, error: 'Selected plan is not available' }
  }

  return { valid: true }
}

// Subscription Display Utilities
export const formatSubscriptionStatus = (status: SubscriptionStatus): string => {
  const statusMap: Record<SubscriptionStatus, string> = {
    incomplete: 'Incomplete',
    incomplete_expired: 'Incomplete (Expired)',
    trialing: 'Trial',
    active: 'Active',
    past_due: 'Past Due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
  }
  return statusMap[status] || status
}

export const getSubscriptionStatusColor = (status: SubscriptionStatus): string => {
  const colorMap: Record<SubscriptionStatus, string> = {
    incomplete: 'text-yellow-600',
    incomplete_expired: 'text-red-600',
    trialing: 'text-blue-600',
    active: 'text-green-600',
    past_due: 'text-orange-600',
    canceled: 'text-gray-600',
    unpaid: 'text-red-600',
  }
  return colorMap[status] || 'text-gray-600'
}

export const formatPlanInterval = (interval: string, intervalCount: number = 1): string => {
  const intervalMap: Record<string, string> = {
    day: intervalCount === 1 ? 'daily' : `every ${intervalCount} days`,
    week: intervalCount === 1 ? 'weekly' : `every ${intervalCount} weeks`,
    month: intervalCount === 1 ? 'monthly' : `every ${intervalCount} months`,
    year: intervalCount === 1 ? 'yearly' : `every ${intervalCount} years`,
  }
  return intervalMap[interval] || `every ${intervalCount} ${interval}s`
}

export const formatPrice = (amount: number, currency: string = 'usd'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

// Trial Utilities
export const isInTrial = (subscription: UserSubscription): boolean => {
  if (!subscription.trialEnd) return false
  const now = new Date()
  return new Date(subscription.trialEnd) > now
}

export const getTrialDaysRemaining = (subscription: UserSubscription): number => {
  if (!subscription.trialEnd) return 0
  const now = new Date()
  const trialEnd = new Date(subscription.trialEnd)
  const timeRemaining = Math.max(0, trialEnd.getTime() - now.getTime())
  return Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))
}

// Error Messages
export const SUBSCRIPTION_ERROR_MESSAGES = {
  PLAN_NOT_FOUND: 'Subscription plan not found',
  SUBSCRIPTION_NOT_FOUND: 'Subscription not found',
  INVALID_PLAN_CHANGE: 'Invalid plan change requested',
  SUBSCRIPTION_ALREADY_CANCELED: 'Subscription is already canceled',
  SUBSCRIPTION_NOT_ACTIVE: 'Subscription is not active',
  CUSTOMER_NOT_FOUND: 'Customer not found',
  PAYMENT_METHOD_REQUIRED: 'Payment method required',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions to perform this action',
} as const

export type SubscriptionErrorMessage = typeof SUBSCRIPTION_ERROR_MESSAGES[keyof typeof SUBSCRIPTION_ERROR_MESSAGES]
