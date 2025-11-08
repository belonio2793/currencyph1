-- Remove UNIQUE constraint on user_id to allow multiple characters per user
ALTER TABLE IF EXISTS public.game_characters DROP CONSTRAINT IF EXISTS game_characters_user_id_key;

-- Add missing columns that PlayCurrency uses (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='wealth') THEN
    ALTER TABLE public.game_characters ADD COLUMN wealth BIGINT DEFAULT 1000;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='income_rate') THEN
    ALTER TABLE public.game_characters ADD COLUMN income_rate NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='xp') THEN
    ALTER TABLE public.game_characters ADD COLUMN xp BIGINT DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='properties') THEN
    ALTER TABLE public.game_characters ADD COLUMN properties JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='last_daily') THEN
    ALTER TABLE public.game_characters ADD COLUMN last_daily TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='archived_at') THEN
    ALTER TABLE public.game_characters ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
END$$;

-- Create index on user_id for better query performance (no uniqueness constraint)
DROP INDEX IF EXISTS idx_game_characters_user_id;
CREATE INDEX idx_game_characters_user_id ON public.game_characters(user_id);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_game_characters_created_at ON public.game_characters(created_at DESC);
