-- Create poker_tables
CREATE TABLE IF NOT EXISTS poker_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stake_min numeric NOT NULL DEFAULT 1,
  stake_max numeric NOT NULL DEFAULT 100,
  currency_code text NOT NULL DEFAULT 'PHP',
  max_seats int DEFAULT 9,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_tables_created_at ON poker_tables(created_at);

-- Create poker_seats
CREATE TABLE IF NOT EXISTS poker_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat_number int NOT NULL,
  starting_balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(table_id, seat_number),
  UNIQUE(table_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poker_seats_table_id ON poker_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_seats_user_id ON poker_seats(user_id);

-- Create poker_hands
CREATE TABLE IF NOT EXISTS poker_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
  round_state text NOT NULL DEFAULT 'preflop',
  community_cards text[] DEFAULT '{}',
  dealer_seat int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_hands_table_id ON poker_hands(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_hands_created_at ON poker_hands(created_at);

-- Create poker_hole_cards
CREATE TABLE IF NOT EXISTS poker_hole_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid NOT NULL REFERENCES poker_hands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat_number int NOT NULL,
  cards text[] NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_hole_cards_hand_id ON poker_hole_cards(hand_id);
CREATE INDEX IF NOT EXISTS idx_poker_hole_cards_user_id ON poker_hole_cards(user_id);

-- Create poker_bets
CREATE TABLE IF NOT EXISTS poker_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid NOT NULL REFERENCES poker_hands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  amount numeric DEFAULT 0,
  round_state text DEFAULT 'preflop',
  pot_before numeric DEFAULT 0,
  pot_after numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_bets_hand_id ON poker_bets(hand_id);
CREATE INDEX IF NOT EXISTS idx_poker_bets_user_id ON poker_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_bets_action ON poker_bets(action);
CREATE INDEX IF NOT EXISTS idx_poker_bets_round_state ON poker_bets(round_state);

-- Create poker_escrow
CREATE TABLE IF NOT EXISTS poker_escrow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid NOT NULL REFERENCES poker_hands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency_code text NOT NULL DEFAULT 'PHP',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_escrow_hand_id ON poker_escrow(hand_id);
CREATE INDEX IF NOT EXISTS idx_poker_escrow_user_id ON poker_escrow(user_id);

-- Create poker_audit
CREATE TABLE IF NOT EXISTS poker_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid REFERENCES poker_hands(id) ON DELETE CASCADE,
  table_id uuid REFERENCES poker_tables(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_audit_hand_id ON poker_audit(hand_id);
CREATE INDEX IF NOT EXISTS idx_poker_audit_table_id ON poker_audit(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_audit_event ON poker_audit(event);

-- Create rake_transactions
CREATE TABLE IF NOT EXISTS rake_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL,
  user_id uuid NOT NULL,
  table_id uuid NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  tip_percent numeric DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'PHP',
  balance_after numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rake_transactions_house_id ON rake_transactions(house_id);
CREATE INDEX IF NOT EXISTS idx_rake_transactions_user_id ON rake_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rake_transactions_table_id ON rake_transactions(table_id);

-- Create poker_sessions
CREATE TABLE IF NOT EXISTS poker_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat_id uuid REFERENCES poker_seats(id) ON DELETE SET NULL,
  starting_balance numeric NOT NULL,
  ending_balance numeric NOT NULL,
  net_profit numeric,
  rake_percent numeric DEFAULT 10,
  rake_amount numeric DEFAULT 0,
  tip_percent numeric DEFAULT 0,
  tip_amount numeric DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'PHP',
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_sessions_table_id ON poker_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_user_id ON poker_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_left_at ON poker_sessions(left_at);

-- Enable RLS for all poker tables
ALTER TABLE poker_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_hole_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rake_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- poker_tables: everyone can read
CREATE POLICY "Anyone can read poker_tables" ON poker_tables FOR SELECT USING (true);

-- poker_seats: everyone can read
CREATE POLICY "Anyone can read poker_seats" ON poker_seats FOR SELECT USING (true);
CREATE POLICY "Users can insert seat for themselves" ON poker_seats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- poker_hands: everyone can read
CREATE POLICY "Anyone can read poker_hands" ON poker_hands FOR SELECT USING (true);

-- poker_hole_cards: users can read their own
CREATE POLICY "Users can read their own hole cards" ON poker_hole_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can read all hole cards" ON poker_hole_cards FOR SELECT USING (auth.role() = 'service_role');

-- poker_bets: everyone can read
CREATE POLICY "Anyone can read poker_bets" ON poker_bets FOR SELECT USING (true);

-- poker_escrow: users can read their own
CREATE POLICY "Users can read their own escrow" ON poker_escrow FOR SELECT USING (auth.uid() = user_id);

-- poker_audit: everyone can read
CREATE POLICY "Anyone can read poker_audit" ON poker_audit FOR SELECT USING (true);

-- rake_transactions: everyone can read
CREATE POLICY "Anyone can read rake_transactions" ON rake_transactions FOR SELECT USING (true);

-- poker_sessions: everyone can read
CREATE POLICY "Anyone can read poker_sessions" ON poker_sessions FOR SELECT USING (true);

-- Add comments
COMMENT ON TABLE poker_tables IS 'Poker game tables with stake information';
COMMENT ON TABLE poker_seats IS 'Player seating assignments for poker tables';
COMMENT ON TABLE poker_hands IS 'Individual poker hand records';
COMMENT ON TABLE poker_hole_cards IS 'Private hole cards dealt to players';
COMMENT ON TABLE poker_bets IS 'Betting actions and amounts for each hand';
COMMENT ON TABLE poker_escrow IS 'Escrow funds held during active hands';
COMMENT ON TABLE poker_audit IS 'Audit log of all poker game events';
COMMENT ON TABLE rake_transactions IS 'House rake and tip transactions';
COMMENT ON TABLE poker_sessions IS 'Player session records for analytics';
