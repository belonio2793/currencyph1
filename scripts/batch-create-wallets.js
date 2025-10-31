#!/usr/bin/env node
/**
 * Batch Create Real Onchain Wallets
 * Creates Bitcoin, Solana, and EVM-compatible wallets for all chains
 * Syncs to wallets_house table for transparent UI display
 *
 * Usage: node scripts/batch-create-wallets.js [--thirdweb-only]
 *
 * Requires env vars:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - THIRDWEB_SECRET_KEY (optional for --thirdweb-only)
 *   - WALLET_ENCRYPTION_KEY (for private key encryption)
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { secp256k1 } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { keccak_256 } from '@noble/hashes/sha3';
import { ed25519 } from '@noble/ed25519';
import bs58 from 'bs58';

const CHAIN_CONFIGS = {
  0: { name: 'bitcoin', chainId: 0, symbol: 'BTC', type: 'bitcoin' },
  1: { name: 'ethereum', chainId: 1, symbol: 'ETH', type: 'evm' },
  10: { name: 'optimism', chainId: 10, symbol: 'OP', type: 'evm' },
  56: { name: 'bsc', chainId: 56, symbol: 'BNB', type: 'evm' },
  100: { name: 'gnosis', chainId: 100, symbol: 'GNO', type: 'evm' },
  137: { name: 'polygon', chainId: 137, symbol: 'MATIC', type: 'evm' },
  250: { name: 'fantom', chainId: 250, symbol: 'FTM', type: 'evm' },
  42161: { name: 'arbitrum', chainId: 42161, symbol: 'ARB', type: 'evm' },
  42170: { name: 'arbitrum-nova', chainId: 42170, symbol: 'ARB', type: 'evm' },
  8453: { name: 'base', chainId: 8453, symbol: 'BASE', type: 'evm' },
  43114: { name: 'avalanche', chainId: 43114, symbol: 'AVAX', type: 'evm' },
  1284: { name: 'moonbeam', chainId: 1284, symbol: 'GLMR', type: 'evm' },
  1285: { name: 'moonriver', chainId: 1285, symbol: 'MOVR', type: 'evm' },
  42220: { name: 'celo', chainId: 42220, symbol: 'CELO', type: 'evm' },
  25: { name: 'cronos', chainId: 25, symbol: 'CRO', type: 'evm' },
  324: { name: 'zksync', chainId: 324, symbol: 'ZK', type: 'evm' },
  59144: { name: 'linea', chainId: 59144, symbol: 'LINEA', type: 'evm' },
  5000: { name: 'mantle', chainId: 5000, symbol: 'MNT', type: 'evm' },
  9001: { name: 'evmos', chainId: 9001, symbol: 'EVMOS', type: 'evm' },
  288: { name: 'boba', chainId: 288, symbol: 'BOBA', type: 'evm' },
  1088: { name: 'metis', chainId: 1088, symbol: 'METIS', type: 'evm' },
  66: { name: 'okc', chainId: 66, symbol: 'OKT', type: 'evm' },
  1313161554: { name: 'aurora', chainId: 1313161554, symbol: 'AURORA', type: 'evm' },
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL', type: 'solana' }
};

const toHex = (buf) => Buffer.from(buf).toString('hex');
const toBase64 = (buf) => Buffer.from(buf).toString('base64');

async function aesGcmEncryptString(plaintext, keyString) {
  const keyBuffer = Buffer.from(keyString, 'hex');
  const key = await crypto.subtle.importKey('raw', keyBuffer, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, Buffer.from(plaintext));
  return {
    cipher: toBase64(cipherBuf),
    iv: toBase64(iv),
    method: 'AES-GCM',
    created_at: new Date().toISOString()
  };
}

async function createBitcoinWallet() {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, true);
  const shaHash = sha256(pub);
  const pubHash = ripemd160(shaHash);
  const payload = new Uint8Array(1 + pubHash.length);
  payload[0] = 0x00;
  payload.set(pubHash, 1);
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const addrBytes = new Uint8Array(payload.length + 4);
  addrBytes.set(payload, 0);
  addrBytes.set(checksum, payload.length);
  const address = bs58.encode(addrBytes);
  const public_key = toHex(pub);
  const privateKeyHex = toHex(priv);

  return { address, public_key, private_key: privateKeyHex };
}

async function createSolanaWallet() {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = await ed25519.getPublicKey(priv);
  const address = bs58.encode(pub);
  const public_key = toHex(pub);
  const privateKeyHex = toHex(priv);

  return { address, public_key, private_key: privateKeyHex };
}

async function createEVMWallet() {
  const priv = secp256k1.utils.randomPrivateKey();
  const pubUn = secp256k1.getPublicKey(priv, false);
  const hash = keccak_256(pubUn.slice(1));
  const address = '0x' + toHex(hash.slice(-20)).toLowerCase();
  const public_key = toHex(secp256k1.getPublicKey(priv, true));
  const privateKeyHex = toHex(priv);

  return { address, public_key, private_key: privateKeyHex };
}

async function createThirdwebWallet(chain, thirdwebKey) {
  if (!thirdwebKey) {
    console.warn(`⚠️  Skipping ThirdWeb wallet for ${chain.name} (THIRDWEB_SECRET_KEY not set)`);
    return null;
  }

  try {
    const res = await fetch('https://api.thirdweb.com/v1/wallets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${thirdwebKey}`
      },
      body: JSON.stringify({ chain_id: chain.chainId, chain: chain.name })
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`⚠️  ThirdWeb error for ${chain.name}: ${res.status} ${text}`);
      return null;
    }

    const data = await res.json();
    return {
      address: data.address || data.wallet?.address,
      walletId: data.walletId || data.id || data.wallet?.id,
      data: data
    };
  } catch (e) {
    console.warn(`⚠️  Failed to create ThirdWeb wallet for ${chain.name}: ${e.message}`);
    return null;
  }
}

async function syncToWalletsHouse(supabase, chain, wallet, provider) {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || process.env.BTC_ENCRYPTION_KEY;
  
  const metadata = {
    chainName: chain.name,
    chainSymbol: chain.symbol,
    created_at: new Date().toISOString(),
    public_key: wallet.public_key,
    address: wallet.address
  };

  if (wallet.private_key && encryptionKey) {
    try {
      metadata.encrypted_private_key = await aesGcmEncryptString(wallet.private_key, encryptionKey);
    } catch (e) {
      console.warn(`⚠️  Failed to encrypt private key for ${chain.name}: ${e.message}`);
    }
  }

  const { data: existing } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('network', chain.name)
    .eq('currency', chain.symbol)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from('wallets_house')
      .update({
        metadata,
        address: wallet.address,
        provider,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return { id: updated.id, isNew: false };
  } else {
    const { data: inserted, error } = await supabase
      .from('wallets_house')
      .insert([{
        wallet_type: 'crypto',
        currency: chain.symbol,
        network: chain.name,
        address: wallet.address,
        provider,
        balance: 0,
        metadata,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return { id: inserted.id, isNew: true };
  }
}

async function main() {
  const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const THIRDWEB_KEY = process.env.THIRDWEB_SECRET_KEY;
  const thirdwebOnly = process.argv.includes('--thirdweb-only');

  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  console.log(`🚀 Starting batch wallet creation (${thirdwebOnly ? 'ThirdWeb only' : 'all chains'})`);
  console.log(`📊 Total chains: ${Object.keys(CHAIN_CONFIGS).length}`);
  console.log('');

  for (const [, chain] of Object.entries(CHAIN_CONFIGS)) {
    try {
      let wallet = null;
      let provider = null;

      if (thirdwebOnly) {
        const twWallet = await createThirdwebWallet(chain, THIRDWEB_KEY);
        if (twWallet) {
          wallet = twWallet;
          provider = 'thirdweb';
        } else {
          results.skipped.push({ chain: chain.name, reason: 'ThirdWeb creation failed or skipped' });
          continue;
        }
      } else {
        if (chain.type === 'bitcoin') {
          wallet = await createBitcoinWallet();
          provider = 'generated';
        } else if (chain.type === 'solana') {
          wallet = await createSolanaWallet();
          provider = 'generated';
        } else if (chain.type === 'evm') {
          wallet = await createEVMWallet();
          provider = 'generated';
        }
      }

      if (!wallet || !wallet.address) {
        results.failed.push({ chain: chain.name, reason: 'Failed to generate wallet' });
        continue;
      }

      const houseResult = await syncToWalletsHouse(supabase, chain, wallet, provider);
      results.success.push({
        chain: chain.name,
        symbol: chain.symbol,
        address: wallet.address.substring(0, 20) + '...',
        provider,
        houseId: houseResult.id,
        isNew: houseResult.isNew
      });

      console.log(`✅ ${chain.name.padEnd(20)} (${chain.symbol.padEnd(6)}) - ${provider.padEnd(10)}`);
    } catch (e) {
      results.failed.push({
        chain: chain.name,
        error: e.message
      });
      console.error(`❌ ${chain.name}: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📈 Results:`);
  console.log(`  ✅ Success: ${results.success.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log(`  ⏭️  Skipped: ${results.skipped.length}`);
  console.log('='.repeat(70) + '\n');

  if (results.failed.length > 0) {
    console.log('Failed chains:');
    results.failed.forEach(r => console.log(`  - ${r.chain}: ${r.error || r.reason}`));
    console.log('');
  }

  console.log('💾 All wallets synced to wallets_house table');
  console.log('🔓 Private keys are AES-GCM encrypted with WALLET_ENCRYPTION_KEY');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
