-- 1. Ensure pgcrypto extension (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create table only if it doesn't exist (with both columns from the start if possible)
CREATE TABLE IF NOT EXISTS public.planning_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_user_id UUID, -- will be added/altered safely below
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add planning_user_id if missing
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

-- 4. Add foreign key constraint to planning_users only if it doesn't exist yet
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

-- Make planning_user_id NOT NULL only after backfilling or if you're sure data exists
-- Uncomment the next block when you're ready to enforce NOT NULL
--
-- ALTER TABLE public.planning_markers ALTER COLUMN planning_user_id SET NOT NULL;

-- 5. Add user_id column if missing (defensive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planning_markers'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD COLUMN user_id UUID NOT NULL
      REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_planning_markers_user_id 
  ON public.planning_markers(user_id);

CREATE INDEX IF NOT EXISTS idx_planning_markers_planning_user_id 
  ON public.planning_markers(planning_user_id);

-- 7. Row Level Security
ALTER TABLE public.planning_markers ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies (idempotent drop + create)
DROP POLICY IF EXISTS "Allow read all markers" ON public.planning_markers;
CREATE POLICY "Allow read all markers" ON public.planning_markers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to insert markers" ON public.planning_markers;
CREATE POLICY "Allow users to insert markers" ON public.planning_markers
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to update own markers" ON public.planning_markers;
CREATE POLICY "Allow users to update own markers" ON public.planning_markers
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow users to delete own markers" ON public.planning_markers;
CREATE POLICY "Allow users to delete own markers" ON public.planning_markers
  FOR DELETE USING (user_id = auth.uid());

-- 9. updated_at trigger
CREATE OR REPLACE FUNCTION update_planning_markers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planning_markers_timestamp_trigger ON public.planning_markers;

CREATE TRIGGER planning_markers_timestamp_trigger
  BEFORE UPDATE ON public.planning_markers
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_markers_timestamp();
