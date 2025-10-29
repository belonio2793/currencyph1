-- Create balances table for ledger and activity tracking
-- Designed for Supabase (Postgres)

create extension if not exists "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.balances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reference_id text,
  activity_type text NOT NULL,
  transaction_type text NOT NULL,
  amount numeric(18,6) NOT NULL,
  previous_balance numeric(18,6),
  new_balance numeric(18,6),
  currency text DEFAULT 'PHP',
  status text DEFAULT 'completed',
  -- direction is derived from transaction_type for easy UI filtering
  direction text GENERATED ALWAYS AS (
    case when lower(transaction_type) in ('received','credit','bonus','refund','deposit') then 'inflow' else 'outflow' end
  ) STORED,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  source_app text,
  visibility boolean DEFAULT true,
  note_admin text,
  ip_address inet,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON public.balances(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_created_at ON public.balances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balances_new_balance ON public.balances(new_balance DESC);
CREATE INDEX IF NOT EXISTS idx_balances_transaction_type ON public.balances(transaction_type);
CREATE INDEX IF NOT EXISTS idx_balances_visibility ON public.balances(visibility);

-- Optional: per-user summary view (latest record per user)
CREATE OR REPLACE VIEW public.balances_latest_per_user AS
SELECT DISTINCT ON (user_id) user_id, id AS balance_id, new_balance, created_at, currency
FROM public.balances
ORDER BY user_id, created_at DESC;

-- Enable Row Level Security and basic policies
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own records
CREATE POLICY insert_own_balance ON public.balances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to select their own records
CREATE POLICY select_own_balance ON public.balances
  FOR SELECT USING (auth.uid() = user_id OR visibility = true);

-- Allow updates only by the same user (or admin via service role)
CREATE POLICY update_own_balance ON public.balances
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow delete only by the same user
CREATE POLICY delete_own_balance ON public.balances
  FOR DELETE USING (auth.uid() = user_id);

-- Note: service role (server-side) can bypass RLS using service key
