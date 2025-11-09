-- Achievement definitions
CREATE TABLE IF NOT EXISTS public.game_achievements (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  reward_credits NUMERIC DEFAULT 0,
  reward_xp NUMERIC DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Player achievement progress (unlock tracking)
CREATE TABLE IF NOT EXISTS public.game_player_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ,
  progress INT DEFAULT 0,
  claimed_reward BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_character FOREIGN KEY (character_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_achievement FOREIGN KEY (achievement_key) REFERENCES public.game_achievements(key) ON DELETE CASCADE,
  UNIQUE(character_id, achievement_key)
);

-- Seasonal leaderboard (tracks seasons separately)
CREATE TABLE IF NOT EXISTS public.game_seasonal_leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  season_number INT NOT NULL,
  rank INT,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  wealth NUMERIC DEFAULT 0,
  final_rank INT,
  reward_claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_character FOREIGN KEY (character_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, season_number)
);

-- Player statistics for profiles
CREATE TABLE IF NOT EXISTS public.game_player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL UNIQUE,
  total_matches INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_losses INT DEFAULT 0,
  win_streak INT DEFAULT 0,
  best_win_streak INT DEFAULT 0,
  total_damage_dealt BIGINT DEFAULT 0,
  total_damage_taken BIGINT DEFAULT 0,
  total_healing BIGINT DEFAULT 0,
  kills INT DEFAULT 0,
  deaths INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_character FOREIGN KEY (character_id) REFERENCES public.game_characters(id) ON DELETE CASCADE
);

-- Insert default achievements
INSERT INTO public.game_achievements (key, name, description, icon, reward_credits, reward_xp, rarity, category) VALUES
('first_duel', 'Rookie Fighter', 'Win your first duel', '🥋', 50, 100, 'common', 'combat'),
('5_wins', '5 Victory Streak', 'Achieve 5 consecutive wins', '⚔️', 150, 250, 'uncommon', 'combat'),
('10_wins', '10 Victory Streak', 'Achieve 10 consecutive wins', '🔥', 300, 500, 'rare', 'combat'),
('win_with_counter', 'Defensive Master', 'Win a duel using only Counter ability', '🛡️', 100, 150, 'rare', 'strategy'),
('critical_hit_spree', 'Critical Strike', 'Land 3 critical hits in one duel', '💥', 75, 100, 'uncommon', 'combat'),
('heal_specialist', 'Healer', 'Win a duel using Heal ability 5+ times', '💚', 100, 200, 'uncommon', 'strategy'),
('level_up', 'Rising Star', 'Reach level 5', '⭐', 200, 300, 'common', 'progress'),
('wealth_1000', 'Entrepreneur', 'Accumulate 1,000 credits', '💰', 100, 150, 'uncommon', 'economy'),
('wealth_10000', 'Mogul', 'Accumulate 10,000 credits', '🏆', 500, 1000, 'rare', 'economy'),
('match_historian', 'Veteran', 'Participate in 50 matches', '📜', 200, 300, 'rare', 'combat'),
('perfect_victory', 'Flawless Victory', 'Win a duel without taking damage', '✨', 250, 500, 'epic', 'combat'),
('property_owner', 'Landlord', 'Own 5 properties', '����', 150, 200, 'uncommon', 'economy')
ON CONFLICT(key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_player_achievements_character ON public.game_player_achievements(character_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked ON public.game_player_achievements(unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_seasonal_leaderboard_season ON public.game_seasonal_leaderboard(season_number, rank);
CREATE INDEX IF NOT EXISTS idx_player_stats_character ON public.game_player_stats(character_id);

-- View: Player achievement summary
CREATE OR REPLACE VIEW public.player_achievement_summary AS
SELECT 
  c.id,
  c.name,
  COUNT(CASE WHEN pa.unlocked_at IS NOT NULL THEN 1 END) as total_achievements,
  COALESCE(SUM(ga.reward_credits), 0) as total_reward_credits,
  COALESCE(SUM(ga.reward_xp), 0) as total_reward_xp,
  MAX(pa.unlocked_at) as latest_achievement
FROM public.game_characters c
LEFT JOIN public.game_player_achievements pa ON c.id = pa.character_id
LEFT JOIN public.game_achievements ga ON pa.achievement_key = ga.key AND pa.unlocked_at IS NOT NULL
GROUP BY c.id, c.name;

-- View: Current season leaderboard
CREATE OR REPLACE VIEW public.current_season_leaderboard AS
SELECT 
  gsl.character_id,
  gc.name,
  gc.wealth,
  gsl.season_number,
  gsl.rank,
  gsl.wins,
  gsl.losses,
  CASE WHEN gsl.losses > 0 THEN (gsl.wins::NUMERIC / (gsl.wins + gsl.losses)) ELSE 0 END as win_rate,
  gsl.final_rank
FROM public.game_seasonal_leaderboard gsl
JOIN public.game_characters gc ON gsl.character_id = gc.id
WHERE gsl.season_number = (SELECT MAX(season_number) FROM public.game_seasonal_leaderboard)
ORDER BY gsl.rank;

-- Trigger to update player stats when match completes
CREATE OR REPLACE FUNCTION public.update_player_stats_on_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player1 stats
  INSERT INTO public.game_player_stats (character_id, total_matches, total_wins)
  VALUES (NEW.player1_id, 1, CASE WHEN NEW.winner_id = NEW.player1_id THEN 1 ELSE 0 END)
  ON CONFLICT(character_id) DO UPDATE SET
    total_matches = game_player_stats.total_matches + 1,
    total_wins = game_player_stats.total_wins + CASE WHEN NEW.winner_id = NEW.player1_id THEN 1 ELSE 0 END,
    total_losses = game_player_stats.total_losses + CASE WHEN NEW.winner_id != NEW.player1_id THEN 1 ELSE 0 END,
    updated_at = now();
  
  -- Update player2 stats
  INSERT INTO public.game_player_stats (character_id, total_matches, total_wins)
  VALUES (NEW.player2_id, 1, CASE WHEN NEW.winner_id = NEW.player2_id THEN 1 ELSE 0 END)
  ON CONFLICT(character_id) DO UPDATE SET
    total_matches = game_player_stats.total_matches + 1,
    total_wins = game_player_stats.total_wins + CASE WHEN NEW.winner_id = NEW.player2_id THEN 1 ELSE 0 END,
    total_losses = game_player_stats.total_losses + CASE WHEN NEW.winner_id != NEW.player2_id THEN 1 ELSE 0 END,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_player_stats ON public.game_matches;
CREATE TRIGGER trigger_update_player_stats
AFTER INSERT ON public.game_matches
FOR EACH ROW
EXECUTE FUNCTION public.update_player_stats_on_match();
