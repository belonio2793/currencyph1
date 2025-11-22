-- Create addresses table with comprehensive geolocation and property information
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Address components
  addresses_address TEXT,
  addresses_street_number TEXT,
  addresses_street_name TEXT,
  addresses_city TEXT,
  addresses_province TEXT,
  addresses_region TEXT,
  addresses_postal_code TEXT,
  
  -- Geolocation
  addresses_latitude DECIMAL(10, 8),
  addresses_longitude DECIMAL(11, 8),
  
  -- Property information
  lot_number TEXT,
  lot_area DECIMAL(10, 2),
  lot_area_unit VARCHAR(20) DEFAULT 'sqm',
  property_type VARCHAR(50),
  zoning_classification TEXT,
  
  -- Ownership and titles
  owner_name TEXT,
  land_title_number TEXT,
  certificate_of_ownership TEXT,
  
  -- Building/Structure information
  building_name TEXT,
  building_number TEXT,
  floor_number TEXT,
  unit_number TEXT,
  
  -- Administrative
  barangay TEXT,
  municipality TEXT,
  land_use VARCHAR(100),
  tax_declaration_number TEXT,
  cadastral_lot_number TEXT,
  
  -- Boundaries and mapping
  boundary_geojson JSONB,
  elevation DECIMAL(8, 2),
  
  -- Status and metadata
  is_default BOOLEAN DEFAULT FALSE,
  property_status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on geolocation for faster spatial queries
CREATE INDEX idx_addresses_geolocation ON addresses(addresses_latitude, addresses_longitude);
CREATE INDEX idx_addresses_city ON addresses(addresses_city);
CREATE INDEX idx_addresses_region ON addresses(addresses_region);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_property_type ON addresses(property_type);
CREATE INDEX idx_addresses_zoning ON addresses(zoning_classification);

-- Create property_zoning_rules table
CREATE TABLE IF NOT EXISTS property_zoning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT,
  city TEXT,
  zoning_code VARCHAR(50),
  zoning_name TEXT,
  description TEXT,
  allowed_uses TEXT[],
  prohibited_uses TEXT[],
  max_floor_area_ratio DECIMAL(5, 2),
  max_building_height DECIMAL(6, 2),
  setback_front DECIMAL(6, 2),
  setback_side DECIMAL(6, 2),
  setback_rear DECIMAL(6, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create property_boundaries table for storing lot boundaries
CREATE TABLE IF NOT EXISTS property_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID REFERENCES addresses(id) ON DELETE CASCADE,
  boundary_type VARCHAR(50),
  boundary_geojson JSONB,
  area_sqm DECIMAL(10, 2),
  perimeter_m DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create property_documents table
CREATE TABLE IF NOT EXISTS property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID REFERENCES addresses(id) ON DELETE CASCADE,
  document_type VARCHAR(100),
  document_name TEXT,
  document_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create region boundaries table for country mapping
CREATE TABLE IF NOT EXISTS region_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_name TEXT UNIQUE,
  region_code VARCHAR(10),
  boundary_geojson JSONB,
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for region boundaries
CREATE INDEX idx_region_boundaries_name ON region_boundaries(region_name);
CREATE INDEX idx_region_boundaries_geolocation ON region_boundaries(center_latitude, center_longitude);

-- Create city boundaries table
CREATE TABLE IF NOT EXISTS city_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT,
  province TEXT,
  region TEXT,
  city_code VARCHAR(10),
  boundary_geojson JSONB,
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for city boundaries
CREATE INDEX idx_city_boundaries_city ON city_boundaries(city_name);
CREATE INDEX idx_city_boundaries_province ON city_boundaries(province);
CREATE INDEX idx_city_boundaries_region ON city_boundaries(region);
