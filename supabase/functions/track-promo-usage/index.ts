
// Follow this setup guide: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Define TypeScript types for function inputs and outputs
interface TrackPromoUsageRequest {
  promo_code: string
  customer_id?: string
  order_value: number
  discount_amount: number
  currency?: string
  session_id?: string
  subscription_id?: string
  timestamp?: string
}

interface TrackPromoUsageResponse {
  success: boolean
  id?: string
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
    // Parse and validate request body
    const requestData: TrackPromoUsageRequest = await req.json()

    // Validate required fields
    if (!requestData.promo_code || requestData.order_value === undefined || requestData.discount_amount === undefined) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: 'promo_code, order_value, and discount_amount are required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Validate numeric values
    if (requestData.order_value < 0 || requestData.discount_amount < 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid values',
          details: 'order_value and discount_amount must be non-negative'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Prepare tracking data
    const trackingData = {
      promo_code: requestData.promo_code.toUpperCase(),
      customer_id: requestData.customer_id || null,
      order_value: requestData.order_value,
      discount_amount: requestData.discount_amount,
      currency: requestData.currency || 'usd',
      session_id: requestData.session_id || null,
      subscription_id: requestData.subscription_id || null,
      timestamp: requestData.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    // Insert tracking record into database
    const { data, error } = await supabase
      .from('promo_code_usage')
      .insert(trackingData)
      .select('id')
      .single()

    if (error) {
      console.error('Database error tracking promo usage:', error)

      // If table doesn't exist, try to create it and retry
      if (error.code === '42P01') {
        try {
          await createPromoUsageTable()

          // Retry the insert
          const { data: retryData, error: retryError } = await supabase
            .from('promo_code_usage')
            .insert(trackingData)
            .select('id')
            .single()

          if (retryError) {
            console.warn('Failed to track promo usage after table creation:', retryError)
            // Return success but log the issue - don't fail the entire request
            return new Response(
              JSON.stringify({
                success: true,
                warning: 'Promo usage tracking unavailable'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              },
            )
          }

          return new Response(
            JSON.stringify({
              success: true,
              id: retryData?.id
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            },
          )
        } catch (createError) {
          console.warn('Failed to create promo_code_usage table:', createError)
          // Return success but log the issue - don't fail the entire request
          return new Response(
            JSON.stringify({
              success: true,
              warning: 'Promo usage tracking unavailable'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            },
          )
        }
      }

      // For other errors, log but don't fail the request
      console.warn('Failed to track promo usage:', error.message)
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Promo usage tracking unavailable'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Return successful response
    const responseData: TrackPromoUsageResponse = {
      success: true,
      id: data?.id,
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Promo usage tracking error:', error)

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
 * Create the promo_code_usage table if it doesn't exist
 */
async function createPromoUsageTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS promo_code_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      promo_code TEXT NOT NULL,
      customer_id TEXT,
      order_value INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      session_id TEXT,
      subscription_id TEXT,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS promo_code_usage_promo_code_idx ON promo_code_usage(promo_code);
    CREATE INDEX IF NOT EXISTS promo_code_usage_customer_id_idx ON promo_code_usage(customer_id);
    CREATE INDEX IF NOT EXISTS promo_code_usage_timestamp_idx ON promo_code_usage(timestamp);
    CREATE INDEX IF NOT EXISTS promo_code_usage_created_at_idx ON promo_code_usage(created_at);

    -- Enable RLS (Row Level Security)
    ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    CREATE POLICY "Service role can manage all promo usage records"
      ON promo_code_usage FOR ALL
      USING (auth.role() = 'service_role');

    -- Allow authenticated users to view their own usage records
    CREATE POLICY "Users can view own promo usage"
      ON promo_code_usage FOR SELECT
      USING (
        auth.uid()::text IN (
          SELECT user_id::text FROM customers WHERE stripe_customer_id = customer_id
        )
      );
  `

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    if (error) {
      console.error('Failed to create promo_code_usage table:', error)
    }
  } catch (error) {
    console.error('Failed to execute table creation SQL:', error)
  }
}

