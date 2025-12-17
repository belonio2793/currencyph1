-- Migration 030: Standardize Column Names and Document Schema
-- 
-- This migration ensures consistent column naming across all tables:
-- - Currency fields use 'currency_code' (not 'currency')
-- - Country fields use 'country_code' (not 'country')
-- - All column names follow snake_case convention
--
-- Date: 2025-12-17
-- Status: Standardization & Documentation

-- ============================================================================
-- USERS TABLE STANDARDIZATION
-- ============================================================================

-- Add country_code if it doesn't exist and country does
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'country'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE users ADD COLUMN country_code VARCHAR(2) DEFAULT 'PH';
    UPDATE users SET country_code = country WHERE country IS NOT NULL;
    ALTER TABLE users DROP COLUMN country;
  END IF;
END $$;

-- Ensure country_code column exists on users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'PH';

-- ============================================================================
-- WALLETS TABLE STANDARDIZATION
-- ============================================================================

-- Ensure currency_code is used (not currency)
ALTER TABLE wallets 
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16) NOT NULL DEFAULT 'PHP' REFERENCES currencies(code);

-- Migrate data from 'currency' to 'currency_code' if both exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' AND column_name = 'currency'
  ) THEN
    UPDATE wallets SET currency_code = currency WHERE currency IS NOT NULL;
    ALTER TABLE wallets DROP COLUMN currency;
  END IF;
END $$;

-- Ensure required wallet columns exist
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS total_deposited DECIMAL(20, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn DECIMAL(20, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Note: account_number is intentionally NOT added to the main wallets table
-- If account_number is needed, use wallets_fiat table or wallet metadata
-- For now, the column exists on wallets if previously created and is left as-is

-- ============================================================================
-- LOANS TABLE STANDARDIZATION
-- ============================================================================

-- Ensure currency_code is the canonical column (not currency)
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16) DEFAULT 'PHP' REFERENCES currencies(code);

-- Migrate data from 'currency' to 'currency_code' if both exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loans' AND column_name = 'currency'
  ) THEN
    UPDATE loans SET currency_code = currency WHERE currency IS NOT NULL;
    ALTER TABLE loans DROP COLUMN currency;
  END IF;
END $$;

-- ============================================================================
-- DEPOSITS TABLE STANDARDIZATION
-- ============================================================================

-- Ensure currency_code is used on deposits table
ALTER TABLE deposits
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16) DEFAULT 'PHP' REFERENCES currencies(code);

-- Migrate legacy 'currency' column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deposits' AND column_name = 'currency'
  ) THEN
    UPDATE deposits SET currency_code = currency WHERE currency IS NOT NULL;
    ALTER TABLE deposits DROP COLUMN currency;
  END IF;
END $$;

-- ============================================================================
-- WALLET_TRANSACTIONS TABLE (if exists) - STANDARDIZATION
-- ============================================================================

-- Ensure currency_code is the standard column
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(16) DEFAULT 'PHP';

-- ============================================================================
-- BENEFICIARIES TABLE STANDARDIZATION
-- ============================================================================

-- Ensure standard columns exist
ALTER TABLE beneficiaries
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'PH';

-- ============================================================================
-- SCHEMA DOCUMENTATION
-- ============================================================================

-- Canonical table schemas (as implemented in code):

/*
USERS TABLE:
  - id: UUID PRIMARY KEY
  - email: VARCHAR(255) UNIQUE
  - full_name: VARCHAR(255)
  - phone_number: VARCHAR(20)
  - profile_picture_url: TEXT
  - country_code: VARCHAR(2) [STANDARDIZED]
  - status: VARCHAR(50) DEFAULT 'active'
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - username: VARCHAR(255) UNIQUE
  - display_name_type: VARCHAR(50)

WALLETS TABLE:
  - id: UUID PRIMARY KEY
  - user_id: UUID FOREIGN KEY (users)
  - currency_code: VARCHAR(16) [STANDARDIZED] REFERENCES currencies(code)
  - balance: DECIMAL(20, 8)
  - total_deposited: DECIMAL(20, 8) [STANDARDIZED]
  - total_withdrawn: DECIMAL(20, 8) [STANDARDIZED]
  - is_active: BOOLEAN [STANDARDIZED]
  - account_number: VARCHAR(255) [OPTIONAL - only if added]
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - UNIQUE(user_id, currency_code)

LOANS TABLE:
  - id: UUID PRIMARY KEY
  - user_id: UUID FOREIGN KEY (users)
  - loan_type: VARCHAR(50)
  - status: VARCHAR(50)
  - requested_amount: DECIMAL(20, 2)
  - total_owed: DECIMAL(20, 2)
  - remaining_balance: DECIMAL(20, 2)
  - currency_code: VARCHAR(16) [STANDARDIZED] REFERENCES currencies(code)
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP
  - lender_id: UUID FOREIGN KEY (users)
  - due_date: DATE
  - payment_method: VARCHAR(50)

DEPOSITS TABLE:
  - id: UUID PRIMARY KEY
  - user_id: UUID FOREIGN KEY (users)
  - wallet_id: UUID FOREIGN KEY (wallets)
  - amount: DECIMAL(20, 8)
  - currency_code: VARCHAR(16) [STANDARDIZED] REFERENCES currencies(code)
  - deposit_method: VARCHAR(50)
  - status: VARCHAR(50) DEFAULT 'pending'
  - payment_reference: VARCHAR(255)
  - external_tx_id: VARCHAR(255) UNIQUE
  - created_at: TIMESTAMP
  - updated_at: TIMESTAMP

WALLET_TRANSACTIONS TABLE:
  - id: UUID PRIMARY KEY
  - wallet_id: UUID FOREIGN KEY (wallets)
  - user_id: UUID FOREIGN KEY (users)
  - type: VARCHAR(50)
  - reference_id: VARCHAR(255)
  - amount: DECIMAL(20, 8)
  - balance_before: DECIMAL(20, 8)
  - balance_after: DECIMAL(20, 8)
  - currency_code: VARCHAR(16) [STANDARDIZED] REFERENCES currencies(code)
  - description: TEXT
  - created_at: TIMESTAMP

BENEFICIARIES TABLE:
  - id: UUID PRIMARY KEY
  - user_id: UUID FOREIGN KEY (users)
  - name: VARCHAR(255)
  - account_number: VARCHAR(255)
  - bank_name: VARCHAR(255)
  - phone: VARCHAR(20)
  - email: VARCHAR(255)
  - country_code: VARCHAR(2) [STANDARDIZED]
  - verified: BOOLEAN DEFAULT false
  - created_at: TIMESTAMP

*/

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================

/*
If you need to revert this migration:
1. This migration only adds columns and migrates data
2. Column drops are conditional and safe
3. To fully revert, restore from backup or manually:
   - ALTER TABLE users DROP COLUMN country_code;
   - ALTER TABLE wallets DROP COLUMN currency_code, total_deposited, total_withdrawn, is_active;
   - ALTER TABLE loans DROP COLUMN currency_code;
   - ALTER TABLE deposits DROP COLUMN currency_code;
   - ALTER TABLE wallet_transactions DROP COLUMN currency_code;
   - ALTER TABLE beneficiaries DROP COLUMN country_code;
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

/*
After migration, run these queries to verify schema:

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wallets' 
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loans' 
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deposits' 
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'wallet_transactions' 
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'beneficiaries' 
ORDER BY column_name;
*/
