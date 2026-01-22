
import React, { useState, useEffect } from 'react'
import {
  CreditCardIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import type { SubscriptionStatus } from '../../lib/payment-types'
import {
  formatDate,
  getSubscriptionStatusBadge,
  fetchSubscriptionStatus,
  createCustomerPortalSession,
  handleStripeError
} from '../../lib/payment-utils'
import PaymentHistory from './PaymentHistory'

interface StripeCustomerRecord {
  id?: string
  stripe_customer_id: string
  email?: string
  name?: string
}

interface StripeSubscriptionRecord {
  id?: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  trial_end?: string
  cancel_at_period_end?: boolean
}

interface BillingDashboardProps {
  userId: string
  onSubscriptionChange?: (subscription: StripeSubscriptionRecord | null) => void
}

interface BillingData {
  subscription: StripeSubscriptionRecord | null
  customer: StripeCustomerRecord | null
  loading: boolean
  error: string | null
}

const UserBillingDashboard: React.FC<BillingDashboardProps> = ({
  userId,
  onSubscriptionChange
}) => {
  const [billingData, setBillingData] = useState<BillingData>({
    subscription: null,
    customer: null,
    loading: true,
    error: null
  })

  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    loadBillingData()
  }, [userId])

  const getDaysUntilEnd = (date?: string) => {
    if (!date) return 0
    const diff = new Date(date).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const loadBillingData = async () => {
    try {
      setBillingData(prev => ({ ...prev, loading: true, error: null }))
      const data = await fetchSubscriptionStatus(userId)
      setBillingData({
        subscription: data.subscription,
        customer: data.customer,
        loading: false,
        error: null
      })

      if (onSubscriptionChange) {
        onSubscriptionChange(data.subscription)
      }
    } catch (error) {
      const paymentError = handleStripeError(error)
      setBillingData(prev => ({
        ...prev,
        loading: false,
        error: paymentError.message
      }))
    }
  }
  const handleManageSubscription = async () => {
    if (!billingData.customer?.stripe_customer_id) return

    try {
      setPortalLoading(true)
      const { url } = await createCustomerPortalSession(
        billingData.customer.stripe_customer_id
      )
      window.location.href = url
    } catch (error) {
      const paymentError = handleStripeError(error)
      setBillingData(prev => ({ ...prev, error: paymentError.message }))
    } finally {
      setPortalLoading(false)
    }
  }

  const renderSubscriptionStatus = () => {
    const { subscription } = billingData

    if (!subscription) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-blue-900">No Active Subscription</h3>
              <p className="text-blue-700 mt-1">
                Subscribe to a plan to access premium features and manage your notes.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <a
              href="/checkout"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View Plans
            </a>
          </div>
        </div>
      )
    }

    const isActive = ['active', 'trialing'].includes(subscription.status)
    const needsAttention = ['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(subscription.status)
    const inTrial = subscription.status === 'trialing' && !!subscription.trial_end
    const daysUntilEnd = getDaysUntilEnd(subscription.current_period_end)

    return (
      <div className={`border rounded-lg p-6 ${
        needsAttention ? 'bg-red-50 border-red-200' :
        inTrial ? 'bg-blue-50 border-blue-200' :
        'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            {isActive ? (
              <CheckCircleIcon className="h-8 w-8 text-green-600 mr-3" />
            ) : (
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Current Subscription
              </h3>
              <div className="mt-1">
                <span className={getSubscriptionStatusBadge(subscription.status)}>
                  {subscription.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {portalLoading ? (
              'Loading...'
            ) : (
              <>
                Manage
                <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Current Period</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
            </dd>
          </div>

          {inTrial && subscription.trial_end && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Trial Ends</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(subscription.trial_end)}
              </dd>
            </div>
          )}

          <div>
            <dt className="text-sm font-medium text-gray-500">
              {inTrial ? 'Trial Status' : 'Next Billing'}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {inTrial
                ? `${getDaysUntilEnd(subscription.trial_end)} days remaining`
                : daysUntilEnd > 0
                ? `${daysUntilEnd} days`
                : 'Overdue'}
            </dd>
          </div>

          {subscription.cancel_at_period_end && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Cancellation</dt>
              <dd className="mt-1 text-sm text-red-600">
                Ends {formatDate(subscription.current_period_end)}
              </dd>
            </div>
          )}
        </div>

        {needsAttention && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              Your subscription needs attention. Please update your payment method or contact support.
            </p>
          </div>
        )}
      </div>
    )
  }
  if (billingData.loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="bg-gray-200 rounded-lg h-48"></div>
        </div>
        <div className="animate-pulse">
          <div className="bg-gray-200 rounded-lg h-64"></div>
        </div>
      </div>
    )
  }

  if (billingData.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-900">Error Loading Billing Data</h3>
            <p className="text-red-700 mt-1">{billingData.error}</p>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={loadBillingData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status Section */}
      {renderSubscriptionStatus()}

      {/* Payment History Section */}
      {billingData.customer && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <CreditCardIcon className="h-6 w-6 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Payment History</h3>
            </div>
          </div>
          <div className="p-6">
            <PaymentHistory
              customerId={billingData.customer.stripe_customer_id}
              limit={5}
              showPagination={false}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="/checkout"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            View Plans
          </a>
          {billingData.customer && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <CreditCardIcon className="mr-2 h-4 w-4" />
              {portalLoading ? 'Loading...' : 'Manage Billing'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserBillingDashboard
