# Addresses Page Database Audit Report

## Executive Summary

The **Addresses** page has 5 tabs with varying levels of database integration. **3 tabs are properly mapped** to their database tables, but **2 tabs use mock data** and lack complete database implementation.

---

## Tab-by-Tab Mapping Analysis

### ✅ TAB 1: Default Addresses (PropertyMapper)

**Component:** `src/components/DefaultAddressesTab.jsx` → `src/components/PropertyMapper.jsx`

**Database Tables:**
- `addresses` ✅

**Features & Database Mapping:**

| Feature | Implemented | DB Table | DB Columns |
|---------|-----------|----------|-----------|
| View addresses on map | ✅ | `addresses` | `addresses_latitude`, `addresses_longitude` |
| Display property list | ✅ | `addresses` | `addresses_street_name`, `addresses_city` |
| View property details (modal) | ✅ | `addresses` | All `addresses_*` columns |
| Filter by city | ✅ | `addresses` | `addresses_city` |
| Delete property | ✅ | `addresses` | (DELETE operation) |

**Query Operations:**
```javascript
// Load addresses for map
.from('addresses')
.select('*')
.not('addresses_latitude', 'is', null)
.not('addresses_longitude', 'is', null)
```

**Status:** ✅ **FULLY MAPPED**

---

### ✅ TAB 2: My Addresses (MyAddressesTab)

**Component:** `src/components/MyAddressesTab.jsx`

**Database Tables:**
- `addresses` ✅
- `address_history` ✅

**Features & Database Mapping:**

| Feature | Implemented | DB Table | DB Columns | Status |
|---------|-----------|----------|-----------|--------|
| Create address | ✅ | `addresses` | All columns | Complete |
| Edit address (nickname) | ✅ | `addresses` | `address_nickname` | Complete |
| Track nickname changes | ✅ | `address_history` | `field_name`, `old_value`, `new_value` | Complete |
| Search by street/city/nickname | ✅ | `addresses` | `addresses_street_name`, `addresses_city`, `address_nickname` | Complete |
| Filter by region | ✅ | `addresses` | `addresses_region` | Complete |
| Filter by city | ✅ | `addresses` | `addresses_city` | Complete |
| Set default address | ✅ | `addresses` | `is_default` | Complete |
| View address history | ✅ | `address_history` | All columns | Complete |
| Popular cities quick select | ✅ | State only | N/A | UI only |

**Form Fields & Database Columns:**

```javascript
addresses_address           // Full address text
addresses_street_number     // Street number (e.g., "123")
addresses_street_name       // Street name (e.g., "Makati Ave")
addresses_city              // City (e.g., "Manila")
addresses_province          // Province
addresses_region            // Region (Philippine region)
addresses_postal_code       // Postal code
barangay                    // Barangay name
addresses_latitude          // Geolocation latitude
addresses_longitude         // Geolocation longitude
address_nickname            // Friendly name (e.g., "Home", "Office")
elevation                   // Elevation in meters
property_type               // Type: Residential, Commercial, etc.
zoning_classification       // Zoning: residential, commercial, etc.
lot_number                  // Lot number (e.g., "LOT-001")
lot_area                    // Lot area numeric value
lot_area_unit               // Unit: sqm, sqft, hectares
land_use                    // Land use description
owner_name                  // Property owner name
land_title_number           // Land title (e.g., "TCT-123456")
property_status             // Status: active, inactive, etc.
notes                       // Additional notes
```

**Query Operations:**
```javascript
// Load addresses
.from('addresses')
.select('*')
.eq('user_id', userId)

// Update nickname
.from('addresses')
.update({ address_nickname: value })

// Record change history
.from('address_history')
.insert([{ address_id, field_name, old_value, new_value }])
```

**Status:** ✅ **FULLY MAPPED**

---

### ✅ TAB 3: Shipping & Tracking (ShippingTrackingTab)

**Component:** `src/components/ShippingTrackingTab.jsx`

**Database Tables:**
- `shipments` ✅
- `shipment_tracking_history` ✅

**Features & Database Mapping:**

