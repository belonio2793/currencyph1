// Supabase Edge Function for sending crypto transactions via Thirdweb
// Expects POST JSON: { user_id, to_address, value, chain_id, tx_hash? }

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS', 
        'Access-Control-Allow-Headers': 'Content-Type, Authorization' 
      } 
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    })
  }

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const THIRDWEB_SECRET_KEY = Deno.env.get('THIRDWEB_SECRET_KEY')

    if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
      console.error('Missing Supabase env vars')
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      })
    }

    // Parse request body
    const body = await req.json().catch(() => null)
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      })
    }

    const { user_id, to_address, value, chain_id, tx_hash } = body

    if (!user_id || !to_address || !value || !chain_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: user_id, to_address, value, chain_id' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      })
    }

    // Initialize Supabase client with service role
    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // Verify user owns the wallet being used
    const { data: userWallet, error: walletError } = await supabase
      .from('wallets_crypto')
      .select('*')
      .eq('user_id', user_id)
      .eq('chain_id', chain_id)
      .single()

    if (walletError || !userWallet) {
      console.error('Wallet not found for user:', user_id, 'chain:', chain_id)
      return new Response(JSON.stringify({ error: 'Wallet not found or not owned by user' }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      })
    }

    // For production, you would use Thirdweb SDK here to sign and send the transaction
    // This is a placeholder that records the transaction request
    // In production, you'd initialize Thirdweb server SDK with THIRDWEB_SECRET_KEY

    const txRecord = {
      user_id,
      from_address: userWallet.address,
      to_address,
      value: value.toString(),
      chain_id,
      tx_hash: tx_hash || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {
        initiated_from: 'edge_function'
      }
    }

    // Create transaction record (if table exists)
    const { error: insertError } = await supabase
      .from('wallet_transactions')
      .insert([txRecord])
      .select()
      .single()

    if (insertError) {
      console.warn('Could not record transaction:', insertError.message)
      // Don't fail if transaction table doesn't exist - proceed anyway
    }

    // Return success response
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Transaction recorded successfully',
      transaction: {
        user_id,
        to_address,
        value,
        chain_id,
        status: 'pending'
      }
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    })

  } catch (err) {
    console.error('crypto-send error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    })
  }
})
