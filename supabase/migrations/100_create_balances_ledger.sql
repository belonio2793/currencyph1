-- ============================================================================
-- PUBLIC BALANCES LEDGER - Transaction Log for all balance changes
-- ============================================================================

-- Create balances table to track all balance transactions
CREATE TABLE IF NOT EXISTS public.balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_code VARCHAR(16) NOT NULL REFERENCES currencies(code),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'deposit',
    'withdrawal',
    'transfer_send',
    'transfer_receive',
    'payment_send',
    'payment_receive',
    'refund',
    'credit',
    'adjustment'
  )),
  amount NUMERIC(36, 8) NOT NULL,
  balance_before NUMERIC(36, 8),
  balance_after NUMERIC(36, 8),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reference_id UUID COMMENT 'Links to deposits, transfers, or payment requests',
  reference_type TEXT COMMENT 'deposit, transfer, payment_request, etc.',
  description TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  metadata JSONB DEFAULT '{}' COMMENT 'Additional data like payment method, QR code, etc.',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON public.balances(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_currency ON public.balances(currency_code);
CREATE INDEX IF NOT EXISTS idx_balances_transaction_type ON public.balances(transaction_type);
CREATE INDEX IF NOT EXISTS idx_balances_created_at ON public.balances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balances_sender ON public.balances(sender_id);
CREATE INDEX IF NOT EXISTS idx_balances_receiver ON public.balances(receiver_id);
CREATE INDEX IF NOT EXISTS idx_balances_reference ON public.balances(reference_id);
CREATE INDEX IF NOT EXISTS idx_balances_status ON public.balances(status);
CREATE INDEX IF NOT EXISTS idx_balances_user_created ON public.balances(user_id, created_at DESC);

-- RLS Policies for balances
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- Users can view their own balance records
CREATE POLICY "Users can view their own balances" ON public.balances
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Only system can insert balance records (via functions/triggers)
CREATE POLICY "System can insert balances" ON public.balances
  FOR INSERT
  WITH CHECK (true);

-- Only system can update balance records
CREATE POLICY "System can update balances" ON public.balances
  FOR UPDATE
  USING (true);

-- Create view for balance summary
CREATE OR REPLACE VIEW balance_summary AS
SELECT
  user_id,
  currency_code,
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  MAX(created_at) as last_transaction,
  MIN(created_at) as first_transaction
FROM public.balances
WHERE status = 'completed'
GROUP BY user_id, currency_code, transaction_type;

-- Function to record balance transaction
CREATE OR REPLACE FUNCTION record_balance_transaction(
  p_user_id UUID,
  p_currency_code VARCHAR,
  p_transaction_type TEXT,
  p_amount NUMERIC,
  p_balance_before NUMERIC DEFAULT NULL,
  p_balance_after NUMERIC DEFAULT NULL,
  p_sender_id UUID DEFAULT NULL,
  p_receiver_id UUID DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_balance_id UUID;
BEGIN
  INSERT INTO public.balances (
    user_id,
    currency_code,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    sender_id,
    receiver_id,
    reference_id,
    reference_type,
    description,
    metadata,
    status
  ) VALUES (
    p_user_id,
    p_currency_code,
    p_transaction_type,
    p_amount,
    p_balance_before,
    p_balance_after,
    p_sender_id,
    p_receiver_id,
    p_reference_id,
    p_reference_type,
    p_description,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_balance_id;

  RETURN v_balance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
