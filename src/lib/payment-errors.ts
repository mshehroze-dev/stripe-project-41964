
/**
 * Error handling utilities for payment operations
 * Centralized error handling, logging, and user-friendly error messages
 */

/**
 * Payment error types
 */
export enum PaymentErrorType {
  // Stripe-specific errors
  CARD_DECLINED = 'card_declined',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  EXPIRED_CARD = 'expired_card',
  INCORRECT_CVC = 'incorrect_cvc',
  PROCESSING_ERROR = 'processing_error',

  // Subscription errors
  SUBSCRIPTION_NOT_FOUND = 'subscription_not_found',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  PLAN_NOT_FOUND = 'plan_not_found',
  INVALID_PLAN_CHANGE = 'invalid_plan_change',

  // Validation errors
  INVALID_AMOUNT = 'invalid_amount',
  INVALID_CURRENCY = 'invalid_currency',
  INVALID_EMAIL = 'invalid_email',
  MISSING_REQUIRED_FIELD = 'missing_required_field',

  // Authentication errors
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  SESSION_EXPIRED = 'session_expired',

  // Network/API errors
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  TIMEOUT_ERROR = 'timeout_error',

  // General errors
  UNKNOWN_ERROR = 'unknown_error',
  CONFIGURATION_ERROR = 'configuration_error'
}

/**
 * Payment error class with enhanced information
 */
export class PaymentError extends Error {
  public readonly type: PaymentErrorType
  public readonly code?: string
  public readonly userMessage: string
  public readonly originalError?: Error
  public readonly metadata?: Record<string, any>
  public readonly timestamp: Date
  public readonly retryable: boolean

  constructor(
    type: PaymentErrorType,
    message: string,
    options: {
      code?: string
      userMessage?: string
      originalError?: Error
      metadata?: Record<string, any>
      retryable?: boolean
    } = {}
  ) {
    super(message)

    this.name = 'PaymentError'
    this.type = type
    this.code = options.code
    this.userMessage = options.userMessage || this.getDefaultUserMessage(type)
    this.originalError = options.originalError
    this.metadata = options.metadata
    this.timestamp = new Date()
    this.retryable = options.retryable ?? this.isRetryableByDefault(type)

    // Maintain proper stack trace
    const errorConstructor = Error as { captureStackTrace?: (target: Error, ctor?: Function) => void }
    errorConstructor.captureStackTrace?.(this, PaymentError)
  }

  private getDefaultUserMessage(type: PaymentErrorType): string {
    switch (type) {
      case PaymentErrorType.CARD_DECLINED:
        return 'Your card was declined. Please try a different payment method.'
      case PaymentErrorType.INSUFFICIENT_FUNDS:
        return 'Your card has insufficient funds. Please try a different payment method.'
      case PaymentErrorType.EXPIRED_CARD:
        return 'Your card has expired. Please update your payment information.'
      case PaymentErrorType.INCORRECT_CVC:
        return 'The security code (CVC) is incorrect. Please check and try again.'
      case PaymentErrorType.PROCESSING_ERROR:
        return 'There was an error processing your payment. Please try again.'
      case PaymentErrorType.SUBSCRIPTION_NOT_FOUND:
        return 'Subscription not found. Please contact support if this continues.'
      case PaymentErrorType.SUBSCRIPTION_CANCELED:
        return 'This subscription has been canceled and cannot be modified.'
      case PaymentErrorType.PLAN_NOT_FOUND:
        return 'The selected plan is no longer available. Please choose a different plan.'
      case PaymentErrorType.INVALID_PLAN_CHANGE:
        return 'This plan change is not allowed. Please contact support for assistance.'
      case PaymentErrorType.INVALID_AMOUNT:
        return 'The payment amount is invalid. Please check and try again.'
      case PaymentErrorType.INVALID_CURRENCY:
        return 'The selected currency is not supported.'
      case PaymentErrorType.INVALID_EMAIL:
        return 'Please enter a valid email address.'
      case PaymentErrorType.MISSING_REQUIRED_FIELD:
        return 'Please fill in all required fields.'
      case PaymentErrorType.UNAUTHORIZED:
        return 'You need to log in to access this feature.'
      case PaymentErrorType.FORBIDDEN:
        return 'You do not have permission to perform this action.'
      case PaymentErrorType.SESSION_EXPIRED:
        return 'Your session has expired. Please log in again.'
      case PaymentErrorType.NETWORK_ERROR:
        return 'Network connection error. Please check your internet connection and try again.'
      case PaymentErrorType.API_ERROR:
        return 'Service temporarily unavailable. Please try again in a few moments.'
      case PaymentErrorType.TIMEOUT_ERROR:
        return 'Request timed out. Please try again.'
      case PaymentErrorType.CONFIGURATION_ERROR:
        return 'Service configuration error. Please contact support.'
      default:
        return 'An unexpected error occurred. Please try again or contact support.'
    }
  }

