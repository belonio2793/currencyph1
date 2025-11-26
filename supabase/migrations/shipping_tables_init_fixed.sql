-- Drop dependent foreign keys first if they exist (for idempotency)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_routes') THEN
    ALTER TABLE IF EXISTS public.shipping_routes DROP CONSTRAINT IF EXISTS shipping_routes_origin_address_id_fkey;
    ALTER TABLE IF EXISTS public.shipping_routes DROP CONSTRAINT IF EXISTS shipping_routes_destination_address_id_fkey;
  END IF;
END $$;

-- Drop and recreate tables with consistent UUID types
DROP TABLE IF EXISTS public.shipping_routes CASCADE;
DROP TABLE IF EXISTS public.shipping_ports CASCADE;
DROP TABLE IF EXISTS public.shipping_handlers CASCADE;
DROP TABLE IF EXISTS public.default_addresses CASCADE;
DROP TABLE IF EXISTS public.user_addresses CASCADE;
DROP TABLE IF EXISTS public.shipment_tracking_history CASCADE;
DROP TABLE IF EXISTS public.shipments CASCADE;

-- Create shipments table
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_number VARCHAR(255) NOT NULL UNIQUE,
  package_weight VARCHAR(50),
  package_dimensions VARCHAR(100),
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  carrier VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in-transit', 'delivered', 'failed')),
  estimated_delivery TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shipment_tracking_history table
CREATE TABLE public.shipment_tracking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Create user_addresses table (for My Addresses tab)
CREATE TABLE public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label VARCHAR(100),
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Philippines',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create default_addresses table (for Default tab - system-wide addresses)
CREATE TABLE public.default_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address_type VARCHAR(100) NOT NULL CHECK (address_type IN ('warehouse', 'headquarters', 'branch', 'pickup', 'delivery')),
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Philippines',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shipping_ports table with UUID (to match shipping_routes foreign keys)
CREATE TABLE public.shipping_ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port_name VARCHAR(255) NOT NULL UNIQUE,
  port_code VARCHAR(50) UNIQUE,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Philippines',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  port_type VARCHAR(50) CHECK (port_type IN ('seaport', 'airport', 'inland', 'border')),
  facilities TEXT[],
  contact_person VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  operating_hours VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shipping_handlers table (for Shipping Handlers tab)
CREATE TABLE public.shipping_handlers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  handler_name VARCHAR(255) NOT NULL,
  handler_type VARCHAR(100) NOT NULL CHECK (handler_type IN ('courier', 'logistics', 'warehouse', 'freight', 'other')),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  coverage_areas TEXT[],
  service_types TEXT[],
  rates JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shipping_routes table (now with compatible UUID types)
CREATE TABLE public.shipping_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_port_id uuid REFERENCES public.shipping_ports(id) ON DELETE SET NULL,
  destination_port_id uuid REFERENCES public.shipping_ports(id) ON DELETE SET NULL,
  origin_city VARCHAR(100) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  estimated_days INTEGER,
  cost DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_shipments_user_id ON public.shipments(user_id);
CREATE INDEX idx_shipments_tracking_number ON public.shipments(tracking_number);
CREATE INDEX idx_shipments_status ON public.shipments(status);
CREATE INDEX idx_shipments_created_at ON public.shipments(created_at DESC);

CREATE INDEX idx_shipment_tracking_history_shipment_id ON public.shipment_tracking_history(shipment_id);
CREATE INDEX idx_shipment_tracking_history_timestamp ON public.shipment_tracking_history(timestamp DESC);

CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_user_addresses_default ON public.user_addresses(user_id, is_default);

CREATE INDEX idx_default_addresses_city ON public.default_addresses(city);
CREATE INDEX idx_default_addresses_type ON public.default_addresses(address_type);

CREATE INDEX idx_shipping_handlers_business_id ON public.shipping_handlers(business_id);
CREATE INDEX idx_shipping_handlers_type ON public.shipping_handlers(handler_type);

CREATE INDEX idx_shipping_ports_city ON public.shipping_ports(city);
CREATE INDEX idx_shipping_ports_code ON public.shipping_ports(port_code);

CREATE INDEX idx_shipping_routes_origin_dest ON public.shipping_routes(origin_city, destination_city);

-- Enable RLS (Row Level Security) for multi-tenancy
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_handlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- RLS Policies for shipments (user-owned data)
CREATE POLICY "Users can view their own shipments" ON public.shipments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipments" ON public.shipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments" ON public.shipments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipments" ON public.shipments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user addresses (user-owned data)
CREATE POLICY "Users can view their own addresses" ON public.user_addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses" ON public.user_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" ON public.user_addresses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" ON public.user_addresses
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tracking history (user can view for their shipments)
CREATE POLICY "Users can view tracking history for their shipments" ON public.shipment_tracking_history
  FOR SELECT USING (
    shipment_id IN (
      SELECT id FROM public.shipments WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for public data (everyone can read, no writes)
CREATE POLICY "Anyone can view default addresses" ON public.default_addresses
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view shipping ports" ON public.shipping_ports
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view shipping routes" ON public.shipping_routes
  FOR SELECT USING (true);

-- RLS Policies for business data (business owners only)
CREATE POLICY "Business users can view their own handlers" ON public.shipping_handlers
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business users can insert their own handlers" ON public.shipping_handlers
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business users can update their own handlers" ON public.shipping_handlers
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Sample Data (optional - for testing)
-- ============================================================================

-- Insert sample shipping ports
INSERT INTO public.shipping_ports (port_name, port_code, city, province, latitude, longitude, port_type, is_active)
VALUES
  ('Port of Manila', 'PHMNL', 'Manila', 'Metro Manila', 14.5995, 120.9842, 'seaport', true),
  ('Port of Cebu', 'PHCEB', 'Cebu', 'Cebu', 10.3157, 123.8854, 'seaport', true),
  ('Port of Davao', 'PHDAV', 'Davao', 'Davao', 7.0731, 125.6121, 'seaport', true),
  ('Ninoy Aquino International Airport', 'MNLA', 'Manila', 'Metro Manila', 14.5086, 121.0197, 'airport', true),
  ('Mactan Cebu International Airport', 'CEB', 'Cebu', 'Cebu', 10.3077, 123.9761, 'airport', true)
ON CONFLICT (port_name) DO NOTHING;

-- Insert sample shipping routes
INSERT INTO public.shipping_routes (origin_city, destination_city, estimated_days, cost)
VALUES
  ('Manila', 'Cebu', 2, 5000.00),
  ('Manila', 'Davao', 3, 8000.00),
  ('Cebu', 'Davao', 1, 4000.00),
  ('Manila', 'Iloilo', 2, 4500.00),
  ('Manila', 'Baguio', 1, 3000.00)
ON CONFLICT DO NOTHING;
