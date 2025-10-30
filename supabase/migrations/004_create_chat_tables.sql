-- Create conversations and friends tables for chat feature

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Conversations table to track conversation metadata
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Conversation members mapping
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Friends table for friend relationships
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  status text DEFAULT 'accepted', -- pending, accepted, blocked
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Friend requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  message text,
  status text DEFAULT 'pending', -- pending, accepted, rejected
  created_at timestamptz DEFAULT now()
);

-- Message media references
CREATE TABLE IF NOT EXISTS public.message_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path text,
  mime_type text,
  size bigint,
  created_at timestamptz DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS conversations_created_by_idx ON public.conversations (created_by);
CREATE INDEX IF NOT EXISTS conv_members_user_idx ON public.conversation_members (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS friends_user_idx ON public.friends (user_id, friend_id);
CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON public.friend_requests (receiver_id, status);

-- Note: existing public.messages table (003) is used for message storage. It contains sender_id, recipient_id, ciphertext and iv.
