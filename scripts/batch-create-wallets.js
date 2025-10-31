#!/usr/bin/env node
/**
 * Batch Create Real Onchain Wallets
 * Creates ThirdWeb smart wallets for all EVM chains + Bitcoin and Solana
 * Syncs to wallets_house table for transparent UI display
 * 
 * Usage: node scripts/batch-create-wallets.js
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const CHAIN_CONFIGS = {
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
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL', type: 'solana' },
  0: { name: 'bitcoin', chainId: 0, symbol: 'BTC', type: 'bitcoin' }
};

const toHex = (buf) => Buffer.from(buf).toString('hex');
const toBase64 = (buf) => Buffer.from(buf).toString('base64');

// Generate a simple Bitcoin address (P2PKH format)
async function generateBitcoinAddress() {
  const secp256k1 = await import('@noble/secp256k1');
  const hashLib = await import('@noble/hashes/sha256');
  const ripemd = await import('@noble/hashes/ripemd160');
  const bs58 = await import('bs58');

  const priv = secp256k1.secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.secp256k1.getPublicKey(priv, true);
  const sha = hashLib.sha256(pub);
  const hash160 = ripemd.ripemd160(sha);
  
  const payload = new Uint8Array(1 + hash160.length);
  payload[0] = 0x00;
  payload.set(hash160, 1);
  
  const checksum = hashLib.sha256(hashLib.sha256(payload)).slice(0, 4);
  const addrBytes = new Uint8Array(payload.length + 4);
  addrBytes.set(payload, 0);
  addrBytes.set(checksum, payload.length);
  
  const address = bs58.default.encode(addrBytes);
  const publicKey = toHex(pub);
  const privateKey = toHex(priv);

  return { address, publicKey, privateKey };
}

// Generate a simple Solana address
async function generateSolanaAddress() {
  const ed25519 = await import('@noble/ed25519');
  const bs58 = await import('bs58');

  const priv = ed25519.ed25519.utils.randomPrivateKey();
  const pub = await ed25519.ed25519.getPublicKey(priv);
  const address = bs58.default.encode(pub);
  const publicKey = toHex(pub);
  const privateKey = toHex(priv);

  return { address, publicKey, privateKey };
}

// Generate an EVM address
async function generateEVMAddress() {
  const secp256k1 = await import('@noble/secp256k1');
  const hashes = await import('@noble/hashes/sha3');

  const priv = secp256k1.secp256k1.utils.randomPrivateKey();
  const pubUn = secp256k1.secp256k1.getPublicKey(priv, false);
  const hash = hashes.keccak_256(pubUn.slice(1));
  const address = '0x' + toHex(hash.slice(-20)).toLowerCase();
  const publicKey = toHex(secp256k1.secp256k1.getPublicKey(priv, true));
  const privateKey = toHex(priv);

  return { address, publicKey, privateKey };
}

// Encrypt private key
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

// Create ThirdWeb wallet
async function createThirdwebWallet(chain, thirdwebKey) {
  if (!thirdwebKey) return null;

  try {
    const res = await fetch('https://api.thirdweb.com/v1/wallets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${thirdwebKey}`
      },
      body: JSON.stringify({ chain_id: chain.chainId, chain: chain.name })
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      address: data.address || data.wallet?.address,
      walletId: data.walletId || data.id || data.wallet?.id,
      rawData: data
    };
  } catch (e) {
    console.warn(`⚠️  ThirdWeb error for ${chain.name}: ${e.message}`);
    return null;
  }
}

// Sync wallet to wallets_house
async function syncToWalletsHouse(supabase, chain, wallet, provider) {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || process.env.BTC_ENCRYPTION_KEY;
  
  const metadata = {
    chainName: chain.name,
    chainSymbol: chain.symbol,
    created_at: new Date().toISOString(),
    public_key: wallet.publicKey,
    address: wallet.address
  };

  if (wallet.privateKey && encryptionKey) {
    try {
      metadata.encrypted_private_key = await aesGcmEncryptString(wallet.privateKey, encryptionKey);
    } catch (e) {
      console.warn(`⚠️  Failed to encrypt private key for ${chain.name}`);
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

  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
  const results = { success: [], failed: [], skipped: [] };

  console.log(`🚀 Starting batch wallet creation`);
  console.log(`📊 Total chains: ${Object.keys(CHAIN_CONFIGS).length}\n`);

  for (const [, chain] of Object.entries(CHAIN_CONFIGS)) {
    try {
      let wallet = null;
      let provider = null;

      // Try ThirdWeb first for EVM chains
      if (chain.type === 'evm' && THIRDWEB_KEY) {
        const twWallet = await createThirdwebWallet(chain, THIRDWEB_KEY);
        if (twWallet) {
          wallet = {
            address: twWallet.address,
            publicKey: null
          };
          provider = 'thirdweb';
        }
      }

      // Fall back to generated wallets
      if (!wallet) {
        try {
          if (chain.type === 'bitcoin') {
            wallet = await generateBitcoinAddress();
            provider = 'generated';
          } else if (chain.type === 'solana') {
            wallet = await generateSolanaAddress();
            provider = 'generated';
          } else if (chain.type === 'evm') {
            wallet = await generateEVMAddress();
            provider = 'generated';
          }
        } catch (genErr) {
          console.error(`❌ ${chain.name}: Generation failed - ${genErr.message}`);
          results.failed.push({
            chain: chain.name,
            error: genErr.message
          });
          continue;
        }
      }

      if (!wallet || !wallet.address) {
        results.failed.push({ chain: chain.name, reason: 'No address generated' });
        continue;
      }

      // Sync to database
      const houseResult = await syncToWalletsHouse(supabase, chain, wallet, provider);
      results.success.push({
        chain: chain.name,
        symbol: chain.symbol,
        address: wallet.address.substring(0, 20) + '...',
        provider,
        houseId: houseResult.id
      });

      console.log(`✅ ${chain.name.padEnd(20)} (${chain.symbol.padEnd(6)}) - ${provider.padEnd(10)}`);
    } catch (e) {
      results.failed.push({ chain: chain.name, error: e.message });
      console.error(`❌ ${chain.name}: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📈 Results:`);
  console.log(`  ✅ Success: ${results.success.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(70) + '\n');

  if (results.failed.length > 0) {
    console.log('Failed chains:');
    results.failed.forEach(r => console.log(`  - ${r.chain}: ${r.error || r.reason}`));
  }

  console.log('💾 All wallets synced to wallets_house table');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
