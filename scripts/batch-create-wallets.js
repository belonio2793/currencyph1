#!/usr/bin/env node
/**
 * Batch Create Real ThirdWeb Wallets
 * Uses ThirdWeb API to create embedded wallets
 * 
 * Usage: node scripts/batch-create-wallets.js
 */

import { createClient } from '@supabase/supabase-js';

const CHAIN_CONFIGS = [
  { name: 'ethereum', chainId: 1, symbol: 'ETH' },
  { name: 'polygon', chainId: 137, symbol: 'MATIC' },
  { name: 'arbitrum', chainId: 42161, symbol: 'ARB' },
  { name: 'optimism', chainId: 10, symbol: 'OP' },
  { name: 'base', chainId: 8453, symbol: 'BASE' },
  { name: 'avalanche', chainId: 43114, symbol: 'AVAX' },
  { name: 'fantom', chainId: 250, symbol: 'FTM' },
  { name: 'bsc', chainId: 56, symbol: 'BNB' },
  { name: 'gnosis', chainId: 100, symbol: 'GNO' },
  { name: 'celo', chainId: 42220, symbol: 'CELO' },
  { name: 'zksync', chainId: 324, symbol: 'ZK' },
  { name: 'linea', chainId: 59144, symbol: 'LINEA' },
  { name: 'mantle', chainId: 5000, symbol: 'MNT' },
  { name: 'moonbeam', chainId: 1284, symbol: 'GLMR' },
  { name: 'moonriver', chainId: 1285, symbol: 'MOVR' },
  { name: 'cronos', chainId: 25, symbol: 'CRO' },
  { name: 'metis', chainId: 1088, symbol: 'METIS' },
  { name: 'boba', chainId: 288, symbol: 'BOBA' },
  { name: 'okc', chainId: 66, symbol: 'OKT' },
  { name: 'aurora', chainId: 1313161554, symbol: 'AURORA' },
  { name: 'evmos', chainId: 9001, symbol: 'EVMOS' },
  { name: 'arbitrum-nova', chainId: 42170, symbol: 'ARB' }
];

// Create embedded wallet using ThirdWeb API
async function createThirdwebWallet(chain, thirdwebKey) {
  if (!thirdwebKey) {
    throw new Error(`THIRDWEB_SECRET_KEY not configured`);
  }

  // Try multiple endpoints in order
  const endpoints = [
    {
      url: `https://api.thirdweb.com/v1/embedded-wallets`,
      headers: { 'Authorization': `Bearer ${thirdwebKey}` },
      body: { chainId: chain.chainId }
    },
    {
      url: `https://api.thirdweb.com/v1/embedded-wallet`,
      headers: { 'x-secret-key': thirdwebKey },
      body: { chainId: chain.chainId }
    },
    {
      url: `https://api.thirdweb.com/v1/wallet`,
      headers: { 'Authorization': `Bearer ${thirdwebKey}` },
      body: { chainId: chain.chainId, type: 'embedded' }
    }
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...endpoint.headers
        },
        body: JSON.stringify(endpoint.body)
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      
      if (data.address || data.walletAddress) {
        return {
          address: data.address || data.walletAddress,
          walletId: data.walletId || data.id,
          rawData: data,
          provider: 'thirdweb',
          endpoint: endpoint.url
        };
      }
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  throw new Error(`Failed all endpoints for ${chain.name}: ${lastError}`);
}

// Sync wallet to wallets_house table
async function syncToWalletsHouse(supabase, chain, wallet) {
  const metadata = {
    chainName: chain.name,
    chainSymbol: chain.symbol,
    created_at: new Date().toISOString(),
    thirdweb_data: wallet.rawData,
    address: wallet.address,
    endpoint_used: wallet.endpoint
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

  console.log(`🚀 Creating REAL ThirdWeb Wallets (Starter Plan)`);
  console.log(`📊 Total chains: ${CHAIN_CONFIGS.length}`);
  console.log(`🔑 Using ThirdWeb Secret Key`);
  console.log('');

  for (const chain of CHAIN_CONFIGS) {
    try {
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
  console.log(`  ✅ Success: ${results.success.length}/${CHAIN_CONFIGS.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(80) + '\n');

  if (results.failed.length > 0) {
    console.log('Failed chains:');
    results.failed.forEach(r => console.log(`  - ${r.chain}: ${r.error}`));
  }

  if (results.success.length > 0) {
    console.log('\n💾 Real ThirdWeb wallets synced to wallets_house table');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
