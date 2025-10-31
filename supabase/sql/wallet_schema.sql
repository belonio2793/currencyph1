-- ============================================================================
-- COMPLETE WALLET SCHEMA FOR MULTI-CURRENCY SUPPORT
-- ============================================================================
-- PHP is set as the default primary currency
-- Supports fiat currencies and cryptocurrencies
-- Includes audit trail via wallet_transactions table
-- ============================================================================

-- 1️⃣ CURRENCIES TABLE - Define all supported currencies
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(16) PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fiat', 'crypto')),
  symbol TEXT,
  decimals INTEGER DEFAULT 2,
  active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common currencies (PHP as primary/default)
INSERT INTO currencies (code, name, type, symbol, decimals, is_default) VALUES
  ('PHP', 'Philippine Peso', 'fiat', '₱', 2, TRUE),
  ('USD', 'US Dollar', 'fiat', '$', 2, FALSE),
  ('EUR', 'Euro', 'fiat', '€', 2, FALSE),
  ('GBP', 'British Pound', 'fiat', '£', 2, FALSE),
  ('JPY', 'Japanese Yen', 'fiat', '¥', 0, FALSE),
  ('CNY', 'Chinese Yuan', 'fiat', '¥', 2, FALSE),
  ('INR', 'Indian Rupee', 'fiat', '₹', 2, FALSE),
  ('AUD', 'Australian Dollar', 'fiat', '$', 2, FALSE),
  ('CAD', 'Canadian Dollar', 'fiat', '$', 2, FALSE),
  ('CHF', 'Swiss Franc', 'fiat', 'CHF', 2, FALSE),
  ('SEK', 'Swedish Krona', 'fiat', 'kr', 2, FALSE),
  ('NZD', 'New Zealand Dollar', 'fiat', '$', 2, FALSE),
  ('SGD', 'Singapore Dollar', 'fiat', '$', 2, FALSE),
  ('HKD', 'Hong Kong Dollar', 'fiat', '$', 2, FALSE),
  ('IDR', 'Indonesian Rupiah', 'fiat', 'Rp', 0, FALSE),
  ('MYR', 'Malaysian Ringgit', 'fiat', 'RM', 2, FALSE),
  ('THB', 'Thai Baht', 'fiat', '฿', 2, FALSE),
  ('VND', 'Vietnamese Dong', 'fiat', '₫', 0, FALSE),
  ('KRW', 'South Korean Won', 'fiat', '₩', 0, FALSE),
  ('ZAR', 'South African Rand', 'fiat', 'R', 2, FALSE),
  ('BRL', 'Brazilian Real', 'fiat', 'R$', 2, FALSE),
  ('MXN', 'Mexican Peso', 'fiat', '$', 2, FALSE),
  ('NOK', 'Norwegian Krone', 'fiat', 'kr', 2, FALSE),
  ('DKK', 'Danish Krone', 'fiat', 'kr', 2, FALSE),
  ('AED', 'UAE Dirham', 'fiat', 'د.إ', 2, FALSE),
  ('BTC', 'Bitcoin', 'crypto', '₿', 8, FALSE),
  ('ETH', 'Ethereum', 'crypto', 'Ξ', 8, FALSE),
  ('XRP', 'XRP', 'crypto', 'XRP', 8, FALSE),
  ('ADA', 'Cardano', 'crypto', 'ADA', 8, FALSE),
  ('SOL', 'Solana', 'crypto', 'SOL', 8, FALSE),
  ('DOGE', 'Dogecoin', 'crypto', 'Ð', 8, FALSE),
  ('MATIC', 'Polygon', 'crypto', 'MATIC', 8, FALSE),
  ('LINK', 'Chainlink', 'crypto', 'LINK', 8, FALSE),
  ('LTC', 'Litecoin', 'crypto', 'Ł', 8, FALSE),
  ('BCH', 'Bitcoin Cash', 'crypto', 'BCH', 8, FALSE),
  ('USDT', 'Tether USD', 'crypto', 'USDT', 6, FALSE),
  ('USDC', 'USD Coin', 'crypto', 'USDC', 6, FALSE),
  ('BUSD', 'Binance USD', 'crypto', 'BUSD', 6, FALSE),
  ('SHIB', 'Shiba Inu', 'crypto', 'SHIB', 8, FALSE),
  ('AVAX', 'Avalanche', 'crypto', 'AVAX', 8, FALSE),
  ('DOT', 'Polkadot', 'crypto', 'DOT', 8, FALSE)
