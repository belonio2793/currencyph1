-- Add cosmetics column to game_characters if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='cosmetics') THEN
    ALTER TABLE public.game_characters ADD COLUMN cosmetics JSONB DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Create game_matches table for tracking duel results
CREATE TABLE IF NOT EXISTS public.game_matches (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id text,
  player1_id text NOT NULL,
  player1_name text,
  player2_id text NOT NULL,
  player2_name text,
  winner_id text,
  player1_score integer DEFAULT 0,
  player2_score integer DEFAULT 0,
  duration_seconds integer,
  match_type text DEFAULT 'duel', -- duel, tournament, casual
  status text DEFAULT 'completed', -- ongoing, completed, cancelled
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  FOREIGN KEY (player1_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES public.game_characters(id) ON DELETE SET NULL
);

-- Create indexes for game_matches
CREATE INDEX IF NOT EXISTS idx_game_matches_player1_id ON public.game_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_player2_id ON public.game_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_winner_id ON public.game_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_matches_created_at ON public.game_matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_matches_session_id ON public.game_matches(session_id);

-- Create trigger for game_matches updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_matches_set_updated_at') THEN
    CREATE TRIGGER game_matches_set_updated_at
    BEFORE UPDATE ON public.game_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END$$;

-- Create game_match_log table for detailed move tracking
CREATE TABLE IF NOT EXISTS public.game_match_log (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id text NOT NULL,
  player_id text NOT NULL,
  action text,
  damage integer,
  health_before integer,
  health_after integer,
  turn_number integer,
  created_at timestamptz DEFAULT now(),
  
  FOREIGN KEY (match_id) REFERENCES public.game_matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES public.game_characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_match_log_match_id ON public.game_match_log(match_id);
CREATE INDEX IF NOT EXISTS idx_game_match_log_player_id ON public.game_match_log(player_id);
