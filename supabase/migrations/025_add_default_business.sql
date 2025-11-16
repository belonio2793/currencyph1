-- Add is_default column to businesses table to track user's default business
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Create an index on is_default for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_default ON public.businesses(user_id, is_default) 
WHERE is_default = true;

-- Ensure only one default business per user
-- This constraint is enforced through trigger logic instead of unique constraint
-- since we need to allow multiple businesses with is_default = false

-- Create a trigger function to enforce only one default business per user
CREATE OR REPLACE FUNCTION enforce_single_default_business()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new business is being set as default
  IF NEW.is_default = true THEN
    -- Update all other businesses for this user to not be default
    UPDATE public.businesses 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_enforce_single_default_business ON public.businesses;
CREATE TRIGGER trg_enforce_single_default_business
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION enforce_single_default_business();
