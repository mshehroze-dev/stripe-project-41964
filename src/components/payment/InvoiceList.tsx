
import React, { useEffect, useState } from 'react';
import {
  DocumentTextIcon,
  // DownloadIcon,
  EyeIcon,
  // CalendarIcon,
  // CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';import { formatAmount } from '@/lib/stripe';

interface Invoice {
  id: string
  customer_id: string
  subscription_id: string | null
  stripe_invoice_id: string
  amount_paid: number
  amount_due: number
  status: string
  invoice_pdf: string | null
  created_at: string
}

interface InvoiceListProps {
  className?: string
  limit?: number
  showFilters?: boolean
  customerId?: string // Optional: filter by specific customer
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  className = '',
  limit = 20,
  showFilters = true,
  customerId
}) => {  const user = null;  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    const client = supabase

    if (!user && !customerId) return

    const fetchInvoices = async () => {
      setLoading(true)
      setError(null)

      try {
        let customerIdToUse = customerId

        // If no customerId provided, get it from the current user
        if (!customerIdToUse && user) {
          const { data: customerData, error: customerError } = await client
            .from('customers')
            .select('id')
            .eq('user_id', user.id)
            .single()

          if (customerError) {
            if (customerError.code === 'PGRST116') {
              // No customer record found
              setInvoices([])
              return
            }
            throw customerError
          }

          customerIdToUse = customerData.id
        }

        if (!customerIdToUse) {
          setInvoices([])
          return
        }

        // Build query
        let query = client
          .from('invoices')
          .select('*')
          .eq('customer_id', customerIdToUse)

        // Apply status filter
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter)
        }

        // Apply date filter
        if (dateFilter !== 'all') {
          const now = new Date()
          let startDate: Date

          switch (dateFilter) {
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              break
            case 'month':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              break
            case 'quarter':
              startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
              break
            case 'year':
              startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
              break
            default:
              startDate = new Date(0)
          }

          query = query.gte('created_at', startDate.toISOString())
        }

        // Apply sorting
        const sortColumn = sortBy === 'date' ? 'created_at' : 'amount_paid'
        query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

        // Apply limit
        if (limit > 0) {
          query = query.limit(limit)
        }

        const { data, error } = await query

        if (error) {
          if (error.code === 'PGRST106' || error.message.includes('relation "invoices" does not exist')) {
            // Table doesn't exist, return empty array
            console.warn('invoices table does not exist')
            setInvoices([])
            return
          }
          throw error
        }

        setInvoices(data || [])
      } catch (err) {
        console.error('Error fetching invoices:', err)
        setError('Failed to load invoices')
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [user, customerId, statusFilter, dateFilter, sortBy, sortOrder, limit])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'open':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      case 'void':
      case 'uncollectible':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <DocumentTextIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

    switch (status.toLowerCase()) {
      case 'paid':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'open':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'void':
        return `${baseClasses} bg-gray-100 text-gray-800`
      case 'uncollectible':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const handleDownloadInvoice = async (invoice: Invoice) => {
    if (!invoice.invoice_pdf) {
      console.warn('No PDF available for invoice:', invoice.stripe_invoice_id)
      return
    }

    try {
      // Open the PDF in a new tab
      window.open(invoice.invoice_pdf, '_blank')
    } catch (error) {
      console.error('Failed to download invoice:', error)
    }
  }

  const handleViewInvoice = (invoice: Invoice) => {
    // This could open a modal or navigate to a detailed invoice view
    console.log('View invoice details:', invoice.stripe_invoice_id)
    // For now, just download the PDF if available
    if (invoice.invoice_pdf) {
      handleDownloadInvoice(invoice)
    }
  }

  const calculateTotalPaid = () => {
    return invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((total, invoice) => total + invoice.amount_paid, 0)
  }

  const calculateTotalDue = () => {
    return invoices
      .filter(invoice => invoice.status === 'open')
      .reduce((total, invoice) => total + invoice.amount_due, 0)
  }

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          {showFilters && (
            <div className="flex space-x-4">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          )}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-6`}>
        <div className="text-center">
          <ExclamationCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Invoices</h3>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Invoices</h3>
          {invoices.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {showFilters && (
          <div className="flex space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="open">Open</option>
              <option value="void">Void</option>
              <option value="uncollectible">Uncollectible</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as ['date' | 'amount', 'asc' | 'desc']
                setSortBy(newSortBy)
                setSortOrder(newSortOrder)
              }}
              className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Total Paid</p>
                <p className="text-xl font-bold text-green-900">
                  {formatAmount(calculateTotalPaid())}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-600">Amount Due</p>
                <p className="text-xl font-bold text-yellow-900">
                  {formatAmount(calculateTotalDue())}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Invoices</p>
                <p className="text-xl font-bold text-blue-900">{invoices.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices Found</h3>
          <p className="text-gray-600">
            {statusFilter !== 'all' || dateFilter !== 'all'
              ? 'No invoices match your current filters. Try adjusting your search criteria.'
              : 'No invoices have been generated yet.'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0">
                        {getStatusIcon(invoice.status)}
                      </div>

                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Invoice #{invoice.stripe_invoice_id.substring(3, 15)}...
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDate(invoice.created_at)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900">
                              {invoice.status === 'paid'
                                ? formatAmount(invoice.amount_paid)
                                : formatAmount(invoice.amount_due)
                              }
                            </p>
                            <span className={getStatusBadge(invoice.status)}>
                              {invoice.status}
                            </span>
                          </div>
                        </div>

                        {invoice.subscription_id && (
                          <p className="text-xs text-gray-400 mt-1">
                            Subscription invoice
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        className="text-indigo-600 hover:text-indigo-900 p-1"
                        title="View invoice"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>

                      {invoice.invoice_pdf && (
                        <button
                          onClick={() => handleDownloadInvoice(invoice)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="Download PDF"
                        >
                          {/* <DownloadIcon className="h-5 w-5" /> */}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