  private isRetryableByDefault(type: PaymentErrorType): boolean {
    const retryableTypes = [
      PaymentErrorType.NETWORK_ERROR,
      PaymentErrorType.API_ERROR,
      PaymentErrorType.TIMEOUT_ERROR,
      PaymentErrorType.PROCESSING_ERROR
    ]
    return retryableTypes.includes(type)
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      userMessage: this.userMessage,
      code: this.code,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
      stack: this.stack
    }
  }
}

/**
 * Convert Stripe errors to PaymentError
 */
export function handleStripeError(error: any): PaymentError {
  if (!error) {
    return new PaymentError(PaymentErrorType.UNKNOWN_ERROR, 'Unknown error occurred')
  }

  // Handle Stripe-specific error types
  if (error.type) {
    switch (error.type) {
      case 'card_error':
        return handleCardError(error)
      case 'validation_error':
        return new PaymentError(
          PaymentErrorType.MISSING_REQUIRED_FIELD,
          error.message || 'Validation error',
          {
            code: error.code,
            originalError: error,
            userMessage: error.message || 'Please check your payment information and try again.'
          }
        )
      case 'api_error':
        return new PaymentError(
          PaymentErrorType.API_ERROR,
          error.message || 'API error',
          {
            code: error.code,
            originalError: error,
            retryable: true
          }
        )
      case 'authentication_error':
        return new PaymentError(
          PaymentErrorType.CONFIGURATION_ERROR,
          error.message || 'Authentication error',
          {
            code: error.code,
            originalError: error,
            retryable: false
          }
        )
      case 'rate_limit_error':
        return new PaymentError(
          PaymentErrorType.API_ERROR,
          error.message || 'Rate limit exceeded',
          {
            code: error.code,
            originalError: error,
            retryable: true,
            userMessage: 'Too many requests. Please wait a moment and try again.'
          }
        )
    }
  }

  // Handle network errors
  if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
    return new PaymentError(
      PaymentErrorType.NETWORK_ERROR,
      error.message || 'Network error',
      {
        originalError: error,
        retryable: true
      }
    )
  }

  // Handle timeout errors
  if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
    return new PaymentError(
      PaymentErrorType.TIMEOUT_ERROR,
      error.message || 'Request timeout',
      {
        originalError: error,
        retryable: true
      }
    )
  }

  // Default to unknown error
  return new PaymentError(
    PaymentErrorType.UNKNOWN_ERROR,
    error.message || 'Unknown error occurred',
    {
      originalError: error,
      code: error.code
    }
  )
}

/**
 * Handle card-specific errors
 */
function handleCardError(error: any): PaymentError {
  const declineCode = error.decline_code
  const code = error.code

  // Map specific decline codes to error types
  if (declineCode === 'insufficient_funds' || code === 'insufficient_funds') {
    return new PaymentError(
      PaymentErrorType.INSUFFICIENT_FUNDS,
      error.message || 'Insufficient funds',
      {
        code: error.code,
        originalError: error
      }
    )
  }

  if (declineCode === 'expired_card' || code === 'expired_card') {
    return new PaymentError(
      PaymentErrorType.EXPIRED_CARD,
      error.message || 'Card expired',
      {
        code: error.code,
        originalError: error
      }
    )
  }

  if (code === 'incorrect_cvc') {
    return new PaymentError(
      PaymentErrorType.INCORRECT_CVC,
      error.message || 'Incorrect CVC',
      {
        code: error.code,
        originalError: error
      }
    )
  }

  // Generic card declined
  return new PaymentError(
    PaymentErrorType.CARD_DECLINED,
    error.message || 'Card declined',
    {
      code: error.code,
      originalError: error,
      metadata: {
        declineCode,
        cardType: error.payment_method?.card?.brand
      }
    }
  )
}

/**
 * Handle subscription-related errors
 */
export function handleSubscriptionError(error: any, context?: string): PaymentError {
  if (error instanceof PaymentError) {
    return error
  }

  const message = error.message || 'Subscription error'

  // Check for specific subscription error patterns
  if (message.includes('not found') || message.includes('does not exist')) {
    return new PaymentError(
      PaymentErrorType.SUBSCRIPTION_NOT_FOUND,
      message,
      {
        originalError: error,
        metadata: { context }
      }
    )
  }

  if (message.includes('canceled') || message.includes('cancelled')) {
    return new PaymentError(
      PaymentErrorType.SUBSCRIPTION_CANCELED,
      message,
      {
        originalError: error,
        metadata: { context }
      }
    )
  }

  if (message.includes('plan') && message.includes('not found')) {
    return new PaymentError(
      PaymentErrorType.PLAN_NOT_FOUND,
      message,
      {
        originalError: error,
        metadata: { context }
      }
    )
  }

  return new PaymentError(
    PaymentErrorType.UNKNOWN_ERROR,
    message,
    {
      originalError: error,
      metadata: { context }
    }
  )
}

