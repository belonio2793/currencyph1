# Wise/GCash App - Supabase Setup

## Setup Instructions

1. Go to your Supabase Dashboard: https://dfhanacsmsvvkpunurnp.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the SQL below and paste it into the editor
5. Click **Run** to execute

## SQL Schema

```sql
-- Wise/GCash Application - Complete Schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  full_name VARCHAR(255),
  profile_picture_url TEXT,
  country_code VARCHAR(5) DEFAULT 'PH',
  status VARCHAR(20) DEFAULT 'active',
  kyc_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create wallets table (multi-currency support)
CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency_code VARCHAR(3) NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 0,
  account_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, currency_code)
);

-- Create beneficiaries table (saved recipients)
CREATE TABLE IF NOT EXISTS beneficiaries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(255) NOT NULL,
  bank_account VARCHAR(50),
  bank_name VARCHAR(255),
  country_code VARCHAR(5),
  relationship VARCHAR(50),
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create transfers table (money transfers between users)
CREATE TABLE IF NOT EXISTS transfers (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_currency VARCHAR(3) NOT NULL,
  recipient_currency VARCHAR(3) NOT NULL,
  sender_amount DECIMAL(15, 2) NOT NULL,
  recipient_amount DECIMAL(15, 2) NOT NULL,
  exchange_rate DECIMAL(15, 6),
  fee DECIMAL(15, 2),
  status VARCHAR(20) DEFAULT 'completed',
  description TEXT,
  reference_number VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create bills table (bill payment tracking)
CREATE TABLE IF NOT EXISTS bills (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  biller_category VARCHAR(50) NOT NULL,
  biller_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  reference_number VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create bill payments table
CREATE TABLE IF NOT EXISTS bill_payments (
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  currency_code VARCHAR(3) DEFAULT 'PHP',
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'completed',
  transaction_id VARCHAR(100) UNIQUE,
  paid_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create transactions table (general transaction log)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(100),
  amount DECIMAL(15, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  status VARCHAR(20) DEFAULT 'completed',
  description TEXT,
  reference_number VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create currency rates table
CREATE TABLE IF NOT EXISTS currency_rates (
  id BIGSERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 6) NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_currency ON wallets(currency_code);
CREATE INDEX idx_beneficiaries_user ON beneficiaries(user_id);
CREATE INDEX idx_transfers_sender ON transfers(sender_id);
CREATE INDEX idx_transfers_recipient ON transfers(recipient_id);
CREATE INDEX idx_transfers_created ON transfers(created_at DESC);
CREATE INDEX idx_bills_user ON bills(user_id);
CREATE INDEX idx_bill_payments_user ON bill_payments(user_id);
CREATE INDEX idx_bill_payments_created ON bill_payments(created_at DESC);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_currency_rates ON currency_rates(from_currency, to_currency);

-- Insert supported currencies
INSERT INTO currency_rates (from_currency, to_currency, rate) VALUES
('USD', 'PHP', 56.50),
('USD', 'EUR', 0.92),
('USD', 'GBP', 0.79),
('PHP', 'USD', 0.0177),
('EUR', 'USD', 1.09),
('GBP', 'USD', 1.27),
('PHP', 'EUR', 0.0163),
('EUR', 'PHP', 61.35),
('GBP', 'PHP', 71.85),
('PHP', 'GBP', 0.0139)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

-- Create public view for user profiles (limited data)
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  email,
  full_name,
  profile_picture_url,
  country_code,
  kyc_verified,
  created_at
FROM users;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own wallets" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallets" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own beneficiaries" ON beneficiaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert beneficiaries" ON beneficiaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own beneficiaries" ON beneficiaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transfers" ON transfers
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can view own bills" ON bills
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own bill payments" ON bill_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
```

After running this SQL, your database will have all the tables needed for a Wise/GCash-like application.
