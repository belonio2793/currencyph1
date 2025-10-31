-- Insert missing network (house) wallet rows for supported chains
BEGIN;

-- Bitcoin
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','BTC','bitcoin',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='bitcoin' AND currency='BTC');

-- Ethereum
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','ETH','ethereum',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='ethereum' AND currency='ETH');

-- Polygon
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','MATIC','polygon',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='polygon' AND currency='MATIC');

-- Arbitrum
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','ARB','arbitrum',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='arbitrum' AND currency='ARB');

-- Optimism
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','OP','optimism',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='optimism' AND currency='OP');

-- Base
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','BASE','base',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='base' AND currency='BASE');

-- Avalanche
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','AVAX','avalanche',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='avalanche' AND currency='AVAX');

-- Fantom
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','FTM','fantom',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='fantom' AND currency='FTM');

-- Celo
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','CELO','celo',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='celo' AND currency='CELO');

-- zkSync
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','ZK','zksync',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='zksync' AND currency='ZK');

-- Solana
INSERT INTO public.wallets_house (wallet_type, currency, network, balance, metadata, updated_at)
SELECT 'crypto','SOL','solana',0, jsonb_build_object('generated_at', now()), now()
WHERE NOT EXISTS (SELECT 1 FROM public.wallets_house WHERE network='solana' AND currency='SOL');

-- Add any additional chains as needed following the pattern above

COMMIT;

-- Optionally add a unique constraint to prevent duplicates (run only after ensuring no duplicates exist):
-- ALTER TABLE public.wallets_house ADD CONSTRAINT wallets_house_network_currency_unique UNIQUE (network, currency);
