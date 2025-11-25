# Shipping Ports Feature Implementation Guide

## Overview
This document describes the complete implementation of shipping ports functionality, allowing you to mark, list, and sync shipping port data with your application. The feature includes map visualization, filtering, and a dedicated public ports directory.

## What Was Implemented

### 1. Database Table: `shipping_ports`
**Location:** `supabase/migrations/054_create_shipping_ports_table.sql`

A comprehensive PostgreSQL table with the following features:
- **Core Fields:** ID, name, description, status
- **Geographic Data:** Latitude, longitude, region, province, city, address
- **Port Details:** Port code, type (international/domestic), berth count, depth, vessel capacity
- **Operational:** Operating hours, contact info, website
- **Capabilities:** Container terminal, RoRo services, breakbulk, bulk cargo, refrigerated containers, dangerous cargo handling
- **Row-Level Security (RLS):** Public read access for all users, edit/delete for port creators
- **Automatic Timestamps:** Updated timestamps on every modification
- **Sample Data:** 5 major Philippine ports pre-populated

### 2. Service Library: `shippingPortsService.js`
**Location:** `src/lib/shippingPortsService.js`

Provides the following functions:
- `fetchShippingPorts(filters)` - Get all public ports with optional filters
- `fetchShippingPortsByLocation(city, region)` - Filter by location
- `getShippingPort(portId)` - Get single port details
- `createShippingPort(portData)` - Create new port (admin)
- `updateShippingPort(portId, updates)` - Update port details
- `deleteShippingPort(portId)` - Remove port
- `getShippingPortCities()` - Get unique cities
- `getShippingPortRegions()` - Get unique regions
- `searchShippingPorts(query)` - Search by name/description
- `getShippingPortStats()` - Get statistics

### 3. UI Components

#### a. **PropertyMapper** (Enhanced)
**Location:** `src/components/PropertyMapper.jsx`

**Changes:**
- Added shipping ports state management
- Added `loadShippingPorts()` function
- Port markers render on map with red icon
- Toggle button "Show Ports" / "Hide Ports" in legend
- Port details panel in sidebar showing:
  - Port name, type, status
  - Location (city, province, region, coordinates)
  - Specifications (berths, depth, vessel length, capacity)
  - Available services
  - Contact information
- When port selected, map flies to that location
- Clickable port markers with popup information

**Usage:**
```jsx
<PropertyMapper 
  userId={userId}
  onPropertyAdded={handlePropertyAdded}
  showShippingPorts={false}  // New prop
/>
```

#### b. **ShippingPorts Component** (Subtab in Default)
**Location:** `src/components/ShippingPorts.jsx`

Features:
- List view of all shipping ports
- Real-time search by name/city
- Filter by city dropdown
- Expandable port cards showing detailed information
- Services and contact information display
- Responsive design for mobile/tablet
- Port count footer
- Styled with `ShippingPorts.css`

#### c. **PublicShippingPorts Component** (New Tab)
**Location:** `src/components/PublicShippingPorts.jsx`

Features:
- **Dual-pane layout:** Map on left, sidebar on right (responsive)
- **Interactive map:** All ports marked with red icons
- **Statistics panel:** Shows total ports, active count, international/domestic split
- **Advanced filtering:**
  - Search by port name or city
  - Filter by region or city (mutually exclusive)
  - Reset filters button
- **Port list sidebar:**
  - Clickable list items
  - Expand to show full details
  - Click to center map on that port
- **Responsive design:** Converts to vertical layout on mobile
- **Styled with `PublicShippingPorts.css`**

### 4. Integration Points

#### Updated Files:
- **`src/components/Addresses.jsx`**
  - Added import for `PublicShippingPorts`
  - Added new tab: "Public Shipping Ports"

- **`src/components/DefaultAddressesTab.jsx`**
  - Added import for `ShippingPorts`
  - Added subtab button: "Shipping Ports"
  - Added subtab content rendering

- **`src/components/PropertyMapper.jsx`**
  - Added shipping ports service import
  - New state: `shippingPorts`, `selectedPort`, `showPorts`
  - New functions: `loadShippingPorts()`, `handlePortMarkerClick()`
  - Enhanced legend with port toggle button
  - Port markers rendered on map
  - Port details panel in sidebar

- **`src/components/PropertyMapper.css`**
  - Added `.port-details-panel` styling
  - Added `.port-description` styling
  - Added `.shipping-port-marker` styling with hover effects

## Data Structure

### Shipping Port Object
```javascript
{
  id: 1,
  name: "Port of Manila (South Harbor)",
  description: "Main international container port serving Metro Manila",
  status: "active", // active, inactive, under_maintenance
  latitude: 14.5879,
  longitude: 120.8578,
  city: "Manila",
  province: "Metro Manila",
  region: "NCR",
  address: "South Harbor, Manila",
  port_code: "MNL",
  port_type: "international", // international, domestic, private
  berth_count: 15,
  max_depth_meters: 14.0,
  max_vessel_length_meters: 300.0,
  annual_capacity_teu: 2000000,
  
  // Services
  container_terminal: true,
  ro_ro_services: true,
  breakbulk_services: true,
  bulk_cargo: false,
  refrigerated_containers: false,
  dangerous_cargo: false,
  
  // Contact
  contact_phone: "+63 2 5279-5555",
  contact_email: null,
  website: "https://www.ppa.com.ph",
  
  // Metadata
  is_public: true,
  metadata: { facilities: [...], operator: "Philippine Ports Authority" },
  created_by: "user-uuid",
  created_at: "2024-01-20T10:00:00Z",
  updated_at: "2024-01-20T10:00:00Z"
}
```

