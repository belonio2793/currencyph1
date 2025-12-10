# Shipping Ports with Rate Calculator - Setup Guide

## Overview

You now have a complete shipping ports system for the planning page that displays:
- **Philippines Ports** (red markers) - 5 major ports with full details
- **Chinese Ports** (blue markers) - 10 major import/export hubs
- **Interactive Rate Calculator** - Dynamic pricing based on cargo type, weight/volume, and direction

## What's Included

### 1. Database Migration (055_add_planning_ports_with_rates.sql)

Adds the following columns to the `shipping_ports` table:
- `country_code` - PH or CN
- `marker_color` - Visual indicator (red/blue)
- **Handling Fees:**
  - `handling_fee_php_per_kg` - Cost per kilogram
  - `handling_fee_php_per_teu` - Cost per container (20ft/40ft)
  - `handling_fee_php_per_cbm` - Cost per cubic meter
- **Port Fees:**
  - `documentation_fee_php` - Documentation processing
  - `port_authority_fee_php` - Port authority charges
  - `security_fee_php` - Security screening
  - `customs_clearance_fee_php` - Customs processing
- **Surcharges:**
  - `import_surcharge_percentage` - Extra charge for imports
  - `export_surcharge_percentage` - Extra charge for exports

### 2. Rate Calculator Service (src/lib/portRateCalculatorService.js)

Core features:
```javascript
// Calculate total cost with breakdown
portRateCalculator.calculateTotalCost(port, cargo)

// Format breakdown for display
portRateCalculator.formatBreakdown(breakdown)

// Get default cargo by type
portRateCalculator.getDefaultCargo('teu') // kg, teu, or cbm

// Compare rates between two ports
portRateCalculator.comparePorts(port1, port2, cargo)
```

### 3. Updated Planning Chat Component

Features:
- ✅ Loads and displays both Philippines and China ports
- ✅ Color-coded markers (red = PH, blue = CN)
- ✅ Port dropdown selector in header
- ✅ Interactive popup with full port details:
  - Port name, location, description
  - Port type, depth, capacity, berths
  - Available services (Container, RoRo, Bulk, etc.)
  - Contact information and website
- ✅ **Rate Calculator Popup:**
  - Select cargo type: Weight (kg), Container (TEU), or Volume (CBM)
  - Enter quantity
  - Choose direction: Import or Export
  - Displays real-time cost breakdown:
    - Handling fee
    - Documentation fee
    - Port authority fee
    - Security fee
    - Customs fee
    - Surcharge (import/export specific)
    - **Total cost in PHP**

## Setup Instructions

### Step 1: Apply the Migration

Run the migration script to add new columns and data to your database:

```bash
node scripts/apply-migration-055.js
```

**OR** manually in Supabase dashboard:
1. Go to Supabase → SQL Editor
2. Create a new query
3. Copy the contents of `supabase/migrations/055_add_planning_ports_with_rates.sql`
4. Click "Run" to execute

### Step 2: Verify Installation

Check that:
- ✅ `shipping_ports` table has new rate columns
- ✅ Philippines ports have rates and marker_color = 'red'
- ✅ Chinese ports (10 ports) are added with marker_color = 'blue'

```sql
SELECT name, country_code, marker_color, handling_fee_php_per_teu 
FROM shipping_ports 
ORDER BY country_code, name;
```

### Step 3: Visit the Planning Page

Navigate to: `http://localhost:3000/planning`

You should see:
- ✅ Red markers for Philippines ports (5 total)
- ✅ Blue markers for Chinese ports (10 total)
- ✅ "Ports:" dropdown selector in header
- ✅ Interactive rate calculator in port popups

## Philippines Ports Included

1. **Port of Manila (South Harbor)** - Manila, NCR
   - International container port
   - 15 berths, 14m max depth
   - 2M+ TEU capacity

2. **Port of Cebu** - Cebu, Cebu
   - Central Visayas regional hub
   - 10 berths, 13m max depth
   - 1.8M TEU capacity

3. **Port of Iloilo** - Iloilo, Iloilo
   - Panay Island service center
   - 8 berths, 12m max depth
   - 800K TEU capacity

4. **Port of Davao** - Davao, Davao City
   - Southern Mindanao hub
   - 10 berths, 13.5m max depth
   - 1.5M TEU capacity

5. **Port of General Santos** - General Santos, South Cotabato
   - Southern region gateway
   - 6 berths, 12m max depth
   - 600K TEU capacity

## Chinese Ports Included

1. **Port of Shanghai** - East China
   - World's largest container port
   - 128 berths, 15m max depth
   - 4.4M+ TEU capacity

2. **Port of Shenzhen** - South China
   - Key Southeast Asia gateway
   - 70 berths, 13.5m max depth
   - 1.4M TEU capacity

3. **Port of Ningbo-Zhoushan** - East China
   - Yangtze River Delta hub
   - 80 berths, 14.5m max depth
   - 2.8M TEU capacity

4. **Port of Qingdao** - North China
   - Deep-water natural harbor
   - 60 berths, 13m max depth
   - 2.1M TEU capacity

