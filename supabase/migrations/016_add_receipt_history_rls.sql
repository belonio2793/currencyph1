-- Add RLS policy to allow users to view receipts issued to them
-- Users can view receipts where the customer_email matches their email or customer_phone matches their phone

-- First, we need to ensure users table exists and has the necessary fields
-- The policy will match based on customer_email or customer_phone

-- Create a policy that allows users to view receipts issued to their email/phone
-- This requires checking against the auth.users() table
CREATE POLICY "Users can view receipts issued to them" ON public.business_receipts
  FOR SELECT USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR customer_phone = (
      SELECT phone FROM auth.users WHERE id = auth.uid()
    )
  );

-- Merchants can view receipts they created from their businesses
-- This is already covered by the existing policy, but let's be explicit
CREATE POLICY "Merchants can view receipts they created" ON public.business_receipts
  FOR SELECT USING (
    user_id = auth.uid()
  );
