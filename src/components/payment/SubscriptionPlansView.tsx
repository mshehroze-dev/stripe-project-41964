
import React from 'react'
import {
  CheckIcon,
  StarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import {
  SubscriptionPlansViewProps,
  SubscriptionPlan
} from '../../lib/payment-types'
import { formatCurrency } from '../../lib/payment-utils'
import { CheckoutButton } from './CheckoutButton'

const SubscriptionPlansView: React.FC<SubscriptionPlansViewProps> = ({
  plans,
  currentPlan: currentPlanId,
  onPlanSelect,
  loading = false
}) => {
  const activePlans = plans.filter(plan => plan.active)
  const [error, setError] = React.useState<string | null>(null)

  const formatPlanInterval = (interval: SubscriptionPlan['interval'], intervalCount?: number) => {
    const count = intervalCount ?? 1
    if (count === 1) {
      return interval === 'year' ? 'per year' : 'per month'
    }
    return `every ${count} ${interval}${count > 1 ? 's' : ''}`
  }

  const safeOnPlanSelect = async (planId: string) => {
    if (!onPlanSelect) return
    try {
      setError(null)
      await onPlanSelect(planId)
    } catch (err) {
      console.error(err)
      setError('Failed to select plan. Please try again.')
    }
  }

  if (activePlans.length === 0) {
    return (
      <div className="text-center py-12">
        <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Plans Available</h3>
        <p className="mt-1 text-sm text-gray-500">
          Subscription plans are currently being updated. Please check back later.
        </p>
      </div>
    )
  }

  const getPopularPlan = (): SubscriptionPlan | null => {
    // Find the plan with the most features or mark the middle-priced plan as popular
    if (activePlans.length >= 3) {
      const sortedByPrice = [...activePlans].sort((a, b) => a.price - b.price)
      return sortedByPrice[Math.floor(sortedByPrice.length / 2)]
    }
    return null
  }

  const popularPlan = getPopularPlan()

  const getPlanFeatures = (plan: SubscriptionPlan): string[] => {
    if (plan.features && plan.features.length > 0) {
      return plan.features
    }

    // Default features based on plan price (fallback)
    const baseFeatures = ['Access to all notes', 'Cloud sync', 'Basic support']

    if (plan.price > 1000) { // $10+ plans
      return [
        ...baseFeatures,
        'Unlimited notes',
        'Advanced search',
        'Priority support',
        'Export features',
        'Team collaboration'
      ]
    } else if (plan.price > 500) { // $5+ plans
      return [
        ...baseFeatures,
        'Up to 1000 notes',
        'Advanced search',
        'Email support'
      ]
    }

    return baseFeatures
  }

  const isCurrentPlan = (planId: string): boolean => {
    return currentPlanId === planId
  }

  const getTrialText = (plan: SubscriptionPlan): string | null => {
    if (plan.trialPeriodDays && plan.trialPeriodDays > 0) {
      return `${plan.trialPeriodDays}-day free trial`
    }
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
        <p className="mt-4 text-lg text-gray-600">
          Select the perfect plan for your note-taking needs
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
        {activePlans.map((plan) => {
          const isPopular = popularPlan?.id === plan.id
          const isCurrent = isCurrentPlan(plan.id)
          const features = getPlanFeatures(plan)
          const trialText = getTrialText(plan)

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-8 shadow-lg ${
                isPopular
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                  : isCurrent
                  ? 'border-green-500 ring-2 ring-green-500 ring-opacity-50'
                  : 'border-gray-200'
              } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-blue-500 text-white">
                    <StarIcon className="w-4 h-4 mr-1" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrent && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center px-4 py-1 rounded-full text-sm font-medium bg-green-500 text-white">
                    <CheckIcon className="w-4 h-4 mr-1" />
                    Current Plan
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-2 text-gray-600">{plan.description}</p>
                )}

                <div className="mt-6">
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-bold text-gray-900">
                      {formatCurrency(plan.price, plan.currency)}
                    </span>
                    <span className="ml-2 text-xl text-gray-500">
                      {formatPlanInterval(plan.interval, plan.intervalCount)}
                    </span>
                  </div>

                  {trialText && (
                    <p className="mt-2 text-sm text-blue-600 font-medium">
                      {trialText}
                    </p>
                  )}
                </div>
              </div>

              {/* Features List */}
              <ul className="mt-8 space-y-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <CheckIcon className="flex-shrink-0 w-5 h-5 text-green-500 mt-0.5" />
                    <span className="ml-3 text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              {/* Action Button */}
              <div className="mt-8">
                {error && (
                  <p className="text-sm text-red-600 mb-2">{error}</p>
                )}
                {isCurrent ? (
                  <div className="w-full text-center py-3 px-4 border-2 border-green-500 rounded-lg text-green-700 font-medium bg-green-50">
                    Current Plan
                  </div>
                ) : (
                  <div className="space-y-2">
                    <CheckoutButton
                      priceId={plan.stripePriceId}
                      className={`w-full text-center py-3 px-4 rounded-lg font-medium transition-colors ${
                        isPopular
                          ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                          : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading ? 'Loading...' : 'Get Started'}
                    </CheckoutButton>
                    <button
                      onClick={() => safeOnPlanSelect(plan.id)}
                      className="w-full inline-flex justify-center px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Select Plan
                    </button>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              {plan.interval === 'year' && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-green-600 font-medium">
                    Save {Math.round((1 - (plan.price * 12) / (plan.price * 12)) * 100) || 20}% with annual billing
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Additional Information */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
          <div className="flex items-center">
            <CheckIcon className="w-4 h-4 mr-1 text-green-500" />
            Cancel anytime
          </div>
          <div className="flex items-center">
            <CheckIcon className="w-4 h-4 mr-1 text-green-500" />
            Secure payments
          </div>
          <div className="flex items-center">
            <CheckIcon className="w-4 h-4 mr-1 text-green-500" />
            24/7 support
          </div>
        </div>

        <p className="text-sm text-gray-500">
          All plans include our core features. Upgrade or downgrade at any time.
        </p>
      </div>

      {/* FAQ or Additional Info */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">
          Need help choosing?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-900">Free Trial</p>
            <p>Most plans include a free trial period to test all features.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Easy Upgrades</p>
            <p>Change your plan anytime from your billing dashboard.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Secure Billing</p>
            <p>All payments are processed securely through Stripe.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900">Cancel Anytime</p>
            <p>No long-term commitments. Cancel your subscription anytime.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionPlansView
