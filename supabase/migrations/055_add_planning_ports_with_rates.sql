-- Migration 055: Add planning_ports with rates and fees for Philippines and China ports

-- Add new columns to shipping_ports if they don't exist
ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT 'PH' CHECK (country_code IN ('PH', 'CN'));

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS handling_fee_php_per_kg DECIMAL(10, 2) DEFAULT 25.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS handling_fee_php_per_teu DECIMAL(10, 2) DEFAULT 5000.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS handling_fee_php_per_cbm DECIMAL(10, 2) DEFAULT 500.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS documentation_fee_php DECIMAL(10, 2) DEFAULT 2000.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS port_authority_fee_php DECIMAL(10, 2) DEFAULT 5000.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS security_fee_php DECIMAL(10, 2) DEFAULT 1500.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS customs_clearance_fee_php DECIMAL(10, 2) DEFAULT 3000.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS import_surcharge_percentage DECIMAL(5, 2) DEFAULT 10.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS export_surcharge_percentage DECIMAL(5, 2) DEFAULT 5.00;

ALTER TABLE IF EXISTS shipping_ports 
ADD COLUMN IF NOT EXISTS marker_color VARCHAR(50) DEFAULT 'red';

-- Create index for country lookups
CREATE INDEX IF NOT EXISTS idx_shipping_ports_country_code ON shipping_ports(country_code);
CREATE INDEX IF NOT EXISTS idx_shipping_ports_country_status ON shipping_ports(country_code, status);

-- Update existing Philippines ports
UPDATE shipping_ports 
SET 
  country_code = 'PH',
  marker_color = 'red',
  handling_fee_php_per_kg = 30.00,
  handling_fee_php_per_teu = 8000.00,
  handling_fee_php_per_cbm = 600.00,
  documentation_fee_php = 2500.00,
  port_authority_fee_php = 6000.00,
  security_fee_php = 2000.00,
  customs_clearance_fee_php = 3500.00,
  import_surcharge_percentage = 12.00,
  export_surcharge_percentage = 6.00
WHERE name LIKE '%Manila%' OR name LIKE '%Cebu%' OR name LIKE '%Iloilo%' OR name LIKE '%Davao%' OR name LIKE '%General Santos%';

-- Add major Chinese shipping ports
INSERT INTO shipping_ports (
  name, description, status, latitude, longitude, city, province, region, country,
  country_code, port_code, port_type, berth_count, max_depth_meters, max_vessel_length_meters,
  annual_capacity_teu, container_terminal, ro_ro_services, breakbulk_services, bulk_cargo,
  refrigerated_containers, dangerous_cargo, contact_phone, website, is_public,
  handling_fee_php_per_kg, handling_fee_php_per_teu, handling_fee_php_per_cbm,
  documentation_fee_php, port_authority_fee_php, security_fee_php, customs_clearance_fee_php,
  import_surcharge_percentage, export_surcharge_percentage, marker_color, metadata
) VALUES
  -- Shanghai Ports
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
    true,
    18.00, 3500.00, 350.00,
    1500.00, 2500.00, 800.00, 1200.00,
    8.00, 4.00, 'blue',
    '{"facilities": ["Container Terminal", "Bulk Terminal", "General Cargo"], "operator": "Shanghai Port Group", "specialization": "containers"}'
  ),
  -- Shenzhen Ports
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
    true,
    16.00, 3200.00, 320.00,
    1300.00, 2300.00, 700.00, 1100.00,
    7.00, 3.50, 'blue',
    '{"facilities": ["Container Terminal", "Breakbulk", "Ro-Ro"], "operator": "Shenzhen Port Group", "specialization": "containers"}'
  ),
  -- Ningbo-Zhoushan Ports
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
    true,
    16.50, 3400.00, 340.00,
    1400.00, 2600.00, 750.00, 1150.00,
    7.50, 3.75, 'blue',
    '{"facilities": ["Container Terminal", "Dry Bulk Terminal"], "operator": "Ningbo Zhoushan Port Group", "specialization": "containers+bulk"}'
  ),
  -- Qingdao Port
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
    true,
    15.50, 3100.00, 310.00,
    1250.00, 2400.00, 700.00, 1050.00,
    6.50, 3.25, 'blue',
    '{"facilities": ["Container Terminal", "Coal Terminal", "Ore Terminal"], "operator": "Qingdao Port Group", "specialization": "containers+bulk"}'
  ),
  -- Tianjin Port
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
    true,
    16.00, 3300.00, 330.00,
    1350.00, 2500.00, 750.00, 1150.00,
    7.00, 3.50, 'blue',
    '{"facilities": ["Container Terminal", "Heavy Lift"], "operator": "Tianjin Port Group", "specialization": "containers"}'
  ),
  -- Guangzhou Port
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
    true,
    17.00, 3600.00, 360.00,
    1450.00, 2700.00, 800.00, 1200.00,
    8.00, 4.00, 'blue',
    '{"facilities": ["Container Terminal", "Vehicle Terminal"], "operator": "Guangzhou Port Group", "specialization": "containers+vehicles"}'
  ),
  -- Dalian Port
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
    true,
    15.00, 3000.00, 300.00,
    1200.00, 2300.00, 700.00, 1000.00,
    6.00, 3.00, 'blue',
    '{"facilities": ["Container Terminal", "Ore Terminal"], "operator": "Dalian Port Group", "specialization": "containers+bulk"}'
  ),
  -- Xiamen Port
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
    true,
    16.00, 3300.00, 330.00,
    1300.00, 2400.00, 750.00, 1100.00,
    7.00, 3.50, 'blue',
    '{"facilities": ["Container Terminal", "General Cargo"], "operator": "Xiamen Port Authority", "specialization": "containers"}'
  ),
  -- Suzhou Port (Yangshan)
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
    true,
    16.50, 3250.00, 325.00,
    1300.00, 2350.00, 700.00, 1050.00,
    6.50, 3.25, 'blue',
    '{"facilities": ["Container Terminal"], "operator": "Suzhou Port Group", "specialization": "containers"}'
  ),
  -- Nantong Port
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
    true,
    15.50, 3000.00, 300.00,
    1200.00, 2200.00, 650.00, 950.00,
    6.00, 3.00, 'blue',
    '{"facilities": ["Container Terminal", "Breakbulk"], "operator": "Nantong Port Group", "specialization": "containers"}'
  ),
  -- Wuhan Port
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
    true,
    14.00, 2800.00, 280.00,
    1100.00, 2100.00, 600.00, 900.00,
    5.00, 2.50, 'blue',
    '{"facilities": ["General Cargo", "Breakbulk"], "operator": "Wuhan Port Group", "specialization": "general_cargo"}'
  );

-- Update existing Philippines ports with accurate rates if not already updated
UPDATE shipping_ports 
SET 
  country_code = 'PH',
  marker_color = 'red',
  handling_fee_php_per_kg = 28.00,
  handling_fee_php_per_teu = 7500.00,
  handling_fee_php_per_cbm = 550.00,
  documentation_fee_php = 2200.00,
  port_authority_fee_php = 5500.00,
  security_fee_php = 1800.00,
  customs_clearance_fee_php = 3200.00,
  import_surcharge_percentage = 11.00,
  export_surcharge_percentage = 5.50
WHERE country_code IS NULL OR country_code = '';
