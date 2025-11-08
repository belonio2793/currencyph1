-- Game matches table for duel history and leaderboard tracking
CREATE TABLE IF NOT EXISTS public.game_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE,
  player1_id UUID NOT NULL,
  player2_id UUID NOT NULL,
  player1_name TEXT,
  player2_name TEXT,
  winner_id UUID,
  player1_final_hp INT DEFAULT 0,
  player2_final_hp INT DEFAULT 0,
  duration_seconds INT,
  total_rounds INT DEFAULT 0,
  reward_winner NUMERIC DEFAULT 100,
  reward_loser NUMERIC DEFAULT 25,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_player1 FOREIGN KEY (player1_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_player2 FOREIGN KEY (player2_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_winner FOREIGN KEY (winner_id) REFERENCES public.game_characters(id) ON DELETE SET NULL
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_game_matches_player1 ON public.game_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_player2 ON public.game_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_winner ON public.game_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_created_at ON public.game_matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_matches_session_id ON public.game_matches(session_id);

-- Trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_matches_set_updated_at') THEN
    CREATE TRIGGER game_matches_set_updated_at
    BEFORE UPDATE ON public.game_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END$$;

-- View for player match statistics
CREATE OR REPLACE VIEW public.player_match_stats AS
SELECT 
  p.id,
  p.name,
  p.user_id,
  COALESCE(COUNT(CASE WHEN m.winner_id = p.id THEN 1 END), 0) as total_wins,
  COALESCE(COUNT(m.id), 0) as total_matches,
  COALESCE(COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::NUMERIC / NULLIF(COUNT(m.id), 0) * 100, 0) as win_rate,
  COALESCE(AVG(CASE WHEN m.player1_id = p.id THEN m.player1_final_hp WHEN m.player2_id = p.id THEN m.player2_final_hp END), 0) as avg_final_hp,
  MAX(m.created_at) as last_match_at
FROM public.game_characters p
LEFT JOIN public.game_matches m ON (p.id = m.player1_id OR p.id = m.player2_id)
GROUP BY p.id, p.name, p.user_id;

-- Duel match actions log (for match validation and replay)
CREATE TABLE IF NOT EXISTS public.game_match_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL,
  player_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  damage_dealt INT DEFAULT 0,
  hp_remaining INT,
  round_number INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_match FOREIGN KEY (match_id) REFERENCES public.game_matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES public.game_characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_actions_match_id ON public.game_match_actions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_actions_player_id ON public.game_match_actions(player_id);