ON CONFLICT (code) DO NOTHING;

-- 2️⃣ WALLETS TABLE - Per-user wallet balances
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  balance NUMERIC(36, 8) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(36, 8) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(36, 8) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, currency_code)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets(currency_code);
CREATE INDEX IF NOT EXISTS idx_wallets_active ON wallets(is_active) WHERE is_active = TRUE;

-- 3️⃣ WALLET TRANSACTIONS TABLE - Audit trail of all balance changes
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'purchase', 'reward', 'rake', 'tip', 'adjustment')),
  reference_id UUID,
  amount NUMERIC(36, 8) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(36, 8),
  balance_after NUMERIC(36, 8),
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_currency ON wallet_transactions(currency_code);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON wallet_transactions(reference_id);

-- 4️⃣ UTILITY VIEW - User wallets summary
CREATE OR REPLACE VIEW user_wallets_summary AS
SELECT 
  u.id AS user_id,
  u.email,
  w.id AS wallet_id,
  w.currency_code,
  c.name AS currency_name,
  c.type AS currency_type,
  c.symbol,
  c.decimals,
  w.balance,
  w.total_deposited,
  w.total_withdrawn,
  w.is_active,
  w.created_at,
  w.updated_at
FROM wallets w
JOIN users u ON u.id = w.user_id
JOIN currencies c ON c.code = w.currency_code;

-- 5️⃣ FUNCTION - Record wallet transaction atomically
CREATE OR REPLACE FUNCTION record_wallet_transaction(
  p_user_id UUID,
  p_wallet_id UUID,
  p_transaction_type TEXT,
  p_amount NUMERIC,
  p_currency_code VARCHAR,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT balance INTO v_balance_before FROM wallets WHERE id = p_wallet_id FOR UPDATE;
  
  IF v_balance_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Calculate new balance based on transaction type
  CASE p_transaction_type
    WHEN 'deposit', 'transfer_in', 'reward', 'tip' THEN
      v_balance_after := v_balance_before + p_amount;
    WHEN 'withdrawal', 'transfer_out', 'purchase', 'rake', 'adjustment' THEN
      v_balance_after := v_balance_before - p_amount;
    ELSE
      RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END CASE;

  -- Prevent negative balance (except for adjustments)
  IF v_balance_after < 0 AND p_transaction_type != 'adjustment' THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Attempted withdrawal: %', v_balance_before, p_amount;
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET 
    balance = v_balance_after,
    total_deposited = CASE WHEN p_transaction_type IN ('deposit', 'transfer_in', 'reward', 'tip') THEN total_deposited + p_amount ELSE total_deposited END,
    total_withdrawn = CASE WHEN p_transaction_type IN ('withdrawal', 'transfer_out', 'purchase', 'rake') THEN total_withdrawn + p_amount ELSE total_withdrawn END,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Record transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    currency_code,
    description,
    reference_id
  ) VALUES (
    p_wallet_id,
    p_user_id,
    p_transaction_type,
    p_amount,
    v_balance_before,
    v_balance_after,
    p_currency_code,
    p_description,
    p_reference_id
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- 6️⃣ FUNCTION - Create default wallets for new user (PHP + USD)
CREATE OR REPLACE FUNCTION create_default_wallets(p_user_id UUID) RETURNS VOID AS $$
BEGIN
  -- Create PHP wallet (primary)
  INSERT INTO wallets (user_id, currency_code, balance)
  VALUES (p_user_id, 'PHP', 0)
  ON CONFLICT (user_id, currency_code) DO NOTHING;

  -- Create USD wallet (secondary)
  INSERT INTO wallets (user_id, currency_code, balance)
  VALUES (p_user_id, 'USD', 0)
  ON CONFLICT (user_id, currency_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 7️⃣ Enable Row Level Security on new tables
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Currencies: Public read access
CREATE POLICY "Anyone can view currencies" ON currencies FOR SELECT USING (active = TRUE);

-- Wallets: Users can view/update their own
CREATE POLICY "Users can view own wallets" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallets" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Transactions: Users can view their own
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- END SCHEMA
-- ============================================================================
