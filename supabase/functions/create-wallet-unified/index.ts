// Supabase Edge Function: create-wallet-unified
// POST /functions/v1/create-wallet-unified
// Body: { user_id, chain_id, create_house?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'
import * as secp from 'https://esm.sh/@noble/secp256k1@2.0.0'
import { sha256 } from 'https://esm.sh/@noble/hashes@1.3.2/sha256'
import { ripemd160 } from 'https://esm.sh/@noble/hashes@1.3.2/ripemd160'
import { keccak_256 } from 'https://esm.sh/@noble/hashes@1.3.2/sha3'
import nacl from 'https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/+esm'
import base58 from 'https://cdn.jsdelivr.net/npm/bs58@4.0.1/+esm'

// Minimal chain map - extend as needed
const CHAIN_CONFIGS = {
  0: { name: 'bitcoin', chainId: 0, symbol: 'BTC' },
  1: { name: 'ethereum', chainId: 1, symbol: 'ETH' },
  10: { name: 'optimism', chainId: 10, symbol: 'OP' },
  25: { name: 'cronos', chainId: 25, symbol: 'CRO' },
  56: { name: 'bsc', chainId: 56, symbol: 'BNB' },
  100: { name: 'gnosis', chainId: 100, symbol: 'GNO' },
  137: { name: 'polygon', chainId: 137, symbol: 'MATIC' },
  250: { name: 'fantom', chainId: 250, symbol: 'FTM' },
  42161: { name: 'arbitrum', chainId: 42161, symbol: 'ARB' },
  42170: { name: 'arbitrum-nova', chainId: 42170, symbol: 'ARB' },
  43114: { name: 'avalanche', chainId: 43114, symbol: 'AVAX' },
  42220: { name: 'celo', chainId: 42220, symbol: 'CELO' },
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL' }
}

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')

async function aesGcmEncryptString(plaintext, keyString) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(keyString))
  const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(plaintext))
  const ivB = Array.from(iv).map(b => String.fromCharCode(b)).join('')
  const cipherB = Array.from(new Uint8Array(cipherBuf)).map(b => String.fromCharCode(b)).join('')
  return { cipher: btoa(cipherB), iv: btoa(ivB), method: 'AES-GCM', created_at: new Date().toISOString() }
}

Deno.serve(async (req) => {
  const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  try {
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!PROJECT_URL || !SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => null)
    if (!body || (!body.user_id && !body.create_house) || typeof body.chain_id === 'undefined') return new Response(JSON.stringify({ error: 'Missing user_id or chain_id' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const HOUSE_ID = '00000000-0000-0000-0000-000000000000'
    const user_id = body.create_house ? HOUSE_ID : body.user_id
    const chain_id = Number(body.chain_id)
    const createHouse = !!body.create_house

    const chainConfig = CHAIN_CONFIGS[chain_id] || { name: `chain-${chain_id}`, chainId: chain_id, symbol: 'UNKNOWN' }

    let address = ''
    let public_key = ''
    let encrypted_private_key = null

    // Key generation per chain
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
      // Use tweetnacl for ed25519 (Deno-friendly)
      const seed = crypto.getRandomValues(new Uint8Array(32))
      const kp = nacl.sign.keyPair.fromSeed(seed)
      const pub = kp.publicKey
      const priv = kp.secretKey
      address = base58.encode(pub)
      public_key = toHex(pub)
      const key = Deno.env.get('SOL_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (key) encrypted_private_key = await aesGcmEncryptString(toHex(priv), key)
    } else {
      // EVM-style
      const priv = secp.utils.randomPrivateKey()
      const pubUn = secp.getPublicKey(priv, false)
      const hash = keccak_256(pubUn.slice(1))
      address = '0x' + toHex(hash.slice(-20)).toLowerCase()
      public_key = toHex(secp.getPublicKey(priv, true))
      const key = Deno.env.get('EVM_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (key) encrypted_private_key = await aesGcmEncryptString(toHex(priv), key)
    }

    if (!address) return new Response(JSON.stringify({ error: `Wallet generation failed for ${chainConfig.name}` }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    const metadata = {
      chainName: chainConfig.name,
      chainSymbol: chainConfig.symbol,
      generated_at: new Date().toISOString(),
      public_key,
      address
    }
    if (encrypted_private_key) metadata.encrypted_private_key = encrypted_private_key

    const { data: upserted, error: upsertErr } = await supabase
      .from('wallets_crypto')
      .insert([
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
      ])
      .select()
      .single()

    if (upsertErr) return new Response(JSON.stringify({ error: upsertErr.message }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

    let houseRow = null
    if (createHouse) {
      try {
        const houseMeta = { ...metadata, wallet_id: upserted.id }
        const houseObj = { wallet_type: 'crypto', currency: chainConfig.symbol || chainConfig.name, network: chainConfig.name, balance: 0, metadata: houseMeta, address: address || null, provider: 'thirdweb', updated_at: new Date().toISOString() }

        const { data: existing, error: selErr } = await supabase.from('wallets_house').select('*').eq('network', chainConfig.name).eq('currency', chainConfig.symbol || chainConfig.name).maybeSingle()
        if (selErr) throw selErr

        if (existing) {
          const { data: updated, error: updErr } = await supabase.from('wallets_house').update({ metadata: houseObj.metadata, address: houseObj.address, provider: houseObj.provider, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
          if (updErr) throw updErr
          houseRow = updated
        } else {
          const { data: inserted, error: insErr } = await supabase.from('wallets_house').insert([houseObj]).select().single()
          if (insErr) throw insErr
          houseRow = inserted
        }
      } catch (e) {
        console.warn('Could not create/update house wallet row:', e)
        houseRow = null
      }
    }

    return new Response(JSON.stringify({ ok: true, wallet: { id: upserted.id, address: upserted.address, chain_id: upserted.chain_id, chain: upserted.chain, provider: upserted.provider || (createHouse ? 'house' : 'manual'), chainName: chainConfig.name, chainSymbol: chainConfig.symbol }, house: houseRow }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('create-wallet-unified error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
