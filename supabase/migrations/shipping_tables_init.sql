-- Create shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
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
CREATE TABLE IF NOT EXISTS public.shipment_tracking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Create user_addresses table (for My Addresses tab)
CREATE TABLE IF NOT EXISTS public.user_addresses (
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
CREATE TABLE IF NOT EXISTS public.default_addresses (
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

-- Create shipping_handlers table (for Shipping Handlers tab)
CREATE TABLE IF NOT EXISTS public.shipping_handlers (
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

-- Create shipping_ports table (for Public Shipping Ports tab)
CREATE TABLE IF NOT EXISTS public.shipping_ports (
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

-- Create shipping_routes table
CREATE TABLE IF NOT EXISTS public.shipping_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_address_id uuid REFERENCES public.shipping_ports(id) ON DELETE SET NULL,
  destination_address_id uuid REFERENCES public.shipping_ports(id) ON DELETE SET NULL,
  origin_city VARCHAR(100) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  estimated_days INTEGER,
  cost DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON public.shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_history_shipment_id ON public.shipment_tracking_history(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_history_timestamp ON public.shipment_tracking_history(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON public.user_addresses(user_id, is_default);

CREATE INDEX IF NOT EXISTS idx_default_addresses_city ON public.default_addresses(city);
CREATE INDEX IF NOT EXISTS idx_default_addresses_type ON public.default_addresses(address_type);

CREATE INDEX IF NOT EXISTS idx_shipping_handlers_business_id ON public.shipping_handlers(business_id);
CREATE INDEX IF NOT EXISTS idx_shipping_handlers_type ON public.shipping_handlers(handler_type);

CREATE INDEX IF NOT EXISTS idx_shipping_ports_city ON public.shipping_ports(city);
CREATE INDEX IF NOT EXISTS idx_shipping_ports_code ON public.shipping_ports(port_code);

CREATE INDEX IF NOT EXISTS idx_shipping_routes_origin_dest ON public.shipping_routes(origin_city, destination_city);

-- Enable RLS (Row Level Security) for multi-tenancy
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_handlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipments
CREATE POLICY "Users can view their own shipments" ON public.shipments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipments" ON public.shipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments" ON public.shipments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipments" ON public.shipments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user addresses
CREATE POLICY "Users can view their own addresses" ON public.user_addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses" ON public.user_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" ON public.user_addresses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" ON public.user_addresses
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tracking history
CREATE POLICY "Users can view tracking history for their shipments" ON public.shipment_tracking_history
  FOR SELECT USING (
    shipment_id IN (
      SELECT id FROM public.shipments WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for public data (everyone can read)
CREATE POLICY "Anyone can view default addresses" ON public.default_addresses
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view shipping ports" ON public.shipping_ports
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view shipping routes" ON public.shipping_routes
  FOR SELECT USING (true);

CREATE POLICY "Business users can view their own handlers" ON public.shipping_handlers
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );
