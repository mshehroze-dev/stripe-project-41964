
import React, { useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { UserSubscription } from '../../lib/payment-types'
import {
  formatPrice,
  formatPlanInterval,
  getDaysUntilRenewal,
  isInTrial,
  getTrialDaysRemaining
} from '../../lib/subscription-validation'

interface SubscriptionCancellationDialogProps {
  isOpen: boolean
  onClose: () => void
  subscription: UserSubscription
  onCancel: (subscriptionId: string, cancelAtPeriodEnd: boolean) => void
  loading?: boolean
}

export const SubscriptionCancellationDialog: React.FC<SubscriptionCancellationDialogProps> = ({
  isOpen,
  onClose,
  subscription,
  onCancel,
  loading = false,
}) => {
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedReason, setSelectedReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cancellationReasons = [
    'Too expensive',
    'Not using enough features',
    'Found a better alternative',
    'Technical issues',
    'Temporary pause',
    'Other'
  ]

  const handleCancel = async () => {
    if (!confirmed) return
    try {
      setError(null)
      await onCancel(subscription.id, cancelAtPeriodEnd)
    } catch (err) {
      console.error(err)
      setError('Failed to cancel subscription. Please try again.')
    }
  }

  const handleClose = () => {
    // Reset form state
    setCancelAtPeriodEnd(true)
    setConfirmed(false)
    setFeedback('')
    setSelectedReason('')
    onClose()
  }

  const getAccessEndDate = () => {
    if (isInTrial(subscription)) {
      return subscription.trialEnd!
    }
    return subscription.currentPeriodEnd
  }

  const getDaysUntilAccessEnd = () => {
    if (isInTrial(subscription)) {
      return getTrialDaysRemaining(subscription)
    }
    return getDaysUntilRenewal(subscription)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center">
                  <div className="flex-shrink-0 rounded-full bg-red-100 p-2">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Cancel Subscription
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 mt-1">
                      We're sorry to see you go
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Current Subscription</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Plan:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {subscription.plan?.name || 'Unknown Plan'}
                        </span>
                      </div>
                      {subscription.plan && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Price:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatPrice(subscription.plan.price, subscription.plan.currency)} /
                            {formatPlanInterval(subscription.plan.interval, subscription.plan.intervalCount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">
                          {isInTrial(subscription) ? 'Trial ends:' : 'Next billing:'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(getAccessEndDate()).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Options */}
                  <div className="space-y-4 mb-6">
                    <h4 className="text-sm font-medium text-gray-900">When would you like to cancel?</h4>

                    <div className="space-y-3">
                      <label className="flex items-start">
                        <input
                          type="radio"
                          checked={cancelAtPeriodEnd}
                          onChange={() => setCancelAtPeriodEnd(true)}
                          className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            At the end of current period (Recommended)
                          </div>
                          <div className="text-sm text-gray-600">
                            You'll continue to have access for {getDaysUntilAccessEnd()} more days
                            until {new Date(getAccessEndDate()).toLocaleDateString()}
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start">
                        <input
                          type="radio"
                          checked={!cancelAtPeriodEnd}
                          onChange={() => setCancelAtPeriodEnd(false)}
                          className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            Cancel immediately
                          </div>
                          <div className="text-sm text-gray-600">
                            You'll lose access right away. No refund will be provided for unused time.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Cancellation Reason */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Why are you canceling? (Optional)
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select a reason...</option>
                      {cancellationReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Additional Feedback */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Additional feedback (Optional)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Help us improve by sharing your experience..."
                    />
                  </div>

                  {/* Confirmation */}
                  <div className="mb-6">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        I understand that {cancelAtPeriodEnd ? 'my subscription will be canceled at the end of the current billing period' : 'my subscription will be canceled immediately and I will lose access right away'}.
                        {!cancelAtPeriodEnd && ' No refund will be provided.'}
                      </span>
                    </label>
                  </div>

                  {/* Warning for immediate cancellation */}
                  {!cancelAtPeriodEnd && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Immediate Cancellation Warning
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>
                              You will lose access to all premium features immediately.
                              This action cannot be undone and no refund will be provided for the remaining time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  {error && (
                    <p className="text-sm text-red-600 mb-3">{error}</p>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      Keep Subscription
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleCancel}
                      disabled={loading || !confirmed}
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2-647z"></path>
                          </svg>
                          Canceling...
                        </div>
                      ) : (
                        `Cancel ${cancelAtPeriodEnd ? 'at Period End' : 'Immediately'}`
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
