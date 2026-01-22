
/**
 * Subscription Service - Handles all subscription-related operations
 */

import { supabase } from './supabase'
import {
  SubscriptionPlan,
  UserSubscription,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  SubscriptionChangeRequest,
  SubscriptionChangeResponse,
  SubscriptionService as ISubscriptionService,
} from './payment-types'
import {
  isActiveSubscription,
  canCancelSubscription,
  canReactivateSubscription,
  validatePlanChange,
  getChangeType,
  SUBSCRIPTION_ERROR_MESSAGES,
} from './subscription-validation'
import {
  createSubscription as createStripeSubscription,
  updateSubscription as updateStripeSubscription,
  cancelSubscription as cancelStripeSubscription,
  reactivateSubscription as reactivateStripeSubscription,
  createCustomerPortal,
  getAvailablePlans as getStripePlans,
} from './stripe'

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

export class SubscriptionService implements ISubscriptionService {
  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    try {
      const client = requireSupabase()
      // First try to get plans from Supabase cache
      const { data: cachedPlans, error: cacheError } = await client
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('tier', { ascending: true })

      if (!cacheError && cachedPlans && cachedPlans.length > 0) {
        return cachedPlans.map(this.mapDatabasePlanToSubscriptionPlan)
      }

      // If table doesn't exist, log warning and continue to Stripe fallback
      if (cacheError && (cacheError.code === 'PGRST106' || cacheError.message.includes('relation "subscription_plans" does not exist'))) {
        console.warn('subscription_plans table does not exist, using Stripe API fallback')
      }

      // Fallback to Stripe API
      const stripePlans = await getStripePlans()
      return stripePlans.data || []
    } catch (error) {
      console.error('Error fetching subscription plans:', error)
      throw new Error('Failed to fetch subscription plans')
    }
  }

  /**
   * Get current subscription for a user
   */
  async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const client = requireSupabase()
      const { data: subscription, error } = await client
        .from('subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found
          return null
        }
        throw error
      }

      return this.mapDatabaseSubscriptionToUserSubscription(subscription)
    } catch (error) {
      console.error('Error fetching current subscription:', error)
      throw new Error('Failed to fetch current subscription')
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<UserSubscription> {
    try {
      const client = requireSupabase()
      const { planId, userId, customerId, trialPeriodDays, promoCode, metadata } = params

      // Validate plan exists and is active
      const plans = await this.getAvailablePlans()
      const plan = plans.find(p => p.id === planId)
      if (!plan) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.PLAN_NOT_FOUND)
      }

      // Check if user already has an active subscription
      const existingSubscription = await this.getCurrentSubscription(userId)
      if (existingSubscription && isActiveSubscription(existingSubscription)) {
        throw new Error('User already has an active subscription')
      }

      // Create subscription via Stripe
      const stripeResponse = await createStripeSubscription({
        planId: plan.stripePriceId,
        trialDays: trialPeriodDays,
        customerEmail: customerId, // This should be email in the Stripe function
        promoCode,
      })

      // Store subscription in database
      const { data: newSubscription, error } = await client
        .from('subscriptions')
        .insert({
          user_id: userId,
          stripe_subscription_id: stripeResponse.subscriptionId,
          stripe_customer_id: customerId,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          cancel_at_period_end: false,
          trial_start: trialPeriodDays ? new Date().toISOString() : null,
          trial_end: trialPeriodDays ? new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000).toISOString() : null,
          metadata: metadata || {},
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return this.mapDatabaseSubscriptionToUserSubscription({ ...newSubscription, plan })
    } catch (error) {
      console.error('Error creating subscription:', error)
      throw new Error('Failed to create subscription')
    }
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<UserSubscription> {
    try {
      const client = requireSupabase()
      const { planId, cancelAtPeriodEnd, metadata } = params

      // Get current subscription
      const { data: currentSub, error: fetchError } = await client
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (fetchError || !currentSub) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND)
      }

      const currentSubscription = this.mapDatabaseSubscriptionToUserSubscription(currentSub)

      // If changing plan, validate the change
      if (planId && planId !== currentSubscription.planId) {
        const plans = await this.getAvailablePlans()
        const newPlan = plans.find(p => p.id === planId)
        if (!newPlan) {
          throw new Error(SUBSCRIPTION_ERROR_MESSAGES.PLAN_NOT_FOUND)
        }

        const validation = validatePlanChange(currentSubscription, newPlan)
        if (!validation.valid) {
          throw new Error(validation.error)
        }

        // Update subscription via Stripe
        await updateStripeSubscription({
          subscriptionId: currentSubscription.stripeSubscriptionId,
          newPlanId: newPlan.stripePriceId,
          prorationBehavior: 'create_prorations',
        })
      }

      // Update subscription in database
      const updateData: any = {}
      if (planId) updateData.plan_id = planId
      if (cancelAtPeriodEnd !== undefined) updateData.cancel_at_period_end = cancelAtPeriodEnd
      if (metadata) updateData.metadata = { ...currentSub.metadata, ...metadata }

      const { data: updatedSubscription, error: updateError } = await client
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      return this.mapDatabaseSubscriptionToUserSubscription(updatedSubscription)
    } catch (error) {
      console.error('Error updating subscription:', error)
      throw new Error('Failed to update subscription')
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    try {
      const client = requireSupabase()
      // Get current subscription
      const { data: currentSub, error: fetchError } = await client
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (fetchError || !currentSub) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND)
      }

      const subscription = this.mapDatabaseSubscriptionToUserSubscription(currentSub)

      if (!canCancelSubscription(subscription)) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.SUBSCRIPTION_ALREADY_CANCELED)
      }

      // Cancel subscription via Stripe
      await cancelStripeSubscription({
        subscriptionId: subscription.stripeSubscriptionId,
        cancelAtPeriodEnd,
      })

      // Update subscription in database
      const updateData: any = {
        cancel_at_period_end: cancelAtPeriodEnd,
      }

      if (!cancelAtPeriodEnd) {
        updateData.status = 'canceled'
        updateData.canceled_at = new Date().toISOString()
      }

      const { error: updateError } = await client
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)

      if (updateError) {
        throw updateError
      }
    } catch (error) {
      console.error('Error canceling subscription:', error)
      throw new Error('Failed to cancel subscription')
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<UserSubscription> {
    try {
      const client = requireSupabase()
      // Get current subscription
      const { data: currentSub, error: fetchError } = await client
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (fetchError || !currentSub) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND)
      }

      const subscription = this.mapDatabaseSubscriptionToUserSubscription(currentSub)

      if (!canReactivateSubscription(subscription)) {
        throw new Error('Cannot reactivate this subscription')
      }

      // Reactivate subscription via Stripe
      await reactivateStripeSubscription(subscription.stripeSubscriptionId)

      // Update subscription in database
      const { data: updatedSubscription, error: updateError } = await client
        .from('subscriptions')
        .update({
          status: 'active',
          cancel_at_period_end: false,
          canceled_at: null,
        })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      return this.mapDatabaseSubscriptionToUserSubscription(updatedSubscription)
    } catch (error) {
      console.error('Error reactivating subscription:', error)
      throw new Error('Failed to reactivate subscription')
    }
  }

  /**
   * Create customer portal session
   */
  async createCustomerPortalSession(customerId: string, returnUrl?: string): Promise<{ url: string }> {
    try {
      return await createCustomerPortal({
        customerId,
        returnUrl: returnUrl || window.location.href,
      })
    } catch (error) {
      console.error('Error creating customer portal session:', error)
      throw new Error('Failed to create customer portal session')
    }
  }

  /**
   * Handle subscription plan change with proper upgrade/downgrade logic
   */
  async changeSubscriptionPlan(request: SubscriptionChangeRequest): Promise<SubscriptionChangeResponse> {
    try {
      const client = requireSupabase()
      const { subscriptionId, newPlanId, prorationBehavior = 'create_prorations' } = request

      // Get current subscription and plans
      const { data: currentSub, error: fetchError } = await client
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()

      if (fetchError || !currentSub) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND)
      }

      const currentSubscription = this.mapDatabaseSubscriptionToUserSubscription(currentSub)
      const plans = await this.getAvailablePlans()
      const currentPlan = plans.find(p => p.id === currentSubscription.planId)
      const newPlan = plans.find(p => p.id === newPlanId)

      if (!currentPlan || !newPlan) {
        throw new Error(SUBSCRIPTION_ERROR_MESSAGES.PLAN_NOT_FOUND)
      }

      // Validate plan change
      const validation = validatePlanChange(currentSubscription, newPlan)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      const changeType = getChangeType(currentPlan, newPlan)

      // Update subscription via Stripe
      await updateStripeSubscription({
        subscriptionId: currentSubscription.stripeSubscriptionId,
        newPlanId: newPlan.stripePriceId,
        prorationBehavior,
      })

      // Update subscription in database
      const { data: updatedSubscription, error: updateError } = await client
        .from('subscriptions')
        .update({
          plan_id: newPlanId,
        })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      const updatedUserSubscription = this.mapDatabaseSubscriptionToUserSubscription(updatedSubscription)

      return {
        subscription: updatedUserSubscription,
        prorationAmount: 0, // This would come from Stripe response in real implementation
        effectiveDate: changeType === 'upgrade' ? new Date().toISOString() : currentSubscription.currentPeriodEnd.toISOString(),
        changeType,
      }
    } catch (error) {
      console.error('Error changing subscription plan:', error)
      throw new Error('Failed to change subscription plan')
    }
  }

  /**
   * Map database subscription to UserSubscription type
   */
  private mapDatabaseSubscriptionToUserSubscription(dbSub: any): UserSubscription {
    return {
      id: dbSub.id,
      userId: dbSub.user_id,
      stripeSubscriptionId: dbSub.stripe_subscription_id,
      stripeCustomerId: dbSub.stripe_customer_id,
      planId: dbSub.plan_id,
      status: dbSub.status,
      currentPeriodStart: new Date(dbSub.current_period_start),
      currentPeriodEnd: new Date(dbSub.current_period_end),
      cancelAtPeriodEnd: dbSub.cancel_at_period_end,
      canceledAt: dbSub.canceled_at ? new Date(dbSub.canceled_at) : undefined,
      trialStart: dbSub.trial_start ? new Date(dbSub.trial_start) : undefined,
      trialEnd: dbSub.trial_end ? new Date(dbSub.trial_end) : undefined,
      createdAt: new Date(dbSub.created_at),
      updatedAt: new Date(dbSub.updated_at),
      plan: dbSub.plan ? this.mapDatabasePlanToSubscriptionPlan(dbSub.plan) : undefined,
    }
  }

  /**
   * Map database plan to SubscriptionPlan type
   */
  private mapDatabasePlanToSubscriptionPlan(dbPlan: any): SubscriptionPlan {
    return {
      id: dbPlan.id,
      name: dbPlan.name,
      description: dbPlan.description,
      price: dbPlan.price,
      currency: dbPlan.currency,
      interval: dbPlan.interval,
      intervalCount: dbPlan.interval_count,
      trialPeriodDays: dbPlan.trial_period_days,
      features: dbPlan.features || [],
      popular: dbPlan.popular || false,
      stripePriceId: dbPlan.stripe_price_id,
      stripeProductId: dbPlan.stripe_product_id,
      metadata: dbPlan.metadata || {},
      active: dbPlan.active,
      tier: dbPlan.tier,
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService()
