# Property Mapper - Interactive Philippines Land & Property Mapping System

## Overview

The Property Mapper is an interactive geolocation-based mapping system for the Philippines that allows users to:
- View and manage properties on an interactive Leaflet map
- Click on properties to view detailed information
- Search for properties by address, city, street, or region
- Zoom in/out and pan across the map
- View property details including geolocation, zoning, ownership, and legal information

## Architecture

### Components

#### 1. **PropertyMapper.jsx** (`src/components/PropertyMapper.jsx`)
- Main interactive map component using React-Leaflet
- Handles map interactions (drag, zoom, click)
- Displays property markers with color-coded zoning
- Manages search and filtering functionality
- Loads properties from Supabase database

#### 2. **Addresses.jsx** (`src/components/Addresses.jsx`)
- Container component for the mapping system
- Integrates the PropertyMapper component
- Manages navigation between different views

### Database Schema

#### `addresses` Table
Main property data table with the following columns:

```sql
-- Address Components
- addresses_address (TEXT) - Full address
- addresses_street_number (TEXT) - Street number/lot
- addresses_street_name (TEXT) - Street name
- addresses_city (TEXT) - City name
- addresses_province (TEXT) - Province
- addresses_region (TEXT) - Region
- addresses_postal_code (TEXT)
- barangay (TEXT) - Barangay name

-- Geolocation
- addresses_latitude (DECIMAL) - Latitude coordinate
- addresses_longitude (DECIMAL) - Longitude coordinate
- elevation (DECIMAL) - Elevation in meters

-- Property Information
- property_type (VARCHAR) - Type: Commercial, Residential, etc.
- lot_number (TEXT) - Official lot number
- lot_area (DECIMAL) - Area in sqm
- lot_area_unit (VARCHAR) - Unit of measurement
- zoning_classification (TEXT) - Zoning type
- land_use (VARCHAR) - Current or intended use
- owner_name (TEXT) - Property owner
- land_title_number (TEXT) - Official title number
- certificate_of_ownership (TEXT)
- property_status (VARCHAR) - Status: active, inactive, etc.

-- Additional Data
- notes (TEXT) - Custom notes
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `property_zoning_rules` Table
Zoning regulations by region and city

#### `property_boundaries` Table
GeoJSON boundaries for each property

#### `region_boundaries` & `city_boundaries` Tables
Administrative boundary data for Philippines regions and cities

## Zoning Color Coding

Properties are color-coded on the map by zoning classification:
- 🟢 **Green** - Residential
- 🔵 **Blue** - Commercial
- 🔴 **Red** - Industrial
- 🟡 **Yellow** - Agricultural
- 🟠 **Orange** - Mixed-Use
- 🟣 **Purple** - Government

## Features

### Interactive Map
- **Pan/Drag**: Click and drag to move across the map
- **Zoom**: Use scroll wheel or zoom controls to zoom in/out
- **Markers**: Colored markers indicate properties with zoning color
- **Popups**: Click marker for quick preview

### Search Functionality
- Search by address
- Search by city
- Search by street name
- Search by region

### Property Details Sidebar
When a property is selected, the sidebar displays:
- Full address information
- Geolocation (latitude, longitude, elevation)
- Property type and area
- Zoning classification
- Land use designation
- Ownership information
- Land titles and certificates
- Custom notes

### Property Management
- View all user properties with geolocation
- Delete properties
- Update property information
- Add new properties with full geolocation data

## Getting Started

### 1. Apply Database Migration

```bash
# Run the migration using Supabase CLI or direct SQL execution
# File: supabase/migrations/001_create_addresses_table.sql

