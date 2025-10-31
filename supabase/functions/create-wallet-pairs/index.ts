// Supabase Edge Function: create-wallet-pairs
// POST /functions/v1/create-wallet-pairs
// Body: { user_id, chain_id, create_house?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'
import * as secp from 'https://esm.sh/@noble/secp256k1@2.0.0'
import { sha256 } from 'https://esm.sh/@noble/hashes@1.3.2/sha256'
import { ripemd160 } from 'https://esm.sh/@noble/hashes@1.3.2/ripemd160'
import { keccak_256 } from 'https://esm.sh/@noble/hashes@1.3.2/sha3'
import * as ed25519 from 'https://esm.sh/@noble/ed25519@2.0.0'
import base58 from 'https://esm.sh/bs58@5.0.0'

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

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
const toBase64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function aesGcmEncryptString(plaintext: string, keyString: string) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(keyString))
  const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(plaintext))
  return { cipher: toBase64(cipherBuf), iv: toBase64(iv), method: 'AES-GCM', created_at: new Date().toISOString() }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY)
      return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => null)
    if (!body || (!body.user_id && !body.create_house) || typeof body.chain_id === 'undefined')
      return new Response(JSON.stringify({ error: 'Missing user_id or chain_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const HOUSE_ID = '00000000-0000-0000-0000-000000000000'
    const user_id = body.create_house ? HOUSE_ID : body.user_id
    const chain_id = Number(body.chain_id)
    const createHouse = !!body.create_house

    const chainConfig = CHAIN_CONFIGS[chain_id] || { name: `chain-${chain_id}`, chainId: chain_id, symbol: 'UNKNOWN' }

    let address = ''
    let public_key = ''
    let encrypted_private_key: any = null

    if (chainConfig.name === 'bitcoin') {
      const priv = secp.utils.randomPrivateKey()
      const pub = secp.getPublicKey(priv, true)
      const sha = sha256(pub)
      const pubHash = ripemd160(sha)
      const payload = new Uint8Array(1 + pubHash.length)
      payload[0] = 0x00
      payload.set(pubHash, 1)
      const checksum = sha256(sha256(payload)).slice(0, 4)
      const addrBytes = new Uint8Array(payload.length + 4)
      addrBytes.set(payload, 0)
      addrBytes.set(checksum, payload.length)
      address = base58.encode(addrBytes)
      public_key = toHex(pub)
      const key = Deno.env.get('BTC_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (key) encrypted_private_key = await aesGcmEncryptString(toHex(priv), key)
    } else if (chainConfig.name === 'solana') {
      const priv = ed25519.utils.randomPrivateKey()
      const pub = await ed25519.getPublicKey(priv)
      address = base58.encode(pub)
      public_key = toHex(pub)
      const key = Deno.env.get('SOL_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (key) encrypted_private_key = await aesGcmEncryptString(toHex(priv), key)
    } else {
      const priv = secp.utils.randomPrivateKey()
      const pubUn = secp.getPublicKey(priv, false)
      const hash = keccak_256(pubUn.slice(1))
      address = '0x' + toHex(hash.slice(-20)).toLowerCase()
      public_key = toHex(secp.getPublicKey(priv, true))
      const key = Deno.env.get('EVM_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (key) encrypted_private_key = await aesGcmEncryptString(toHex(priv), key)
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    const metadata: any = { chainName: chainConfig.name, chainSymbol: chainConfig.symbol, generated_at: new Date().toISOString(), public_key, address }
    if (encrypted_private_key) metadata.encrypted_private_key = encrypted_private_key

    const { data: upserted, error: upsertErr } = await supabase
      .from('wallets_crypto')
      .upsert([
        {
          user_id,
          chain: (chainConfig.name || '').toUpperCase(),
          chain_id,
          address,
          provider: createHouse ? 'house' : 'manual',
          balance: 0,
          metadata,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id,chain,address' })
      .select()
      .single()

    if (upsertErr)
      return new Response(JSON.stringify({ error: upsertErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    let houseRow = null
    if (createHouse) {
      const houseMeta = { ...metadata, wallet_id: upserted.id }
      const houseObj = { wallet_type: 'crypto', currency: chainConfig.symbol || chainConfig.name, network: chainConfig.name, balance: 0, metadata: houseMeta, updated_at: new Date().toISOString() }
      const { data: existing } = await supabase.from('wallets_house').select('*').eq('network', chainConfig.name).eq('currency', chainConfig.symbol || chainConfig.name).maybeSingle()
      if (existing) {
        const { data: updated } = await supabase.from('wallets_house').update({ metadata: houseObj.metadata, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
        houseRow = updated
      } else {
        const { data: inserted } = await supabase.from('wallets_house').insert([houseObj]).select().single()
        houseRow = inserted
      }
    }

    return new Response(JSON.stringify({ ok: true, wallet: { id: upserted.id, address: upserted.address, chain_id: upserted.chain_id, chain: upserted.chain, provider: upserted.provider || (createHouse ? 'house' : 'manual'), chainName: chainConfig.name, chainSymbol: chainConfig.symbol }, house: houseRow }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('create-wallet-pairs error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
