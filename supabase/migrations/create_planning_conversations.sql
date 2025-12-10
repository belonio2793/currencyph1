-- Create planning_conversations table for managing private conversations
-- Tracks which users are having private conversations

CREATE TABLE IF NOT EXISTS public.planning_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Participants (always two users)
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Conversation metadata
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure conversations are unique per pair (order-independent)
  CONSTRAINT unique_conversation_pair UNIQUE (
    LEAST(user1_id, user2_id),
    GREATEST(user1_id, user2_id)
  )
);

-- Create planning_private_messages table for private conversation messages
CREATE TABLE IF NOT EXISTS public.planning_private_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to conversation
  conversation_id UUID NOT NULL REFERENCES public.planning_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  
  -- Message status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_conversations_user1_id ON public.planning_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_planning_conversations_user2_id ON public.planning_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_planning_conversations_updated_at ON public.planning_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_planning_private_messages_conversation_id ON public.planning_private_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_planning_private_messages_sender_id ON public.planning_private_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_planning_private_messages_created_at ON public.planning_private_messages(created_at DESC);

-- Enable RLS (Row Level Security) on conversations
ALTER TABLE public.planning_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to view own conversations" ON public.planning_conversations;
DROP POLICY IF EXISTS "Allow users to create conversations" ON public.planning_conversations;
DROP POLICY IF EXISTS "Allow users to update own conversations" ON public.planning_conversations;

-- RLS Policies for conversations - users can only see conversations they're part of
CREATE POLICY "Allow users to view own conversations" ON public.planning_conversations
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Allow users to create conversations" ON public.planning_conversations
  FOR INSERT WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Allow users to update own conversations" ON public.planning_conversations
  FOR UPDATE USING (user1_id = auth.uid() OR user2_id = auth.uid())
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- Enable RLS on private messages
ALTER TABLE public.planning_private_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow users to view conversation messages" ON public.planning_private_messages;
DROP POLICY IF EXISTS "Allow users to send messages" ON public.planning_private_messages;
DROP POLICY IF EXISTS "Allow users to update own messages" ON public.planning_private_messages;

-- RLS Policies for private messages - users can only see/send messages in conversations they're part of
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

-- Create triggers for timestamps
CREATE OR REPLACE FUNCTION update_planning_conversations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planning_conversations_update_timestamp ON public.planning_conversations;

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

DROP TRIGGER IF EXISTS planning_private_messages_update_timestamp ON public.planning_private_messages;

CREATE TRIGGER planning_private_messages_update_timestamp
  BEFORE UPDATE ON public.planning_private_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_private_messages_timestamp();
