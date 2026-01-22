
import React, { useState } from 'react'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { formatDiscount, validatePromoCodeFormat } from '../../lib/discount-utils'

interface PromoCode {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  currency?: string
  valid: boolean
  error?: string
}

interface PromoCodeInputProps {
  onCodeApplied?: (promoCode: PromoCode) => void
  onCodeRemoved?: () => void
  className?: string
  placeholder?: string
  disabled?: boolean
  appliedCode?: PromoCode | null
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  onCodeApplied,
  onCodeRemoved,
  className = '',
  placeholder = 'Enter promo code',
  disabled = false,
  appliedCode = null
}) => {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<PromoCode | null>(appliedCode)

  const validatePromoCode = async (promoCode: string) => {
    // Client-side validation first
    const formatValidation = validatePromoCodeFormat(promoCode)
    if (!formatValidation.valid) {
      setError(formatValidation.error || 'Invalid promo code format')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/validate-promo-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to validate promo code')
      }

      if (result.valid) {
        const validPromoCode: PromoCode = {
          id: result.id,
          code: result.code,
          discount_type: result.discount_type,
          discount_value: result.discount_value,
          currency: result.currency,
          valid: true,
        }

        setValidationResult(validPromoCode)
        onCodeApplied?.(validPromoCode)
        setError(null)
      } else {
        setError(result.error || 'Invalid promo code')
        setValidationResult(null)
      }
    } catch (err) {
      console.error('Promo code validation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to validate promo code')
      setValidationResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    validatePromoCode(code)
  }

  const handleRemoveCode = () => {
    setCode('')
    setValidationResult(null)
    setError(null)
    onCodeRemoved?.()
  }

  const baseClassName = `
    border border-gray-300 rounded-lg p-4 bg-white
    ${className}
  `.trim()

  if (validationResult?.valid) {
    return (
      <div className={baseClassName}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Promo code applied: <span className="font-mono">{validationResult.code}</span>
              </p>
              <p className="text-sm text-green-600">
                {formatDiscount(validationResult)}
              </p>
            </div>
          </div>

          <button
            onClick={handleRemoveCode}
            disabled={disabled}
            className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={baseClassName}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="promo-code" className="block text-sm font-medium text-gray-700 mb-2">
            Promo Code
          </label>

          <div className="flex space-x-2">
            <input
              id="promo-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={placeholder}
              disabled={disabled || loading}
              className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />

            <button
              type="submit"
              disabled={disabled || loading || !code.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </>
              ) : (
                'Apply'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-red-600">
            <ExclamationCircleIcon className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </form>

      <div className="mt-3 text-xs text-gray-500">
        <p>Enter a valid promo code to receive a discount on your purchase.</p>
      </div>
    </div>
  )
}
