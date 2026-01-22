
/**
 * Stripe API retry utilities with exponential backoff
 * Provides comprehensive error handling and retry logic for all Stripe operations
 */

import Stripe from 'https://esm.sh/stripe@14.21.0'

// Error types for classification
export enum ErrorType {
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  INVALID_REQUEST = 'invalid_request',
  API_ERROR = 'api_error',
  CARD_ERROR = 'card_error',
  IDEMPOTENCY_ERROR = 'idempotency_error',
  UNKNOWN = 'unknown'
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number
  baseDelay: number // milliseconds
  maxDelay: number // milliseconds
  backoffMultiplier: number
  jitter: boolean
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitter: true
}

// Rate limit specific configuration
export const RATE_LIMIT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 2000, // 2 seconds
  maxDelay: 60000, // 60 seconds
  backoffMultiplier: 2,
  jitter: true
}

// Error classification function
export function classifyError(error: any): ErrorType {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case 'StripeRateLimitError':
        return ErrorType.RATE_LIMIT
      case 'StripeAuthenticationError':
        return ErrorType.AUTHENTICATION
      case 'StripeInvalidRequestError':
        return ErrorType.INVALID_REQUEST
      case 'StripeAPIError':
        return ErrorType.API_ERROR
      case 'StripeCardError':
        return ErrorType.CARD_ERROR
      case 'StripeIdempotencyError':
        return ErrorType.IDEMPOTENCY_ERROR
      default:
        return ErrorType.UNKNOWN
    }
  }

  // Network-related errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ErrorType.NETWORK
  }

  return ErrorType.UNKNOWN
}

// Check if error is retryable
export function isRetryableError(errorType: ErrorType): boolean {
  switch (errorType) {
    case ErrorType.RATE_LIMIT:
    case ErrorType.NETWORK:
    case ErrorType.API_ERROR:
      return true
    case ErrorType.AUTHENTICATION:
    case ErrorType.INVALID_REQUEST:
    case ErrorType.CARD_ERROR:
    case ErrorType.IDEMPOTENCY_ERROR:
      return false
    default:
      return false
  }
}

// Calculate delay with exponential backoff and jitter
export function calculateDelay(
  attempt: number,
  config: RetryConfig,
  rateLimitResetTime?: number
): number {
  // For rate limit errors, respect the reset time if provided
  if (rateLimitResetTime) {
    const resetDelay = (rateLimitResetTime * 1000) - Date.now()
    if (resetDelay > 0) {
      return Math.min(resetDelay + 1000, config.maxDelay) // Add 1 second buffer
    }
  }

  // Calculate exponential backoff
  let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)

  // Apply jitter to prevent thundering herd
  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  // Cap at maximum delay
  return Math.min(delay, config.maxDelay)
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Enhanced error logging
export function logError(
  operation: string,
  error: any,
  attempt: number,
  maxRetries: number,
  context?: Record<string, any>
): void {
  const errorType = classifyError(error)
  const isRetryable = isRetryableError(errorType)

  const logData = {
    operation,
    errorType,
    isRetryable,
    attempt,
    maxRetries,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorCode: error instanceof Stripe.errors.StripeError ? error.code : undefined,
    errorParam: error instanceof Stripe.errors.StripeError ? error.param : undefined,
    context: context || {}
  }

  if (attempt <= maxRetries && isRetryable) {
    console.warn(`Retryable error in ${ operation } (attempt ${ attempt }/${ maxRetries }):`, logData)
  } else {
    console.error(`Fatal error in ${ operation }:`, logData)
  }

  // Log sensitive information separately for debugging (without exposing in responses)
  if (error instanceof Stripe.errors.StripeError && error.headers) {
    console.debug(`Stripe error headers for ${ operation }:`, {
      requestId: error.headers['request-id'],
      stripeVersion: error.headers['stripe-version']
    })
  }
}

