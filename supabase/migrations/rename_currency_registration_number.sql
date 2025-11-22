-- Rename currency_registration_number column to currency_registration_id
ALTER TABLE public.businesses RENAME COLUMN currency_registration_number TO currency_registration_id;

-- Rename the index
DROP INDEX IF EXISTS idx_businesses_currency_registration_number;
CREATE INDEX idx_businesses_currency_registration_id ON public.businesses(currency_registration_id);

-- Update the column comment
COMMENT ON COLUMN public.businesses.currency_registration_id IS 'Auto-generated unique currency registration ID for currency.ph platform (format: CRN-XXXXXXXXXXXXXXXX). This is immutable once synced with a business.';
