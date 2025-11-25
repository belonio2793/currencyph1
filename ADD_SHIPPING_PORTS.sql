-- Insert 6 additional major Philippine shipping ports
-- These are some of the most important ports for import/export in the Philippines

INSERT INTO shipping_ports (
  name, description, status, latitude, longitude, city, province, region, 
  address, port_code, port_type, berth_count, max_depth_meters, max_vessel_length_meters, 
  annual_capacity_teu, container_terminal, ro_ro_services, breakbulk_services, 
  bulk_cargo, refrigerated_containers, dangerous_cargo, contact_phone, contact_email, 
  website, is_public, metadata
) VALUES
-- Port of Manila (South Harbor) - largest and busiest port
(
  'Port of Manila (South Harbor)',
  'The largest and busiest port in the Philippines, serving as the main international gateway for Metro Manila. Handles containerized cargo, breakbulk, and general cargo. Over 4.5 million TEUs annually.',
  'active',
  14.5879, 120.8578,
  'Manila', 'Metro Manila', 'NCR',
  'South Harbor, Port Area, Manila 1000',
  'MNL',
  'international',
  15, 14.0, 300.0,
  2000000,
  true, true, true, false, false, true,
  '+63 2 5279-5555', 'info@portofmanila.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"Container Terminal, RoRo Terminal, Breakbulk Berths","annual_volume_tons":75000000}'
),

-- Port of Manila (North Harbor)
(
  'Port of Manila (North Harbor)',
  'Secondary harbor of Port Manila serving general cargo, breakbulk, and passenger operations. Important alternative container gateway with extensive cargo handling capabilities.',
  'active',
  14.6158, 120.8608,
  'Manila', 'Metro Manila', 'NCR',
  'North Harbor, Port Area, Manila 1000',
  'MNL-NH',
  'international',
  18, 13.0, 280.0,
  1500000,
  true, true, true, true, true, true,
  '+63 2 5279-5555', 'info@portofmanila.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"General Cargo Berths, RoRo Terminal, Break-in-Bulk","annual_volume_tons":65000000}'
),

-- Port of Iloilo
(
  'Port of Iloilo',
  'Safe natural harbor serving the Visayas region. Gateway for the Central Visayas and the entire Panay Island. Equipped with modern container and general cargo terminals with significant ferry operations.',
  'active',
  10.6899, 122.5659,
  'Iloilo City', 'Iloilo', 'Region VI',
  'National Highway, Iloilo City',
  'ILO',
  'international',
  12, 12.0, 250.0,
  350000,
  true, true, true, true, false, false,
  '+63 33 335-8000', 'inquiries@iloiloport.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"Container Terminal, General Cargo Terminal, Ferry Terminal","annual_volume_tons":5000000}'
),

-- Port of Zamboanga
(
  'Port of Zamboanga',
  'Major port serving Southern Philippines and Mindanao. Center for sardine exports and general cargo operations. Strategic hub for trade with 19 functional docks supporting various cargo types.',
  'active',
  6.8988, 122.0724,
  'Zamboanga City', 'Zamboanga del Sur', 'Region IX',
  'Port Road, Zamboanga City',
  'ZAM',
  'international',
  12, 11.0, 240.0,
  280000,
  true, true, true, true, false, true,
  '+63 62 991-3261', 'info@zamboangaport.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"General Cargo Terminal, Ro-Ro Services, Cold Storage","annual_volume_tons":3500000}'
),

-- Port of Batangas
(
  'Port of Batangas',
  'Strategic international gateway south of Manila serving domestic and international trade. Modern facilities for container, breakbulk, and project cargo handling with dedicated liquid bulk terminal.',
  'active',
  13.7584, 121.1841,
  'Batangas City', 'Batangas', 'CALABARZON',
  'Port Area, Batangas City',
  'BAN',
  'international',
  14, 12.0, 260.0,
  450000,
  true, true, true, true, true, false,
  '+63 43 740-0251', 'portadmin@batangasport.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"Container Terminal, Breakbulk Terminal, Liquid Bulk Terminal","annual_volume_tons":8000000}'
),

-- Port of Cagayan de Oro
(
  'Port of Cagayan de Oro',
  'Strategic gateway for Northern Mindanao and major commercial hub. Home to the Mindanao International Container Port with state-of-the-art facilities for containerized cargo and general cargo operations.',
  'active',
  8.4866, 124.6348,
  'Cagayan de Oro City', 'Misamis Oriental', 'Region X',
  'Port Road, Cagayan de Oro City',
  'CDO',
  'international',
  10, 11.5, 230.0,
  320000,
  true, true, true, true, false, false,
  '+63 88 857-0266', 'info@cdoport.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"Container Terminal, General Cargo, Ferry Terminal","annual_volume_tons":4500000}'
),

-- Port of Puerto Princesa
(
  'Port of Puerto Princesa',
  'Major port of entry for the island-province of Palawan. Hub for regional transport and trade serving the island''s vast tourism and agricultural industries with container and general cargo facilities.',
  'active',
  9.7424, 118.7292,
  'Puerto Princesa City', 'Palawan', 'MIMAROPA',
  'Rizal Avenue, Puerto Princesa City',
  'PPS',
  'international',
  8, 10.0, 220.0,
  180000,
  true, true, true, false, false, false,
  '+63 48 434-3140', 'info@ppport.ph', 'https://www.ppa.com.ph',
  true,
  '{"operator":"Philippine Ports Authority","facilities":"General Cargo Terminal, Container Berth, Ferry Terminal","annual_volume_tons":2500000}'
);

-- Verify the insertion
SELECT COUNT(*) as total_ports, 
       COUNT(CASE WHEN port_type = 'international' THEN 1 END) as international_ports,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_ports
FROM shipping_ports
WHERE is_public = true;
