-- Create messages table

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ciphertext text,
  iv text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Optional index for recipient queries
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages (recipient_id, created_at DESC);
