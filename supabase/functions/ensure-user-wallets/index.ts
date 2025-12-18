import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  user_id: string
}

async function ensureUserWallets(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Check if user already has a PHP wallet
    const { data: existing, error: checkError } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .eq('currency_code', 'PHP')
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected
      console.error('Error checking for existing PHP wallet:', checkError)
      throw checkError
    }

    // If PHP wallet already exists, return success
    if (existing) {
      return {
        success: true,
        message: 'User already has a PHP wallet',
        wallet_id: existing.id,
      }
    }

    // Create PHP wallet if it doesn't exist
    const { data: newWallet, error: insertError } = await supabase
      .from('wallets')
      .insert([
        {
          user_id: userId,
          currency_code: 'PHP',
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          is_active: true,
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating PHP wallet:', insertError)
      throw insertError
    }

    return {
      success: true,
      message: 'PHP wallet created successfully',
      wallet_id: newWallet.id,
    }
  } catch (error) {
    console.error('Error in ensureUserWallets:', error)
    throw error
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { user_id } = body

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const result = await ensureUserWallets(user_id)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
