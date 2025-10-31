// Supabase Edge Function to create a managed wallet per chain and (optionally) a house/network wallet
// POST /functions/v1/create-wallet-thirdweb
// Body: { user_id, chain_id, create_house?: boolean }
// Returns: { ok: true, wallet: { id, address, chain_id, chain, provider, chainName, chainSymbol }, house?: row }

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
// Crypto libs
import * as secp from 'https://cdn.jsdelivr.net/npm/@noble/secp256k1@1.9.0/+esm'
import { keccak_256 } from 'https://cdn.jsdelivr.net/npm/@noble/hashes@1.3.2/sha3/+esm'
import * as ed25519 from 'https://cdn.jsdelivr.net/npm/@noble/ed25519@1.7.3/+esm'
import { sha256 } from 'https://cdn.jsdelivr.net/npm/@noble/hashes@1.3.0/sha256/+esm'
import { ripemd160 } from 'https://cdn.jsdelivr.net/npm/@noble/hashes@1.3.0/ripemd160/+esm'
import base58 from 'https://cdn.jsdelivr.net/npm/bs58@4.0.1/+esm'

// Supported chains (ids must align with client SUPPORTED_CHAINS)
const CHAIN_CONFIGS: Record<number, { name: string; chainId: number; symbol: string }> = {
  0: { name: 'bitcoin', chainId: 0, symbol: 'BTC' },
  1: { name: 'ethereum', chainId: 1, symbol: 'ETH' },
  10: { name: 'optimism', chainId: 10, symbol: 'OP' },
  25: { name: 'cronos', chainId: 25, symbol: 'CRO' },
  56: { name: 'bsc', chainId: 56, symbol: 'BNB' },
  66: { name: 'okc', chainId: 66, symbol: 'OKT' },
  100: { name: 'gnosis', chainId: 100, symbol: 'GNO' },
  137: { name: 'polygon', chainId: 137, symbol: 'MATIC' },
  250: { name: 'fantom', chainId: 250, symbol: 'FTM' },
  288: { name: 'boba', chainId: 288, symbol: 'BOBA' },
  324: { name: 'zksync', chainId: 324, symbol: 'ZK' },
  8453: { name: 'base', chainId: 8453, symbol: 'BASE' },
  42161: { name: 'arbitrum', chainId: 42161, symbol: 'ARB' },
  42170: { name: 'arbitrum-nova', chainId: 42170, symbol: 'ARB' },
  43114: { name: 'avalanche', chainId: 43114, symbol: 'AVAX' },
  42220: { name: 'celo', chainId: 42220, symbol: 'CELO' },
  5000: { name: 'mantle', chainId: 5000, symbol: 'MNT' },
  59144: { name: 'linea', chainId: 59144, symbol: 'LINEA' },
  9001: { name: 'evmos', chainId: 9001, symbol: 'EVMOS' },
  1088: { name: 'metis', chainId: 1088, symbol: 'METIS' },
  1284: { name: 'moonbeam', chainId: 1284, symbol: 'GLMR' },
  1285: { name: 'moonriver', chainId: 1285, symbol: 'MOVR' },
  1313161554: { name: 'aurora', chainId: 1313161554, symbol: 'AURORA' },
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL' }
}

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')

