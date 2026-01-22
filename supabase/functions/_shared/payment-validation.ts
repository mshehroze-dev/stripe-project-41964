/**
 * Server-side payment validation utilities for Supabase Edge Functions
 * Provides comprehensive input validation and sanitization for payment operations
 */

// Supported currencies (ISO 4217 codes)
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK',
  'PLN', 'CZK', 'HUF', 'BGN', 'RON', 'HRK', 'ISK', 'MXN', 'BRL', 'SGD',
  'HKD', 'NZD', 'KRW', 'INR', 'MYR', 'THB', 'PHP', 'IDR', 'VND', 'TWD'
] as const

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number]

// Validation result interface
export interface ValidationResult<T = any> {
  valid: boolean
  error?: string
  sanitized?: T
}

// Payment mode validation
export type PaymentMode = 'payment' | 'subscription'

/**
 * Validate payment amount in cents
 * Ensures amount is positive integer within reasonable limits
 */
export function validatePaymentAmount(amount: any): ValidationResult<number> {
  if (amount === undefined || amount === null) {
    return { valid: false, error: 'Payment amount is required' }
  }

  let numericAmount: number
  if (typeof amount === 'string') {
    numericAmount = parseInt(amount, 10)
  } else if (typeof amount === 'number') {
    numericAmount = Math.floor(amount)
  } else {
    return { valid: false, error: 'Payment amount must be a number' }
  }

  if (isNaN(numericAmount) || !isFinite(numericAmount)) {
    return { valid: false, error: 'Invalid payment amount format' }
  }

  if (numericAmount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than zero' }
  }

  // Minimum amount: 50 cents for most currencies
  if (numericAmount < 50) {
    return { valid: false, error: 'Payment amount must be at least 50 cents' }
  }

  // Maximum amount: $999,999.99 to prevent overflow
  if (numericAmount > 99999999) {
    return { valid: false, error: 'Payment amount exceeds maximum limit of $999,999.99' }
  }

  return { valid: true, sanitized: numericAmount }
}

/**
 * Validate currency code
 */
export function validateCurrency(currency: any): ValidationResult<SupportedCurrency> {
  if (!currency) {
    return { valid: true, sanitized: 'USD' as SupportedCurrency }
  }

  if (typeof currency !== 'string') {
    return { valid: false, error: 'Currency must be a string' }
  }

  const upperCurrency = currency.trim().toUpperCase() as SupportedCurrency
  
  if (!SUPPORTED_CURRENCIES.includes(upperCurrency)) {
    return { 
      valid: false, 
      error: `Unsupported currency: ${currency}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` 
    }
  }

  return { valid: true, sanitized: upperCurrency }
}

/**
 * Validate quantity
 */
export function validateQuantity(quantity: any): ValidationResult<number> {
  if (quantity === undefined || quantity === null) {
    return { valid: true, sanitized: 1 }
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
    return { valid: false, error: 'Quantity cannot exceed 100 items' }
  }

  return { valid: true, sanitized: numericQuantity }
}

/**
 * Validate URL format
 */
export function validateUrl(url: any, fieldName: string): ValidationResult<string> {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: `${fieldName} is required and must be a string` }
  }

  const trimmedUrl = url.trim()
  
  if (trimmedUrl.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` }
  }

  if (trimmedUrl.length > 2048) {
    return { valid: false, error: `${fieldName} exceeds maximum length of 2048 characters` }
  }

  try {
    const urlObj = new URL(trimmedUrl)
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: `${fieldName} must use HTTP or HTTPS protocol` }
    }

    // Basic security check - prevent localhost in production
    if (Deno.env.get('ENVIRONMENT') === 'production' && 
        (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
      return { valid: false, error: `${fieldName} cannot use localhost in production` }
    }

    return { valid: true, sanitized: trimmedUrl }
  } catch {
    return { valid: false, error: `${fieldName} must be a valid URL` }
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: any): ValidationResult<string> {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required and must be a string' }
  }

  const trimmedEmail = email.trim().toLowerCase()
  
  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'Email cannot be empty' }
  }

  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email address exceeds maximum length of 254 characters' }
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' }
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
): ValidationResult<string> {
  const { 
    required = false, 
    minLength = 0, 
    maxLength = 255, 
    pattern, 
    allowEmpty = true 
  } = options

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
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` }
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
 * Validate payment mode
 */
