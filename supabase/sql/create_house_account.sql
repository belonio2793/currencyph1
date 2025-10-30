-- Rake transactions table to track all rake collected
CREATE TABLE IF NOT EXISTS rake_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL,
  user_id uuid NOT NULL,
  table_id uuid REFERENCES poker_tables(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  tip_percent numeric DEFAULT 10,
  currency_code varchar(8) NOT NULL DEFAULT 'PHP',
  balance_after numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_rake_transactions_house ON rake_transactions(house_id);
CREATE INDEX IF NOT EXISTS idx_rake_transactions_user ON rake_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rake_transactions_table ON rake_transactions(table_id);
CREATE INDEX IF NOT EXISTS idx_rake_transactions_created ON rake_transactions(created_at);

-- Insert or update the House system account in users table
-- The House account is a special system user that collects rake
INSERT INTO users (id, email, region_code, dog_balance, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system@house.local',
  'PH',
  0,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = now();

-- Ensure House has wallets in both currencies
INSERT INTO wallets (user_id, currency_code, balance, created_at)
VALUES 
  ('00000000-0000-0000-0000-000000000000'::uuid, 'PHP', 0, now()),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'USD', 0, now())
ON CONFLICT (user_id, currency_code) DO NOTHING;
