
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { sendEmail, validateEmailConfig, validateEmail } from '../_shared/email-service.ts'

interface SendEmailRequest {
  to: string[] | string
  subject: string
  html?: string
  text?: string
}

interface SendEmailResponse {
  success: boolean
  message: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function stripHtmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment configuration' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const validation = validateEmailConfig()
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          error: 'Email configuration invalid',
          details: `Missing: ${ validation.missingVars.join(', ') }`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userResult, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userResult?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      )
    }

    const payload: SendEmailRequest = await req.json()
    const rawRecipients = Array.isArray(payload.to)
      ? payload.to
      : (payload.to ? [payload.to] : [])
    const recipients = rawRecipients
      .filter(Boolean)
      .map((value) => value.trim())
      .filter(Boolean)
    const subject = (payload.subject || '').trim()
    const html = (payload.html || '').trim()
    const text = (payload.text || '').trim()

    if (!recipients.length || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'to, subject, and html or text are required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    for (const email of recipients) {
      const validationResult = validateEmail(email)
      if (!validationResult.valid) {
        return new Response(
          JSON.stringify({ error: 'Invalid recipient email', details: validationResult.error }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
      }
    }

    const finalHtml = html || `<p>${ text }</p>`
    const finalText = text || stripHtmlToText(html)

    await sendEmail({
      to: recipients,
      subject,
      html: finalHtml,
      text: finalText,
    })

    const response: SendEmailResponse = {
      success: true,
      message: 'Email sent',
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('send-email error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
