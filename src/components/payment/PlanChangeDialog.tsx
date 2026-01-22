
import React, { useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { ExclamationTriangleIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { SubscriptionPlan, UserSubscription } from '../../lib/payment-types'
import {
  formatPrice,
  formatPlanInterval,
  getChangeType,
  validatePlanChange
} from '../../lib/subscription-validation'

interface PlanChangeDialogProps {
  isOpen: boolean
  onClose: () => void
  currentSubscription: UserSubscription
  newPlan: SubscriptionPlan
  currentPlan: SubscriptionPlan
  onConfirm: (planId: string) => void
  loading?: boolean
}

export const PlanChangeDialog: React.FC<PlanChangeDialogProps> = ({
  isOpen,
  onClose,
  currentSubscription,
  newPlan,
  currentPlan,
  onConfirm,
  loading = false,
}) => {
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeType = getChangeType(currentPlan, newPlan)
  const validation = validatePlanChange(currentSubscription, newPlan)

  const handleConfirm = async () => {
    if (!validation.valid) return
    try {
      setError(null)
      await onConfirm(newPlan.id)
    } catch (err) {
      console.error(err)
      setError('Failed to change plan. Please try again.')
    }
  }

  const getChangeDescription = () => {
    switch (changeType) {
      case 'upgrade':
        return {
          title: 'Upgrade Plan',
          description: 'Your plan will be upgraded immediately and you\'ll be charged a prorated amount for the remainder of your billing cycle.',
          effectiveDate: 'Effective immediately',
          icon: <CheckIcon className="h-6 w-6 text-green-600" />,
          iconBg: 'bg-green-100',
        }
      case 'downgrade':
        return {
          title: 'Downgrade Plan',
          description: 'Your plan will be downgraded at the end of your current billing cycle. You\'ll continue to have access to your current features until then.',
          effectiveDate: `Effective ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`,
          icon: <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />,
          iconBg: 'bg-yellow-100',
        }
      case 'lateral':
        return {
          title: 'Change Plan',
          description: 'Your plan will be changed immediately. Any price difference will be prorated for the remainder of your billing cycle.',
          effectiveDate: 'Effective immediately',
          icon: <CheckIcon className="h-6 w-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
        }
    }
  }

  const changeInfo = getChangeDescription()

  if (!validation.valid) {
    return (
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={onClose}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <XMarkIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Cannot Change Plan
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          {validation.error}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    )
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
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
                  <div className={`flex-shrink-0 rounded-full p-2 ${changeInfo.iconBg}`}>
                    {changeInfo.icon}
                  </div>
                  <div className="ml-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      {changeInfo.title}
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 mt-1">
                      {changeInfo.effectiveDate}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm text-gray-700">
                    {changeInfo.description}
                  </p>
                </div>

                {/* Plan Comparison */}
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Plan Change Summary</h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Current Plan:</span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{currentPlan.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatPrice(currentPlan.price, currentPlan.currency)} / {formatPlanInterval(currentPlan.interval, currentPlan.intervalCount)}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">New Plan:</span>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{newPlan.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatPrice(newPlan.price, newPlan.currency)} / {formatPlanInterval(newPlan.interval, newPlan.intervalCount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Price difference */}
                    {currentPlan.price !== newPlan.price && (
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Price Difference:</span>
                          <div className={`text-sm font-medium ${
                            newPlan.price > currentPlan.price ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {newPlan.price > currentPlan.price ? '+' : ''}
                            {formatPrice(newPlan.price - currentPlan.price, newPlan.currency)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Feature Changes */}
                {(newPlan.features.length !== currentPlan.features.length ||
                  !newPlan.features.every(f => currentPlan.features.includes(f))) && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Feature Changes</h4>

                    <div className="space-y-2">
                      {/* New features */}
                      {newPlan.features
                        .filter(f => !currentPlan.features.includes(f))
                        .map((feature, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-green-700">Added: {feature}</span>
                          </div>
                        ))}

                      {/* Removed features */}
                      {currentPlan.features
                        .filter(f => !newPlan.features.includes(f))
                        .map((feature, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <XMarkIcon className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-red-700">Removed: {feature}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Confirmation checkbox for downgrades */}
                {changeType === 'downgrade' && (
                  <div className="mt-6">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        I understand that I will lose access to features not included in the new plan at the end of my current billing cycle.
                      </span>
                    </label>
                  </div>
                )}

                <div className="mt-6">
                  {error && (
                    <p className="text-sm text-red-600 mb-3">{error}</p>
                  )}
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={onClose}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleConfirm}
                      disabled={loading || (changeType === 'downgrade' && !confirmed)}
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </div>
                      ) : (
                        `Confirm ${changeType === 'upgrade' ? 'Upgrade' : changeType === 'downgrade' ? 'Downgrade' : 'Change'}`
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
