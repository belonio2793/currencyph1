-- Create planning_locations table for shared map markers
CREATE TABLE IF NOT EXISTS public.planning_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_planning_locations_user_id ON public.planning_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_locations_planning_user_id ON public.planning_locations(planning_user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.planning_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all locations
CREATE POLICY "Allow read all locations" ON public.planning_locations
  FOR SELECT USING (TRUE);

-- Policy: Allow users to insert their own locations
CREATE POLICY "Allow users to insert locations" ON public.planning_locations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to update their own locations
CREATE POLICY "Allow users to update own locations" ON public.planning_locations
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Allow users to delete their own locations
CREATE POLICY "Allow users to delete own locations" ON public.planning_locations
  FOR DELETE USING (user_id = auth.uid());

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_planning_locations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planning_locations_timestamp_trigger
  BEFORE UPDATE ON public.planning_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_locations_timestamp();
