-- Fix Receipt RLS Policies - Use auth.jwt() instead of querying auth.users
-- This resolves "permission denied for table users" errors

-- Drop the problematic policies that try to SELECT from auth.users
DROP POLICY IF EXISTS "Customers can view receipts by email" ON public.business_receipts;
DROP POLICY IF EXISTS "Customers can view receipts by phone" ON public.business_receipts;
DROP POLICY IF EXISTS "Customers can view receipts sent to email" ON public.business_receipts;
DROP POLICY IF EXISTS "Customers can view receipts sent to phone" ON public.business_receipts;

-- Create fixed RLS Policies for Customer Access using auth.jwt()
-- Customers can view receipts issued to their email address
CREATE POLICY "Customers can view receipts by email" ON public.business_receipts
  FOR SELECT USING (
    customer_email = auth.jwt()->>'email'
  );

-- Customers can view receipts sent to their phone number
CREATE POLICY "Customers can view receipts by phone" ON public.business_receipts
  FOR SELECT USING (
    customer_phone = auth.jwt()->>'phone'
  );

-- Customers can view receipts sent to alternate email
CREATE POLICY "Customers can view receipts sent to email" ON public.business_receipts
  FOR SELECT USING (
    sent_to_email = auth.jwt()->>'email'
  );

-- Customers can view receipts sent to alternate phone
CREATE POLICY "Customers can view receipts sent to phone" ON public.business_receipts
  FOR SELECT USING (
    sent_to_phone = auth.jwt()->>'phone'
  );
