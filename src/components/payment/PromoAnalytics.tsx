
import React, { useState, useEffect } from 'react'
import { ChartBarIcon, CurrencyDollarIcon, UserGroupIcon, TagIcon } from '@heroicons/react/24/outline'
import { getPromoUsageAnalytics, PromoUsageAnalytics, AnalyticsResponse } from '../../lib/stripe'
import { formatCurrency } from '../../lib/discount-utils'

interface PromoAnalyticsProps {
  promoCode?: string
  className?: string
  dateRange?: {
    startDate: string
    endDate: string
  }
}

export const PromoAnalytics: React.FC<PromoAnalyticsProps> = ({
  promoCode,
  className = '',
  dateRange
}) => {
  const [analytics, setAnalytics] = useState<PromoUsageAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [promoCode, dateRange])

  const loadAnalytics = async () => {
    setLoading(true)
    setError(null)

    try {
      const response: AnalyticsResponse = await getPromoUsageAnalytics({
        promoCode,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
        limit: 10,
      })

      setAnalytics(response.data as PromoUsageAnalytics)
    } catch (err) {
      console.error('Failed to load promo analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <ChartBarIcon className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadAnalytics}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Promotional Code Analytics
            {analytics.promoCode !== 'ALL_CODES' && (
              <span className="ml-2 text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {analytics.promoCode}
              </span>
            )}
          </h3>
          <button
            onClick={loadAnalytics}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Refresh
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <TagIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Redemptions</p>
                <p className="text-2xl font-bold text-blue-900">{analytics.totalRedemptions.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Total Discount</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(analytics.totalDiscountAmount, analytics.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(analytics.averageOrderValue, analytics.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Revenue Impact</p>
                <p className="text-2xl font-bold text-orange-900">
                  {formatCurrency(analytics.revenueImpact, analytics.currency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        {analytics.topCustomers.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2" />
              Top Customers
            </h4>
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Redemptions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Spent
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.topCustomers.map((customer, index) => (
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
                        <div className="text-sm text-gray-900">{customer.redemptions}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.totalSpent, analytics.currency)}
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
        {analytics.totalRedemptions === 0 && (
          <div className="text-center py-12">
            <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Usage Data</h3>
            <p className="text-gray-600">
              {analytics.promoCode !== 'ALL_CODES'
                ? `No redemptions found for promo code "${analytics.promoCode}" in the selected date range.`
                : 'No promo code redemptions found in the selected date range.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Date range picker component for analytics
 */
interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
  className?: string
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
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