| Feature | Implemented | DB Table | DB Columns | Status |
|---------|-----------|----------|-----------|--------|
| Create shipment | ✅ | `shipments` | All columns | Complete |
| Track shipments | ✅ | `shipments` | `status`, `tracking_number` | Complete |
| Search by tracking number | ✅ | `shipments` | `tracking_number` | Complete |
| Filter by status | ✅ | `shipments` | `status` | Complete |
| Generate tracking number | ✅ | `shipments` | `tracking_number` | Complete |
| Generate barcode | ✅ | State/UI | N/A | UI only |
| Generate QR code | ✅ | State/UI | N/A | UI only |
| View tracking history | ✅ | `shipment_tracking_history` | `status`, `location`, `timestamp`, `notes` | Complete |
| Download labels | ⚠️ | None | N/A | UI only, not persistent |

**Form Fields & Database Columns:**

```javascript
tracking_number          // Unique tracking number
package_weight           // Weight (e.g., "2.5 kg")
package_dimensions       // Dimensions (e.g., "20x30x40 cm")
origin_address          // Sender's address
destination_address     // Recipient's address
carrier                 // Courier name (e.g., "JNT", "LBC")
status                  // Status: pending, in-transit, delivered, failed
estimated_delivery      // Expected delivery date
notes                   // Additional notes
```

**Query Operations:**
```javascript
// Load shipments
.from('shipments')
.select('*')
.eq('user_id', userId)

// Load tracking history
.from('shipment_tracking_history')
.select('*')
.eq('shipment_id', shipmentId)

// Create shipment
.from('shipments')
.insert([{ user_id, tracking_number, ... }])
```

**Status:** ✅ **FULLY MAPPED**

---

### ⚠️ TAB 4: Route Calculator (RouteCalculatorTab)

**Component:** `src/components/RouteCalculatorTab.jsx`

**Database Tables:** NONE (Uses mock data)

**Features & Database Mapping:**

| Feature | Implemented | DB Table | DB Columns | Status |
|---------|-----------|----------|-----------|--------|
| Package type selection | ✅ | ❌ None | N/A | Mock data only |
| Package dimensions input | ✅ | ❌ None | N/A | Mock data only |
| Weight input | ✅ | ❌ None | N/A | Mock data only |
| Origin/destination city | ✅ | ❌ None | N/A | Mock data only |
| Urgency level selection | ✅ | ❌ None | N/A | Mock data only |
| Calculate volume | ✅ | ❌ None | N/A | Client-side only |
| Display viable routes | ✅ | ❌ None | N/A | Mock shipping partners |
| Route selection | ⚠️ | ❌ None | N/A | Not functional |

**Mock Data Used:**
- `mockShippingPartners` - hardcoded array with 4 partners (JNT, LBC, Lazada, Shopee)

**Missing Database Integration:**

The `shipping_routes` table exists in migrations but is **NOT USED** by this component:

```sql
-- EXISTS in migrations/002_create_shipments_table.sql but not used
CREATE TABLE shipping_routes (
  id UUID,
  user_id UUID,
  shipment_id UUID,
  origin_city VARCHAR(100),
  destination_city VARCHAR(100),
  package_weight DECIMAL(8, 2),
  package_volume DECIMAL(10, 2),
  package_type VARCHAR(50),
  selected_partner_id UUID,
  estimated_cost DECIMAL(10, 2),
  estimated_days INTEGER,
  route_status VARCHAR(50),
  notes TEXT,
  created_at, updated_at
);
```

**Status:** ⚠️ **NOT MAPPED - Uses Mock Data Only**

**Issues:**
1. No database persistence - form data is lost on navigation
2. Mock shipping partners hardcoded in component
3. Route calculations not saved to `shipping_routes` table
4. No integration with `shipping_partners` table
5. "Select This Route" button has no functionality

---

### ⚠️ TAB 5: Partners & Handlers (PartnersHandlersTab)

**Component:** `src/components/PartnersHandlersTab.jsx`

**Database Tables:** NONE (Uses mock data)

**Features & Database Mapping:**

