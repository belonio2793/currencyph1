-- Migration: create/alter game tables used by PlayCurrency MVP
BEGIN;

-- Helper: ensure updated_at is maintained
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- game_characters table
CREATE TABLE IF NOT EXISTS public.game_characters (
  id text PRIMARY KEY,
  user_id text,
  name text,
  wealth numeric DEFAULT 0,
  income_rate numeric DEFAULT 0,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  properties jsonb DEFAULT '[]'::jsonb,
  cosmetics jsonb DEFAULT '{}'::jsonb,
  last_daily timestamptz,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure missing columns are added if table existed previously
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='income_rate') THEN
    ALTER TABLE public.game_characters ADD COLUMN income_rate numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='properties') THEN
    ALTER TABLE public.game_characters ADD COLUMN properties jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='last_daily') THEN
    ALTER TABLE public.game_characters ADD COLUMN last_daily timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='cosmetics') THEN
    ALTER TABLE public.game_characters ADD COLUMN cosmetics jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_characters' AND column_name='archived_at') THEN
    ALTER TABLE public.game_characters ADD COLUMN archived_at timestamptz;
  END IF;
END$$;

-- Attach trigger to keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_characters_set_updated_at') THEN
    CREATE TRIGGER game_characters_set_updated_at
    BEFORE UPDATE ON public.game_characters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END$$;

-- game_leaderboard (lightweight cache)
CREATE TABLE IF NOT EXISTS public.game_leaderboard (
  user_id uuid PRIMARY KEY,
  name text,
  wealth numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_leaderboard_set_updated_at') THEN
    CREATE TRIGGER game_leaderboard_set_updated_at
    BEFORE UPDATE ON public.game_leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END$$;

-- game_daily_rewards
CREATE TABLE IF NOT EXISTS public.game_daily_rewards (
  id bigserial PRIMARY KEY,
  user_id uuid,
  amount numeric,
  created_at timestamptz DEFAULT now()
);

-- game_presence (optional simple table for presence snapshots)
CREATE TABLE IF NOT EXISTS public.game_presence (
  user_id uuid PRIMARY KEY,
  name text,
  status text DEFAULT 'online',
  last_seen timestamptz DEFAULT now()
);

-- Enable RLS on game_characters
ALTER TABLE public.game_characters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_characters
DO $$
BEGIN
  -- Users can view their own characters (handle both uuid and text types for user_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'game_characters' AND policyname = 'Users can view their own characters'
  ) THEN
    CREATE POLICY "Users can view their own characters" ON public.game_characters
      FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR user_id::text = auth.uid()::text);
  END IF;

  -- Users can insert their own characters
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'game_characters' AND policyname = 'Users can insert their own characters'
  ) THEN
    CREATE POLICY "Users can insert their own characters" ON public.game_characters
      FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id::text = auth.uid()::text);
  END IF;

  -- Users can update their own characters
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'game_characters' AND policyname = 'Users can update their own characters'
  ) THEN
    CREATE POLICY "Users can update their own characters" ON public.game_characters
      FOR UPDATE USING (user_id = auth.uid() OR user_id::text = auth.uid()::text) WITH CHECK (user_id = auth.uid() OR user_id::text = auth.uid()::text);
  END IF;

  -- Users can delete their own characters
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'game_characters' AND policyname = 'Users can delete their own characters'
  ) THEN
    CREATE POLICY "Users can delete their own characters" ON public.game_characters
      FOR DELETE USING (user_id = auth.uid() OR user_id::text = auth.uid()::text);
  END IF;

  -- Public can view all characters (for leaderboard, etc)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'game_characters' AND policyname = 'Public can view all characters'
  ) THEN
    CREATE POLICY "Public can view all characters" ON public.game_characters
      FOR SELECT USING (true);
  END IF;
END$$;

COMMIT;
