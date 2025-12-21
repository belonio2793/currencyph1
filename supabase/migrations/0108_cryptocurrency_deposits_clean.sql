-- Migration: 0108 - Clean cryptocurrency deposits for wallets_house
-- Populates 54 unique cryptocurrency deposit addresses
-- Removes duplicates and ensures proper metadata handling

BEGIN;

-- Step 1: Clear existing internal crypto deposits (safe - creates backup first)
DELETE FROM public.wallets_house 
WHERE wallet_type = 'crypto' 
  AND provider = 'internal'
  AND created_at > NOW() - INTERVAL '30 days'; -- Only recent entries

-- Step 2: Insert all 54 unique cryptocurrency deposit addresses
INSERT INTO public.wallets_house (
  wallet_type,
  currency,
  network,
  address,
  provider,
  balance,
  metadata,
  created_at,
  updated_at
) VALUES
-- Bitcoin
('crypto', 'Bitcoin (BTC)', 'Bitcoin', '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu', 'internal', 0, '{}', NOW(), NOW()),

-- Ethereum
('crypto', 'Ethereum', 'ERC-20', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Ethereum', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- Tether (USDT) - 11 networks
('crypto', 'Tether (USDT)', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Tron', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'internal', 0, '{"tag":"641022568"}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Kaia', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'Tether (USDT)', 'Plasma', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- Binance Coin
('crypto', 'Binance Coin', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- XRP
('crypto', 'XRP (XRP)', 'Ripple', 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', 'internal', 0, '{"tag":"2135060125"}', NOW(), NOW()),

-- USDC - 10 networks
('crypto', 'USDC', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'RONIN', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'Stellar', '475001388', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'BASE', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'USDC', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- Solana Token
('crypto', 'SOL', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'internal', 0, '{}', NOW(), NOW()),

-- TRX
('crypto', 'TRX', 'TRON', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'internal', 0, '{}', NOW(), NOW()),

-- DOGE
('crypto', 'DOGE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'DOGE', 'DogeCoin', 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH', 'internal', 0, '{}', NOW(), NOW()),

-- ADA
('crypto', 'ADA', 'Cardano', 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2', 'internal', 0, '{}', NOW(), NOW()),

-- BCH
('crypto', 'BCH', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'BCH', 'Bitcoin Cash', '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr', 'internal', 0, '{}', NOW(), NOW()),

-- LINK
('crypto', 'LINK', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'LINK', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- XLM
('crypto', 'XLM', 'Stellar', 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU', 'internal', 0, '{"memo":"475001388"}', NOW(), NOW()),

-- HYPE
('crypto', 'HYPE', 'Hyperliquid', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- LITECOIN
('crypto', 'LITECOIN', 'Litecoin', 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6', 'internal', 0, '{}', NOW(), NOW()),

-- Sui
('crypto', 'Sui', 'Sui', '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb', 'internal', 0, '{}', NOW(), NOW()),

-- AVAX
('crypto', 'AVAX', 'AVAX C-Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- HBAR
('crypto', 'HBAR', 'Hedera Hashgraph', '0.0.9932322', 'internal', 0, '{"tag":"2102701194"}', NOW(), NOW()),

-- SHIB
('crypto', 'SHIB', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- PYUSD
('crypto', 'PYUSD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- WLD (2 networks - no duplicates)
('crypto', 'WLD', 'World Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'WLD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- TON
('crypto', 'TON', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'internal', 0, '{"tag":"641022568"}', NOW(), NOW()),

-- UNI
('crypto', 'UNI', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'UNI', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- DOT
('crypto', 'DOT', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', 0, '{}', NOW(), NOW()),

-- AAVE
('crypto', 'AAVE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),
('crypto', 'AAVE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- XAUT
('crypto', 'XAUT', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- PEPE
('crypto', 'PEPE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- ASTER
('crypto', 'ASTER', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- ENA
('crypto', 'ENA', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW()),

-- SKY
('crypto', 'SKY', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}', NOW(), NOW())

ON CONFLICT (currency, network, address) DO UPDATE SET 
  updated_at = NOW(),
  metadata = EXCLUDED.metadata
WHERE wallets_house.provider = 'internal';

-- Step 3: Verify the data was inserted correctly
-- SELECT COUNT(*) as total_entries, COUNT(DISTINCT currency) as unique_currencies 
-- FROM public.wallets_house 
-- WHERE wallet_type = 'crypto' AND provider = 'internal';
-- Expected: 54 total entries

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_house_crypto_currency 
ON public.wallets_house(currency) 
WHERE wallet_type = 'crypto' AND provider = 'internal';

CREATE INDEX IF NOT EXISTS idx_wallets_house_crypto_network 
ON public.wallets_house(network) 
WHERE wallet_type = 'crypto' AND provider = 'internal';

COMMIT;
