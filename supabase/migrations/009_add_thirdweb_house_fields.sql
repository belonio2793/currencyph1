-- Add ThirdWeb-specific fields to wallets_house
BEGIN;
ALTER TABLE IF EXISTS public.wallets_house
  ADD COLUMN IF NOT EXISTS thirdweb_wallet_id text,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'thirdweb',
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Ensure address and metadata columns exist (address may be stored in metadata)
ALTER TABLE IF EXISTS public.wallets_house
  ADD COLUMN IF NOT EXISTS address text;

COMMIT;
