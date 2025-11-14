-- Complete Receipt Schema Migration - Ensures merchants and customers can sync receipts

-- Ensure all necessary columns exist in business_receipts table
ALTER TABLE public.business_receipts
ADD COLUMN IF NOT EXISTS customer_phone varchar(255),
ADD COLUMN IF NOT EXISTS sent_to_email varchar(255),
ADD COLUMN IF NOT EXISTS sent_to_phone varchar(255),
ADD COLUMN IF NOT EXISTS sent_at timestamptz,
ADD COLUMN IF NOT EXISTS is_sent boolean DEFAULT false;

-- Add indexes for better query performance on frequently searched columns
CREATE INDEX IF NOT EXISTS idx_business_receipts_user_id ON public.business_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_business_receipts_customer_email ON public.business_receipts(customer_email);
CREATE INDEX IF NOT EXISTS idx_business_receipts_customer_phone ON public.business_receipts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_business_receipts_sent_to_email ON public.business_receipts(sent_to_email);
CREATE INDEX IF NOT EXISTS idx_business_receipts_sent_to_phone ON public.business_receipts(sent_to_phone);
CREATE INDEX IF NOT EXISTS idx_business_receipts_status ON public.business_receipts(status);

-- Drop old conflicting policies if they exist (to avoid duplicates)
DROP POLICY IF EXISTS "Users can view receipts issued to them" ON public.business_receipts;
DROP POLICY IF EXISTS "Merchants can view receipts they created" ON public.business_receipts;

-- RLS Policies for Merchant (Business Owner) Access
-- Merchants can view all receipts for their businesses
CREATE POLICY "Merchants can view business receipts" ON public.business_receipts
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can create receipts" ON public.business_receipts
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update receipts" ON public.business_receipts
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for Customer Access
-- Customers can view receipts issued to their email address
CREATE POLICY "Customers can view receipts by email" ON public.business_receipts
  FOR SELECT USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Customers can view receipts sent to their phone number
CREATE POLICY "Customers can view receipts by phone" ON public.business_receipts
  FOR SELECT USING (
    customer_phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

-- Customers can view receipts sent to alternate email
CREATE POLICY "Customers can view receipts sent to email" ON public.business_receipts
  FOR SELECT USING (
    sent_to_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Customers can view receipts sent to alternate phone
CREATE POLICY "Customers can view receipts sent to phone" ON public.business_receipts
  FOR SELECT USING (
    sent_to_phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

-- Comments for documentation
COMMENT ON TABLE public.business_receipts IS 'Stores all sales receipts issued by businesses. Merchants can view receipts for their businesses, customers can view receipts issued to them.';
COMMENT ON COLUMN public.business_receipts.business_id IS 'References the business that issued the receipt';
COMMENT ON COLUMN public.business_receipts.user_id IS 'References the merchant (business owner) who created the receipt';
COMMENT ON COLUMN public.business_receipts.customer_email IS 'Email of the customer who received the receipt';
COMMENT ON COLUMN public.business_receipts.customer_phone IS 'Phone number of the customer who received the receipt';
COMMENT ON COLUMN public.business_receipts.sent_to_email IS 'Email address the receipt was sent to (may differ from customer_email)';
COMMENT ON COLUMN public.business_receipts.sent_to_phone IS 'Phone number the receipt was sent to (may differ from customer_phone)';
COMMENT ON COLUMN public.business_receipts.sent_at IS 'Timestamp when the receipt was sent to customer';
COMMENT ON COLUMN public.business_receipts.is_sent IS 'Boolean flag indicating if receipt has been sent to customer';
