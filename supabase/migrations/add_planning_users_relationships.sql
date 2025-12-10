-- Add planning_users relationship to planning_private_messages
-- This allows the REST API to properly join planning_users data for sender information

-- First, ensure planning_private_messages has the proper structure
-- Add a planning_user_id column that references planning_users directly
ALTER TABLE public.planning_private_messages
ADD COLUMN IF NOT EXISTS planning_user_id UUID REFERENCES public.planning_users(id) ON DELETE SET NULL;

-- Create a function to populate planning_user_id from sender_id
CREATE OR REPLACE FUNCTION populate_planning_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Find the planning_users record for this sender
  SELECT id INTO NEW.planning_user_id 
  FROM public.planning_users 
  WHERE user_id = NEW.sender_id 
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate planning_user_id on insert
DROP TRIGGER IF EXISTS populate_planning_user_id_trigger ON public.planning_private_messages;

CREATE TRIGGER populate_planning_user_id_trigger
  BEFORE INSERT ON public.planning_private_messages
  FOR EACH ROW
  EXECUTE FUNCTION populate_planning_user_id();

-- Update existing records
UPDATE public.planning_private_messages
SET planning_user_id = (
  SELECT id FROM public.planning_users 
  WHERE user_id = planning_private_messages.sender_id 
  LIMIT 1
)
WHERE planning_user_id IS NULL;

-- Create indexes for the new column
CREATE INDEX IF NOT EXISTS idx_planning_private_messages_planning_user_id 
  ON public.planning_private_messages(planning_user_id);

-- Also add planning_users relationship to planning_conversations via user1_id and user2_id
-- Create views for easier querying (optional but helpful)
CREATE OR REPLACE VIEW planning_conversations_with_users AS
SELECT 
  pc.id,
  pc.user1_id,
  pc.user2_id,
  pu1.id as user1_planning_id,
  pu1.name as user1_name,
  pu1.email as user1_email,
  pu2.id as user2_planning_id,
  pu2.name as user2_name,
  pu2.email as user2_email,
  pc.is_active,
  pc.last_message_at,
  pc.last_message_preview,
  pc.created_at,
  pc.updated_at
FROM public.planning_conversations pc
LEFT JOIN public.planning_users pu1 ON pc.user1_id = pu1.user_id
LEFT JOIN public.planning_users pu2 ON pc.user2_id = pu2.user_id;
