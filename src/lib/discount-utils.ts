
/**
 * Utility functions for handling promotional codes and discount calculations
 */

export interface PromoCode {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  currency?: string
  valid: boolean
  error?: string
}

export interface DiscountCalculation {
  originalAmount: number
  discountAmount: number
  finalAmount: number
  discountPercentage?: number
  currency: string
}

/**
 * Calculate discount amount based on promo code and original amount
 */
export function calculateDiscount(
  originalAmount: number,
  promoCode: PromoCode,
  currency: string = 'USD'
): DiscountCalculation {
  if (!promoCode.valid) {
    return {
      originalAmount,
      discountAmount: 0,
      finalAmount: originalAmount,
      currency,
    }
  }

  let discountAmount = 0
  let discountPercentage: number | undefined

  if (promoCode.discount_type === 'percentage') {
    discountPercentage = promoCode.discount_value
    discountAmount = Math.round((originalAmount * promoCode.discount_value) / 100)
  } else if (promoCode.discount_type === 'fixed') {
    // Convert fixed discount to same currency if needed
    if (promoCode.currency && promoCode.currency.toUpperCase() === currency.toUpperCase()) {
      discountAmount = promoCode.discount_value
    } else {
      // For simplicity, assume same currency. In production, you'd need currency conversion
      discountAmount = promoCode.discount_value
    }

    // Calculate percentage for display purposes
    discountPercentage = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0
  }

  // Ensure discount doesn't exceed original amount
  discountAmount = Math.min(discountAmount, originalAmount)

  const finalAmount = Math.max(0, originalAmount - discountAmount)

  return {
    originalAmount,
    discountAmount,
    finalAmount,
    discountPercentage,
    currency,
  }
}

/**
 * Format discount for display
 */
export function formatDiscount(promoCode: PromoCode): string {
  if (!promoCode.valid) {
    return 'Invalid'
  }

  if (promoCode.discount_type === 'percentage') {
    return `${promoCode.discount_value}% off`
  } else {
    const currency = promoCode.currency || 'USD'
    const amount = (promoCode.discount_value / 100).toFixed(2)
    return `${currency.toUpperCase()} ${amount} off`
  }
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100) // Convert from cents to dollars
}

/**
 * Validate promo code format
 */
export function validatePromoCodeFormat(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Promo code is required' }
  }

  const trimmedCode = code.trim()

  if (trimmedCode.length === 0) {
    return { valid: false, error: 'Promo code cannot be empty' }
  }

  if (trimmedCode.length > 50) {
    return { valid: false, error: 'Promo code is too long' }
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[A-Za-z0-9\-_]+$/
  if (!validPattern.test(trimmedCode)) {
    return { valid: false, error: 'Promo code contains invalid characters' }
  }

  return { valid: true }
}
/**
 * Apply multiple discounts (for future extensibility)
 */
export function applyMultipleDiscounts(
  originalAmount: number,
  promoCodes: PromoCode[],
  currency: string = 'USD'
): DiscountCalculation {
  let currentAmount = originalAmount
  let totalDiscountAmount = 0

  // Apply discounts in order (percentage first, then fixed amounts)
  const sortedCodes = [...promoCodes].sort((a, b) => {
    if (a.discount_type === 'percentage' && b.discount_type === 'fixed') return -1
    if (a.discount_type === 'fixed' && b.discount_type === 'percentage') return 1
    return 0
  })

  for (const promoCode of sortedCodes) {
    if (!promoCode.valid) continue

    const discount = calculateDiscount(currentAmount, promoCode, currency)
    totalDiscountAmount += discount.discountAmount
    currentAmount = discount.finalAmount
  }

  const finalDiscountPercentage = originalAmount > 0
    ? Math.round((totalDiscountAmount / originalAmount) * 100)
    : 0

  return {
    originalAmount,
    discountAmount: totalDiscountAmount,
    finalAmount: currentAmount,
    discountPercentage: finalDiscountPercentage,
    currency,
  }
}

/**
 * Check if promo code is expired
 */
export function isPromoCodeExpired(redeemBy?: number): boolean {
  if (!redeemBy) return false

  const now = Math.floor(Date.now() / 1000)
  return now > redeemBy
}

/**
 * Check if promo code has reached usage limit
 */
export function hasReachedUsageLimit(timesRedeemed: number, maxRedemptions?: number): boolean {
  if (!maxRedemptions) return false

  return timesRedeemed >= maxRedemptions
}
