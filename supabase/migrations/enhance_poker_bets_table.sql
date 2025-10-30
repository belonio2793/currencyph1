-- Enhance poker_bets table
ALTER TABLE poker_bets
ADD COLUMN IF NOT EXISTS round_state text DEFAULT 'preflop',
ADD COLUMN IF NOT EXISTS pot_before numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pot_after numeric DEFAULT 0;

-- Create index on action for query optimization
CREATE INDEX IF NOT EXISTS idx_poker_bets_action ON poker_bets(action);
CREATE INDEX IF NOT EXISTS idx_poker_bets_round_state ON poker_bets(round_state);

-- Add comments
COMMENT ON COLUMN poker_bets.round_state IS 'Poker round when bet was made (preflop, flop, turn, river)';
COMMENT ON COLUMN poker_bets.pot_before IS 'Pot size before this bet';
COMMENT ON COLUMN poker_bets.pot_after IS 'Pot size after this bet';
