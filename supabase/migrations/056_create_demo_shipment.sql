-- Create demo shipment with tracking checkpoints
DO $$
DECLARE
  demo_user_id UUID;
  demo_shipment_id UUID;
BEGIN
  -- Get the first user (or the authenticated admin user)
  SELECT id INTO demo_user_id FROM auth.users LIMIT 1;

  -- Create the demo shipment
  INSERT INTO addresses_shipment_labels (
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
    demo_user_id,
    'DEMO-2024-001',
    'Electronics Bundle',
    'Mixed electronics including laptop accessories, phone charger, and USB cables',
    2.5,
    '30x25x15 cm',
    'in-transit',
    'Demo shipment for testing the tracking system',
    NOW(),
    NOW()
  ) RETURNING id INTO demo_shipment_id;

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
  ) VALUES
    (demo_shipment_id, 'Origin - Manila Hub', 'origin', 'scanned', 14.5994, 120.9842, 'Manila Distribution Center, Quezon City, Philippines', demo_user_id, 'Package received and sorted', NOW() - INTERVAL '48 hours'),
    (demo_shipment_id, 'In Transit - Batangas Port', 'waypoint', 'in-transit', 13.7631, 120.9427, 'Batangas Port Terminal, Batangas City, Philippines', demo_user_id, 'Package loaded onto ferry', NOW() - INTERVAL '36 hours'),
    (demo_shipment_id, 'In Transit - Cebu Port', 'waypoint', 'in-transit', 10.3157, 123.8854, 'Cebu Port Authority, Cebu City, Philippines', demo_user_id, 'Package arrived at destination port', NOW() - INTERVAL '24 hours'),
    (demo_shipment_id, 'Local Delivery - Cebu Distribution Hub', 'waypoint', 'in-transit', 10.3226, 123.9008, 'Cebu Regional Distribution Center, Cebu City, Philippines', demo_user_id, 'Package in local delivery queue', NOW() - INTERVAL '12 hours'),
    (demo_shipment_id, 'Out for Delivery', 'waypoint', 'in-transit', 10.3356, 123.9119, 'Banilad, Cebu City, Philippines', demo_user_id, 'Package out for delivery with driver', NOW() - INTERVAL '2 hours');

  RAISE NOTICE 'Demo shipment created: %', demo_shipment_id;
END $$;
