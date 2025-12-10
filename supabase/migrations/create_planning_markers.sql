-- Create planning_markers table for planning custom location markers
-- This table stores user-created custom location markers on the map
-- IDEMPOTENT: Safe to run multiple times

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.planning_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_user_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add planning_user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planning_markers'
      AND column_name = 'planning_user_id'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD COLUMN planning_user_id UUID;
  END IF;
END $$;

-- Add foreign key constraint to planning_users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planning_markers_planning_user_id_fkey'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD CONSTRAINT planning_markers_planning_user_id_fkey
      FOREIGN KEY (planning_user_id) REFERENCES public.planning_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_planning_markers_user_id 
  ON public.planning_markers(user_id);

CREATE INDEX IF NOT EXISTS idx_planning_markers_planning_user_id 
  ON public.planning_markers(planning_user_id);

CREATE INDEX IF NOT EXISTS idx_planning_markers_coordinates
  ON public.planning_markers(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_planning_markers_created_at
  ON public.planning_markers(created_at DESC);

-- Row Level Security
ALTER TABLE public.planning_markers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent approach)
DROP POLICY IF EXISTS "Allow read all markers" ON public.planning_markers;
DROP POLICY IF EXISTS "Allow users to insert markers" ON public.planning_markers;
DROP POLICY IF EXISTS "Allow users to update own markers" ON public.planning_markers;
DROP POLICY IF EXISTS "Allow users to delete own markers" ON public.planning_markers;

-- Recreate policies (now safe because we dropped them first)
CREATE POLICY "Allow read all markers" ON public.planning_markers
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow users to insert markers" ON public.planning_markers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to update own markers" ON public.planning_markers
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to delete own markers" ON public.planning_markers
  FOR DELETE USING (user_id = auth.uid());

-- Create or replace timestamp update function
CREATE OR REPLACE FUNCTION update_planning_markers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (idempotent approach)
DROP TRIGGER IF EXISTS planning_markers_timestamp_trigger ON public.planning_markers;

CREATE TRIGGER planning_markers_timestamp_trigger
  BEFORE UPDATE ON public.planning_markers
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_markers_timestamp();
