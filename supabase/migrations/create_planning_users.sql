-- Create planning_users table for planning chat feature
-- This table tracks users participating in the planning group
-- IDEMPOTENT: Safe to run multiple times

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

-- Create indexes for better query performance (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_planning_users_user_id ON public.planning_users(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_users_email ON public.planning_users(email);
CREATE INDEX IF NOT EXISTS idx_planning_users_status ON public.planning_users(status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.planning_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent approach)
DROP POLICY IF EXISTS "Allow read all planning users" ON public.planning_users;
DROP POLICY IF EXISTS "Allow users to create own profile" ON public.planning_users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.planning_users;
DROP POLICY IF EXISTS "Allow users to delete own profile" ON public.planning_users;

-- Recreate policies (now safe because we dropped them first)
CREATE POLICY "Allow read all planning users" ON public.planning_users
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow users to create own profile" ON public.planning_users
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to update own profile" ON public.planning_users
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to delete own profile" ON public.planning_users
  FOR DELETE USING (user_id = auth.uid());

-- Create or replace function to update updated_at timestamp (safe to run multiple times)
CREATE OR REPLACE FUNCTION update_planning_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (idempotent approach)
DROP TRIGGER IF EXISTS planning_users_timestamp_trigger ON public.planning_users;

CREATE TRIGGER planning_users_timestamp_trigger
  BEFORE UPDATE ON public.planning_users
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_users_timestamp();

-- Create or replace function to auto-create planning_users on auth signup (safe to run multiple times)
CREATE OR REPLACE FUNCTION public.create_planning_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.planning_users (
    user_id,
    email,
    name,
    status,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'active',
    'member',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger for auto-creation (idempotent approach)
DROP TRIGGER IF EXISTS on_auth_user_created_planning ON auth.users;

CREATE TRIGGER on_auth_user_created_planning
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_planning_user_on_signup();