5. **Port of Tianjin** - North China
   - Beijing region gateway
   - 53 berths, 12.5m max depth
   - 1.9M TEU capacity

6. **Port of Guangzhou** - South China
   - Pearl River Delta inland port
   - 75 berths, 12m max depth
   - 2.2M TEU capacity

7. **Port of Dalian** - North China
   - Natural deep-water harbor
   - 45 berths, 13m max depth
   - 1.5M TEU capacity

8. **Port of Xiamen** - Southeast China
   - Free Trade Zone container port
   - 48 berths, 11.5m max depth
   - 1.2M TEU capacity

9. **Port of Suzhou** - East China
   - Modern Jiangsu container facility
   - 40 berths, 12m max depth
   - 800K TEU capacity

10. **Port of Wuhan** - Central China
    - Largest inland Yangtze River port
    - 50 berths, 9m max depth
    - 500K capacity

## Sample Rates (Customizable)

### Philippines Ports (Default)
- **Handling:** ₱28-30/kg, ₱7,500-8,000/TEU, ₱550-600/CBM
- **Documentation:** ₱2,200-2,500
- **Port Authority:** ₱5,500-6,000
- **Security:** ₱1,800-2,000
- **Customs:** ₱3,200-3,500
- **Import Surcharge:** 11-12%
- **Export Surcharge:** 5.5-6%

### Chinese Ports (Default)
- **Handling:** ₱15-18/kg, ₱3,000-3,600/TEU, ₱300-360/CBM
- **Documentation:** ₱1,200-1,500
- **Port Authority:** ₱2,300-2,700
- **Security:** ₱650-800
- **Customs:** ₱950-1,200
- **Import Surcharge:** 6-8%
- **Export Surcharge:** 3-4%

## Customizing Rates

To modify port rates, update the SQL in `055_add_planning_ports_with_rates.sql`:

```sql
UPDATE shipping_ports 
SET 
  handling_fee_php_per_kg = 25.00,
  handling_fee_php_per_teu = 5000.00,
  import_surcharge_percentage = 10.00
WHERE name = 'Port of Shanghai';
```

Or use the Supabase dashboard to edit rates directly in the `shipping_ports` table.

## Usage Examples

### Example 1: Import 5 Containers from Shanghai
1. Click Shanghai port marker (blue)
2. Set Cargo Type: Container (TEU)
3. Set Quantity: 5
4. Set Direction: Import
5. See total cost calculation

### Example 2: Export 500kg from Manila
1. Click Manila port marker (red)
2. Set Cargo Type: Weight (kg)
3. Set Quantity: 500
4. Set Direction: Export
5. See cost breakdown with lower surcharge

### Example 3: Compare Ports
Use the rate calculator in each port popup to compare costs between:
- Philippines (red) vs China (blue)
- Different cargo types
- Import vs Export scenarios

## Features

✅ **Real-time Rate Calculation** - Instant cost updates as you change parameters
✅ **Detailed Breakdowns** - See exactly where your costs go
✅ **Multi-unit Support** - Calculate by kg, TEU, or cubic meters
✅ **Direction-aware Pricing** - Import and export have different surcharges
✅ **Comprehensive Port Data** - 15 major ports with full operational details
✅ **Color-coded Map** - Easy visual distinction between regions
✅ **Interactive Popups** - No page reload needed to calculate rates
✅ **Contact Information** - Phone, email, and website for each port

## API Integration (Future)

When you need to integrate with real-time rates:

```javascript
// Service already supports external rate fetching
// Modify src/lib/portRateCalculatorService.js to:

async function fetchLiveRates(portId) {
  // Fetch from your API/third-party service
  // Update database with live rates
}
```

## Troubleshooting

### Ports not showing on map?
1. ✅ Check migration was applied: `node scripts/apply-migration-055.js`
2. ✅ Verify `shipping_ports` table exists: `select * from shipping_ports limit 1;`
3. ✅ Check `is_public = true` and `status = 'active'` for ports

### Rates showing as ₱0 or undefined?
1. ✅ Ensure migration was applied fully
2. ✅ Check port record has rate columns populated
3. ✅ Verify Supabase table structure with: `DESCRIBE shipping_ports;`

### Markers not colored correctly?
1. ✅ Check `country_code` is 'PH' or 'CN'
2. ✅ Verify `marker_color` is set ('red' or 'blue')
3. ✅ Clear browser cache and reload

## Next Steps

1. **Custom Rates:** Edit rates in `shipping_ports` table per your business model
2. **Add More Ports:** Insert more ports with rates using the migration template
3. **Live Rate Sync:** Integrate with rate management system
4. **Export Quotes:** Build quote generation from rate calculations
5. **Logistics Planning:** Use port comparison to optimize shipping routes

## Support

For issues or questions:
1. Check console (F12) for JavaScript errors
2. Verify Supabase connection in browser DevTools
3. Ensure all migrations applied successfully
4. Check `shipping_ports` table in Supabase dashboard

---

**Last Updated:** 2025-01-10
**Version:** 1.0
**Status:** Production Ready
