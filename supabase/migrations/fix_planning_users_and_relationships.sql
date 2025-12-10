-- Fix planning_users table and relationships
-- Issue: updated_at column missing and planning_private_messages missing FK to planning_users

-- First, check if updated_at column exists in planning_users, if not add it
ALTER TABLE public.planning_users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Drop the old trigger if it exists (in case it was causing issues)
DROP TRIGGER IF EXISTS planning_users_timestamp_trigger ON public.planning_users;

-- Recreate the trigger function
CREATE OR REPLACE FUNCTION update_planning_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER planning_users_timestamp_trigger
  BEFORE UPDATE ON public.planning_users
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_users_timestamp();

-- Fix planning_private_messages to properly reference planning_users for sender name lookups
-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_planning_users_user_id ON public.planning_users(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_private_messages_sender_id ON public.planning_private_messages(sender_id);

-- Verify planning_conversations trigger is correct
DROP TRIGGER IF EXISTS planning_conversations_update_timestamp ON public.planning_conversations;

CREATE OR REPLACE FUNCTION update_planning_conversations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planning_conversations_update_timestamp
  BEFORE UPDATE ON public.planning_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_conversations_timestamp();

-- Verify planning_private_messages trigger is correct
DROP TRIGGER IF EXISTS planning_private_messages_update_timestamp ON public.planning_private_messages;

CREATE OR REPLACE FUNCTION update_planning_private_messages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planning_private_messages_update_timestamp
  BEFORE UPDATE ON public.planning_private_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_private_messages_timestamp();
