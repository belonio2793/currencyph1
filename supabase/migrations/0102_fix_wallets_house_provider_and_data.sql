-- Migration: Fix wallets_house provider field and ensure all data is correct
-- This migration ensures all crypto deposit addresses are properly configured with provider='coinsph'

BEGIN;

-- Step 1: Update all existing providers to 'coinsph'
UPDATE wallets_house
SET provider = 'coinsph'
WHERE wallet_type = 'crypto' AND provider != 'coinsph';

-- Step 2: Ensure all critical cryptocurrencies are present
-- BITCOIN
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata)
VALUES ('crypto', 'BTC', 'Bitcoin', '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu', 'coinsph', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO UPDATE SET provider = 'coinsph';

-- ETHEREUM
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata)
VALUES 
('crypto', 'ETH', 'ERC-20', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'ETH', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO UPDATE SET provider = 'coinsph';

-- USDT (All Networks)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata)
VALUES
('crypto', 'USDT', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'Tron', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'coinsph', '{"tag":"641022568"}'::jsonb),
('crypto', 'USDT', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'Kaia', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'USDT', 'Plasma', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO UPDATE SET provider = 'coinsph';

-- MAJOR ASSETS
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata)
VALUES
('crypto', 'BNB', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'XRP', 'Ripple', 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', 'coinsph', '{"tag":"2135060125"}'::jsonb),
('crypto', 'USDC', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'USDC', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'coinsph', '{}'::jsonb),
('crypto', 'TRX', 'TRON', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'coinsph', '{}'::jsonb),
('crypto', 'DOGE', 'DogeCoin', 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH', 'coinsph', '{}'::jsonb),
('crypto', 'ADA', 'Cardano', 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2', 'coinsph', '{}'::jsonb),
('crypto', 'BCH', 'Bitcoin Cash', '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr', 'coinsph', '{}'::jsonb),
('crypto', 'XLM', 'Stellar', 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU', 'coinsph', '{"memo":"475001388"}'::jsonb),
('crypto', 'LTC', 'Litecoin', 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6', 'coinsph', '{}'::jsonb),
('crypto', 'SUI', 'Sui', '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb', 'coinsph', '{}'::jsonb),
('crypto', 'AVAX', 'AVAX C-Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'coinsph', '{}'::jsonb),
('crypto', 'HBAR', 'Hedera Hashgraph', '0.0.9932322', 'coinsph', '{"tag":"2102701194"}'::jsonb),
('crypto', 'TON', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'coinsph', '{"tag":"641022568"}'::jsonb)
ON CONFLICT (currency, network, address) DO UPDATE SET provider = 'coinsph';

-- Step 3: Ensure these cryptocurrencies exist in the currencies table
INSERT INTO currencies (code, name, type, symbol, active)
VALUES
('BTC', 'Bitcoin', 'crypto', '₿', true),
('ETH', 'Ethereum', 'crypto', 'Ξ', true),
('USDT', 'Tether', 'crypto', 'USDT', true),
('BNB', 'Binance Coin', 'crypto', 'BNB', true),
('XRP', 'Ripple', 'crypto', 'XRP', true),
('USDC', 'USD Coin', 'crypto', 'USDC', true),
('TRX', 'Tron', 'crypto', 'TRX', true),
('DOGE', 'Dogecoin', 'crypto', 'DOGE', true),
('ADA', 'Cardano', 'crypto', 'ADA', true),
('BCH', 'Bitcoin Cash', 'crypto', 'BCH', true),
('XLM', 'Stellar Lumens', 'crypto', 'XLM', true),
('LTC', 'Litecoin', 'crypto', 'LTC', true),
('SUI', 'Sui', 'crypto', 'SUI', true),
('AVAX', 'Avalanche', 'crypto', 'AVAX', true),
('HBAR', 'Hedera', 'crypto', 'HBAR', true),
('TON', 'Telegram', 'crypto', 'TON', true)
ON CONFLICT (code) DO UPDATE SET active = true, type = 'crypto';

-- Step 4: Verify data integrity
-- Ensure no NULL addresses (except for special cases)
UPDATE wallets_house
SET address = 'PENDING'
WHERE wallet_type = 'crypto' AND address IS NULL;

-- Step 5: Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_house_crypto_currency 
ON wallets_house (currency) 
WHERE wallet_type = 'crypto';

CREATE INDEX IF NOT EXISTS idx_wallets_house_provider 
ON wallets_house (provider) 
WHERE wallet_type = 'crypto';

-- Step 6: Verify the data
-- Count total crypto addresses
-- SELECT COUNT(*) as total_crypto_addresses FROM wallets_house WHERE wallet_type = 'crypto';
-- 
-- Count by currency
-- SELECT currency, COUNT(*) as network_count FROM wallets_house WHERE wallet_type = 'crypto' GROUP BY currency ORDER BY currency;
--
-- Verify all have coinsph provider
-- SELECT DISTINCT provider FROM wallets_house WHERE wallet_type = 'crypto';

COMMIT;
