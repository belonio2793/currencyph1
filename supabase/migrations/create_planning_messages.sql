-- Create planning_messages table for planning chat feature
-- This table stores messages in the planning group chat
-- IDEMPOTENT: Safe to run multiple times

CREATE TABLE IF NOT EXISTS public.planning_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_user_id UUID NOT NULL REFERENCES public.planning_users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_messages_user_id ON public.planning_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_messages_planning_user_id ON public.planning_messages(planning_user_id);
CREATE INDEX IF NOT EXISTS idx_planning_messages_created_at ON public.planning_messages(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE public.planning_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent approach)
DROP POLICY IF EXISTS "Allow read all messages" ON public.planning_messages;
DROP POLICY IF EXISTS "Allow authenticated to insert messages" ON public.planning_messages;
DROP POLICY IF EXISTS "Allow users to update own messages" ON public.planning_messages;
DROP POLICY IF EXISTS "Allow users to delete own messages" ON public.planning_messages;

-- Recreate policies (now safe because we dropped them first)
CREATE POLICY "Allow read all messages" ON public.planning_messages
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow authenticated to insert messages" ON public.planning_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Allow users to update own messages" ON public.planning_messages
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to delete own messages" ON public.planning_messages
  FOR DELETE USING (user_id = auth.uid());

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_planning_messages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (idempotent approach)
DROP TRIGGER IF EXISTS planning_messages_timestamp_trigger ON public.planning_messages;

CREATE TRIGGER planning_messages_timestamp_trigger
  BEFORE UPDATE ON public.planning_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_messages_timestamp();
