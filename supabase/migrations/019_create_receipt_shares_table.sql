-- Create receipt_shares table for sharing receipts with other users
CREATE TABLE IF NOT EXISTS public.receipt_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.business_receipts(id) ON DELETE CASCADE,
  shared_with_email varchar(255) NOT NULL,
  shared_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  shared_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_shares_receipt ON public.receipt_shares(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_shares_email ON public.receipt_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_receipt_shares_created ON public.receipt_shares(created_at DESC);

-- Enable RLS for receipt_shares table
ALTER TABLE public.receipt_shares ENABLE ROW LEVEL SECURITY;

-- Users can view shares for receipts they own or that were shared with them
CREATE POLICY "Users can view receipt shares for their receipts" ON public.receipt_shares
  FOR SELECT USING (
    shared_by_user_id = auth.uid()
  );

CREATE POLICY "Users can view receipt shares shared with them" ON public.receipt_shares
  FOR SELECT USING (
    shared_with_email = auth.jwt()->>'email'
  );

-- Users can create shares for their receipts
CREATE POLICY "Users can create receipt shares for their receipts" ON public.receipt_shares
  FOR INSERT WITH CHECK (
    shared_by_user_id = auth.uid()
    AND receipt_id IN (
      SELECT id FROM public.business_receipts WHERE user_id = auth.uid()
    )
  );

-- Users can delete shares for their receipts
CREATE POLICY "Users can delete receipt shares for their receipts" ON public.receipt_shares
  FOR DELETE USING (
    shared_by_user_id = auth.uid()
  );