export function validatePaymentMode(mode: any): ValidationResult<PaymentMode> {
  if (!mode) {
    return { valid: true, sanitized: 'payment' as PaymentMode }
  }

  if (typeof mode !== 'string') {
    return { valid: false, error: 'Payment mode must be a string' }
  }

  const lowerMode = mode.toLowerCase().trim()
  
  if (!['payment', 'subscription'].includes(lowerMode)) {
    return { valid: false, error: 'Payment mode must be either "payment" or "subscription"' }
  }

  return { valid: true, sanitized: lowerMode as PaymentMode }
}

/**
 * Validate Stripe price ID format
 */
export function validatePriceId(priceId: any): ValidationResult<string> {
  if (!priceId || typeof priceId !== 'string') {
    return { valid: false, error: 'Price ID is required and must be a string' }
  }

  const trimmedId = priceId.trim()
  
  if (trimmedId.length === 0) {
    return { valid: false, error: 'Price ID cannot be empty' }
  }

  // Stripe price IDs start with 'price_'
  if (!trimmedId.startsWith('price_')) {
    return { valid: false, error: 'Invalid price ID format. Must start with "price_"' }
  }

  if (trimmedId.length > 255) {
    return { valid: false, error: 'Price ID exceeds maximum length' }
  }

  // Validate characters (alphanumeric and underscores)
  const validPattern = /^price_[a-zA-Z0-9_]+$/
  if (!validPattern.test(trimmedId)) {
    return { valid: false, error: 'Price ID contains invalid characters' }
  }

  return { valid: true, sanitized: trimmedId }
}

/**
 * Validate Stripe customer ID format
 */
export function validateCustomerId(customerId: any): ValidationResult<string> {
  if (!customerId) {
    return { valid: true, sanitized: undefined }
  }

  if (typeof customerId !== 'string') {
    return { valid: false, error: 'Customer ID must be a string' }
  }

  const trimmedId = customerId.trim()
  
  if (trimmedId.length === 0) {
    return { valid: true, sanitized: undefined }
  }

  // Stripe customer IDs start with 'cus_'
  if (!trimmedId.startsWith('cus_')) {
    return { valid: false, error: 'Invalid customer ID format. Must start with "cus_"' }
  }

  if (trimmedId.length > 255) {
    return { valid: false, error: 'Customer ID exceeds maximum length' }
  }

  // Validate characters
  const validPattern = /^cus_[a-zA-Z0-9_]+$/
  if (!validPattern.test(trimmedId)) {
    return { valid: false, error: 'Customer ID contains invalid characters' }
  }

  return { valid: true, sanitized: trimmedId }
}

/**
 * Validate trial period days
 */
export function validateTrialDays(trialDays: any): ValidationResult<number> {
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
 * Validate promo code format
 */
export function validatePromoCode(promoCode: any): ValidationResult<string> {
  if (!promoCode) {
    return { valid: true, sanitized: undefined }
  }

  if (typeof promoCode !== 'string') {
    return { valid: false, error: 'Promo code must be a string' }
  }

  const trimmedCode = promoCode.trim().toUpperCase()
  
  if (trimmedCode.length === 0) {
    return { valid: true, sanitized: undefined }
  }

  if (trimmedCode.length > 50) {
    return { valid: false, error: 'Promo code cannot exceed 50 characters' }
  }

  // Allow alphanumeric characters, hyphens, and underscores
  const validPattern = /^[A-Z0-9\-_]+$/
  if (!validPattern.test(trimmedCode)) {
    return { valid: false, error: 'Promo code contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed' }
  }

  return { valid: true, sanitized: trimmedCode }
}

/**
 * Validate metadata object
 */
export function validateMetadata(metadata: any): ValidationResult<Record<string, string>> {
  if (metadata === undefined || metadata === null) {
    return { valid: true, sanitized: {} }
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { valid: false, error: 'Metadata must be an object' }
  }

  const sanitizedMetadata: Record<string, string> = {}
  const entries = Object.entries(metadata)
  
  if (entries.length > 50) {
    return { valid: false, error: 'Metadata cannot have more than 50 key-value pairs' }
  }

  for (const [key, value] of entries) {
    // Validate key
    if (typeof key !== 'string' || key.trim().length === 0) {
      return { valid: false, error: 'Metadata keys must be non-empty strings' }
    }

    if (key.length > 40) {
      return { valid: false, error: `Metadata key "${key}" exceeds 40 character limit` }
    }

    // Validate value
    if (value !== null && value !== undefined) {
      const stringValue = String(value).trim()
      if (stringValue.length > 500) {
        return { valid: false, error: `Metadata value for key "${key}" exceeds 500 character limit` }
      }
      sanitizedMetadata[key.trim()] = stringValue
    }
  }

  return { valid: true, sanitized: sanitizedMetadata }
}

/**
 * Validate boolean value
 */
export function validateBoolean(value: any, fieldName: string, defaultValue = false): ValidationResult<boolean> {
  if (value === undefined || value === null) {
    return { valid: true, sanitized: defaultValue }
  }

  if (typeof value === 'boolean') {
    return { valid: true, sanitized: value }
  }

  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim()
    if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
      return { valid: true, sanitized: true }
    }
    if (['false', '0', 'no', 'off'].includes(lowerValue)) {
      return { valid: true, sanitized: false }
    }
  }

  return { valid: false, error: `${fieldName} must be a boolean value` }
}

