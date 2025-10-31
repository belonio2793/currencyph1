#!/usr/bin/env node
// Directly generate a Solana keypair, encrypt the private key with WALLET_ENCRYPTION_KEY, and upsert into Supabase wallets_crypto and wallets_house tables

import { createClient } from '@supabase/supabase-js'
import * as ed25519 from '@noble/ed25519'
import base58 from 'bs58'
import crypto from 'crypto'

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WALLET_KEY = process.env.SOL_ENCRYPTION_KEY || process.env.WALLET_ENCRYPTION_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL (or PROJECT_URL) and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}
if (!WALLET_KEY) {
  console.error('WALLET_ENCRYPTION_KEY (or SOL_ENCRYPTION_KEY) is required to encrypt private key')
  process.exit(1)
}

const HOUSE_ID = '00000000-0000-0000-0000-000000000000'

function toHex(buf) {
  return Buffer.from(buf).toString('hex')
}

function toBase64(buf) {
  return Buffer.from(buf).toString('base64')
}

async function aesGcmEncryptString(plaintext, keyString) {
  const keyHash = crypto.createHash('sha256').update(keyString).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyHash, iv)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'hex')), cipher.final()])
  const authTag = cipher.getAuthTag()
  const combined = Buffer.concat([ciphertext, authTag])
  return { cipher: toBase64(combined), iv: toBase64(iv), method: 'AES-GCM', created_at: new Date().toISOString() }
}

async function run() {
  try {
    // generate solana keypair
    const priv = ed25519.utils.randomPrivateKey()
    const pub = await ed25519.getPublicKey(priv)
    const address = base58.encode(pub)
    const public_key = toHex(pub)

    // encrypt private key (hex)
    const enc = await aesGcmEncryptString(toHex(priv), WALLET_KEY)

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

    // upsert wallets_crypto
    const chain = { name: 'solana', chainId: 245022926, symbol: 'SOL' }
    const metadata = { chainName: chain.name, chainSymbol: chain.symbol, generated_at: new Date().toISOString(), public_key, address }
    if (enc) metadata.encrypted_private_key = enc

    const { data: upserted, error: upsertErr } = await supabase
      .from('wallets_crypto')
      .upsert([
        {
          user_id: HOUSE_ID,
          chain: (chain.name || '').toUpperCase(),
          chain_id: chain.chainId,
          address,
          provider: 'house',
          balance: 0,
          metadata,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'user_id,chain,address' })
      .select()
      .single()

    if (upsertErr) throw upsertErr

    // upsert wallets_house
    const houseMeta = { ...metadata, wallet_id: upserted.id }
    const houseObj = { wallet_type: 'crypto', currency: chain.symbol, network: chain.name, balance: 0, metadata: houseMeta, address: address, provider: 'thirdweb', updated_at: new Date().toISOString() }

    const { data: existing } = await supabase.from('wallets_house').select('*').eq('network', chain.name).eq('currency', chain.symbol).maybeSingle()
    let houseRow
    if (existing) {
      const { data: updated, error: updErr } = await supabase.from('wallets_house').update({ metadata: houseObj.metadata, address: houseObj.address, provider: houseObj.provider, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
      if (updErr) throw updErr
      houseRow = updated
    } else {
      const { data: inserted, error: insErr } = await supabase.from('wallets_house').insert([houseObj]).select().single()
      if (insErr) throw insErr
      houseRow = inserted
    }

    console.log('✅ Solana house wallet created')
    console.log(JSON.stringify({ wallet: upserted, house: houseRow }, null, 2))
  } catch (e) {
    console.error('Failed creating Solana house wallet:', e)
    process.exit(1)
  }
}

run()
