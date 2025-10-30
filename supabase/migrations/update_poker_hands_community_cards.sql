-- Ensure community_cards column exists in poker_hands
ALTER TABLE poker_hands
ADD COLUMN IF NOT EXISTS community_cards text[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN poker_hands.community_cards IS 'Array of community cards (flop, turn, river)';
