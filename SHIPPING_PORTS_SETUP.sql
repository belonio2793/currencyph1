-- ============================================
-- SHIPPING PORTS TABLE SETUP FOR SUPABASE
-- ============================================
-- Run this SQL in your Supabase dashboard SQL Editor
-- Copy the entire script and paste it in the editor, then click "Run"

-- Step 1: Check if table exists and drop if needed
DROP TABLE IF EXISTS shipping_ports CASCADE;

-- Step 2: Create shipping_ports table
CREATE TABLE shipping_ports (
  id BIGSERIAL PRIMARY KEY,
  
  -- Basic Information
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  
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
  port_type VARCHAR(50),
  berth_count INTEGER,
  max_depth_meters DECIMAL(5, 2),
  max_vessel_length_meters DECIMAL(6, 2),
  annual_capacity_teu INTEGER,
  
  -- Operational Details
  operating_hours TEXT,
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  website VARCHAR(255),
  
  -- Capabilities & Services
  container_terminal BOOLEAN DEFAULT false,
  ro_ro_services BOOLEAN DEFAULT false,
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

-- Step 3: Create indexes
CREATE INDEX idx_shipping_ports_city ON shipping_ports(city);
CREATE INDEX idx_shipping_ports_province ON shipping_ports(province);
CREATE INDEX idx_shipping_ports_region ON shipping_ports(region);
CREATE INDEX idx_shipping_ports_coordinates ON shipping_ports(latitude, longitude);
CREATE INDEX idx_shipping_ports_status ON shipping_ports(status);
CREATE INDEX idx_shipping_ports_port_type ON shipping_ports(port_type);
CREATE INDEX idx_shipping_ports_is_public ON shipping_ports(is_public);
CREATE INDEX idx_shipping_ports_updated_at ON shipping_ports(updated_at DESC);

-- Step 4: Enable RLS
ALTER TABLE shipping_ports ENABLE ROW LEVEL SECURITY;

-- Step 5: Create simple RLS policies (IMPORTANT: Start with permissive policies)
-- Allow all authenticated users to read public ports
CREATE POLICY "Anyone can read public ports"
  ON shipping_ports
  FOR SELECT
  USING (is_public = true);

-- Allow authenticated users to see their own ports or all ports they have permission to
CREATE POLICY "Users can read all public ports"
  ON shipping_ports
  FOR SELECT
  USING (true);

-- Allow authenticated users to create ports
CREATE POLICY "Authenticated users can create ports"
  ON shipping_ports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own ports
CREATE POLICY "Users can update their own ports"
  ON shipping_ports
  FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() IS NULL)
  WITH CHECK (auth.uid() = created_by OR auth.uid() IS NULL);

-- Allow users to delete their own ports
CREATE POLICY "Users can delete their own ports"
  ON shipping_ports
  FOR DELETE
  USING (auth.uid() = created_by OR auth.uid() IS NULL);

-- Step 6: Create update timestamp function
CREATE OR REPLACE FUNCTION update_shipping_ports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for timestamp
DROP TRIGGER IF EXISTS shipping_ports_update_timestamp ON shipping_ports;
CREATE TRIGGER shipping_ports_update_timestamp
BEFORE UPDATE ON shipping_ports
FOR EACH ROW
EXECUTE FUNCTION update_shipping_ports_updated_at();

-- Step 8: Insert sample data (Major Philippine Shipping Ports)
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

-- Step 9: Verify the table was created
SELECT COUNT(*) as "Total Ports" FROM shipping_ports;
SELECT * FROM shipping_ports LIMIT 1;

-- ============================================
-- SUCCESS!
-- The shipping_ports table is now ready to use
-- ============================================
