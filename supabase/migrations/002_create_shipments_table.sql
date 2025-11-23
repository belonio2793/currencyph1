-- Create shipments table for tracking packages
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tracking Information
  tracking_number VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Package Information
  package_weight VARCHAR(50),
  package_dimensions VARCHAR(100),
  package_type VARCHAR(50) DEFAULT 'general',
  
  -- Location Information
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  
  -- Carrier and Delivery
  carrier VARCHAR(100),
  estimated_delivery DATE,
  
  -- Additional Information
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_shipments_user_id ON shipments(user_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_created_at ON shipments(created_at);

-- Create shipment_tracking_history table for tracking updates
CREATE TABLE IF NOT EXISTS shipment_tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  
  -- Tracking Information
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional Details
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for tracking history
CREATE INDEX idx_shipment_tracking_history_shipment_id ON shipment_tracking_history(shipment_id);
CREATE INDEX idx_shipment_tracking_history_timestamp ON shipment_tracking_history(timestamp);

-- Add address_nicknames column to addresses table if it doesn't exist
ALTER TABLE addresses
ADD COLUMN IF NOT EXISTS address_nickname VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Create address_history table for tracking address changes
CREATE TABLE IF NOT EXISTS address_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID REFERENCES addresses(id) ON DELETE CASCADE,
  
  -- Change Information
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for address history
CREATE INDEX idx_address_history_address_id ON address_history(address_id);
CREATE INDEX idx_address_history_changed_at ON address_history(changed_at);

-- Create shipping_partners table for managing partners
CREATE TABLE IF NOT EXISTS shipping_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Partner Information
  partner_name VARCHAR(255) NOT NULL,
  partner_type VARCHAR(50),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  website TEXT,
  
  -- Service Information
  delivery_method VARCHAR(100),
  coverage_area TEXT,
  estimated_delivery_days INTEGER,
  base_rate DECIMAL(10, 2),
  
  -- Features
  has_tracking BOOLEAN DEFAULT TRUE,
  has_insurance BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  is_favorite BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3, 1) DEFAULT 4.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for shipping partners
CREATE INDEX idx_shipping_partners_user_id ON shipping_partners(user_id);
CREATE INDEX idx_shipping_partners_partner_type ON shipping_partners(partner_type);
CREATE INDEX idx_shipping_partners_is_favorite ON shipping_partners(is_favorite);

-- Create shipping_routes table for managing routes
CREATE TABLE IF NOT EXISTS shipping_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  
  -- Route Information
  origin_city VARCHAR(100) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  
  -- Package Details
  package_weight DECIMAL(8, 2),
  package_volume DECIMAL(10, 2),
  package_type VARCHAR(50),
  
  -- Route Calculation
  selected_partner_id UUID,
  estimated_cost DECIMAL(10, 2),
  estimated_days INTEGER,
  route_status VARCHAR(50) DEFAULT 'pending',
  
  -- Additional Information
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for shipping routes
CREATE INDEX idx_shipping_routes_user_id ON shipping_routes(user_id);
CREATE INDEX idx_shipping_routes_shipment_id ON shipping_routes(shipment_id);
CREATE INDEX idx_shipping_routes_origin_destination ON shipping_routes(origin_city, destination_city);

-- Enable Row Level Security
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_routes ENABLE ROW LEVEL SECURITY;

-- Create policies for shipments
CREATE POLICY "Users can view their own shipments"
  ON shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipments"
  ON shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments"
  ON shipments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipments"
  ON shipments FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for shipment_tracking_history
CREATE POLICY "Users can view tracking history for their shipments"
  ON shipment_tracking_history FOR SELECT
  USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE user_id = auth.uid()
    )
  );

-- Create policies for address_history
CREATE POLICY "Users can view history for their addresses"
  ON address_history FOR SELECT
  USING (auth.uid() = user_id);

-- Create policies for shipping_partners
CREATE POLICY "Users can view their own partners"
  ON shipping_partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own partners"
  ON shipping_partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own partners"
  ON shipping_partners FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for shipping_routes
CREATE POLICY "Users can view their own routes"
  ON shipping_routes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own routes"
  ON shipping_routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routes"
  ON shipping_routes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
