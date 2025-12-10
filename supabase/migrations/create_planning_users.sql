-- Create planning_users table for planning chat feature
-- This table tracks users participating in the planning group

CREATE TABLE IF NOT EXISTS public.planning_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  role VARCHAR(50) DEFAULT 'member',
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_users_user_id ON public.planning_users(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_users_email ON public.planning_users(email);
CREATE INDEX IF NOT EXISTS idx_planning_users_status ON public.planning_users(status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.planning_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all planning users
CREATE POLICY "Allow read all planning users" ON public.planning_users
  FOR SELECT USING (TRUE);

-- Policy: Allow users to create their own planning user profile
CREATE POLICY "Allow users to create own profile" ON public.planning_users
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to update their own planning user profile
CREATE POLICY "Allow users to update own profile" ON public.planning_users
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Allow users to delete their own planning user profile
CREATE POLICY "Allow users to delete own profile" ON public.planning_users
  FOR DELETE USING (user_id = auth.uid());

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_planning_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planning_users_timestamp_trigger ON public.planning_users;

CREATE TRIGGER planning_users_timestamp_trigger
  BEFORE UPDATE ON public.planning_users
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_users_timestamp();