/**
 * Error logging utility
 */
export class PaymentErrorLogger {
  private static instance: PaymentErrorLogger
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error'

  static getInstance(): PaymentErrorLogger {
    if (!PaymentErrorLogger.instance) {
      PaymentErrorLogger.instance = new PaymentErrorLogger()
    }
    return PaymentErrorLogger.instance
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  log(error: PaymentError, context?: Record<string, any>): void {
    const logData = {
      ...error.toJSON(),
      context
    }

    // Log to console (in production, this would go to your logging service)
    if (this.shouldLog('error')) {
      console.error('[PaymentError]', logData)
    }

    // In production, send to error tracking service
    this.sendToErrorTracking(logData)
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private sendToErrorTracking(logData: any): void {
    // In production, integrate with services like Sentry, LogRocket, etc.
    // For now, we'll just store in session storage for debugging when available
    try {
      const storage = (globalThis as any)?.sessionStorage
      if (!storage) return

      const raw = storage.getItem?.('payment_errors') || '[]'
      const errors = JSON.parse(raw)
      errors.push(logData)

      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50)
      }

      storage.setItem?.('payment_errors', JSON.stringify(errors))
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Retry utility for payment operations
 */
export class PaymentRetryHandler {
  private maxRetries: number = 3
  private baseDelay: number = 1000 // 1 second
  private maxDelay: number = 10000 // 10 seconds

  constructor(options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
  } = {}) {
    this.maxRetries = options.maxRetries ?? 3
    this.baseDelay = options.baseDelay ?? 1000
    this.maxDelay = options.maxDelay ?? 10000
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: PaymentError | null = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        const paymentError = error instanceof PaymentError
          ? error
          : handleStripeError(error)

        lastError = paymentError

        // Don't retry if error is not retryable
        if (!paymentError.retryable) {
          throw paymentError
        }

        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt - 1),
          this.maxDelay
        )

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000

        PaymentErrorLogger.getInstance().log(paymentError, {
          context,
          attempt,
          retryAfter: jitteredDelay
        })

        await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      }
    }

    throw lastError
  }
}

/**
 * Error boundary helper for React components
 */
export function createPaymentErrorBoundary() {
  return {
    handleError: (error: Error, errorInfo: any) => {
      const paymentError = error instanceof PaymentError
        ? error
        : handleStripeError(error)

      PaymentErrorLogger.getInstance().log(paymentError, {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      })

      return paymentError
    }
  }
}

/**
 * Utility to safely execute payment operations with error handling
 */
export async function safePaymentOperation<T>(
  operation: () => Promise<T>,
  options: {
    context?: string
    retries?: number
    onError?: (error: PaymentError) => void
    fallback?: T
  } = {}
): Promise<T | null> {
  try {
    if (options.retries && options.retries > 0) {
      const retryHandler = new PaymentRetryHandler({ maxRetries: options.retries })
      return await retryHandler.execute(operation, options.context)
    } else {
      return await operation()
    }
  } catch (error) {
    const paymentError = error instanceof PaymentError
      ? error
      : handleStripeError(error)

    PaymentErrorLogger.getInstance().log(paymentError, {
      context: options.context
    })

    if (options.onError) {
      options.onError(paymentError)
    }

    if (options.fallback !== undefined) {
      return options.fallback
    }

    throw paymentError
  }
}

/**
 * Get user-friendly error message for display
 */
export function getDisplayErrorMessage(error: any): string {
  if (error instanceof PaymentError) {
    return error.userMessage
  }

  if (error?.type && error?.message) {
    const paymentError = handleStripeError(error)
    return paymentError.userMessage
  }

  return 'An unexpected error occurred. Please try again or contact support.'
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof PaymentError) {
    return error.retryable
  }

  const paymentError = handleStripeError(error)
  return paymentError.retryable
}

/**
 * Format error for API responses
 */
export function formatErrorResponse(error: any): {
  error: string
  message: string
  code?: string
  retryable: boolean
  timestamp: string
} {
  const paymentError = error instanceof PaymentError
    ? error
    : handleStripeError(error)

  return {
    error: paymentError.type,
    message: paymentError.userMessage,
    code: paymentError.code,
    retryable: paymentError.retryable,
    timestamp: paymentError.timestamp.toISOString()
  }
}
