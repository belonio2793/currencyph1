-- ============================================================================
-- EXPAND DEPOSIT METHODS TO SUPPORT ALL CRYPTOCURRENCIES
-- ============================================================================
-- This migration updates the check constraint on deposit_method to accept:
-- - All standard fiat/payment methods
-- - Any cryptocurrency symbol (BTC, ETH, SOL, USDC, USDT, etc.)
-- This allows dynamic deposit methods from wallets_house crypto addresses

-- Drop the restrictive constraint
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_deposit_method_check;

-- Create a more flexible constraint
-- Allows: fiat methods, single/multi-network crypto deposits, and any uppercase crypto symbols
ALTER TABLE deposits ADD CONSTRAINT deposits_deposit_method_check 
  CHECK (
    deposit_method IN (
      -- Fiat/Payment Methods
      'gcash', 'paymaya', 'bank_transfer', 'fiat_transfer', 'stripe', 
      'wise', 'remitly', 'coins_ph', 'instapay',
      -- Deprecated/legacy
      'solana', 'crypto_transfer', 'crypto_direct'
    )
    OR 
    -- Allow any lowercase cryptocurrency symbol (btc, eth, sol, usdc, usdt, etc.)
    -- Also allows variants like 'btc-0', 'eth-1' for multi-network support
    (
      deposit_method ~ '^[a-z]+(-[0-9]+)?$' 
      AND length(deposit_method) >= 2 
      AND length(deposit_method) <= 20
    )
  );

-- ============================================================================
-- Add comment explaining the constraint
-- ============================================================================

COMMENT ON CONSTRAINT deposits_deposit_method_check ON deposits IS
'Flexible constraint allowing:
1. Named fiat/payment methods: gcash, paymaya, bank_transfer, stripe, etc.
2. Cryptocurrency symbols in lowercase: btc, eth, sol, usdc, usdt, etc.
3. Multi-network crypto: btc-0, eth-1 for multiple networks of same crypto
4. Pattern: lowercase letters and optional dash with numeric suffix
Examples: btc, eth, sol, usdc, btc-0 (Bitcoin via network 0), eth-1 (Ethereum via network 1)';

-- ============================================================================
-- Update status check constraint to include 'approved'
-- ============================================================================

ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;

ALTER TABLE deposits ADD CONSTRAINT deposits_status_check 
  CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'completed', 'failed', 'cancelled'));

-- ============================================================================
-- Verify deposits table has necessary columns for crypto
-- ============================================================================

-- Note: The following columns should exist in the deposits table:
-- - id, user_id, wallet_id (foreign keys)
-- - amount (numeric deposit amount)
-- - currency_code (receiving wallet currency, e.g., 'PHP')
-- - deposit_method (crypto symbol or payment method)
-- - description (human-readable description)
-- - notes (JSON metadata, can store crypto details)
-- - status (pending, processing, approved, completed, failed, cancelled)
-- - created_at, updated_at, completed_at (timestamps)

-- ============================================================================
-- END CRYPTO DEPOSIT METHODS MIGRATION
-- ============================================================================
