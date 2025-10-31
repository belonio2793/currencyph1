-- Add Thirdweb wallet fields to wallets_crypto table
-- Note: 'address' column already exists and represents onchain_address
-- 'provider' column already exists
-- Adding chain_id (int) for EIP-155 chain IDs (Ethereum=1, Polygon=137, etc.)

ALTER TABLE public.wallets_crypto ADD COLUMN IF NOT EXISTS chain_id int;

-- Optional: Add onchain_address as explicit column (keep 'address' for backward compatibility)
-- Uncomment below if you want explicit onchain_address column
-- ALTER TABLE public.wallets_crypto ADD COLUMN IF NOT EXISTS onchain_address text;

-- Create index on chain_id for faster queries
CREATE INDEX IF NOT EXISTS idx_wallets_crypto_chain_id ON public.wallets_crypto(chain_id);

-- Update existing rows with chain_id based on chain text values (if chain column contains numeric chain IDs as strings)
-- This is optional and depends on your existing data format
-- UPDATE public.wallets_crypto SET chain_id = CAST(chain AS int) WHERE chain_id IS NULL AND chain ~ '^\d+$';
