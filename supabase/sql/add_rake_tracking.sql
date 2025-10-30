-- Add rake tracking fields to poker_seats table

ALTER TABLE poker_seats 
  ADD COLUMN IF NOT EXISTS starting_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ending_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rake_deducted numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_ended_at timestamptz;

-- Create sessions table to track complete session history for analytics
CREATE TABLE IF NOT EXISTS poker_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  seat_id uuid REFERENCES poker_seats(id) ON DELETE SET NULL,
  starting_balance numeric NOT NULL,
  ending_balance numeric NOT NULL,
  net_profit numeric NOT NULL,
  rake_percent numeric DEFAULT 10,
  rake_amount numeric DEFAULT 0,
  tip_percent numeric DEFAULT 10,
  tip_amount numeric DEFAULT 0,
  currency_code varchar(8) NOT NULL DEFAULT 'PHP',
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poker_sessions_user ON poker_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_table ON poker_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_sessions_left_at ON poker_sessions(left_at);
