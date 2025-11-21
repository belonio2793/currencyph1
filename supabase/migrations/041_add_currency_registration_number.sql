-- Add currency_registration_number column to businesses table
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS currency_registration_number TEXT UNIQUE NOT NULL DEFAULT '';

-- Create an index on currency_registration_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_currency_registration_number ON public.businesses(currency_registration_number);

-- Add a comment to document the column
COMMENT ON COLUMN public.businesses.currency_registration_number IS 'Auto-generated unique currency registration number for currency.ph platform (format: CRN-XXXXXXXXXXXXXXXX)';
