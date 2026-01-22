
/**
 * Comprehensive input validation and sanitization for payment operations
 * Validates payment amounts, currencies, checkout parameters, and user inputs
 */

// Supported currencies (ISO 4217 codes)
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK',
  'PLN', 'CZK', 'HUF', 'BGN', 'RON', 'HRK', 'ISK', 'MXN', 'BRL', 'SGD',
  'HKD', 'NZD', 'KRW', 'INR', 'MYR', 'THB', 'PHP', 'IDR', 'VND', 'TWD'
] as const

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number]

// Payment validation interfaces
export interface ValidationResult {
  valid: boolean
  error?: string
  sanitized?: any
}

export interface PaymentAmountValidation extends ValidationResult {
  sanitized?: number
}

export interface CurrencyValidation extends ValidationResult {
  sanitized?: SupportedCurrency
}

export interface CheckoutSessionValidation extends ValidationResult {
  sanitized?: CheckoutSessionParams
}

export interface CheckoutSessionParams {
  amount?: number
  currency?: string
  priceId?: string
  quantity?: number
  customerId?: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  mode?: 'payment' | 'subscription'
  allowPromotionCodes?: boolean
  promoCode?: string
  collectBillingAddress?: boolean
  collectShippingAddress?: boolean
  metadata?: Record<string, string>
  trialDays?: number
}

/**
 * Validate and sanitize payment amount
 * Ensures amount is positive, within reasonable limits, and properly formatted
 */
export function validatePaymentAmount(amount: any): PaymentAmountValidation {
  // Check if amount is provided
  if (amount === undefined || amount === null) {
    return { valid: false, error: 'Payment amount is required' }
  }

  // Convert to number if string
  let numericAmount: number
  if (typeof amount === 'string') {
    // Remove any non-numeric characters except decimal point
    const cleanAmount = amount.replace(/[^\d.-]/g, '')
    numericAmount = parseFloat(cleanAmount)
  } else if (typeof amount === 'number') {
    numericAmount = amount
  } else {
    return { valid: false, error: 'Payment amount must be a number' }
  }

  // Check if conversion resulted in valid number
  if (isNaN(numericAmount) || !isFinite(numericAmount)) {
    return { valid: false, error: 'Invalid payment amount format' }
  }

  // Ensure amount is positive
  if (numericAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than zero' }
  }

  // Check minimum amount (50 cents for most currencies)
  if (numericAmount < 50) {
    return { valid: false, error: 'Payment amount must be at least $0.50' }
  }

  // Check maximum amount (reasonable limit to prevent errors)
  if (numericAmount > 99999999) { // $999,999.99
    return { valid: false, error: 'Payment amount exceeds maximum limit' }
  }

  // Ensure amount has at most 2 decimal places (cents precision)
  const rounded = Math.round(numericAmount)
  if (Math.abs(numericAmount - rounded) > 0.01) {
    return { valid: false, error: 'Payment amount cannot have more than 2 decimal places' }
  }

  return { valid: true, sanitized: rounded }
}

/**
 * Validate and sanitize currency code
 * Ensures currency is supported and properly formatted
 */
export function validateCurrency(currency: any): CurrencyValidation {
  if (!currency) {
    return { valid: true, sanitized: 'USD' } // Default to USD
  }

  if (typeof currency !== 'string') {
    return { valid: false, error: 'Currency must be a string' }
  }

  const upperCurrency = currency.trim().toUpperCase() as SupportedCurrency

  if (!SUPPORTED_CURRENCIES.includes(upperCurrency)) {
    return {
      valid: false,
      error: `Unsupported currency: ${currency}. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    }
  }

  return { valid: true, sanitized: upperCurrency }
}

/**
 * Validate and sanitize quantity
 */
export function validateQuantity(quantity: any): ValidationResult {
  if (quantity === undefined || quantity === null) {
    return { valid: true, sanitized: 1 } // Default quantity
  }

  let numericQuantity: number
  if (typeof quantity === 'string') {
    numericQuantity = parseInt(quantity, 10)
  } else if (typeof quantity === 'number') {
    numericQuantity = Math.floor(quantity)
  } else {
    return { valid: false, error: 'Quantity must be a number' }
  }

  if (isNaN(numericQuantity) || !isFinite(numericQuantity)) {
    return { valid: false, error: 'Invalid quantity format' }
  }

  if (numericQuantity < 1) {
    return { valid: false, error: 'Quantity must be at least 1' }
  }

  if (numericQuantity > 100) {
    return { valid: false, error: 'Quantity cannot exceed 100' }
  }

  return { valid: true, sanitized: numericQuantity }
}

/**
 * Validate URL format
 */
export function validateUrl(url: any, fieldName: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: `${fieldName} is required and must be a string` }
  }

  const trimmedUrl = url.trim()

  if (trimmedUrl.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` }
  }

  try {
    const urlObj = new URL(trimmedUrl)

    // Ensure it's HTTP or HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: `${fieldName} must use HTTP or HTTPS protocol` }
    }

    // Check for reasonable length
    if (trimmedUrl.length > 2048) {
      return { valid: false, error: `${fieldName} is too long` }
    }

    return { valid: true, sanitized: trimmedUrl }
  } catch {
    return { valid: false, error: `${fieldName} must be a valid URL` }
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: any): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' }
  }

  const trimmedEmail = email.trim().toLowerCase()

  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'Email cannot be empty' }
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' }
  }

  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email address is too long' }
  }

  return { valid: true, sanitized: trimmedEmail }
}