function toBase64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
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
      return new Response(JSON.stringify({ error: 'Missing configuration' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const body = await req.json().catch(() => null)
    if (!body || (!body.user_id && !body.create_house) || !body.chain_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id or chain_id' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const HOUSE_ID = '00000000-0000-0000-0000-000000000000'
    let user_id: string = body.create_house ? HOUSE_ID : body.user_id
    const chain_id: number = Number(body.chain_id)
    const createHouse: boolean = !!body.create_house

    let chainConfig = CHAIN_CONFIGS[chain_id]
    if (!chainConfig) chainConfig = { name: `chain-${chain_id}`, chainId: chain_id, symbol: 'UNKNOWN' }

    // Generate keypair per chain
    let address = ''
    let publicKey: string | null = null
    let encryptedKey: any = null

    if (chainConfig.name === 'bitcoin') {
      const privBytes = secp.utils.randomPrivateKey()
      const pubKeyComp = secp.getPublicKey(privBytes, true) // 33 bytes
      const pubKeyHash = ripemd160(sha256(pubKeyComp))
      const versioned = new Uint8Array(1 + pubKeyHash.length)
      versioned[0] = 0x00 // mainnet
      versioned.set(pubKeyHash, 1)
      const checksumFull = sha256(sha256(versioned))
      const checksum = checksumFull.slice(0, 4)
      const addrBytes = new Uint8Array(versioned.length + 4)
      addrBytes.set(versioned)
      addrBytes.set(checksum, versioned.length)
      address = base58.encode(addrBytes)
      publicKey = toHex(pubKeyComp)

      const EK = Deno.env.get('BTC_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (!EK) {
        console.error('Missing BTC_ENCRYPTION_KEY/WALLET_ENCRYPTION_KEY')
      } else {
        const privHex = toHex(privBytes)
        encryptedKey = await aesGcmEncryptString(privHex, EK)
      }
    } else if (chainConfig.name === 'solana') {
      // ed25519 keypair; address = base58(publicKey)
      const priv = ed25519.utils.randomPrivateKey()
      const pub = await ed25519.getPublicKey(priv)
      address = base58.encode(pub)
      publicKey = toHex(pub)
      const EK = Deno.env.get('SOL_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (!EK) {
        console.error('Missing SOL_ENCRYPTION_KEY/WALLET_ENCRYPTION_KEY')
      } else {
        const privHex = toHex(priv)
        encryptedKey = await aesGcmEncryptString(privHex, EK)
      }
    } else {
      // EVM chains
      const priv = secp.utils.randomPrivateKey()
      const pubUn = secp.getPublicKey(priv, false) // 65 bytes, 0x04 prefix
      const pubComp = secp.getPublicKey(priv, true)
      const hash = keccak_256(pubUn.slice(1)) // drop 0x04
      address = '0x' + toHex(hash.slice(-20))
      publicKey = toHex(pubComp)
      const EK = Deno.env.get('EVM_ENCRYPTION_KEY') || Deno.env.get('WALLET_ENCRYPTION_KEY')
      if (!EK) {
        console.error('Missing EVM_ENCRYPTION_KEY/WALLET_ENCRYPTION_KEY')
      } else {
        const privHex = toHex(priv)
        encryptedKey = await aesGcmEncryptString(privHex, EK)
      }
    }

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // Upsert into wallets_crypto for traceability (house user when createHouse=true)
    const metadataObj: any = {
      chainName: chainConfig.name,
      chainSymbol: chainConfig.symbol,
      generated_at: new Date().toISOString(),
      public_key: publicKey,
      address
    }
    if (encryptedKey) metadataObj.encrypted_private_key = encryptedKey

    const { data: upserted, error: upsertError } = await supabase
      .from('wallets_crypto')
      .upsert([
        {
          user_id,
          chain: chainConfig.name.toUpperCase(),
          chain_id,
          address,
          provider: createHouse ? 'house' : 'manual',
          balance: 0,
          metadata: metadataObj,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id,chain,address' })
      .select()
      .single()

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // Optionally create/update a house wallet row with keys in metadata
    let houseRow: any = null
    if (createHouse) {
      try {
        const houseMeta = { ...metadataObj, wallet_id: upserted.id }
        const houseObj = {
          wallet_type: 'crypto',
          currency: chainConfig.symbol || chainConfig.name,
          network: chainConfig.name,
          balance: 0,
          metadata: houseMeta,
          updated_at: new Date().toISOString()
        }

        // Try to find existing
        const { data: existing, error: selErr } = await supabase
          .from('wallets_house')
          .select('*')
          .eq('network', chainConfig.name)
          .eq('currency', chainConfig.symbol || chainConfig.name)
          .maybeSingle()
        if (selErr) throw selErr

        if (existing) {
          const { data: updated, error: updErr } = await supabase
            .from('wallets_house')
            .update({ metadata: houseObj.metadata, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .single()
          if (updErr) throw updErr
          houseRow = updated
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from('wallets_house')
            .insert([houseObj])
            .select()
            .single()
          if (insErr) throw insErr
          houseRow = inserted
        }
      } catch (e) {
        console.warn('Could not create/update house wallet row:', e)
        houseRow = null
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        wallet: {
          id: upserted.id,
          address: upserted.address,
          chain_id: upserted.chain_id,
          chain: upserted.chain,
          provider: upserted.provider || (createHouse ? 'house' : 'manual'),
          chainName: chainConfig.name,
          chainSymbol: chainConfig.symbol
        },
        house: houseRow
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error('Error creating wallet:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
