-- Create shipping_ports table for public maritime port data
CREATE TABLE IF NOT EXISTS shipping_ports (
  id BIGSERIAL PRIMARY KEY,
  
  -- Basic Information
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, under_maintenance
  
  -- Geographic Information
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  region VARCHAR(255),
  province VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  country VARCHAR(100) DEFAULT 'Philippines',
  address TEXT,
  
  -- Port Details
  port_code VARCHAR(50) UNIQUE,
  port_type VARCHAR(50), -- international, domestic, private, etc.
  berth_count INTEGER,
  max_depth_meters DECIMAL(5, 2),
  max_vessel_length_meters DECIMAL(6, 2),
  annual_capacity_teu INTEGER, -- TEU = Twenty-foot Equivalent Unit for containers
  
  -- Operational Details
  operating_hours TEXT, -- JSON or simple text
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  website VARCHAR(255),
  
  -- Capabilities & Services
  container_terminal BOOLEAN DEFAULT false,
  ro_ro_services BOOLEAN DEFAULT false, -- Roll-on/Roll-off for vehicles
  breakbulk_services BOOLEAN DEFAULT false,
  bulk_cargo BOOLEAN DEFAULT false,
  refrigerated_containers BOOLEAN DEFAULT false,
  dangerous_cargo BOOLEAN DEFAULT false,
  
  -- Metadata
  is_public BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_coordinates CHECK (
    latitude >= -90 AND latitude <= 90 AND 
    longitude >= -180 AND longitude <= 180
  )
);

-- Create indexes for optimal query performance
CREATE INDEX idx_shipping_ports_city ON shipping_ports(city);
CREATE INDEX idx_shipping_ports_province ON shipping_ports(province);
CREATE INDEX idx_shipping_ports_region ON shipping_ports(region);
CREATE INDEX idx_shipping_ports_coordinates ON shipping_ports(latitude, longitude);
CREATE INDEX idx_shipping_ports_status ON shipping_ports(status);
CREATE INDEX idx_shipping_ports_port_type ON shipping_ports(port_type);
CREATE INDEX idx_shipping_ports_is_public ON shipping_ports(is_public);
CREATE INDEX idx_shipping_ports_updated_at ON shipping_ports(updated_at DESC);
CREATE INDEX idx_shipping_ports_name_gin ON shipping_ports USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Enable Row Level Security
ALTER TABLE shipping_ports ENABLE ROW LEVEL SECURITY;

-- Public READ policy - everyone can see public ports
CREATE POLICY "shipping_ports_public_read" ON shipping_ports
  FOR SELECT
  USING (is_public = true);

-- Admin CREATE policy - only authenticated users can create (will add role checks later)
CREATE POLICY "shipping_ports_authenticated_create" ON shipping_ports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admin UPDATE policy - users can update ports they created
CREATE POLICY "shipping_ports_owner_update" ON shipping_ports
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Admin DELETE policy
CREATE POLICY "shipping_ports_owner_delete" ON shipping_ports
  FOR DELETE
  USING (auth.uid() = created_by);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shipping_ports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on every modification
CREATE TRIGGER shipping_ports_update_timestamp
BEFORE UPDATE ON shipping_ports
FOR EACH ROW
EXECUTE FUNCTION update_shipping_ports_updated_at();

-- Sample data: Add major Philippine shipping ports
INSERT INTO shipping_ports (
  name, description, status, latitude, longitude, city, province, region,
  port_code, port_type, berth_count, max_depth_meters, max_vessel_length_meters,
  annual_capacity_teu, container_terminal, ro_ro_services, breakbulk_services,
  contact_phone, website, is_public, metadata
) VALUES
  (
    'Port of Manila (South Harbor)',
    'Main international container port serving Metro Manila',
    'active',
    14.5879, 120.8578,
    'Manila', 'Metro Manila', 'NCR',
    'MNL', 'international',
    15, 14.0, 300.0,
    2000000,
    true, true, true,
    '+63 2 5279-5555',
    'https://www.ppa.com.ph',
    true,
    '{"facilities": ["Container Terminal", "Multipurpose Berths"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of Cebu',
    'Primary seaport in Central Visayas region',
    'active',
    10.3157, 123.8854,
    'Cebu', 'Cebu', 'VII',
    'CEBUPRT', 'international',
    10, 13.0, 280.0,
    1800000,
    true, true, true,
    '+63 32 232-2600',
    'https://www.ppa.com.ph',
    true,
    '{"facilities": ["Container Terminal", "General Cargo"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of Iloilo',
    'Significant port serving Panay Island and surrounding regions',
    'active',
    10.6920, 122.5637,
    'Iloilo', 'Iloilo', 'VI',
    'ILOILO', 'domestic',
    8, 12.0, 250.0,
    800000,
    true, false, true,
    '+63 33 335-0100',
    'https://www.ppa.com.ph',
    true,
    '{"facilities": ["General Cargo", "Container", "RoRo"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of Davao',
    'Major port in Mindanao serving the southern region',
    'active',
    7.1315, 125.6368,
    'Davao', 'Davao City', 'XI',
    'DAVAO', 'international',
    10, 13.5, 290.0,
    1500000,
    true, true, true,
    '+63 82 227-2020',
    'https://www.ppa.com.ph',
    true,
    '{"facilities": ["Container Terminal", "General Cargo", "Bulk"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of General Santos',
    'Strategic port in Southern Mindanao',
    'active',
    6.1130, 125.1616,
    'General Santos', 'South Cotabato', 'XII',
    'GSC', 'domestic',
    6, 12.0, 220.0,
    600000,
    true, false, true,
    '+63 83 552-5025',
    'https://www.ppa.com.ph',
    true,
    '{"facilities": ["General Cargo", "Bulk"], "operator": "Philippine Ports Authority"}'
  );
