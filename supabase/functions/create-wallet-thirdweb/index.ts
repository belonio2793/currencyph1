// Supabase Edge Function to create a smart wallet on Thirdweb
// POST /functions/v1/create-wallet-thirdweb
// Body: { user_id, chain_id }
// Returns: { address, chain_id, chain, provider }

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Chain configurations with Thirdweb RPC endpoints
const CHAIN_CONFIGS = {
  1: { name: 'ethereum', chainId: 1, symbol: 'ETH' },
  137: { name: 'polygon', chainId: 137, symbol: 'MATIC' },
  8453: { name: 'base', chainId: 8453, symbol: 'BASE' },
  42161: { name: 'arbitrum', chainId: 42161, symbol: 'ARB' },
  10: { name: 'optimism', chainId: 10, symbol: 'OP' },
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL' },
  43114: { name: 'avalanche', chainId: 43114, symbol: 'AVAX' }
}

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
    const THIRDWEB_CLIENT_ID = Deno.env.get('VITE_THIRDWEB_CLIENT_ID')
    const THIRDWEB_SECRET_KEY = Deno.env.get('THIRDWEB_SECRET_KEY')

    if (!PROJECT_URL || !SERVICE_ROLE_KEY || !THIRDWEB_CLIENT_ID || !THIRDWEB_SECRET_KEY) {
      console.error('Missing environment variables')
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.user_id || !body.chain_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id or chain_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const { user_id, chain_id } = body
    const chainConfig = CHAIN_CONFIGS[chain_id]

    if (!chainConfig) {
      return new Response(JSON.stringify({ error: `Unsupported chain ID: ${chain_id}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Generate a random wallet using Web3 standards
    // In production, you'd use Thirdweb's Smart Wallet API to create managed wallets
    // For now, we'll generate a deterministic address based on user_id + chain_id

    // Create a simple deterministic address from user_id + chain for consistency
    // This is a placeholder - in production, integrate with Thirdweb's wallet creation API
    const textEncoder = new TextEncoder()
    const data = textEncoder.encode(`${user_id}:${chain_id}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // For EVM chains: generate 0x-prefixed address
    let address = ''
    if ([1, 137, 8453, 42161, 10, 43114].includes(chain_id)) {
      address = '0x' + hashHex.substring(0, 40).toLowerCase()
    } else if (chain_id === 245022926) {
      // Solana: use base58 encoding (simplified)
      address = hashHex.substring(0, 44)
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // Insert into wallets_crypto
    const { data: inserted, error: insertError } = await supabase
      .from('wallets_crypto')
      .insert([{
        user_id,
        chain: chainConfig.name.toUpperCase(),
        chain_id: chain_id,
        address: address,
        provider: 'manual',
        balance: 0,
        metadata: {
          chainName: chainConfig.name,
          chainSymbol: chainConfig.symbol,
          generated_at: new Date().toISOString()
        }
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      wallet: {
        id: inserted.id,
        address: inserted.address,
        chain_id: inserted.chain_id,
        chain: inserted.chain,
        provider: 'manual',
        chainName: chainConfig.name,
        chainSymbol: chainConfig.symbol
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error('Error creating wallet:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