## Usage Guide

### For End Users

1. **View All Ports:**
   - Navigate to "Addresses" → "Public Shipping Ports" tab
   - See interactive map with all port locations
   - View port statistics at the top

2. **In Default Tab:**
   - Click "Shipping Ports" subtab
   - See list view of all ports
   - Search by name or filter by city
   - Click port card to expand and see details

3. **On Property Map:**
   - Properties map now shows shipping ports
   - Click "Show Ports" button to toggle port visibility
   - Click port marker to see details in sidebar
   - Port information includes services, contact, specifications

### For Developers

#### Query Examples
```javascript
// Get all public ports
const ports = await fetchShippingPorts()

// Filter by city
const manilaports = await fetchShippingPorts({ city: 'Manila' })

// Search for specific port
const results = await searchShippingPorts('Manila')

// Get port by ID
const port = await getShippingPort(1)

// Create new port (requires authentication)
const newPort = await createShippingPort({
  name: 'New Port',
  city: 'Quezon City',
  latitude: 14.6349,
  longitude: 121.0388,
  port_type: 'domestic'
})

// Update port
await updateShippingPort(1, { status: 'under_maintenance' })

// Get statistics
const stats = await getShippingPortStats()
```

#### Component Usage
```javascript
// In PropertyMapper, show shipping ports on map
<PropertyMapper 
  showShippingPorts={true}
/>

// Use ShippingPorts subtab directly
import ShippingPorts from './components/ShippingPorts'
<ShippingPorts />

// Use PublicShippingPorts component
import PublicShippingPorts from './components/PublicShippingPorts'
<PublicShippingPorts />
```

## Key Features

✅ **Map Integration**
- Leaflet-based interactive maps
- Port markers with custom red icons
- Clickable markers with popup information
- Fly-to functionality when port selected

✅ **Search & Filter**
- Real-time search by name, city, description
- Filter by city or region
- Search across all fields
- Reset filters capability

✅ **Responsive Design**
- Mobile-friendly (vertical layout on small screens)
- Tablet-optimized layout
- Desktop-optimized dual-pane layout

✅ **Data Management**
- Pre-populated with 5 major Philippine ports
- Easily extensible schema
- Support for custom metadata
- Automatic timestamp tracking

✅ **Security**
- Row-Level Security (RLS) policies
- Public read access
- Authenticated user creation
- Owner-based edit/delete permissions

## File Structure

```
/
├── supabase/
│   └── migrations/
│       └── 054_create_shipping_ports_table.sql
├── src/
│   ├── lib/
│   │   └── shippingPortsService.js
│   └── components/
│       ├── ShippingPorts.jsx
│       ├── ShippingPorts.css
│       ├── PublicShippingPorts.jsx
│       ├── PublicShippingPorts.css
│       ├── PropertyMapper.jsx (enhanced)
│       ├── PropertyMapper.css (enhanced)
│       ├── Addresses.jsx (updated)
│       └── DefaultAddressesTab.jsx (updated)
└── SHIPPING_PORTS_IMPLEMENTATION.md
```

## Next Steps

1. **Apply Database Migration:**
   - Run the migration SQL script in your Supabase dashboard
   - Or use Supabase CLI: `supabase db push`

2. **Test the Feature:**
   - Navigate to "Public Shipping Ports" tab
   - Search and filter ports
   - Click ports on the map
   - Test on Properties map (toggle ports on/off)

3. **Customize (Optional):**
   - Add more sample ports to the database
   - Modify port types and services available
   - Update map styling and colors
   - Add additional metadata fields

4. **Admin Panel (Future):**
   - Consider adding admin panel for managing ports
   - Add port creation/editing forms
   - Implement port verification workflow
   - Add photo/document uploads for ports

## Troubleshooting

**Ports not showing on map:**
- Check if `shipping_ports` table exists in Supabase
- Verify `is_public = true` for ports
- Check browser console for errors

**Search/filter not working:**
- Ensure ports have proper data in fields
- Clear browser cache and reload
- Check network tab in DevTools

**Map not centering on selected port:**
- Verify latitude/longitude are valid numbers
- Check if map ref is properly initialized
- Ensure port object has valid coordinates

## Performance Notes

- Ports load on demand (when component mounts)
- Large datasets may require pagination
- Search is client-side for <1000 ports
- Consider server-side search for larger datasets
- Map rendering optimized for 100+ markers

## Future Enhancements

- [ ] Port analytics dashboard
- [ ] Port capacity tracking
- [ ] Real-time port status updates
- [ ] Port scheduling system
- [ ] Integration with logistics APIs
- [ ] Port comparison tool
- [ ] Export port data (CSV, PDF)
- [ ] Port rating/review system
- [ ] Historical port data