// Main retry wrapper function
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: Record<string, any>
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const errorType = classifyError(error)

      // Log the error
      logError(operationName, error, attempt, config.maxRetries, context)

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt > config.maxRetries || !isRetryableError(errorType)) {
        break
      }

      // Calculate delay for next attempt
      let rateLimitResetTime: number | undefined
      if (error instanceof Stripe.errors.StripeRateLimitError && error.headers) {
        const resetHeader = error.headers['x-ratelimit-reset-after']
        if (resetHeader) {
          rateLimitResetTime = parseInt(resetHeader, 10)
        }
      }

      const retryConfig = errorType === ErrorType.RATE_LIMIT ? RATE_LIMIT_RETRY_CONFIG : config
      const delay = calculateDelay(attempt, retryConfig, rateLimitResetTime)

      console.log(`Retrying ${ operationName } in ${ delay }ms (attempt ${ attempt + 1 }/${ config.maxRetries + 1 })`)
      await sleep(delay)
    }
  }

  // If we get here, all retries failed
  throw lastError
}

// Specialized retry functions for common Stripe operations

/**
 * Retry wrapper for Stripe API calls with rate limit handling
 */
export async function retryStripeCall<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, any>
): Promise<T> {
  return withRetry(operation, operationName, DEFAULT_RETRY_CONFIG, context)
}

/**
 * Retry wrapper specifically for rate-limited operations
 */
export async function retryRateLimitedCall<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, any>
): Promise<T> {
  return withRetry(operation, operationName, RATE_LIMIT_RETRY_CONFIG, context)
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: any,
  operation: string,
  corsHeaders: Record<string, string>
): Response {
  const errorType = classifyError(error)

  let statusCode = 500
  let errorMessage = 'Internal server error'
  let errorDetails = error instanceof Error ? error.message : 'An unknown error occurred'

  // Map error types to appropriate HTTP status codes and messages
  switch (errorType) {
    case ErrorType.AUTHENTICATION:
      statusCode = 401
      errorMessage = 'Authentication failed'
      break
    case ErrorType.INVALID_REQUEST:
      statusCode = 400
      errorMessage = 'Invalid request'
      break
    case ErrorType.CARD_ERROR:
      statusCode = 402
      errorMessage = 'Payment failed'
      break
    case ErrorType.RATE_LIMIT:
      statusCode = 429
      errorMessage = 'Rate limit exceeded'
      break
    case ErrorType.API_ERROR:
      statusCode = 502
      errorMessage = 'Payment service error'
      break
    case ErrorType.NETWORK:
      statusCode = 503
      errorMessage = 'Service temporarily unavailable'
      break
  }

  // Don't expose sensitive error details in production
  const isProduction = Deno.env.get('ENVIRONMENT') === 'production'
  if (isProduction && errorType === ErrorType.AUTHENTICATION) {
    errorDetails = 'Invalid API credentials'
  }

  const responseBody = {
    error: errorMessage,
    details: errorDetails,
    type: errorType,
    operation: operation,
    timestamp: new Date().toISOString()
  }

  // Add retry-after header for rate limit errors
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (errorType === ErrorType.RATE_LIMIT && error instanceof Stripe.errors.StripeRateLimitError) {
    const resetAfter = error.headers?.['x-ratelimit-reset-after']
    if (resetAfter) {
      headers['Retry-After'] = resetAfter
    }
  }

  return new Response(
    JSON.stringify(responseBody),
    {
      headers,
      status: statusCode,
    }
  )
}

/**
 * Validate environment variables required for Stripe operations
 */
export function validateStripeEnvironment(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = ['STRIPE_SECRET_KEY']
  const missingVars: string[] = []

  for (const varName of requiredVars) {
    if (!Deno.env.get(varName)) {
      missingVars.push(varName)
    }
  }

  return {
    isValid: missingVars.length === 0,
    missingVars
  }
}

/**
 * Create a circuit breaker for repeated failures
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open - service temporarily unavailable')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): string {
    return this.state
  }
}

