-- Add is_public column to businesses table to support public business listings
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Create index for public businesses queries
CREATE INDEX IF NOT EXISTS idx_businesses_public ON public.businesses(is_public) 
WHERE is_public = true;

-- Add comment documenting the column
COMMENT ON COLUMN public.businesses.is_public IS 'Whether this business is publicly visible in the business directory';

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "select_own_businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can view own businesses" ON public.businesses;

-- Create new SELECT policy that allows viewing own businesses and all public businesses
CREATE POLICY "select_own_or_public_businesses" 
ON public.businesses 
FOR SELECT 
USING (auth.uid() = user_id OR is_public = true);
