-- Fix planning_conversations table and triggers
-- Issues: Foreign key constraint failures and profile update trigger errors

-- Drop existing triggers and functions to start fresh
DROP TRIGGER IF EXISTS planning_users_timestamp_trigger ON public.planning_users;
DROP FUNCTION IF EXISTS update_planning_users_timestamp();

-- Recreate the function with explicit field assignment
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

-- Verify planning_conversations table structure and recreate if needed
DROP TABLE IF EXISTS public.planning_conversations CASCADE;
DROP TABLE IF EXISTS public.planning_private_messages CASCADE;

-- Recreate planning_conversations with correct structure
CREATE TABLE public.planning_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_conversation_pair UNIQUE (
    LEAST(user1_id, user2_id),
    GREATEST(user1_id, user2_id)
  )
);

-- Create planning_private_messages
CREATE TABLE public.planning_private_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.planning_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_planning_conversations_user1_id ON public.planning_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_planning_conversations_user2_id ON public.planning_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_planning_conversations_updated_at ON public.planning_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_planning_private_messages_conversation_id ON public.planning_private_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_planning_private_messages_sender_id ON public.planning_private_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_planning_private_messages_created_at ON public.planning_private_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.planning_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_private_messages ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies for conversations
DROP POLICY IF EXISTS "Allow users to view own conversations" ON public.planning_conversations;
DROP POLICY IF EXISTS "Allow users to create conversations" ON public.planning_conversations;
DROP POLICY IF EXISTS "Allow users to update own conversations" ON public.planning_conversations;

CREATE POLICY "Allow users to view own conversations" ON public.planning_conversations
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Allow users to create conversations" ON public.planning_conversations
  FOR INSERT WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Allow users to update own conversations" ON public.planning_conversations
  FOR UPDATE USING (user1_id = auth.uid() OR user2_id = auth.uid())
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- Drop and recreate RLS policies for private messages
DROP POLICY IF EXISTS "Allow users to view conversation messages" ON public.planning_private_messages;
DROP POLICY IF EXISTS "Allow users to send messages" ON public.planning_private_messages;
DROP POLICY IF EXISTS "Allow users to update own messages" ON public.planning_private_messages;

CREATE POLICY "Allow users to view conversation messages" ON public.planning_private_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.planning_conversations
      WHERE id = conversation_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY "Allow users to send messages" ON public.planning_private_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.planning_conversations
      WHERE id = conversation_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY "Allow users to update own messages" ON public.planning_private_messages
  FOR UPDATE USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Recreate triggers for conversations and private messages
DROP TRIGGER IF EXISTS planning_conversations_update_timestamp ON public.planning_conversations;
DROP TRIGGER IF EXISTS planning_private_messages_update_timestamp ON public.planning_private_messages;

DROP FUNCTION IF EXISTS update_planning_conversations_timestamp();
DROP FUNCTION IF EXISTS update_planning_private_messages_timestamp();

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
