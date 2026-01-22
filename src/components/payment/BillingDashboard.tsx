
import React, { useState, useEffect } from 'react'
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  UserGroupIcon,
  CreditCardIcon,
  ArrowUpIcon,
  // ArrowDownIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import {
  getPaymentSummaryAnalytics,
  getSubscriptionMetrics,
  getCustomerAnalytics,
  PaymentSummaryAnalytics,
  SubscriptionMetrics,
  CustomerAnalytics,
  formatAmount
} from '@/lib/stripe'

// Local DateRangePicker component
interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
  className?: string
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  className = ''
}) => {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, endDate)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(startDate, e.target.value)
  }

  const setPresetRange = (days: number) => {
    const end = new Date()
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    onChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0])
  }

  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      <div className="flex items-center space-x-2">
        <label htmlFor="start-date" className="text-sm font-medium text-gray-700">
          From:
        </label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onChange={handleStartDateChange}
          className="block w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="end-date" className="text-sm font-medium text-gray-700">
          To:
        </label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          onChange={handleEndDateChange}
          className="block w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => setPresetRange(7)}
          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Last 7 days
        </button>
        <button
          onClick={() => setPresetRange(30)}
          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Last 30 days
        </button>
        <button
          onClick={() => setPresetRange(90)}
          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Last 90 days
        </button>
      </div>
    </div>
  )
}


interface BillingDashboardProps {
  className?: string
}

interface DashboardData {
  paymentSummary: PaymentSummaryAnalytics | null
  subscriptionMetrics: SubscriptionMetrics | null
  customerAnalytics: CustomerAnalytics | null
}

export const BillingDashboard: React.FC<BillingDashboardProps> = ({
  className = ''
}) => {
  const [data, setData] = useState<DashboardData>({
    paymentSummary: null,
    subscriptionMetrics: null,
    customerAnalytics: null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date()
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }
  })

  useEffect(() => {
    loadDashboardData()
  }, [dateRange])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [paymentResponse, subscriptionResponse, customerResponse] = await Promise.allSettled([
        getPaymentSummaryAnalytics(dateRange),
        getSubscriptionMetrics(dateRange),
        getCustomerAnalytics({ ...dateRange, limit: 5 })
      ])

      setData({
        paymentSummary: paymentResponse.status === 'fulfilled' ? paymentResponse.value.data as PaymentSummaryAnalytics : null,
        subscriptionMetrics: subscriptionResponse.status === 'fulfilled' ? subscriptionResponse.value.data as SubscriptionMetrics : null,
        customerAnalytics: customerResponse.status === 'fulfilled' ? customerResponse.value.data as CustomerAnalytics : null
      })

      // Check if all requests failed
      if (paymentResponse.status === 'rejected' &&
          subscriptionResponse.status === 'rejected' &&
          customerResponse.status === 'rejected') {
        setError('Failed to load dashboard data')
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }
  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate })
  }

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return formatAmount(amount, currency)
  }

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="h-8 bg-gray-200 rounded mb-6 w-1/3"></div>

          {/* Date picker skeleton */}
          <div className="h-10 bg-gray-200 rounded mb-6 w-full"></div>

          {/* Metrics grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>

          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-200 h-64 rounded-lg"></div>
            <div className="bg-gray-200 h-64 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !data.paymentSummary && !data.subscriptionMetrics && !data.customerAnalytics) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <ChartBarIcon className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Dashboard Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Billing Dashboard</h2>
        <button
          onClick={loadDashboardData}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Refresh
        </button>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg shadow p-4">
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onChange={handleDateRangeChange}
        />
      </div>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        {data.paymentSummary && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.paymentSummary.totalRevenue, data.paymentSummary.currency)}
                </p>
                <p className="text-sm text-gray-600">
                  {data.paymentSummary.totalTransactions} transactions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Recurring Revenue */}
        {data.subscriptionMetrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.subscriptionMetrics.monthlyRecurringRevenue)}
                </p>
                <p className="text-sm text-gray-600">
                  {data.subscriptionMetrics.activeSubscriptions} active subscriptions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Total Customers */}
        {data.customerAnalytics && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.customerAnalytics.totalCustomers.toLocaleString()}
                </p>
                <div className="flex items-center text-sm">
                  <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-600">{data.customerAnalytics.newCustomers} new</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Average Transaction Value */}
        {data.paymentSummary && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CreditCardIcon className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Avg Transaction Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(data.paymentSummary.averageTransactionValue, data.paymentSummary.currency)}
                </p>
                <p className="text-sm text-gray-600">
                  {formatPercentage(data.paymentSummary.successRate)} success rate
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Charts and Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown */}
        {data.paymentSummary && data.paymentSummary.topPaymentMethods.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h3>
            <div className="space-y-3">
              {data.paymentSummary.topPaymentMethods.map((method, index) => (
                <div key={method.type} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}                    ></div>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {method.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{method.count}</div>
                    <div className="text-xs text-gray-500">{method.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscription Metrics */}
        {data.subscriptionMetrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Subscription Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Subscriptions</span>
                <span className="text-lg font-semibold text-gray-900">
                  {data.subscriptionMetrics.activeSubscriptions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">New Subscriptions</span>
                <span className="text-lg font-semibold text-green-600">
                  +{data.subscriptionMetrics.newSubscriptions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Canceled Subscriptions</span>
                <span className="text-lg font-semibold text-red-600">
                  -{data.subscriptionMetrics.canceledSubscriptions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Churn Rate</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatPercentage(data.subscriptionMetrics.churnRate)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Revenue Per User</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(data.subscriptionMetrics.averageRevenuePerUser)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Customer Lifetime Value</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatCurrency(data.subscriptionMetrics.lifetimeValue)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Top Customers Table */}
      {data.customerAnalytics && data.customerAnalytics.topCustomers.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Top Customers</h3>
          </div>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lifetime Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.customerAnalytics.topCustomers.map((customer, index) => (
                  <tr key={customer.customerId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {customer.email || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {customer.customerId.substring(0, 20)}...
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(customer.totalSpent)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.orderCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(customer.lifetimeValue)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data.paymentSummary && !data.subscriptionMetrics && !data.customerAnalytics && (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600 mb-4">
              No billing data found for the selected date range. Try adjusting your date range or check back later.
            </p>
            <button
              onClick={loadDashboardData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Refresh Data
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
