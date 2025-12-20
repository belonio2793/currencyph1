-- Migration: Add all cryptocurrency deposit addresses to wallets_house
-- This migration populates the wallets_house table with deposit addresses for various cryptocurrencies
-- across multiple networks, enabling users to deposit crypto directly

BEGIN;

-- Bitcoin (BTC)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'BTC', 'Bitcoin', '15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'BTC', 'Bitcoin Lightning Network', NULL, 'internal', '{"note": "Lightning Network address pending"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- Ethereum (ETH)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'ETH', 'ERC-20', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'ETH', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- Tether (USDT)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Tron', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'internal', '{"tag": "641022568"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Kaia', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDT', 'Plasma', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- Binance Coin (BNB)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'BNB', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- XRP (XRP)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'XRP', 'Ripple', 'rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu', 'internal', '{"tag": "2135060125"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- USDC
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'APT', '0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'Arbitrum One', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'RONIN', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'Stellar', '475001388', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'BASE', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'Polygon', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'USDC', 'Solana', 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- TRX (Tron)
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'TRX', 'TRON', 'TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- DOGE
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'DOGE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'DOGE', 'DogeCoin', 'DJungBB29tYgcuUXnXUpParVN9BTwKj4kH', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- ADA
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'ADA', 'Cardano', 'addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- BCH
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'BCH', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'BCH', 'Bitcoin Cash', '1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- LINK
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'LINK', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'LINK', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- XLM
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'XLM', 'Stellar', 'GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU', 'internal', '{"memo": "475001388"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- HYPE
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'HYPE', 'Hyperliquid', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- LITECOIN
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'LTC', 'Litecoin', 'LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- Sui
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'SUI', 'Sui', '0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- AVAX
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'AVAX', 'AVAX C-Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- HBAR
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'HBAR', 'Hedera Hashgraph', '0.0.9932322', 'internal', '{"tag": "2102701194"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- SHIB
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'SHIB', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- PYUSD
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'PYUSD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- WLD
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'WLD', 'World Chain', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'WLD', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- TON
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'TON', 'The Open Network', 'EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD', 'internal', '{"tag": "641022568"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- UNI
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'UNI', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'UNI', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- DOT
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'DOT', 'Asset Hub (Polkadot)', '12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- AAVE
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'AAVE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'AAVE', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- XAUT
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'XAUT', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- PEPE
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'PEPE', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- ASTER
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'ASTER', 'BNB Smart Chain (BEP20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- ENA
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'ENA', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- SKY
INSERT INTO wallets_house (wallet_type, currency, network, address, provider, metadata) 
VALUES ('crypto', 'SKY', 'Ethereum (ERC20)', '0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c', 'internal', '{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

COMMIT;
