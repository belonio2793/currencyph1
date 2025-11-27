-- Create demo shipment
INSERT INTO addresses_shipment_labels (
  id,
  user_id,
  serial_id,
  package_name,
  package_description,
  package_weight,
  package_dimensions,
  status,
  notes,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users LIMIT 1),
  'DEMO-2024-001',
  'Electronics Bundle',
  'Mixed electronics including laptop accessories, phone charger, and USB cables',
  2.5,
  '30x25x15 cm',
  'in-transit',
  'Demo shipment for testing the tracking system',
  NOW(),
  NOW()
) RETURNING id INTO @shipment_id;

-- Store the shipment ID for reference in checkpoints
-- Create tracking checkpoints
INSERT INTO addresses_shipment_tracking (
  shipment_id,
  checkpoint_name,
  checkpoint_type,
  status,
  latitude,
  longitude,
  location_address,
  scanned_by_user_id,
  notes,
  created_at
) 
SELECT
  (SELECT id FROM addresses_shipment_labels WHERE serial_id = 'DEMO-2024-001' LIMIT 1) as shipment_id,
  checkpoint_name,
  checkpoint_type,
  status,
  latitude,
  longitude,
  location_address,
  (SELECT id FROM auth.users LIMIT 1) as scanned_by_user_id,
  notes,
  created_at
FROM (
  VALUES
    ('Origin - Manila Hub', 'origin', 'scanned', 14.5994, 120.9842, 'Manila Distribution Center, Quezon City, Philippines', 'Package received and sorted', NOW() - INTERVAL '48 hours'),
    ('In Transit - Batangas Port', 'waypoint', 'in-transit', 13.7631, 120.9427, 'Batangas Port Terminal, Batangas City, Philippines', 'Package loaded onto ferry', NOW() - INTERVAL '36 hours'),
    ('In Transit - Cebu Port', 'waypoint', 'in-transit', 10.3157, 123.8854, 'Cebu Port Authority, Cebu City, Philippines', 'Package arrived at destination port', NOW() - INTERVAL '24 hours'),
    ('Local Delivery - Cebu Distribution Hub', 'waypoint', 'in-transit', 10.3226, 123.9008, 'Cebu Regional Distribution Center, Cebu City, Philippines', 'Package in local delivery queue', NOW() - INTERVAL '12 hours'),
    ('Out for Delivery', 'waypoint', 'in-transit', 10.3356, 123.9119, 'Banilad, Cebu City, Philippines', 'Package out for delivery with driver', NOW() - INTERVAL '2 hours')
) AS checkpoints(checkpoint_name, checkpoint_type, status, latitude, longitude, location_address, notes, created_at);

-- Verify insertion
SELECT 
  'Shipment Created' as status,
  serial_id,
  package_name,
  package_weight,
  (SELECT COUNT(*) FROM addresses_shipment_tracking WHERE shipment_id = (SELECT id FROM addresses_shipment_labels WHERE serial_id = 'DEMO-2024-001' LIMIT 1)) as checkpoint_count
FROM addresses_shipment_labels
WHERE serial_id = 'DEMO-2024-001'
LIMIT 1;