/**
 * Validate and sanitize string input
 */
export function validateString(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    allowEmpty?: boolean
  } = {}
): ValidationResult {
  const { required = false, minLength = 0, maxLength = 255, pattern, allowEmpty = true } = options

  if (value === undefined || value === null) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` }
    }
    return { valid: true, sanitized: '' }
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` }
  }

  const trimmedValue = value.trim()

  if (!allowEmpty && trimmedValue.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` }
  }

  if (trimmedValue.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters long` }
  }

  if (trimmedValue.length > maxLength) {
    return { valid: false, error: `${fieldName} cannot exceed ${maxLength} characters` }
  }

  if (pattern && !pattern.test(trimmedValue)) {
    return { valid: false, error: `${fieldName} contains invalid characters` }
  }

  return { valid: true, sanitized: trimmedValue }
}

/**
 * Validate trial period for subscriptions
 */
export function validateTrialDays(trialDays: any): ValidationResult {
  if (trialDays === undefined || trialDays === null) {
    return { valid: true, sanitized: 0 }
  }

  let numericDays: number
  if (typeof trialDays === 'string') {
    numericDays = parseInt(trialDays, 10)
  } else if (typeof trialDays === 'number') {
    numericDays = Math.floor(trialDays)
  } else {
    return { valid: false, error: 'Trial days must be a number' }
  }

  if (isNaN(numericDays) || !isFinite(numericDays)) {
    return { valid: false, error: 'Invalid trial days format' }
  }

  if (numericDays < 0) {
    return { valid: false, error: 'Trial days cannot be negative' }
  }

  if (numericDays > 365) {
    return { valid: false, error: 'Trial period cannot exceed 365 days' }
  }

  return { valid: true, sanitized: numericDays }
}

/**
 * Validate metadata object
 */
export function validateMetadata(metadata: any): ValidationResult {
  if (metadata === undefined || metadata === null) {
    return { valid: true, sanitized: {} }
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { valid: false, error: 'Metadata must be an object' }
  }

  const sanitizedMetadata: Record<string, string> = {}

  for (const [key, value] of Object.entries(metadata)) {
    // Validate key
    if (typeof key !== 'string' || key.trim().length === 0) {
      return { valid: false, error: 'Metadata keys must be non-empty strings' }
    }

    if (key.length > 40) {
      return { valid: false, error: 'Metadata keys cannot exceed 40 characters' }
    }

    // Validate value
    if (value !== null && value !== undefined) {
      const stringValue = String(value).trim()
      if (stringValue.length > 500) {
        return { valid: false, error: 'Metadata values cannot exceed 500 characters' }
      }
      sanitizedMetadata[key.trim()] = stringValue
    }
  }

  // Check total metadata size (Stripe limit is 50 key-value pairs)
  if (Object.keys(sanitizedMetadata).length > 50) {
    return { valid: false, error: 'Metadata cannot have more than 50 key-value pairs' }
  }

  return { valid: true, sanitized: sanitizedMetadata }
}

/**
 * Comprehensive validation for checkout session parameters
 */
