// Supabase Edge Function to create a smart wallet on Thirdweb
// POST /functions/v1/create-wallet-thirdweb
// Body: { user_id, chain_id }
// Returns: { address, chain_id, chain, provider }

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Crypto utilities for Bitcoin key generation and encoding
import * as secp from 'https://cdn.jsdelivr.net/npm/@noble/secp256k1/+esm'
import { sha256 } from 'https://cdn.jsdelivr.net/npm/@noble/hashes/sha256/+esm'
import { ripemd160 } from 'https://cdn.jsdelivr.net/npm/@noble/hashes/ripemd160/+esm'
import base58 from 'https://cdn.jsdelivr.net/npm/bs58/+esm'

// Chain configurations with Thirdweb RPC endpoints (expanded)
// This list contains many commonly supported chains by Thirdweb. If a chain_id is not present
// we will fall back to a generic entry so the edge function remains flexible.
const CHAIN_CONFIGS = {
  0: { name: 'bitcoin', chainId: 0, symbol: 'BTC' },
  1: { name: 'ethereum', chainId: 1, symbol: 'ETH' },
  10: { name: 'optimism', chainId: 10, symbol: 'OP' },
  56: { name: 'bsc', chainId: 56, symbol: 'BNB' },
  100: { name: 'gnosis', chainId: 100, symbol: 'GNO' },
  137: { name: 'polygon', chainId: 137, symbol: 'MATIC' },
  250: { name: 'fantom', chainId: 250, symbol: 'FTM' },
  42161: { name: 'arbitrum', chainId: 42161, symbol: 'ARB' },
  42170: { name: 'arbitrum-nova', chainId: 42170, symbol: 'ARB' },
  8453: { name: 'base', chainId: 8453, symbol: 'BASE' },
  43114: { name: 'avalanche', chainId: 43114, symbol: 'AVAX' },
  1284: { name: 'moonbeam', chainId: 1284, symbol: 'GLMR' },
  1285: { name: 'moonriver', chainId: 1285, symbol: 'MOVR' },
  42220: { name: 'celo', chainId: 42220, symbol: 'CELO' },
  25: { name: 'cronos', chainId: 25, symbol: 'CRO' },
  324: { name: 'zksync', chainId: 324, symbol: 'ZK' },
  59144: { name: 'linea', chainId: 59144, symbol: 'LINEA' },
  5000: { name: 'mantle', chainId: 5000, symbol: 'MNT' },
  9001: { name: 'evmos', chainId: 9001, symbol: 'EVMOS' },
  288: { name: 'boba', chainId: 288, symbol: 'BOBA' },
  1088: { name: 'metis', chainId: 1088, symbol: 'METIS' },
  66: { name: 'okc', chainId: 66, symbol: 'OKT' },
  1313161554: { name: 'aurora', chainId: 1313161554, symbol: 'AURORA' },
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL' }
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

    if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables')
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
    let chainConfig = CHAIN_CONFIGS[chain_id]

    // If the chain is not explicitly known, fall back to a generic config to remain flexible
    if (!chainConfig) {
      console.warn(`Chain ID ${chain_id} not found in CHAIN_CONFIGS, using fallback`)
      chainConfig = { name: `chain-${chain_id}`, chainId: chain_id, symbol: 'UNKNOWN' }
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

    // For Solana use a non-EVM format (simplified); treat everything else as EVM-compatible by default
    let address = ''
    if (chainConfig.name === 'solana') {
      // Solana: use base58-like substring (placeholder)
      address = hashHex.substring(0, 44)
    } else {
      // Default to EVM-style 0x address for supported EVM chains and fallbacks
      address = '0x' + hashHex.substring(0, 40).toLowerCase()
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // Upsert into wallets_crypto to avoid duplicates on retries
    const { data: upserted, error: upsertError } = await supabase
      .from('wallets_crypto')
      .upsert([
        {
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
          },
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id,chain,address' })
      .select()
      .single()

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      wallet: {
        id: upserted.id,
        address: upserted.address,
        chain_id: upserted.chain_id,
        chain: upserted.chain,
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
