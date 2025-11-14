-- Add customer_phone and currencies_registration_number fields to business_receipts table

ALTER TABLE public.business_receipts
ADD COLUMN IF NOT EXISTS customer_phone varchar(255);

-- Add index for customer_phone to support searching by phone number
CREATE INDEX IF NOT EXISTS idx_business_receipts_customer_phone ON public.business_receipts(customer_phone);

-- Add index for customer_email as well to support searching
CREATE INDEX IF NOT EXISTS idx_business_receipts_customer_email ON public.business_receipts(customer_email);