export function validateCheckoutSession(params: any): CheckoutSessionValidation {
  if (!params || typeof params !== 'object') {
    return { valid: false, error: 'Checkout parameters must be an object' }
  }

  const errors: string[] = []
  const sanitized: CheckoutSessionParams = {
    successUrl: '',
    cancelUrl: ''
  }

  // Validate required URLs
  const successUrlValidation = validateUrl(params.successUrl, 'Success URL')
  if (!successUrlValidation.valid) {
    errors.push(successUrlValidation.error!)
  } else {
    sanitized.successUrl = successUrlValidation.sanitized
  }

  const cancelUrlValidation = validateUrl(params.cancelUrl, 'Cancel URL')
  if (!cancelUrlValidation.valid) {
    errors.push(cancelUrlValidation.error!)
  } else {
    sanitized.cancelUrl = cancelUrlValidation.sanitized
  }

  // Validate mode
  if (params.mode !== undefined) {
    if (!['payment', 'subscription'].includes(params.mode)) {
      errors.push('Mode must be either "payment" or "subscription"')
    } else {
      sanitized.mode = params.mode
    }
  }

  // Validate amount (for payment mode)
  if (params.amount !== undefined) {
    const amountValidation = validatePaymentAmount(params.amount)
    if (!amountValidation.valid) {
      errors.push(amountValidation.error!)
    } else {
      sanitized.amount = amountValidation.sanitized
    }
  }

  // Validate currency
  if (params.currency !== undefined) {
    const currencyValidation = validateCurrency(params.currency)
    if (!currencyValidation.valid) {
      errors.push(currencyValidation.error!)
    } else {
      sanitized.currency = currencyValidation.sanitized
    }
  }

  // Validate quantity
  if (params.quantity !== undefined) {
    const quantityValidation = validateQuantity(params.quantity)
    if (!quantityValidation.valid) {
      errors.push(quantityValidation.error!)
    } else {
      sanitized.quantity = quantityValidation.sanitized
    }
  }

  // Validate price ID
  if (params.priceId !== undefined) {
    const priceIdValidation = validateString(params.priceId, 'Price ID', {
      required: false,
      minLength: 1,
      maxLength: 255,
      pattern: /^price_[a-zA-Z0-9_]+$/
    })
    if (!priceIdValidation.valid) {
      errors.push(priceIdValidation.error!)
    } else {
      sanitized.priceId = priceIdValidation.sanitized
    }
  }

  // Validate customer ID
  if (params.customerId !== undefined) {
    const customerIdValidation = validateString(params.customerId, 'Customer ID', {
      required: false,
      minLength: 1,
      maxLength: 255,
      pattern: /^cus_[a-zA-Z0-9_]+$/
    })
    if (!customerIdValidation.valid) {
      errors.push(customerIdValidation.error!)
    } else {
      sanitized.customerId = customerIdValidation.sanitized
    }
  }

  // Validate customer email
  if (params.customerEmail !== undefined) {
    const emailValidation = validateEmail(params.customerEmail)
    if (!emailValidation.valid) {
      errors.push(emailValidation.error!)
    } else {
      sanitized.customerEmail = emailValidation.sanitized
    }
  }

  // Validate trial days
  if (params.trialDays !== undefined) {
    const trialValidation = validateTrialDays(params.trialDays)
    if (!trialValidation.valid) {
      errors.push(trialValidation.error!)
    } else {
      sanitized.trialDays = trialValidation.sanitized
    }
  }

  // Validate boolean flags
  if (params.allowPromotionCodes !== undefined) {
    if (typeof params.allowPromotionCodes !== 'boolean') {
      errors.push('Allow promotion codes must be a boolean')
    } else {
      sanitized.allowPromotionCodes = params.allowPromotionCodes
    }
  }

  if (params.collectBillingAddress !== undefined) {
    if (typeof params.collectBillingAddress !== 'boolean') {
      errors.push('Collect billing address must be a boolean')
    } else {
      sanitized.collectBillingAddress = params.collectBillingAddress
    }
  }

  if (params.collectShippingAddress !== undefined) {
    if (typeof params.collectShippingAddress !== 'boolean') {
      errors.push('Collect shipping address must be a boolean')
    } else {
      sanitized.collectShippingAddress = params.collectShippingAddress
    }
  }

  // Validate promo code
  if (params.promoCode !== undefined) {
    const promoValidation = validateString(params.promoCode, 'Promo code', {
      required: false,
      minLength: 1,
      maxLength: 50,
      pattern: /^[A-Z0-9\-_]+$/i
    })
    if (!promoValidation.valid) {
      errors.push(promoValidation.error!)
    } else {
      sanitized.promoCode = promoValidation.sanitized?.toUpperCase()
    }
  }

  // Validate metadata
  if (params.metadata !== undefined) {
    const metadataValidation = validateMetadata(params.metadata)
    if (!metadataValidation.valid) {
      errors.push(metadataValidation.error!)
    } else {
      sanitized.metadata = metadataValidation.sanitized
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') }
  }

  return { valid: true, sanitized }
}

/**
 * Sanitize HTML input to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate and sanitize form data for payment forms
 */
export function validatePaymentForm(formData: any): ValidationResult {
  if (!formData || typeof formData !== 'object') {
    return { valid: false, error: 'Form data must be an object' }
  }

  const errors: string[] = []
  const sanitized: any = {}

  // Common form fields validation
  const fieldValidations = [
    { key: 'email', validator: validateEmail },
    { key: 'name', validator: (v: any) => validateString(v, 'Name', { required: true, maxLength: 100 }) },
    { key: 'address', validator: (v: any) => validateString(v, 'Address', { required: false, maxLength: 200 }) },
    { key: 'city', validator: (v: any) => validateString(v, 'City', { required: false, maxLength: 100 }) },
    { key: 'state', validator: (v: any) => validateString(v, 'State', { required: false, maxLength: 100 }) },
    { key: 'zipCode', validator: (v: any) => validateString(v, 'ZIP Code', { required: false, maxLength: 20, pattern: /^[A-Za-z0-9\s\-]+$/ }) },
    { key: 'country', validator: (v: any) => validateString(v, 'Country', { required: false, maxLength: 2, pattern: /^[A-Z]{2}$/ }) },
  ]

  for (const { key, validator } of fieldValidations) {
    if (formData[key] !== undefined) {
      const validation = validator(formData[key])
      if (!validation.valid) {
        errors.push(validation.error!)
      } else {
        sanitized[key] = validation.sanitized
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') }
  }

  return { valid: true, sanitized }
}
