-- Create job queue for wallet sync tasks
CREATE TABLE IF NOT EXISTS public.wallet_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_house_id uuid NOT NULL REFERENCES public.wallets_house(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | done | failed
  attempts integer NOT NULL DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  last_error text,
  available_at timestamptz DEFAULT now(),
  scheduled_at timestamptz DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_sync_jobs_status_available ON public.wallet_sync_jobs(status, available_at);
CREATE INDEX IF NOT EXISTS idx_wallet_sync_jobs_wallet ON public.wallet_sync_jobs(wallet_house_id);
