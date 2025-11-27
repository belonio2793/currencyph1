# Demo Shipment Setup

## Quick Start - Add Demo Data to Your Project

This guide shows you how to add a single demo shipment with tracking checkpoints across the Philippines (Manila → Cebu) to test the tracking system.

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL below:

```sql
-- Create demo shipment with tracking checkpoints
DO $$
DECLARE
  demo_user_id UUID;
  demo_shipment_id UUID;
BEGIN
  -- Get the first user
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

  RAISE NOTICE 'Demo shipment created successfully!';
END $$;
```

5. Click **RUN**
6. You should see a success message

### Option 2: Run the Migration

If you have migration system set up, the file `supabase/migrations/056_create_demo_shipment.sql` will be run on next deployment.

---

## What Gets Created

### 📦 Shipment Details
- **Serial ID:** DEMO-2024-001
- **Package Name:** Electronics Bundle
- **Weight:** 2.5 kg
- **Dimensions:** 30x25x15 cm
- **Status:** In Transit
- **Description:** Mixed electronics including laptop accessories, phone charger, and USB cables

### 📍 Tracking Route (Manila → Cebu)
The shipment includes 5 tracking checkpoints showing the journey:

| Checkpoint | Location | Time Ago | Type |
|-----------|----------|----------|------|
| 1. Origin - Manila Hub | Manila Distribution Center, Quezon City | 48 hours | Origin |
| 2. In Transit - Batangas Port | Batangas Port Terminal, Batangas City | 36 hours | Waypoint |
| 3. In Transit - Cebu Port | Cebu Port Authority, Cebu City | 24 hours | Waypoint |
| 4. Local Delivery Hub | Cebu Regional Distribution Center, Cebu City | 12 hours | Waypoint |
| 5. Out for Delivery | Banilad, Cebu City | 2 hours | Waypoint |

---

## Where to See It

After running the SQL, you can see the demo shipment in:

### 📦 Shipping Tab
- Navigate to **Addresses** → **Shipping** → **Shipping**
- The shipment will appear in the list with status badge "In Transit"

### 🗺️ Track Package Tab
- Navigate to **Addresses** → **Shipping** → **Track Package**
- Select the shipment from the left sidebar
- View the interactive map with all 5 checkpoints connected by a route polyline
- See the timeline of tracking events at the bottom

### 📊 Network Orders (if enabled)
- The shipment data will sync with your network monitoring system

---

## Testing Checklist

After creating the demo shipment, verify:

- [ ] Shipment appears in "Shipping" list
- [ ] Can search for "DEMO-2024-001" or "Electronics Bundle"
- [ ] Can filter by "In Transit" status
- [ ] Can click shipment to view details
- [ ] Map loads and shows all 5 checkpoints
- [ ] Route polyline connects the checkpoints (Manila to Cebu)
- [ ] Tracking timeline shows all 5 events with correct times
- [ ] Hover over markers shows popup with location details
- [ ] Zoom controls and map navigation work
- [ ] Can see coordinates for each checkpoint

---

## Clean Up (Optional)

To remove the demo data later, run this SQL:

```sql
DELETE FROM addresses_shipment_labels WHERE serial_id = 'DEMO-2024-001';
```

This will automatically delete all associated tracking checkpoints due to the CASCADE delete constraint.

---

## Need More?

Want to generate additional demo data with variations? Let me know and I can create:
- Multiple shipments with different statuses
- Different routes (Cebu → Davao, etc.)
- Different package types
- Bulk generation for stress testing

