
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Define TypeScript types for function inputs and outputs
interface NotificationRequest {
  action: 'list' | 'acknowledge' | 'stats' | 'configure'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  limit?: number
  notificationId?: string
  config?: AdminNotificationConfig
}

interface AdminNotificationConfig {
  emailRecipients?: string[]
  webhookUrl?: string
  enabledSeverities?: string[]
  rateLimitMinutes?: number
}

interface NotificationListResponse {
  notifications: Array<{
    id: string
    severity: string
    title: string
    message: string
    operation: string
    errorType?: string
    customerId?: string
    timestamp: string
    createdAt: string
    acknowledged: boolean
  }>
  total: number
}

interface NotificationStatsResponse {
  stats: Array<{
    severity: string
    totalCount: number
    acknowledgedCount: number
    unacknowledgedCount: number
  }>
  summary: {
    totalNotifications: number
    unacknowledgedNotifications: number
    criticalUnacknowledged: number
  }
}

interface ErrorResponse {
  error: string
  details?: string
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      },
    )
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: 'Authorization header is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    // Parse and validate request body
    const requestData: NotificationRequest = await req.json()

    // Validate required fields
    if (!requestData.action) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'action is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    let responseData: any

    switch (requestData.action) {
      case 'list':
        responseData = await listNotifications(requestData.severity, requestData.limit)
        break
      case 'acknowledge':
        responseData = await acknowledgeNotification(requestData.notificationId)
        break
      case 'stats':
        responseData = await getNotificationStats()
        break
      case 'configure':
        responseData = await updateNotificationConfig(requestData.config)
        break
      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid action',
            details: 'action must be one of: list, acknowledge, stats, configure'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
    }

    // Return successful response
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Admin notifications error:', error)

    // Handle general errors
    const errorData: ErrorResponse = {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'An unknown error occurred',
    }

    return new Response(
      JSON.stringify(errorData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

/**
 * List admin notifications with optional filtering
 */
async function listNotifications(
  severity?: string,
  limit: number = 50
): Promise<NotificationListResponse> {
  try {
    let query = supabase
      .from('admin_notifications')
      .select(`
        id,
        severity,
        title,
        message,
        operation,
        error_type,
        customer_id,
        timestamp,
        created_at,
        acknowledged
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch notifications: ${ error.message }`)
    }

    const notifications = (data || []).map(notification => ({
      id: notification.id,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      operation: notification.operation,
      errorType: notification.error_type,
      customerId: notification.customer_id,
      timestamp: notification.timestamp,
      createdAt: notification.created_at,
      acknowledged: notification.acknowledged
    }))

    return {
      notifications,
      total: count || notifications.length
    }
  } catch (error) {
    console.error('Error listing notifications:', error)
    throw error
  }
}

/**
 * Acknowledge a specific notification
 */
async function acknowledgeNotification(notificationId?: string): Promise<{ success: boolean; message: string }> {
  if (!notificationId) {
    throw new Error('Notification ID is required for acknowledgment')
  }

  try {
    const { data, error } = await supabase.rpc('acknowledge_admin_notification', {
      p_notification_id: notificationId
    })

    if (error) {
      throw new Error(`Failed to acknowledge notification: ${ error.message }`)
    }

    return {
      success: data,
      message: data ? 'Notification acknowledged successfully' : 'Notification not found or already acknowledged'
    }
  } catch (error) {
    console.error('Error acknowledging notification:', error)
    throw error
  }
}

/**
 * Get notification statistics
 */
async function getNotificationStats(): Promise<NotificationStatsResponse> {
  try {
    // Get stats from the database function
    const { data: statsData, error: statsError } = await supabase.rpc('get_notification_stats')

    if (statsError) {
      throw new Error(`Failed to fetch notification stats: ${ statsError.message }`)
    }

    // Get unacknowledged notifications count
    const { data: unacknowledgedData, error: unacknowledgedError } = await supabase
      .from('admin_notifications')
      .select('severity', { count: 'exact' })
      .eq('acknowledged', false)

    if (unacknowledgedError) {
      throw new Error(`Failed to fetch unacknowledged count: ${ unacknowledgedError.message }`)
    }

    // Get critical unacknowledged count
    const { count: criticalUnacknowledged, error: criticalError } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('acknowledged', false)
      .eq('severity', 'critical')

    if (criticalError) {
      throw new Error(`Failed to fetch critical count: ${ criticalError.message }`)
    }

    const stats = statsData || []
    const totalNotifications = stats.reduce((sum: number, stat: any) => sum + stat.total_count, 0)
    const unacknowledgedNotifications = stats.reduce((sum: number, stat: any) => sum + stat.unacknowledged_count, 0)

    return {
      stats: stats.map((stat: any) => ({
        severity: stat.severity,
        totalCount: stat.total_count,
        acknowledgedCount: stat.acknowledged_count,
        unacknowledgedCount: stat.unacknowledged_count
      })),
      summary: {
        totalNotifications,
        unacknowledgedNotifications,
        criticalUnacknowledged: criticalUnacknowledged || 0
      }
    }
  } catch (error) {
    console.error('Error getting notification stats:', error)
    throw error
  }
}

/**
 * Update notification configuration
 */
async function updateNotificationConfig(config?: AdminNotificationConfig): Promise<{ success: boolean; message: string }> {
  if (!config) {
    throw new Error('Configuration data is required')
  }

  try {
    // Store configuration in environment or database
    // For this example, we'll store it as a JSON document in a config table
    // In a real implementation, you might want to use environment variables or a dedicated config service

    const configData = {
      email_recipients: config.emailRecipients || [],
      webhook_url: config.webhookUrl,
      enabled_severities: config.enabledSeverities || ['high', 'critical'],
      rate_limit_minutes: config.rateLimitMinutes || 5,
      updated_at: new Date().toISOString()
    }

    // This assumes you have a config table - you might implement this differently
    const { error } = await supabase
      .from('admin_config')
      .upsert({
        key: 'notification_config',
        value: configData
      }, { onConflict: 'key' })

    if (error) {
      throw new Error(`Failed to update configuration: ${ error.message }`)
    }

    return {
      success: true,
      message: 'Notification configuration updated successfully'
    }
  } catch (error) {
    console.error('Error updating notification config:', error)
    throw error
  }
}

/**
 * Get current notification configuration
 */
async function getNotificationConfig(): Promise<AdminNotificationConfig> {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'notification_config')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to fetch configuration: ${ error.message }`)
    }

    if (!data) {
      // Return default configuration
      return {
        emailRecipients: [],
        enabledSeverities: ['high', 'critical'],
        rateLimitMinutes: 5
      }
    }

    const config = data.value
    return {
      emailRecipients: config.email_recipients || [],
      webhookUrl: config.webhook_url,
      enabledSeverities: config.enabled_severities || ['high', 'critical'],
      rateLimitMinutes: config.rate_limit_minutes || 5
    }
  } catch (error) {
    console.error('Error getting notification config:', error)
    throw error
  }
}

