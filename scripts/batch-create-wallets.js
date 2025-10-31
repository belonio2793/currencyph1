#!/usr/bin/env node
/**
 * Batch Create Real ThirdWeb Wallets
 * Uses ONLY ThirdWeb API to create smart wallets
 * No fallback to generated/mock addresses
 * 
 * Usage: node scripts/batch-create-wallets.js
 */

import { createClient } from '@supabase/supabase-js';

const CHAIN_CONFIGS = {
  // EVM Chains supported by ThirdWeb
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
  
  // Non-EVM chains (might require special handling)
  245022926: { name: 'solana', chainId: 245022926, symbol: 'SOL' },
  0: { name: 'bitcoin', chainId: 0, symbol: 'BTC' }
};

// Create a ThirdWeb wallet via REST API
async function createThirdwebWallet(chain, thirdwebKey) {
  if (!thirdwebKey) {
    throw new Error(`THIRDWEB_SECRET_KEY not configured`);
  }

  try {
    const res = await fetch('https://api.thirdweb.com/v1/wallets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${thirdwebKey}`
      },
      body: JSON.stringify({ 
        chain_id: chain.chainId, 
        chain: chain.name 
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    
    if (!data.address) {
      throw new Error(`No address returned from ThirdWeb: ${JSON.stringify(data)}`);
    }

    return {
      address: data.address,
      walletId: data.walletId || data.id || data.wallet?.id,
      rawData: data,
      provider: 'thirdweb'
    };
  } catch (e) {
    throw new Error(`Failed to create ThirdWeb wallet for ${chain.name}: ${e.message}`);
  }
}

// Sync wallet to wallets_house table
async function syncToWalletsHouse(supabase, chain, wallet) {
  const metadata = {
    chainName: chain.name,
    chainSymbol: chain.symbol,
    created_at: new Date().toISOString(),
    thirdweb_data: wallet.rawData,
    address: wallet.address
  };

  if (wallet.walletId) {
    metadata.thirdweb_wallet_id = wallet.walletId;
  }

  // Check if wallet already exists
  const { data: existing, error: checkErr } = await supabase
    .from('wallets_house')
    .select('*')
    .eq('network', chain.name)
    .eq('currency', chain.symbol)
    .maybeSingle();

  if (checkErr && checkErr.code !== 'PGRST116') {
    throw new Error(`Query error: ${checkErr.message}`);
  }

  let result;
  if (existing) {
    // Update existing
    const { data: updated, error: updateErr } = await supabase
      .from('wallets_house')
      .update({
        address: wallet.address,
        metadata,
        provider: wallet.provider,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    result = updated;
  } else {
    // Insert new
    const { data: inserted, error: insertErr } = await supabase
      .from('wallets_house')
      .insert({
        wallet_type: 'crypto',
        currency: chain.symbol,
        network: chain.name,
        address: wallet.address,
        metadata,
        provider: wallet.provider,
        balance: 0,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    result = inserted;
  }

  return result;
}

async function main() {
  const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const THIRDWEB_KEY = process.env.THIRDWEB_SECRET_KEY;

  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!THIRDWEB_KEY) {
    console.error('❌ Missing THIRDWEB_SECRET_KEY - required for real wallet creation');
    process.exit(1);
  }

  const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);
  const results = { success: [], failed: [] };

  console.log(`🚀 Creating REAL ThirdWeb Wallets (no mockups)`);
  console.log(`📊 Total chains: ${Object.keys(CHAIN_CONFIGS).length}`);
  console.log(`🔑 Using ThirdWeb API with key: ${THIRDWEB_KEY.substring(0, 20)}...`);
  console.log('');

  for (const [, chain] of Object.entries(CHAIN_CONFIGS)) {
    try {
      // ONLY ThirdWeb - no fallback
      const wallet = await createThirdwebWallet(chain, THIRDWEB_KEY);
      
      if (!wallet.address) {
        throw new Error('No wallet address returned');
      }

      // Sync to database
      await syncToWalletsHouse(supabase, chain, wallet);
      
      results.success.push({
        chain: chain.name,
        symbol: chain.symbol,
        address: wallet.address
      });

      console.log(`✅ ${chain.name.padEnd(20)} | ${chain.symbol.padEnd(6)} | ${wallet.address.substring(0, 20)}...`);
    } catch (e) {
      results.failed.push({
        chain: chain.name,
        error: e.message
      });
      console.error(`❌ ${chain.name}: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📈 Results:`);
  console.log(`  ✅ Success: ${results.success.length}/${Object.keys(CHAIN_CONFIGS).length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(80) + '\n');

  if (results.failed.length > 0) {
    console.log('Failed chains:');
    results.failed.forEach(r => console.log(`  - ${r.chain}: ${r.error}`));
    console.log('\n⚠️  ONLY REAL ThirdWeb wallets created - no fallback to mock addresses\n');
  }

  if (results.success.length > 0) {
    console.log('💾 Real wallets synced to wallets_house table');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
