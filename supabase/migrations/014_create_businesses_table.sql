-- Create businesses table for managing business registrations

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name varchar(255) NOT NULL,
  registration_type varchar(50) NOT NULL CHECK (registration_type IN ('sole', 'partnership', 'corporation', 'llc')),
  tin varchar(50),
  certificate_of_incorporation varchar(255),
  city_of_registration varchar(255),
  registration_date date,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_user ON public.businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);

-- Enable RLS for businesses table
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only view and modify their own businesses
CREATE POLICY "Users can view own businesses" ON public.businesses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own businesses" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own businesses" ON public.businesses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own businesses" ON public.businesses
  FOR DELETE USING (auth.uid() = user_id);

-- Create employees table for business employee management

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255),
  phone varchar(20),
  position varchar(100),
  salary numeric(12,2),
  benefits jsonb DEFAULT '{}'::jsonb,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  hire_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_business ON public.employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

-- Enable RLS for employees table
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees of own businesses" ON public.employees
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage employees of own businesses" ON public.employees
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update employees of own businesses" ON public.employees
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete employees of own businesses" ON public.employees
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Create business_payments table for payment provider integrations

CREATE TABLE IF NOT EXISTS public.business_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider varchar(50) NOT NULL,
  provider_account_id varchar(255),
  status varchar(20) DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'pending', 'error')),
  metadata jsonb DEFAULT '{}'::jsonb,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_payments_business ON public.business_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_business_payments_provider ON public.business_payments(provider);

-- Enable RLS for business_payments table
ALTER TABLE public.business_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment integrations of own businesses" ON public.business_payments
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage payment integrations of own businesses" ON public.business_payments
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete payment integrations of own businesses" ON public.business_payments
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Create business_receipts table for tracking sales and receipts

CREATE TABLE IF NOT EXISTS public.business_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_number varchar(50),
  customer_name varchar(255),
  customer_email varchar(255),
  amount numeric(12,2) NOT NULL,
  payment_method varchar(50),
  items jsonb DEFAULT '[]'::jsonb,
  notes text,
  is_printed boolean DEFAULT false,
  status varchar(20) DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'refunded', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_receipts_business ON public.business_receipts(business_id);
CREATE INDEX IF NOT EXISTS idx_business_receipts_created ON public.business_receipts(created_at);

-- Enable RLS for business_receipts table
ALTER TABLE public.business_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipts of own businesses" ON public.business_receipts
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create receipts for own businesses" ON public.business_receipts
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update receipts of own businesses" ON public.business_receipts
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Create shareholders table

CREATE TABLE IF NOT EXISTS public.shareholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shareholder_name varchar(255) NOT NULL,
  ownership_percentage numeric(5,2) NOT NULL,
  identification_type varchar(50),
  identification_number varchar(100),
  contact_email varchar(255),
  contact_phone varchar(20),
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shareholders_business ON public.shareholders(business_id);
CREATE INDEX IF NOT EXISTS idx_shareholders_user ON public.shareholders(user_id);

-- Enable RLS for shareholders table
ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shareholders of own businesses" ON public.shareholders
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage shareholders of own businesses" ON public.shareholders
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shareholders of own businesses" ON public.shareholders
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shareholders of own businesses" ON public.shareholders
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );
