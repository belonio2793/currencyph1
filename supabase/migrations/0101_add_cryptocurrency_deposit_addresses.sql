-- Migration: Add all cryptocurrency deposit addresses to wallets_house
-- Fully Postgres/Supabase compatible

BEGIN;

-- 1️⃣ Ensure ON CONFLICT works (Postgres-safe)
CREATE UNIQUE INDEX IF NOT EXISTS wallets_house_currency_network_address_uidx
ON wallets_house (currency, network, address);

-- =====================
-- BITCOIN
-- =====================
INSERT INTO wallets_house
(wallet_type, currency, network, address, provider, metadata)
VALUES
('crypto','BTC','Bitcoin','15Z9UvjeLc5zQ1uhemyCeobvpz7Wg2UaYu','internal','{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- =====================
-- ETHEREUM
-- =====================
INSERT INTO wallets_house
(wallet_type, currency, network, address, provider, metadata)
VALUES
('crypto','ETH','ERC-20','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','ETH','Arbitrum One','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- =====================
-- USDT
-- =====================
INSERT INTO wallets_house
(wallet_type, currency, network, address, provider, metadata)
VALUES
('crypto','USDT','Asset Hub (Polkadot)','12xM7g2sVoLqrVqZf6CFH82aYA674uEctsEN8sHnUDkS9YPQ','internal','{}'::jsonb),
('crypto','USDT','APT','0xa4510c0481a7d0a2983633af029fab9550441554b86393d460d66403e37312fe','internal','{}'::jsonb),
('crypto','USDT','Ethereum (ERC20)','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','USDT','Tron','TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB','internal','{}'::jsonb),
('crypto','USDT','BNB Smart Chain (BEP20)','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','USDT','Arbitrum One','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','USDT','Solana','CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS','internal','{}'::jsonb),
('crypto','USDT','The Open Network','EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD','internal','{"tag":"641022568"}'::jsonb),
('crypto','USDT','Polygon','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','USDT','Kaia','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','USDT','Plasma','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

-- =====================
-- MAJOR ASSETS
-- =====================
INSERT INTO wallets_house
(wallet_type, currency, network, address, provider, metadata)
VALUES
('crypto','BNB','BNB Smart Chain (BEP20)','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','XRP','Ripple','rpWJmMcPM4ynNfvhaZFYmPhBq5FYfDJBZu','internal','{"tag":"2135060125"}'::jsonb),
('crypto','USDC','Ethereum (ERC20)','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','USDC','Solana','CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS','internal','{}'::jsonb),
('crypto','TRX','TRON','TMW3RxyTgBXuDp4D2q7BhrDfcimYAqWXsB','internal','{}'::jsonb),
('crypto','DOGE','DogeCoin','DJungBB29tYgcuUXnXUpParVN9BTwKj4kH','internal','{}'::jsonb),
('crypto','ADA','Cardano','addr1vxs8l5cw4vczt00m4va5yqy3ygtgu6rdequn82ncq3umn3stg67g2','internal','{}'::jsonb),
('crypto','BCH','Bitcoin Cash','1C9hSv7WGZ3LBWaam6QFvXmPzyHDrVJnxr','internal','{}'::jsonb),
('crypto','XLM','Stellar','GCB4QJYFM56UC2UCVIEYMELK6QVCCTF533OMKU4QRUY5MHLP5ZDQXEQU','internal','{"memo":"475001388"}'::jsonb),
('crypto','LTC','Litecoin','LcwH9ny5ykyuhX83xQ86j8FqM3ut2dKvJ6','internal','{}'::jsonb),
('crypto','SUI','Sui','0x5522950a29882692e38949a1da2bad51e676058a9caf76f7edf1f02ed73f20bb','internal','{}'::jsonb),
('crypto','AVAX','AVAX C-Chain','0xc530cfc3a9a4e57cb35183ea1f5436aa1f8fc73c','internal','{}'::jsonb),
('crypto','HBAR','Hedera Hashgraph','0.0.9932322','internal','{"tag":"2102701194"}'::jsonb),
('crypto','TON','The Open Network','EQD2P3X9U0R8tVH1N2yj_Y7NkD7BH--02HuBEqzkT3XXi3mD','internal','{"tag":"641022568"}'::jsonb)
ON CONFLICT (currency, network, address) DO NOTHING;

COMMIT;
