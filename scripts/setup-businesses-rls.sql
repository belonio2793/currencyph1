-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can insert own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete own businesses" ON public.businesses;

-- Enable RLS on businesses table
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own businesses
CREATE POLICY "Users can read own businesses" 
ON public.businesses 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own businesses
CREATE POLICY "Users can insert own businesses" 
ON public.businesses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own businesses
CREATE POLICY "Users can update own businesses" 
ON public.businesses 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own businesses
CREATE POLICY "Users can delete own businesses" 
ON public.businesses 
FOR DELETE 
USING (auth.uid() = user_id);