| Feature | Implemented | DB Table | DB Columns | Status |
|---------|-----------|----------|-----------|--------|
| Display shipping partners | ✅ | ❌ None | N/A | Mock data only |
| Search partners | ✅ | ❌ None | N/A | Client-side only |
| Filter by partner type | ✅ | ❌ None | N/A | Mock data only |
| View partner details | ✅ | ❌ None | N/A | Modal popup |
| View contact info | ✅ | ❌ None | N/A | Static data |
| View ratings | ✅ | ❌ None | N/A | Mock data only |
| Use partner button | ⚠️ | ❌ None | N/A | Not functional |
| Save to favorites | ⚠️ | ❌ None | N/A | Not functional |

**Mock Data Used:**
- 8 hardcoded shipping partners (JNT, LBC, Lazada, Shopee, Grab, AirSwift, DHL, FedEx)
- All partner information hardcoded in component

**Missing Database Integration:**

The `shipping_partners` table exists in migrations but is **NOT USED** by this component:

```sql
-- EXISTS in migrations/002_create_shipments_table.sql but not used
CREATE TABLE shipping_partners (
  id UUID,
  user_id UUID,
  partner_name VARCHAR(255),
  partner_type VARCHAR(50),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  website TEXT,
  delivery_method VARCHAR(100),
  coverage_area TEXT,
  estimated_delivery_days INTEGER,
  base_rate DECIMAL(10, 2),
  has_tracking BOOLEAN,
  has_insurance BOOLEAN,
  is_favorite BOOLEAN,
  rating DECIMAL(3, 1),
  created_at, updated_at
);
```

**Status:** ⚠️ **NOT MAPPED - Uses Mock Data Only**

**Issues:**
1. No database persistence
2. All partners hardcoded in component (not user-customizable)
3. Cannot save favorite partners to database
4. "Use This Partner" and "Save to Favorites" buttons have no functionality
5. No integration with `shipping_partners` table
6. No way to add custom partners

---

## Database Schema Summary

### Addresses-Related Tables ✅

| Table | Columns | Used By | Status |
|-------|---------|---------|--------|
| `addresses` | 30+ columns with `addresses_` prefix | Default, My Addresses tabs | ✅ Active |
| `address_history` | address_id, field_name, old_value, new_value, changed_at | My Addresses tab | ✅ Active |

### Shipping-Related Tables

| Table | Columns | Used By | Status |
|-------|---------|---------|--------|
| `shipments` | tracking_number, status, package_*, origin/destination_address, carrier, notes | Shipping & Tracking tab | ✅ Active |
| `shipment_tracking_history` | shipment_id, status, location, timestamp, notes | Shipping & Tracking tab | ✅ Active |
| `shipping_routes` | origin_city, destination_city, package_*, selected_partner_id, estimated_cost, route_status | **NOT USED** | ⚠️ Unused |
| `shipping_partners` | partner_name, partner_type, contact_*, delivery_method, coverage_area, rating, is_favorite | **NOT USED** | ⚠️ Unused |

### Related Tables (Not in Addresses Page)

| Table | Purpose |
|-------|---------|
| `property_zoning_rules` | Zoning information by region/city |
| `property_boundaries` | Lot boundary geospatial data |
| `property_documents` | Document storage for properties |
| `region_boundaries` | Region boundary geospatial data |
| `city_boundaries` | City boundary geospatial data |

---

## Recommendations

### 🔴 Critical Issues

1. **Route Calculator Tab**
   - Replace mock data with `shipping_routes` table queries
   - Save calculated routes to database
   - Load shipping partners from `shipping_partners` table
   - Make "Select This Route" button functional

2. **Partners & Handlers Tab**
   - Load partners from `shipping_partners` table instead of hardcoded data
   - Implement "Save to Favorites" functionality
   - Implement "Use This Partner" functionality
   - Allow users to manage custom partners

### 🟡 Nice-to-Have Improvements

