-- Create poker_chip_packages table (predefined packages)
CREATE TABLE IF NOT EXISTS poker_chip_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chip_amount bigint NOT NULL,
  usd_price numeric(10, 2) NOT NULL,
  bonus_chips bigint DEFAULT 0,
  is_first_purchase_special boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_chip_packages_display_order ON poker_chip_packages(display_order);

-- Create player_poker_chips table (user chip inventory)
CREATE TABLE IF NOT EXISTS player_poker_chips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_chips bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_poker_chips_user_id ON player_poker_chips(user_id);

-- Create chip_purchases table (transaction history)
CREATE TABLE IF NOT EXISTS chip_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES poker_chip_packages(id) ON DELETE SET NULL,
  chips_purchased bigint NOT NULL,
  bonus_chips_awarded bigint DEFAULT 0,
  total_chips_received bigint NOT NULL,
  usd_price_paid numeric(10, 2) NOT NULL,
  payment_status text DEFAULT 'completed',
  payment_method text,
  transaction_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chip_purchases_user_id ON chip_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_chip_purchases_created_at ON chip_purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_chip_purchases_payment_status ON chip_purchases(payment_status);

-- Modify poker_seats to add chip_balance (chips bought into this table)
ALTER TABLE poker_seats ADD COLUMN IF NOT EXISTS chip_balance bigint DEFAULT 0;
ALTER TABLE poker_seats ADD COLUMN IF NOT EXISTS chip_starting_balance bigint DEFAULT 0;

-- Modify poker_bets to use chip amounts instead of currency amounts
ALTER TABLE poker_bets ADD COLUMN IF NOT EXISTS chip_amount bigint DEFAULT 0;

-- Modify poker_escrow to track chips
ALTER TABLE poker_escrow ADD COLUMN IF NOT EXISTS chip_amount bigint DEFAULT 0;

-- Enable RLS for new tables
ALTER TABLE poker_chip_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_poker_chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE chip_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for poker_chip_packages
CREATE POLICY "Anyone can read poker_chip_packages" ON poker_chip_packages FOR SELECT USING (true);

-- RLS Policies for player_poker_chips
CREATE POLICY "Users can read their own poker chips" ON player_poker_chips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage poker chips" ON player_poker_chips FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for chip_purchases
CREATE POLICY "Users can read their own chip purchases" ON chip_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage chip purchases" ON chip_purchases FOR ALL USING (auth.role() = 'service_role');

-- Insert predefined chip packages (based on PokerNews pricing)
INSERT INTO poker_chip_packages (name, chip_amount, usd_price, is_first_purchase_special, display_order) VALUES
  ('280K Chips', 280000, 4.99, false, 1),
  ('1M Chips Special', 1000000, 4.99, true, 2),
  ('560K Chips', 560000, 9.99, false, 3),
  ('1.3M Chips Special', 1300000, 19.99, true, 4),
  ('3M Chips', 3000000, 34.99, false, 5),
  ('5M Chips', 5000000, 49.99, false, 6),
  ('9M Chips', 9000000, 74.99, false, 7),
  ('14M Chips', 14000000, 99.99, false, 8)
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE poker_chip_packages IS 'Predefined chip package offerings';
COMMENT ON TABLE player_poker_chips IS 'Player chip inventory for poker games';
COMMENT ON TABLE chip_purchases IS 'History of chip purchases by players';
COMMENT ON COLUMN poker_seats.chip_balance IS 'Current chips in play at this table';
COMMENT ON COLUMN poker_seats.chip_starting_balance IS 'Chips bought in at start of session';
COMMENT ON COLUMN poker_bets.chip_amount IS 'Chip amount for this bet';
COMMENT ON COLUMN poker_escrow.chip_amount IS 'Chips held in escrow for this hand';
