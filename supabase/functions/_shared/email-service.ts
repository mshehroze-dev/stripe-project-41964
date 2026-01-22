
/**
 * Email service integration for admin notifications
 * This is a template that can be customized for different email providers
 * Examples: SendGrid, AWS SES, Resend, Mailgun, etc.
 */

// Email provider configuration
interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'resend' | 'mailgun' | 'custom'
  apiKey?: string
  region?: string // For AWS SES
  domain?: string // For Mailgun
  fromEmail: string
  fromName?: string
}

// Email data structure
interface EmailData {
  to: string[]
  subject: string
  html: string
  text: string
}

interface ValidationResult<T = any> {
  valid: boolean
  error?: string
  sanitized?: T
}

// Get email configuration from environment
function getEmailConfig(): EmailConfig {
  const provider = (Deno.env.get('EMAIL_PROVIDER') || 'custom') as EmailConfig['provider']

  return {
    provider,
    apiKey: Deno.env.get('EMAIL_API_KEY'),
    region: Deno.env.get('EMAIL_REGION') || 'us-east-1',
    domain: Deno.env.get('EMAIL_DOMAIN'),
    fromEmail: Deno.env.get('EMAIL_FROM') || 'noreply@example.com',
    fromName: Deno.env.get('EMAIL_FROM_NAME') || 'Payment System'
  }
}

/**
 * Send email using configured provider
 */
export async function sendEmail(emailData: EmailData): Promise<void> {
  const config = getEmailConfig()

  if (!config.apiKey && config.provider !== 'custom') {
    console.warn('Email API key not configured, skipping email send')
    return
  }

  try {
    switch (config.provider) {
      case 'sendgrid':
        await sendWithSendGrid(emailData, config)
        break
      case 'ses':
        await sendWithSES(emailData, config)
        break
      case 'resend':
        await sendWithResend(emailData, config)
        break
      case 'mailgun':
        await sendWithMailgun(emailData, config)
        break
      case 'custom':
        await sendWithCustomProvider(emailData, config)
        break
      default:
        throw new Error(`Unsupported email provider: ${ config.provider }`)
    }

    console.log(`Email sent successfully via ${ config.provider } to ${ emailData.to.join(', ') }`)
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

/**
 * SendGrid email provider
 */
async function sendWithSendGrid(emailData: EmailData, config: EmailConfig): Promise<void> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ config.apiKey }`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: emailData.to.map(email => ({ email }))
      }],
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      subject: emailData.subject,
      content: [
        {
          type: 'text/plain',
          value: emailData.text
        },
        {
          type: 'text/html',
          value: emailData.html
        }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid API error: ${ response.status } - ${ error }`)
  }
}

/**
 * AWS SES email provider
 */
async function sendWithSES(emailData: EmailData, config: EmailConfig): Promise<void> {
  // This is a simplified example - in production you'd use AWS SDK
  // For now, we'll use the SES REST API directly

  const sesEndpoint = `https://email.${ config.region }.amazonaws.com`

  // Note: This requires AWS credentials and proper signing
  // In a real implementation, you'd use the AWS SDK for Deno
  console.log('SES integration requires AWS SDK - implement based on your needs')

  // Placeholder implementation
  throw new Error('SES integration not fully implemented - please use AWS SDK')
}

/**
 * Resend email provider
 */
async function sendWithResend(emailData: EmailData, config: EmailConfig): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ config.apiKey }`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${ config.fromName } <${ config.fromEmail }>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${ response.status } - ${ error }`)
  }
}

/**
 * Mailgun email provider
 */
async function sendWithMailgun(emailData: EmailData, config: EmailConfig): Promise<void> {
  if (!config.domain) {
    throw new Error('Mailgun domain is required')
  }

  const formData = new FormData()
  formData.append('from', `${ config.fromName } <${ config.fromEmail }>`)
  formData.append('to', emailData.to.join(','))
  formData.append('subject', emailData.subject)
  formData.append('html', emailData.html)
  formData.append('text', emailData.text)

  const response = await fetch(`https://api.mailgun.net/v3/${ config.domain }/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${ btoa(`api:${ config.apiKey }`) }`
    },
    body: formData
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mailgun API error: ${ response.status } - ${ error }`)
  }
}

/**
 * Custom email provider (webhook or other service)
 */
async function sendWithCustomProvider(emailData: EmailData, config: EmailConfig): Promise<void> {
  const webhookUrl = Deno.env.get('EMAIL_WEBHOOK_URL')

  if (!webhookUrl) {
    console.log('Custom email provider: No webhook URL configured, logging email instead')
    console.log('Email would be sent:', {
      to: emailData.to,
      subject: emailData.subject,
      from: config.fromEmail,
      text: emailData.text.substring(0, 200) + '...'
    })
    return
  }

  // Send to custom webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Payment-System-Notifications/1.0'
    },
    body: JSON.stringify({
      type: 'email_notification',
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      timestamp: new Date().toISOString()
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Custom email webhook error: ${ response.status } - ${ error }`)
  }
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(): { isValid: boolean; missingVars: string[] } {
  const config = getEmailConfig()
  const missingVars: string[] = []

  if (!config.fromEmail) {
    missingVars.push('EMAIL_FROM')
  }

  if (config.provider !== 'custom' && !config.apiKey) {
    missingVars.push('EMAIL_API_KEY')
  }

  if (config.provider === 'mailgun' && !config.domain) {
    missingVars.push('EMAIL_DOMAIN')
  }

  return {
    isValid: missingVars.length === 0,
    missingVars
  }
}

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

  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' }
  }

  return { valid: true, sanitized: trimmedEmail }
}

/**
 * Test email configuration by sending a test email
 */
export async function testEmailConfig(testRecipient: string): Promise<void> {
  const validation = validateEmailConfig()

  if (!validation.isValid) {
    throw new Error(`Email configuration invalid. Missing: ${ validation.missingVars.join(', ') }`)
  }

  const testEmail: EmailData = {
    to: [testRecipient],
    subject: 'Payment System - Email Configuration Test',
    html: `
      <h2>Email Configuration Test</h2>
      <p>This is a test email to verify your email configuration is working correctly.</p>
      <p><strong>Provider:</strong> ${ getEmailConfig().provider }</p>
      <p><strong>Timestamp:</strong> ${ new Date().toISOString() }</p>
      <p>If you received this email, your configuration is working properly!</p>
    `,
    text: `
Email Configuration Test

This is a test email to verify your email configuration is working correctly.

Provider: ${ getEmailConfig().provider }
Timestamp: ${ new Date().toISOString() }

If you received this email, your configuration is working properly!
    `
  }

  await sendEmail(testEmail)
}
