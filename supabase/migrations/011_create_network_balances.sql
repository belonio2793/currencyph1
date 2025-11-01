-- Create network_balances table to track reconciled balances across the network
-- This table reconciles every transaction and balance between users and house accounts

CREATE TABLE IF NOT EXISTS public.network_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity identification (user or house)
  entity_type text NOT NULL CHECK (entity_type IN ('user', 'house')),
  entity_id uuid,
  
  -- Currency and balance tracking
  currency_code varchar(16) NOT NULL REFERENCES currencies(code),
  
  -- Balance values
  wallet_balance numeric(36, 8) NOT NULL DEFAULT 0,
  computed_balance numeric(36, 8) NOT NULL DEFAULT 0,
  balance_difference numeric(36, 8) NOT NULL DEFAULT 0,
  
  -- Reconciliation details
  total_transactions bigint NOT NULL DEFAULT 0,
  total_deposits numeric(36, 8) NOT NULL DEFAULT 0,
  total_withdrawals numeric(36, 8) NOT NULL DEFAULT 0,
  
  -- Status and timing
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'discrepancy')),
  reconciliation_date timestamptz NOT NULL DEFAULT now(),
  
  -- Metadata
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Audit trail
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(entity_type, entity_id, currency_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_network_balances_entity ON public.network_balances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_network_balances_currency ON public.network_balances(currency_code);
CREATE INDEX IF NOT EXISTS idx_network_balances_date ON public.network_balances(reconciliation_date DESC);
CREATE INDEX IF NOT EXISTS idx_network_balances_status ON public.network_balances(status);
CREATE INDEX IF NOT EXISTS idx_network_balances_user ON public.network_balances(entity_id) WHERE entity_type = 'user';
CREATE UNIQUE INDEX IF NOT EXISTS idx_network_balances_daily ON public.network_balances(entity_type, entity_id, currency_code, date_trunc('day'::text, reconciliation_date));

-- Summary view for quick access to latest balances by entity
CREATE OR REPLACE VIEW public.network_balances_latest AS
SELECT DISTINCT ON (entity_type, entity_id, currency_code)
  id,
  entity_type,
  entity_id,
  currency_code,
  wallet_balance,
  computed_balance,
  balance_difference,
  total_transactions,
  total_deposits,
  total_withdrawals,
  status,
  reconciliation_date,
  created_at,
  updated_at
FROM public.network_balances
ORDER BY entity_type, entity_id, currency_code, reconciliation_date DESC;

-- Summary aggregation view for all entities
CREATE OR REPLACE VIEW public.network_balances_summary AS
SELECT
  entity_type,
  currency_code,
  COUNT(*) as entity_count,
  SUM(wallet_balance) as total_wallet_balance,
  SUM(computed_balance) as total_computed_balance,
  SUM(balance_difference) as total_difference,
  SUM(total_transactions) as total_transaction_count,
  SUM(total_deposits) as total_all_deposits,
  SUM(total_withdrawals) as total_all_withdrawals,
  COUNT(CASE WHEN status = 'reconciled' THEN 1 END) as reconciled_count,
  COUNT(CASE WHEN status = 'discrepancy' THEN 1 END) as discrepancy_count,
  MAX(reconciliation_date) as last_reconciliation
FROM public.network_balances
GROUP BY entity_type, currency_code;

-- Row-level security for user data (users can see their own, admins can see all)
ALTER TABLE public.network_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own network balances" ON public.network_balances
  FOR SELECT USING (
    entity_type = 'user' AND (auth.uid() = entity_id OR auth.role() = 'authenticated')
  );

CREATE POLICY "Service role can insert/update network balances" ON public.network_balances
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update network balances" ON public.network_balances
  FOR UPDATE USING (true);