1. **Add address_` prefix consistency**
   - Review other components that use "address" field names
   - Standardize to use `addresses_` prefix for consistency
   - Update form field names to match DB columns

2. **Enhanced Route Calculator**
   - Link selected routes to shipments in `shipping_tracking` tab
   - Store package dimensions and costs for historical analysis
   - Integrate with Partners tab for dynamic pricing

3. **Partner Management**
   - Add admin interface to manage `shipping_partners` base data
   - Allow users to rate partners after delivery
   - Track partner reliability metrics

---

## Database Table Documentation

### addresses (Active) ✅

```
Primary Fields:
- addresses_address: Full address text
- addresses_street_number: Street number
- addresses_street_name: Street name (required)
- addresses_city: City name (required)
- addresses_region: Philippine region
- addresses_latitude: Latitude (required, decimal)
- addresses_longitude: Longitude (required, decimal)

Optional Fields:
- address_nickname: User-friendly name
- property_type: Residential, Commercial, etc.
- zoning_classification: Land zoning type
- lot_number, lot_area: Property lot info
- owner_name, land_title_number: Legal info
- elevation: Height in meters
- notes: Additional information

Metadata:
- is_default: Boolean flag
- property_status: active/inactive
- created_at, updated_at: Timestamps
```

### address_history (Active) ✅

```
Tracks changes to addresses:
- address_id: Foreign key to addresses
- user_id: User who made change
- field_name: Which field was changed
- old_value: Previous value
- new_value: New value
- changed_at: When change was made
```

### shipments (Active) ✅

```
Primary Fields:
- tracking_number: Unique tracking number
- user_id: Owner of shipment
- origin_address: Starting location
- destination_address: Ending location
- carrier: Courier name

Optional Fields:
- status: pending, in-transit, delivered, failed
- package_weight, package_dimensions: Package size
- package_type: general, fragile, perishable, etc.
- estimated_delivery: Expected delivery date
- notes: Additional information

Metadata:
- created_at, updated_at: Timestamps
```

### shipment_tracking_history (Active) ✅

```
Tracks shipment updates:
- shipment_id: Foreign key to shipments
- status: Current status
- location: Current location
- timestamp: When update occurred
- notes: Additional details
```

### shipping_routes (Unused) ⚠️

```
Should store calculated routes:
- user_id: Route owner
- shipment_id: Associated shipment
- origin_city, destination_city: Route endpoints
- package_weight, package_volume, package_type: Package info
- selected_partner_id: Selected shipping partner
- estimated_cost, estimated_days: Cost and time estimates
- route_status: pending, active, completed
- notes: Route details

STATUS: Table exists but component uses mock data instead
```

### shipping_partners (Unused) ⚠️

```
Should store shipping partner information:
- user_id: User who added partner (optional)
- partner_name: Company name
- partner_type: courier, platform, service, international
- contact_email, contact_phone, website: Contact info
- delivery_method: Ground, Air, Mixed, etc.
- coverage_area: Geographic coverage
- estimated_delivery_days: Typical delivery time
- base_rate: Base shipping cost
- has_tracking, has_insurance: Boolean features
- is_favorite: User's favorite flag
- rating: User rating (0-5)

STATUS: Table exists but component uses hardcoded mock data instead
```

---

## Migration Path

If you want to fully implement database integration for Tabs 4 & 5:

1. **Route Calculator Tab**
   ```javascript
   // Load shipping partners from DB
   const { data: partners } = await supabase
     .from('shipping_partners')
     .select('*')
   
   // Save selected route to DB
   const { error } = await supabase
     .from('shipping_routes')
     .insert([routeData])
   ```

2. **Partners & Handlers Tab**
   ```javascript
   // Load user's saved partners
   const { data: partners } = await supabase
     .from('shipping_partners')
     .select('*')
     .eq('user_id', userId)
   
   // Save favorite status
   const { error } = await supabase
     .from('shipping_partners')
     .update({ is_favorite: true })
     .eq('id', partnerId)
   ```

---

## Summary Table

| Feature | Tab | Database | Status |
|---------|-----|----------|--------|
| Address Management | Default, My Addresses | addresses, address_history | ✅ Complete |
| Shipment Tracking | Shipping & Tracking | shipments, shipment_tracking_history | ✅ Complete |
| Route Calculation | Route Calculator | shipping_routes | ⚠️ Uses mock data |
| Partner Management | Partners & Handlers | shipping_partners | ⚠️ Uses mock data |

**Overall: 60% mapped, 40% unmapped (using mock data)**

