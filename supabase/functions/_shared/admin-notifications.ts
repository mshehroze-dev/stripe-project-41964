
/**
 * Admin notification system for payment failures and critical errors
 * Provides multiple notification channels and severity levels
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Notification severity levels
export enum NotificationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Notification channels
export enum NotificationChannel {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  DATABASE = 'database',
  CONSOLE = 'console'
}

// Notification data structure
export interface NotificationData {
  severity: NotificationSeverity
  title: string
  message: string
  operation: string
  errorType?: string
  errorCode?: string
  customerId?: string
  paymentIntentId?: string
  subscriptionId?: string
  amount?: number
  currency?: string
  metadata?: Record<string, any>
  timestamp: string
}

// Admin notification configuration
export interface AdminNotificationConfig {
  channels: NotificationChannel[]
  emailRecipients?: string[]
  webhookUrl?: string
  enabledSeverities: NotificationSeverity[]
  rateLimitMinutes?: number
}

// Default configuration
const DEFAULT_CONFIG: AdminNotificationConfig = {
  channels: [NotificationChannel.DATABASE, NotificationChannel.CONSOLE],
  enabledSeverities: [NotificationSeverity.HIGH, NotificationSeverity.CRITICAL],
  rateLimitMinutes: 5 // Prevent spam by limiting notifications of same type
}

// Rate limiting cache
const notificationCache = new Map<string, number>()

// Initialize Supabase client for database notifications
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

/**
 * Send admin notification through configured channels
 */
export async function sendAdminNotification(
  data: NotificationData,
  config: AdminNotificationConfig = DEFAULT_CONFIG
): Promise<void> {
  try {
    // Check if this severity level is enabled
    if (!config.enabledSeverities.includes(data.severity)) {
      return
    }

    // Apply rate limiting to prevent spam
    if (config.rateLimitMinutes && isRateLimited(data, config.rateLimitMinutes)) {
      console.log(`Rate limited notification: ${ data.title }`)
      return
    }

    // Send through each configured channel
    const promises = config.channels.map(channel => {
      switch (channel) {
        case NotificationChannel.EMAIL:
          return sendEmailNotification(data, config.emailRecipients || [])
        case NotificationChannel.WEBHOOK:
          return sendWebhookNotification(data, config.webhookUrl)
        case NotificationChannel.DATABASE:
          return saveDatabaseNotification(data)
        case NotificationChannel.CONSOLE:
          return logConsoleNotification(data)
        default:
          return Promise.resolve()
      }
    })

    await Promise.allSettled(promises)

    // Update rate limiting cache
    if (config.rateLimitMinutes) {
      updateRateLimitCache(data)
    }

  } catch (error) {
    console.error('Failed to send admin notification:', error)
  }
}

/**
 * Check if notification is rate limited
 */
function isRateLimited(data: NotificationData, rateLimitMinutes: number): boolean {
  const key = `${ data.operation }-${ data.errorType }-${ data.severity }`
  const lastSent = notificationCache.get(key)

  if (!lastSent) {
    return false
  }

  const timeDiff = Date.now() - lastSent
  const rateLimitMs = rateLimitMinutes * 60 * 1000

  return timeDiff < rateLimitMs
}

/**
 * Update rate limiting cache
 */
function updateRateLimitCache(data: NotificationData): void {
  const key = `${ data.operation }-${ data.errorType }-${ data.severity }`
  notificationCache.set(key, Date.now())

  // Clean up old entries (keep cache size manageable)
  if (notificationCache.size > 1000) {
    const entries = Array.from(notificationCache.entries())
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours

    for (const [key, timestamp] of entries) {
      if (timestamp < cutoff) {
        notificationCache.delete(key)
      }
    }
  }
}

/**
 * Send email notification using configured email service
 */
