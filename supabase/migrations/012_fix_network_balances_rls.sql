-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own network balances" ON public.network_balances;
DROP POLICY IF EXISTS "Service role can insert/update network balances" ON public.network_balances;
DROP POLICY IF EXISTS "Service role can update network balances" ON public.network_balances;

-- Ensure RLS is enabled
ALTER TABLE public.network_balances ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can view house balances
CREATE POLICY "Authenticated users can view house balances" ON public.network_balances
  FOR SELECT USING (
    entity_type = 'house'
  );

-- Policy 2: Users can view their own user balances
CREATE POLICY "Users can view their own user balances" ON public.network_balances
  FOR SELECT USING (
    entity_type = 'user' AND auth.uid() = entity_id
  );

-- Policy 3: Service role can do anything (for edge functions and admin)
CREATE POLICY "Service role bypass" ON public.network_balances
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 4: Authenticated users can insert (for admin/service operations)
CREATE POLICY "Authenticated users can insert network balances" ON public.network_balances
  FOR INSERT WITH CHECK (true);

-- Policy 5: Authenticated users can update (for admin/service operations)
CREATE POLICY "Authenticated users can update network balances" ON public.network_balances
  FOR UPDATE USING (true);