# Or manually run the SQL through Supabase dashboard
```

### 2. Seed Sample Data (Optional)

```bash
npm run seed-property-data
```

This will add 10 sample properties across major Philippine cities:
- Makati City
- Manila
- Cebu City
- Davao City
- Baguio City
- Iloilo City
- Quezon City

### 3. Access the Feature

Navigate to the **Maps > Addresses** section in the application footer or through the main navigation.

## Usage Guide

### Viewing Properties

1. Go to **Maps > Addresses** in the application
2. The map displays all your properties with geolocation data
3. Properties are shown as colored markers based on zoning

### Searching Properties

1. Use the search bar at the top of the map
2. Type any part of:
   - Street address
   - City name
   - Street name
   - Region
3. Map updates to show matching properties

### Viewing Property Details

1. Click on a marker on the map, or
2. Click on a property name in the sidebar list
3. The right sidebar expands showing full property details
4. Map automatically centers and zooms to the selected property

### Managing Properties

**Adding Properties:**
- Use the Addresses form modal (to be integrated)
- Include geolocation coordinates when creating

**Updating Properties:**
- Click on a property
- Edit details in the modal (to be integrated)

**Deleting Properties:**
- Click on a property in the sidebar
- Click "Delete Property" button
- Confirm deletion

## Data Format for Import

When adding properties programmatically or via import, ensure:

```json
{
  "addresses_address": "123 Main St, Manila",
  "addresses_street_number": "123",
  "addresses_street_name": "Main St",
  "addresses_city": "Manila",
  "addresses_province": "Metro Manila",
  "addresses_region": "National Capital Region",
  "addresses_postal_code": "1000",
  "addresses_latitude": 14.5951,
  "addresses_longitude": 120.9680,
  "barangay": "Ermita",
  "property_type": "Commercial",
  "lot_number": "LOT-001",
  "lot_area": 2000,
  "zoning_classification": "commercial",
  "land_use": "Office Space",
  "owner_name": "Property Owner Name",
  "land_title_number": "TCT-123456",
  "property_status": "active"
}
```

## Styling

### CustomizableColors
- Marker colors: Defined by zoning classification
- Sidebar: Clean white interface with slate colors
- Badge styling: Color-coded by zoning type

### Responsive Design
- Desktop: Full map with right sidebar
- Tablet: Map above, sidebar below (vertical layout)
- Mobile: Responsive adjustments with collapsible sidebar

## Dependencies

- **React**: 18.2.0
- **Leaflet**: 1.9.4
- **React-Leaflet**: 4.2.1
- **Supabase JS**: 2.38.0
- **TailwindCSS**: For base styling

## Map Tile Layer

Using OpenStreetMap tiles:
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

Can be replaced with:
- Google Maps tiles
- Mapbox tiles
- Custom tile servers

## Future Enhancements

1. **Property Boundary Visualization**
   - Display lot boundaries as GeoJSON polygons
   - Show property areas visually on map

2. **Advanced Search**
   - Filter by property type
   - Filter by zoning classification
   - Price range filtering

3. **Property Editing**
   - Inline editing in sidebar
   - Geolocation picker with map click
   - Batch import from CSV

4. **Analytics**
   - Property statistics dashboard
   - Market analysis by region
   - Zoning distribution charts

5. **Integration Features**
   - Export properties to CSV/PDF
   - Property comparison tool
   - Ownership history timeline
   - Document storage integration

6. **3D/Isometric View**
   - Three.js integration
   - Isometric property visualization
   - Building model rendering

7. **Regulations & Compliance**
   - Display building codes by region
   - Zoning regulations sidebar
   - Property restriction alerts
   - Strata laws information

## Troubleshooting

### Map Not Loading
- Check Leaflet CSS is imported
- Verify Supabase connection
- Check browser console for errors

### Markers Not Showing
- Ensure properties have lat/long values
- Verify coordinates are within Philippines bounds
- Check zoning_classification is set

### Sidebar Not Appearing
- Click on a marker to activate
- Verify property has complete address data
- Check sidebar CSS is loaded

### Search Not Working
- Verify property address fields are populated
- Clear search bar and try again
- Check for special characters in search

## Performance Optimization

For large datasets (1000+ properties):
1. Implement marker clustering
2. Use viewport-based loading
3. Add property caching
4. Implement pagination for sidebar list

## Contributing

When adding new features:
1. Update database schema if needed
2. Add migrations for new tables/columns
3. Update PropertyMapper component
4. Add styling to PropertyMapper.css
5. Test with seed data

## License

Part of the Currency.ph application ecosystem.