async function sendEmailNotification(
  data: NotificationData,
  recipients: string[]
): Promise<void> {
  if (recipients.length === 0) {
    console.warn('No email recipients configured for admin notifications')
    return
  }

  try {
    // Import email service (dynamic import to avoid issues if not configured)
    const { sendEmail } = await import('./email-service.ts')

    const emailData = {
      to: recipients,
      subject: `[${ data.severity.toUpperCase() }] Payment System Alert: ${ data.title }`,
      html: generateEmailTemplate(data),
      text: generateEmailText(data)
    }

    await sendEmail(emailData)
    console.log(`Email notification sent to ${ recipients.length } recipients`)
  } catch (error) {
    console.error('Failed to send email notification:', error)
    // Don't throw - we don't want email failures to break the notification system
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  data: NotificationData,
  webhookUrl?: string
): Promise<void> {
  if (!webhookUrl) {
    console.warn('No webhook URL configured for admin notifications')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Stripe-Payment-System/1.0'
      },
      body: JSON.stringify({
        type: 'admin_notification',
        severity: data.severity,
        data: data
      })
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${ response.status }`)
    }

    console.log(`Webhook notification sent successfully to ${ webhookUrl }`)
  } catch (error) {
    console.error('Failed to send webhook notification:', error)
  }
}

/**
 * Save notification to database
 */
async function saveDatabaseNotification(data: NotificationData): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_notifications')
      .insert({
        severity: data.severity,
        title: data.title,
        message: data.message,
        operation: data.operation,
        error_type: data.errorType,
        error_code: data.errorCode,
        customer_id: data.customerId,
        payment_intent_id: data.paymentIntentId,
        subscription_id: data.subscriptionId,
        amount: data.amount,
        currency: data.currency,
        metadata: data.metadata || {},
        timestamp: data.timestamp,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Failed to save notification to database:', error)
    }
  } catch (error) {
    console.error('Error saving database notification:', error)
  }
}

/**
 * Log notification to console with appropriate formatting
 */
async function logConsoleNotification(data: NotificationData): Promise<void> {
  const prefix = `[${ data.severity.toUpperCase() }]`
  const timestamp = new Date(data.timestamp).toISOString()

  const logMessage = {
    timestamp,
    severity: data.severity,
    title: data.title,
    message: data.message,
    operation: data.operation,
    errorType: data.errorType,
    errorCode: data.errorCode,
    customerId: data.customerId,
    paymentIntentId: data.paymentIntentId,
    subscriptionId: data.subscriptionId,
    amount: data.amount,
    currency: data.currency,
    metadata: data.metadata
  }

  switch (data.severity) {
    case NotificationSeverity.CRITICAL:
      console.error(`${ prefix } ${ data.title }`, logMessage)
      break
    case NotificationSeverity.HIGH:
      console.error(`${ prefix } ${ data.title }`, logMessage)
      break
    case NotificationSeverity.MEDIUM:
      console.warn(`${ prefix } ${ data.title }`, logMessage)
      break
    case NotificationSeverity.LOW:
      console.info(`${ prefix } ${ data.title }`, logMessage)
      break
  }
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(data: NotificationData): string {
  const severityColor = getSeverityColor(data.severity)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment System Alert</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: ${ severityColor }; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${ data.severity.toUpperCase() } Alert</h1>
        <h2>${ data.title }</h2>
      </div>

      <div class="content">
        <p><strong>Message:</strong> ${ data.message }</p>
        <p><strong>Operation:</strong> ${ data.operation }</p>
        <p><strong>Timestamp:</strong> ${ new Date(data.timestamp).toLocaleString() }</p>

        <div class="details">
          <h3>Details</h3>
          ${ data.errorType ? `<p><strong>Error Type:</strong> ${data.errorType }</p>` : ''}
          ${ data.errorCode ? `<p><strong>Error Code:</strong> ${data.errorCode }</p>` : ''}
          ${ data.customerId ? `<p><strong>Customer ID:</strong> ${data.customerId }</p>` : ''}
          ${ data.paymentIntentId ? `<p><strong>Payment Intent:</strong> ${data.paymentIntentId }</p>` : ''}
          ${ data.subscriptionId ? `<p><strong>Subscription ID:</strong> ${data.subscriptionId }</p>` : ''}
          ${ data.amount ? `<p><strong>Amount:</strong> ${formatAmount(data.amount, data.currency) }</p>` : ''}
        </div>

        ${ data.metadata && Object.keys(data.metadata).length > 0 ? `
          <div class="details">
            <h3>Additional Information</h3>
            <pre>${JSON.stringify(data.metadata, null, 2) }</pre>
          </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>This is an automated notification from your payment system.</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text email
 */
function generateEmailText(data: NotificationData): string {
  let text = `${ data.severity.toUpperCase() } ALERT: ${ data.title }\n\n`
  text += `Message: ${ data.message }\n`
  text += `Operation: ${ data.operation }\n`
  text += `Timestamp: ${ new Date(data.timestamp).toLocaleString() }\n\n`

  if (data.errorType) text += `Error Type: ${ data.errorType }\n`
  if (data.errorCode) text += `Error Code: ${ data.errorCode }\n`
  if (data.customerId) text += `Customer ID: ${ data.customerId }\n`
  if (data.paymentIntentId) text += `Payment Intent: ${ data.paymentIntentId }\n`
  if (data.subscriptionId) text += `Subscription ID: ${ data.subscriptionId }\n`
  if (data.amount) text += `Amount: ${ formatAmount(data.amount, data.currency) }\n`

  if (data.metadata && Object.keys(data.metadata).length > 0) {
    text += `\nAdditional Information:\n${ JSON.stringify(data.metadata, null, 2) }\n`
  }

  text += '\nThis is an automated notification from your payment system.'

  return text
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case NotificationSeverity.CRITICAL:
      return '#dc3545' // Red
    case NotificationSeverity.HIGH:
      return '#fd7e14' // Orange
    case NotificationSeverity.MEDIUM:
      return '#ffc107' // Yellow
    case NotificationSeverity.LOW:
      return '#17a2b8' // Blue
    default:
      return '#6c757d' // Gray
  }
}

/**
 * Format amount with currency
 */
function formatAmount(amount: number, currency?: string): string {
  const curr = currency || 'usd'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr.toUpperCase(),
    minimumFractionDigits: 2
  }).format(amount / 100) // Stripe amounts are in cents
}

