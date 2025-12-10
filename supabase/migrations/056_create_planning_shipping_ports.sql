-- Migration 056: Create planning_shipping_ports table for planning page
-- This is a dedicated table specifically for the /planning page shipping ports

-- Create the planning_shipping_ports table
CREATE TABLE IF NOT EXISTS public.planning_shipping_ports (
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
  country_code VARCHAR(5) CHECK (country_code IN ('PH', 'CN')),
  
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
  
  -- Rate Fields (PHP Currency)
  handling_fee_php_per_kg DECIMAL(10, 2) DEFAULT 25.00,
  handling_fee_php_per_teu DECIMAL(10, 2) DEFAULT 5000.00,
  handling_fee_php_per_cbm DECIMAL(10, 2) DEFAULT 500.00,
  documentation_fee_php DECIMAL(10, 2) DEFAULT 2000.00,
  port_authority_fee_php DECIMAL(10, 2) DEFAULT 5000.00,
  security_fee_php DECIMAL(10, 2) DEFAULT 1500.00,
  customs_clearance_fee_php DECIMAL(10, 2) DEFAULT 3000.00,
  import_surcharge_percentage DECIMAL(5, 2) DEFAULT 10.00,
  export_surcharge_percentage DECIMAL(5, 2) DEFAULT 5.00,
  
  -- Marker Styling
  marker_color VARCHAR(50) DEFAULT 'red',
  
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
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_city ON planning_shipping_ports(city);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_province ON planning_shipping_ports(province);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_region ON planning_shipping_ports(region);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_coordinates ON planning_shipping_ports(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_status ON planning_shipping_ports(status);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_port_type ON planning_shipping_ports(port_type);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_country_code ON planning_shipping_ports(country_code);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_is_public ON planning_shipping_ports(is_public);
CREATE INDEX IF NOT EXISTS idx_planning_shipping_ports_updated_at ON planning_shipping_ports(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE planning_shipping_ports ENABLE ROW LEVEL SECURITY;

-- RLS Policies - everyone can read public ports
CREATE POLICY "planning_shipping_ports_public_read" ON planning_shipping_ports
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "planning_shipping_ports_authenticated_create" ON planning_shipping_ports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "planning_shipping_ports_owner_update" ON planning_shipping_ports
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "planning_shipping_ports_owner_delete" ON planning_shipping_ports
  FOR DELETE
  USING (auth.uid() = created_by);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_planning_shipping_ports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on every modification
DROP TRIGGER IF EXISTS planning_shipping_ports_update_timestamp ON planning_shipping_ports;
CREATE TRIGGER planning_shipping_ports_update_timestamp
BEFORE UPDATE ON planning_shipping_ports
FOR EACH ROW
EXECUTE FUNCTION update_planning_shipping_ports_updated_at();

-- Insert Philippines ports
INSERT INTO planning_shipping_ports (
  name, description, status, latitude, longitude, city, province, region, country,
  country_code, port_code, port_type, berth_count, max_depth_meters, max_vessel_length_meters,
  annual_capacity_teu, container_terminal, ro_ro_services, breakbulk_services, bulk_cargo,
  handling_fee_php_per_kg, handling_fee_php_per_teu, handling_fee_php_per_cbm,
  documentation_fee_php, port_authority_fee_php, security_fee_php, customs_clearance_fee_php,
  import_surcharge_percentage, export_surcharge_percentage, marker_color, is_public, metadata
) VALUES
  (
    'Port of Manila (South Harbor)',
    'Main international container port serving Metro Manila',
    'active',
    14.5879, 120.8578,
    'Manila', 'Metro Manila', 'NCR', 'Philippines',
    'PH', 'MNL', 'international',
    15, 14.0, 300.0,
    2000000,
    true, true, true, true,
    30.00, 8000.00, 600.00,
    2500.00, 6000.00, 2000.00, 3500.00,
    12.00, 6.00, 'red', true,
    '{"facilities": ["Container Terminal", "Multipurpose Berths"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of Cebu',
    'Primary seaport in Central Visayas region',
    'active',
    10.3157, 123.8854,
    'Cebu', 'Cebu', 'VII', 'Philippines',
    'PH', 'CEBUPRT', 'international',
    10, 13.0, 280.0,
    1800000,
    true, true, true, true,
    28.00, 7500.00, 550.00,
    2200.00, 5500.00, 1800.00, 3200.00,
    11.00, 5.50, 'red', true,
    '{"facilities": ["Container Terminal", "General Cargo"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of Iloilo',
    'Significant port serving Panay Island and surrounding regions',
    'active',
    10.6920, 122.5637,
    'Iloilo', 'Iloilo', 'VI', 'Philippines',
    'PH', 'ILOILO', 'domestic',
    8, 12.0, 250.0,
    800000,
    true, false, true, true,
    28.00, 7500.00, 550.00,
    2200.00, 5500.00, 1800.00, 3200.00,
    11.00, 5.50, 'red', true,
    '{"facilities": ["General Cargo", "Container", "RoRo"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of Davao',
    'Major port in Mindanao serving the southern region',
    'active',
    7.1315, 125.6368,
    'Davao', 'Davao City', 'XI', 'Philippines',
    'PH', 'DAVAO', 'international',
    10, 13.5, 290.0,
    1500000,
    true, true, true, true,
    30.00, 8000.00, 600.00,
    2500.00, 6000.00, 2000.00, 3500.00,
    12.00, 6.00, 'red', true,
    '{"facilities": ["Container Terminal", "General Cargo", "Bulk"], "operator": "Philippine Ports Authority"}'
  ),
  (
    'Port of General Santos',
    'Strategic port in Southern Mindanao',
    'active',
    6.1130, 125.1616,
    'General Santos', 'South Cotabato', 'XII', 'Philippines',
    'PH', 'GSC', 'domestic',
    6, 12.0, 220.0,
    600000,
    true, false, true, true,
    28.00, 7500.00, 550.00,
    2200.00, 5500.00, 1800.00, 3200.00,
    11.00, 5.50, 'red', true,
    '{"facilities": ["General Cargo", "Bulk"], "operator": "Philippine Ports Authority"}'
  );

-- Insert Chinese ports
INSERT INTO planning_shipping_ports (
  name, description, status, latitude, longitude, city, province, region, country,
  country_code, port_code, port_type, berth_count, max_depth_meters, max_vessel_length_meters,
  annual_capacity_teu, container_terminal, ro_ro_services, breakbulk_services, bulk_cargo,
  refrigerated_containers, dangerous_cargo,
  contact_phone, website,
  handling_fee_php_per_kg, handling_fee_php_per_teu, handling_fee_php_per_cbm,
  documentation_fee_php, port_authority_fee_php, security_fee_php, customs_clearance_fee_php,
  import_surcharge_percentage, export_surcharge_percentage, marker_color, is_public, metadata
) VALUES
  (
    'Port of Shanghai',
    'World''s largest container port, primary import/export hub for China',
    'active',
    30.9176, 121.6372,
    'Shanghai', 'Shanghai', 'East China', 'China',
    'CN', 'SHA', 'international',
    128, 15.0, 400.0,
    4400000,
    true, true, true, true, true, true,
    '+86 21 6858-8888',
    'https://www.portshanghai.com.cn',
    18.00, 3500.00, 350.00,
    1500.00, 2500.00, 800.00, 1200.00,
    8.00, 4.00, 'blue', true,
    '{"facilities": ["Container Terminal", "Bulk Terminal", "General Cargo"], "operator": "Shanghai Port Group", "specialization": "containers"}'
  ),
  (
    'Port of Shenzhen',
    'Major container port serving southern China, key gateway to Southeast Asia',
    'active',
    22.6328, 113.9352,
    'Shenzhen', 'Guangdong', 'South China', 'China',
    'CN', 'SZX', 'international',
    70, 13.5, 365.0,
    1400000,
    true, true, true, true, true, true,
    '+86 755 2568-9888',
    'https://www.portshenzhen.com',
    16.00, 3200.00, 320.00,
    1300.00, 2300.00, 700.00, 1100.00,
    7.00, 3.50, 'blue', true,
    '{"facilities": ["Container Terminal", "Breakbulk", "Ro-Ro"], "operator": "Shenzhen Port Group", "specialization": "containers"}'
  ),
  (
    'Port of Ningbo-Zhoushan',
    'Third largest container port, serves Yangtze River Delta region',
    'active',
    29.9683, 121.8347,
    'Ningbo', 'Zhejiang', 'East China', 'China',
    'CN', 'NGB', 'international',
    80, 14.5, 380.0,
    2800000,
    true, true, true, true, true, true,
    '+86 574 8686-8888',
    'https://www.nbzs-port.com',
    16.50, 3400.00, 340.00,
    1400.00, 2600.00, 750.00, 1150.00,
    7.50, 3.75, 'blue', true,
    '{"facilities": ["Container Terminal", "Dry Bulk Terminal"], "operator": "Ningbo Zhoushan Port Group", "specialization": "containers+bulk"}'
  ),
  (
    'Port of Qingdao',
    'North China major port, deep-water natural harbor',
    'active',
    35.7506, 120.6936,
    'Qingdao', 'Shandong', 'North China', 'China',
    'CN', 'QDG', 'international',
    60, 13.0, 350.0,
    2100000,
    true, true, true, true, true, true,
    '+86 532 8888-8888',
    'https://www.qdport.com',
    15.50, 3100.00, 310.00,
    1250.00, 2400.00, 700.00, 1050.00,
    6.50, 3.25, 'blue', true,
    '{"facilities": ["Container Terminal", "Coal Terminal", "Ore Terminal"], "operator": "Qingdao Port Group", "specialization": "containers+bulk"}'
  ),
  (
    'Port of Tianjin',
    'Major northern port serving Beijing region',
    'active',
    38.9995, 117.7032,
    'Tianjin', 'Tianjin', 'North China', 'China',
    'CN', 'TJN', 'international',
    53, 12.5, 340.0,
    1900000,
    true, true, true, true, true, true,
    '+86 22 6568-8888',
    'https://www.tianjinport.com.cn',
    16.00, 3300.00, 330.00,
    1350.00, 2500.00, 750.00, 1150.00,
    7.00, 3.50, 'blue', true,
    '{"facilities": ["Container Terminal", "Heavy Lift"], "operator": "Tianjin Port Group", "specialization": "containers"}'
  ),
  (
    'Port of Guangzhou',
    'Key inland port on Pearl River Delta, serves Guangdong region',
    'active',
    23.1291, 113.3234,
    'Guangzhou', 'Guangdong', 'South China', 'China',
    'CN', 'CAN', 'international',
    75, 12.0, 330.0,
    2200000,
    true, true, true, true, true, true,
    '+86 20 8278-8888',
    'https://www.guangzhouport.com',
    17.00, 3600.00, 360.00,
    1450.00, 2700.00, 800.00, 1200.00,
    8.00, 4.00, 'blue', true,
    '{"facilities": ["Container Terminal", "Vehicle Terminal"], "operator": "Guangzhou Port Group", "specialization": "containers+vehicles"}'
  ),
  (
    'Port of Dalian',
    'Natural deep-water port in northeastern China',
    'active',
    38.9140, 121.6147,
    'Dalian', 'Liaoning', 'North China', 'China',
    'CN', 'DLC', 'international',
    45, 13.0, 330.0,
    1500000,
    true, true, true, true, true, true,
    '+86 411 8766-8888',
    'https://www.dlport.com',
    15.00, 3000.00, 300.00,
    1200.00, 2300.00, 700.00, 1000.00,
    6.00, 3.00, 'blue', true,
    '{"facilities": ["Container Terminal", "Ore Terminal"], "operator": "Dalian Port Group", "specialization": "containers+bulk"}'
  ),
  (
    'Port of Xiamen',
    'Major container port in southeastern China, Free Trade Zone',
    'active',
    24.4798, 117.8796,
    'Xiamen', 'Fujian', 'Southeast China', 'China',
    'CN', 'XMN', 'international',
    48, 11.5, 320.0,
    1200000,
    true, true, true, true, true, true,
    '+86 592 5085-8888',
    'https://www.xmport.com',
    16.00, 3300.00, 330.00,
    1300.00, 2400.00, 750.00, 1100.00,
    7.00, 3.50, 'blue', true,
    '{"facilities": ["Container Terminal", "General Cargo"], "operator": "Xiamen Port Authority", "specialization": "containers"}'
  ),
  (
    'Port of Suzhou',
    'Modern container port in Jiangsu province',
    'active',
    31.8063, 121.2489,
    'Suzhou', 'Jiangsu', 'East China', 'China',
    'CN', 'SUZ', 'international',
    40, 12.0, 310.0,
    800000,
    true, true, true, true, true, true,
    '+86 512 6826-8888',
    'https://www.szport.com',
    16.50, 3250.00, 325.00,
    1300.00, 2350.00, 700.00, 1050.00,
    6.50, 3.25, 'blue', true,
    '{"facilities": ["Container Terminal"], "operator": "Suzhou Port Group", "specialization": "containers"}'
  ),
  (
    'Port of Nantong',
    'Rapidly developing port on Yangtze River',
    'active',
    32.0016, 120.8955,
    'Nantong', 'Jiangsu', 'East China', 'China',
    'CN', 'NTG', 'domestic',
    35, 11.0, 300.0,
    600000,
    true, false, true, true, true, true,
    '+86 513 8503-8888',
    'https://www.ntport.com.cn',
    15.50, 3000.00, 300.00,
    1200.00, 2200.00, 650.00, 950.00,
    6.00, 3.00, 'blue', true,
    '{"facilities": ["Container Terminal", "Breakbulk"], "operator": "Nantong Port Group", "specialization": "containers"}'
  ),
  (
    'Port of Wuhan',
    'Largest inland port on Yangtze River',
    'active',
    30.5965, 114.3055,
    'Wuhan', 'Hubei', 'Central China', 'China',
    'CN', 'WHU', 'domestic',
    50, 9.0, 200.0,
    500000,
    true, false, true, true, true, false,
    '+86 27 8282-8888',
    'https://www.wuhanuport.com.cn',
    14.00, 2800.00, 280.00,
    1100.00, 2100.00, 600.00, 900.00,
    5.00, 2.50, 'blue', true,
    '{"facilities": ["General Cargo", "Breakbulk"], "operator": "Wuhan Port Group", "specialization": "general_cargo"}'
  );
