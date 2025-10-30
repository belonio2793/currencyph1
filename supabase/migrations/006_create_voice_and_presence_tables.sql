-- Voice calls table for tracking voice and video calls
CREATE TABLE IF NOT EXISTS public.voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  call_type text CHECK (call_type IN ('voice', 'video')), -- voice or video
  status text CHECK (status IN ('pending', 'accepted', 'rejected', 'missed', 'completed')),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- User presence/online status table
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status text CHECK (status IN ('online', 'away', 'offline')),
  last_seen timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  reader_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, reader_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS voice_calls_caller_idx ON public.voice_calls (caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_calls_recipient_idx ON public.voice_calls (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_presence_user_idx ON public.user_presence (user_id);
CREATE INDEX IF NOT EXISTS message_read_receipts_message_idx ON public.message_read_receipts (message_id);
CREATE INDEX IF NOT EXISTS message_read_receipts_reader_idx ON public.message_read_receipts (reader_id);