// Predefined notification templates for common scenarios

/**
 * Payment failure notification
 */
export async function notifyPaymentFailure(
  paymentIntentId: string,
  customerId: string,
  amount: number,
  currency: string,
  errorMessage: string,
  errorCode?: string
): Promise<void> {
  await sendAdminNotification({
    severity: NotificationSeverity.HIGH,
    title: 'Payment Processing Failed',
    message: `Payment failed for customer ${ customerId }: ${ errorMessage }`,
    operation: 'payment_processing',
    errorType: 'payment_failure',
    errorCode,
    customerId,
    paymentIntentId,
    amount,
    currency,
    timestamp: new Date().toISOString()
  })
}

/**
 * Subscription failure notification
 */
export async function notifySubscriptionFailure(
  subscriptionId: string,
  customerId: string,
  errorMessage: string,
  errorCode?: string
): Promise<void> {
  await sendAdminNotification({
    severity: NotificationSeverity.HIGH,
    title: 'Subscription Processing Failed',
    message: `Subscription operation failed for customer ${ customerId }: ${ errorMessage }`,
    operation: 'subscription_processing',
    errorType: 'subscription_failure',
    errorCode,
    customerId,
    subscriptionId,
    timestamp: new Date().toISOString()
  })
}

/**
 * Webhook processing failure notification
 */
export async function notifyWebhookFailure(
  eventId: string,
  eventType: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  const severity = retryCount >= 3 ? NotificationSeverity.CRITICAL : NotificationSeverity.MEDIUM

  await sendAdminNotification({
    severity,
    title: 'Webhook Processing Failed',
    message: `Failed to process webhook event ${ eventType } (${ eventId }) after ${ retryCount } attempts: ${ errorMessage }`,
    operation: 'webhook_processing',
    errorType: 'webhook_failure',
    metadata: {
      eventId,
      eventType,
      retryCount
    },
    timestamp: new Date().toISOString()
  })
}

/**
 * Rate limit exceeded notification
 */
export async function notifyRateLimitExceeded(
  operation: string,
  resetTime?: number
): Promise<void> {
  await sendAdminNotification({
    severity: NotificationSeverity.MEDIUM,
    title: 'Stripe API Rate Limit Exceeded',
    message: `Rate limit exceeded for operation: ${ operation }${ resetTime ? ` (resets at ${new Date(resetTime * 1000).toISOString() })` : ''}`,
    operation,
    errorType: 'rate_limit_exceeded',
    metadata: {
      resetTime
    },
    timestamp: new Date().toISOString()
  })
}

/**
 * Critical system error notification
 */
export async function notifyCriticalError(
  operation: string,
  errorMessage: string,
  errorDetails?: Record<string, any>
): Promise<void> {
  await sendAdminNotification({
    severity: NotificationSeverity.CRITICAL,
    title: 'Critical System Error',
    message: `Critical error in ${ operation }: ${ errorMessage }`,
    operation,
    errorType: 'critical_system_error',
    metadata: errorDetails,
    timestamp: new Date().toISOString()
  })
}