/**
 * Comprehensive validation for checkout session request
 */
export function validateCheckoutSessionRequest(requestData: any): ValidationResult<any> {
  if (!requestData || typeof requestData !== 'object') {
    return { valid: false, error: 'Request data must be an object' }
  }

  const errors: string[] = []
  const sanitized: any = {}

  // Validate required URLs
  const successUrlValidation = validateUrl(requestData.successUrl, 'Success URL')
  if (!successUrlValidation.valid) {
    errors.push(successUrlValidation.error!)
  } else {
    sanitized.successUrl = successUrlValidation.sanitized
  }

  const cancelUrlValidation = validateUrl(requestData.cancelUrl, 'Cancel URL')
  if (!cancelUrlValidation.valid) {
    errors.push(cancelUrlValidation.error!)
  } else {
    sanitized.cancelUrl = cancelUrlValidation.sanitized
  }

  // Validate payment mode
  const modeValidation = validatePaymentMode(requestData.mode)
  if (!modeValidation.valid) {
    errors.push(modeValidation.error!)
  } else {
    sanitized.mode = modeValidation.sanitized
  }

  // Validate price ID (required for both payment and subscription modes)
  if (requestData.priceId !== undefined) {
    const priceIdValidation = validatePriceId(requestData.priceId)
    if (!priceIdValidation.valid) {
      errors.push(priceIdValidation.error!)
    } else {
      sanitized.priceId = priceIdValidation.sanitized
    }
  }

  // Validate quantity
  const quantityValidation = validateQuantity(requestData.quantity)
  if (!quantityValidation.valid) {
    errors.push(quantityValidation.error!)
  } else {
    sanitized.quantity = quantityValidation.sanitized
  }

  // Validate currency
  const currencyValidation = validateCurrency(requestData.currency)
  if (!currencyValidation.valid) {
    errors.push(currencyValidation.error!)
  } else {
    sanitized.currency = currencyValidation.sanitized
  }

  // Validate customer ID
  const customerIdValidation = validateCustomerId(requestData.customerId)
  if (!customerIdValidation.valid) {
    errors.push(customerIdValidation.error!)
  } else if (customerIdValidation.sanitized) {
    sanitized.customerId = customerIdValidation.sanitized
  }

  // Validate customer email
  if (requestData.customerEmail !== undefined) {
    const emailValidation = validateEmail(requestData.customerEmail)
    if (!emailValidation.valid) {
      errors.push(emailValidation.error!)
    } else {
      sanitized.customerEmail = emailValidation.sanitized
    }
  }

  // Validate trial days (for subscription mode)
  if (requestData.trialDays !== undefined) {
    const trialValidation = validateTrialDays(requestData.trialDays)
    if (!trialValidation.valid) {
      errors.push(trialValidation.error!)
    } else {
      sanitized.trialDays = trialValidation.sanitized
    }
  }

  // Validate promo code
  if (requestData.promoCode !== undefined) {
    const promoValidation = validatePromoCode(requestData.promoCode)
    if (!promoValidation.valid) {
      errors.push(promoValidation.error!)
    } else if (promoValidation.sanitized) {
      sanitized.promoCode = promoValidation.sanitized
    }
  }

  // Validate boolean flags
  const booleanFields = [
    'allowPromotionCodes',
    'collectBillingAddress', 
    'collectShippingAddress'
  ]

  for (const field of booleanFields) {
    if (requestData[field] !== undefined) {
      const boolValidation = validateBoolean(requestData[field], field)
      if (!boolValidation.valid) {
        errors.push(boolValidation.error!)
      } else {
        sanitized[field] = boolValidation.sanitized
      }
    }
  }

  // Validate metadata
  if (requestData.metadata !== undefined) {
    const metadataValidation = validateMetadata(requestData.metadata)
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
 * Sanitize request body to prevent injection attacks
 */
export function sanitizeRequestBody(body: any): any {
  if (typeof body !== 'object' || body === null) {
    return body
  }

  if (Array.isArray(body)) {
    return body.map(sanitizeRequestBody)
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Basic HTML entity encoding for string values
      sanitized[key] = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeRequestBody(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}