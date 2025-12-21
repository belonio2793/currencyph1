-- Migration: Populate exact crypto deposit addresses
-- This migration ensures wallets_house table matches the exact configuration from the JSON spec
-- All addresses and network combinations must match exactly

BEGIN;

-- First, remove any entries that are not in the final specification
-- (keeping only the ones defined below)
DELETE FROM public.wallets_house
WHERE wallet_type = 'crypto' 
  AND provider = 'internal'
  AND (currency_name, network, address) NOT IN (
    -- Exact entries from the verified JSON configuration
    ('Bitcoin (BTC)', 'Bitcoin', '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu'),
    ('Bitcoin (BTC)', 'Bitcoin Lightning Network', NULL),
    ('Ethereum', 'ERC-20', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Ethereum', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Tether (USDT)', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ'),
    ('Tether (USDT)', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe'),
    ('Tether (USDT)', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Tether (USDT)', 'Tron', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB'),
    ('Tether (USDT)', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Tether (USDT)', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Tether (USDT)', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'),
    ('Tether (USDT)', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD'),
    ('Tether (USDT)', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Tether (USDT)', 'Kaia', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Tether (USDT)', 'Plasma', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('Binance Coin', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('XRP (XRP)', 'Ripple', 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu'),
    ('USDC', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ'),
    ('USDC', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe'),
    ('USDC', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('USDC', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('USDC', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('USDC', 'RONIN', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('USDC', 'Stellar', '475001388'),
    ('USDC', 'BASE', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('USDC', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('USDC', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'),
    ('TRX', 'TRON', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB'),
    ('DOGE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('DOGE', 'DogeCoin', 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH'),
    ('ADA', 'Cardano', 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2'),
    ('BCH', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('BCH', 'Bitcoin Cash', '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr'),
    ('LINK', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('LINK', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('XLM', 'Stellar', 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU'),
    ('HYPE', 'Hyperliquid', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('LITECOIN', 'Litecoin', 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6'),
    ('Sui', 'Sui', '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb'),
    ('AVAX', 'AVAX C-Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('HBAR', 'Hedera Hashgraph', '0.0.9932322'),
    ('SHIB', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('PYUSD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('WLD', 'World Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('WLD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('TON', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD'),
    ('UNI', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('UNI', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('DOT', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ'),
    ('AAVE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('AAVE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('XAUT', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('PEPE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('ASTER', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('ENA', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c'),
    ('SKY', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c')
  );

-- Then, upsert all entries to ensure they exist with correct metadata
INSERT INTO public.wallets_house (wallet_type, currency_name, network, address, provider, balance, metadata)
VALUES
  ('crypto', 'Bitcoin (BTC)', 'Bitcoin', '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu', 'internal', 0, '{}'),
  ('crypto', 'Bitcoin (BTC)', 'Bitcoin Lightning Network', NULL, 'internal', 0, '{}'),
  ('crypto', 'Ethereum', 'ERC-20', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Ethereum', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Tron', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'internal', 0, '{"tag": "641022568"}'),
  ('crypto', 'Tether (USDT)', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Kaia', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Tether (USDT)', 'Plasma', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'Binance Coin', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'XRP (XRP)', 'Ripple', 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', 'internal', 0, '{"tag": "2135060125"}'),
  ('crypto', 'USDC', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'RONIN', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'Stellar', '475001388', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'BASE', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'USDC', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'internal', 0, '{}'),
  ('crypto', 'TRX', 'TRON', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'internal', 0, '{}'),
  ('crypto', 'DOGE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'DOGE', 'DogeCoin', 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH', 'internal', 0, '{}'),
  ('crypto', 'ADA', 'Cardano', 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2', 'internal', 0, '{}'),
  ('crypto', 'BCH', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'BCH', 'Bitcoin Cash', '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr', 'internal', 0, '{}'),
  ('crypto', 'LINK', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'LINK', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'XLM', 'Stellar', 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU', 'internal', 0, '{"memo": "475001388"}'),
  ('crypto', 'HYPE', 'Hyperliquid', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'LITECOIN', 'Litecoin', 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6', 'internal', 0, '{}'),
  ('crypto', 'Sui', 'Sui', '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb', 'internal', 0, '{}'),
  ('crypto', 'AVAX', 'AVAX C-Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'HBAR', 'Hedera Hashgraph', '0.0.9932322', 'internal', 0, '{"tag": "2102701194"}'),
  ('crypto', 'SHIB', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'PYUSD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'WLD', 'World Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'WLD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'TON', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'internal', 0, '{"tag": "641022568"}'),
  ('crypto', 'UNI', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'UNI', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'DOT', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', 0, '{}'),
  ('crypto', 'AAVE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'AAVE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'XAUT', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'PEPE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'ASTER', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'ENA', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}'),
  ('crypto', 'SKY', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', 0, '{}')
ON CONFLICT (currency_name, network, address) DO UPDATE SET
  updated_at = NOW()
  WHERE wallets_house.provider = 'internal';

-- Step: Verify final state
-- Count total entries
-- SELECT COUNT(*) as total_entries, 
--        COUNT(DISTINCT currency_name) as unique_currencies,
--        COUNT(CASE WHEN address IS NULL THEN 1 END) as null_addresses
-- FROM public.wallets_house 
-- WHERE wallet_type = 'crypto' AND provider = 'internal';

COMMIT;
