
import React, { useState, useEffect } from 'react'
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import {
  PaymentHistoryProps,
  PaymentHistory as PaymentHistoryType
} from '../../lib/payment-types'
import {
  formatCurrency,
  formatDateTime,
  getPaymentStatusBadge,
  fetchPaymentHistory,
  handleStripeError
} from '../../lib/payment-utils'

interface PaymentHistoryState {
  payments: PaymentHistoryType[]
  loading: boolean
  error: string | null
  currentPage: number
  hasMore: boolean
}

const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  customerId,
  limit = 10,
  showPagination = true
}) => {
  const [state, setState] = useState<PaymentHistoryState>({
    payments: [],
    loading: true,
    error: null,
    currentPage: 1,
    hasMore: false
  })

  useEffect(() => {
    if (customerId) {
      loadPaymentHistory()
    }
  }, [customerId, state.currentPage])

  const loadPaymentHistory = async () => {
    if (!customerId) return

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      const payments = await fetchPaymentHistory(
        customerId,
        showPagination ? limit : limit * state.currentPage
      )

      setState(prev => ({
        ...prev,
        payments,
        loading: false,
        hasMore: payments.length === limit && showPagination
      }))
    } catch (error) {
      const paymentError = handleStripeError(error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: paymentError.message
      }))
    }
  }

  const handlePageChange = (direction: 'prev' | 'next') => {
    setState(prev => ({
      ...prev,
      currentPage: direction === 'next' ? prev.currentPage + 1 : prev.currentPage - 1
    }))
  }

  const getPaymentIcon = (status: PaymentHistoryType['status']) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
      case 'canceled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      case 'requires_action':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
      default:
        return <CreditCardIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getPaymentDescription = (payment: PaymentHistoryType): string => {
    if (payment.description) {
      return payment.description
    }

    // Generate description based on amount and status
    switch (payment.status) {
      case 'succeeded':
        return 'Subscription payment'
      case 'failed':
        return 'Failed payment attempt'
      case 'pending':
        return 'Payment processing'
      case 'requires_action':
        return 'Payment requires action'
      default:
        return 'Payment transaction'
    }
  }

  if (!customerId) {
    return (
      <div className="text-center py-8">
        <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Payment History</h3>
        <p className="mt-1 text-sm text-gray-500">
          Payment history will appear here once you make your first payment.
        </p>
      </div>
    )
  }

  if (state.loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
            <div className="rounded-full bg-gray-200 h-10 w-10"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-red-900">Error Loading Payment History</h3>
        <p className="mt-1 text-sm text-red-600">{state.error}</p>
        <button
          onClick={loadPaymentHistory}
          className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Retry
        </button>
      </div>
    )
  }

  if (state.payments.length === 0) {
    return (
      <div className="text-center py-8">
        <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Payment History</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your payment history will appear here once you make your first payment.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Payment List */}
      <div className="space-y-3">
        {state.payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                {getPaymentIcon(payment.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getPaymentDescription(payment)}
                  </p>
                  <span className={getPaymentStatusBadge(payment.status)}>
                    {payment.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {formatDateTime(payment.created_at)}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className={`text-sm font-medium ${
                payment.status === 'succeeded' ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {formatCurrency(payment.amount, payment.currency)}
              </p>
              {payment.stripe_payment_intent_id && (
                <p className="text-xs text-gray-400 font-mono">
                  {payment.stripe_payment_intent_id.slice(-8)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange('prev')}
              disabled={state.currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange('next')}
              disabled={!state.hasMore}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{state.currentPage}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange('prev')}
                  disabled={state.currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => handlePageChange('next')}
                  disabled={!state.hasMore}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {state.payments.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-500">
            Showing {state.payments.length} payment{state.payments.length !== 1 ? 's' : ''}
            {showPagination && state.hasMore && ' (more available)'}
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentHistory
