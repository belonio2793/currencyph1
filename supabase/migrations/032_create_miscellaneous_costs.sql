-- Create miscellaneous_costs table for tracking business expenses
CREATE TABLE IF NOT EXISTS public.miscellaneous_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category varchar(100),
  cost_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method varchar(50),
  notes text,
  receipt_url text,
  status varchar(20) DEFAULT 'recorded' CHECK (status IN ('draft', 'recorded', 'archived')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miscellaneous_costs_business ON public.miscellaneous_costs(business_id);
CREATE INDEX IF NOT EXISTS idx_miscellaneous_costs_user ON public.miscellaneous_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_miscellaneous_costs_date ON public.miscellaneous_costs(cost_date);
CREATE INDEX IF NOT EXISTS idx_miscellaneous_costs_category ON public.miscellaneous_costs(category);

-- Enable RLS for miscellaneous_costs table
ALTER TABLE public.miscellaneous_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view costs of own businesses" ON public.miscellaneous_costs
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert costs for own businesses" ON public.miscellaneous_costs
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    ) AND auth.uid() = user_id
  );

CREATE POLICY "Users can update costs of own businesses" ON public.miscellaneous_costs
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    ) AND auth.uid() = user_id
  );

CREATE POLICY "Users can delete costs of own businesses" ON public.miscellaneous_costs
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    ) AND auth.uid() = user_id
  );
