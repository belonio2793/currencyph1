-- Poker schema for virtual-play using existing wallets table (assumes wallets(user_id, currency_code, balance))

CREATE TABLE IF NOT EXISTS poker_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stake_min numeric NOT NULL,
  stake_max numeric NOT NULL,
  currency_code varchar(8) NOT NULL DEFAULT 'PHP',
  max_seats int NOT NULL DEFAULT 9,
  status text NOT NULL DEFAULT 'open', -- open, in_progress, closed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poker_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat_number int NOT NULL,
  joined_at timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  UNIQUE (table_id, seat_number),
  UNIQUE (table_id, user_id)
);

CREATE TABLE IF NOT EXISTS poker_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES poker_tables(id) ON DELETE CASCADE,
  dealer_seat int,
  round_state text NOT NULL DEFAULT 'waiting', -- waiting, preflop, flop, turn, river, showdown, finished
  community_cards text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poker_hole_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid REFERENCES poker_hands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cards text[2] NOT NULL,
  seat_number int,
  revealed boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS poker_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid REFERENCES poker_hands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat_number int,
  action text NOT NULL, -- post_blind, call, raise, fold, check
  amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poker_pots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid REFERENCES poker_hands(id) ON DELETE CASCADE,
  total_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poker_escrow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid REFERENCES poker_hands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency_code varchar(8) NOT NULL DEFAULT 'PHP',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poker_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id uuid,
  table_id uuid,
  user_id uuid,
  event text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_poker_tables_status ON poker_tables(status);
CREATE INDEX IF NOT EXISTS idx_poker_seats_table ON poker_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_hands_table ON poker_hands(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_bets_hand ON poker_bets(hand_id);
CREATE INDEX IF NOT EXISTS idx_poker_escrow_hand ON poker_escrow(hand_id);

-- Notes:
-- 1) Wallet updates should be performed atomically when creating escrow records: deduct from wallets where sufficient balance and insert escrow in same transaction.
-- 2) All dealing and hand resolution MUST be performed server-side using a cryptographically secure RNG.
-- 3) This schema is intentionally minimal and can be extended with side pots, hand results, and player statistics.
