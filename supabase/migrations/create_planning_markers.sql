-- Create planning_markers table for shared map markers in planning module
CREATE TABLE IF NOT EXISTS public.planning_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_user_id UUID NOT NULL REFERENCES public.planning_users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_markers_user_id ON public.planning_markers(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_markers_planning_user_id ON public.planning_markers(planning_user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.planning_markers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all markers
CREATE POLICY "Allow read all markers" ON public.planning_markers
  FOR SELECT USING (TRUE);

-- Policy: Allow users to insert their own markers
CREATE POLICY "Allow users to insert markers" ON public.planning_markers
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to update their own markers
CREATE POLICY "Allow users to update own markers" ON public.planning_markers
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Allow users to delete their own markers
CREATE POLICY "Allow users to delete own markers" ON public.planning_markers
  FOR DELETE USING (user_id = auth.uid());

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_planning_markers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planning_markers_timestamp_trigger
  BEFORE UPDATE ON public.planning_markers
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_markers_timestamp();
