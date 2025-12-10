-- Create planning_products table for tracking agricultural production sources
-- Tracks farms/sources for water, coconuts, and mango with different marker colors

CREATE TABLE IF NOT EXISTS public.planning_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_user_id UUID NOT NULL REFERENCES public.planning_users(id) ON DELETE CASCADE,
  
  -- Product Information
  product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('water', 'coconut', 'mango')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Farm/Source Location
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  city VARCHAR(255),
  province VARCHAR(255),
  region VARCHAR(255),
  
  -- Production Data
  quantity_available DECIMAL(12, 2),
  quantity_unit VARCHAR(50),  -- e.g., 'kg', 'liters', 'tonnes'
  harvest_season VARCHAR(100),
  
  -- Marker Styling
  marker_color VARCHAR(50) DEFAULT 'red',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_coordinates CHECK (
    latitude >= -90 AND latitude <= 90 AND 
    longitude >= -180 AND longitude <= 180
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_products_product_type ON public.planning_products(product_type);
CREATE INDEX IF NOT EXISTS idx_planning_products_user_id ON public.planning_products(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_products_planning_user_id ON public.planning_products(planning_user_id);
CREATE INDEX IF NOT EXISTS idx_planning_products_coordinates ON public.planning_products(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_planning_products_is_active ON public.planning_products(is_active);
CREATE INDEX IF NOT EXISTS idx_planning_products_province ON public.planning_products(province);

-- Enable RLS (Row Level Security)
ALTER TABLE public.planning_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read all products" ON public.planning_products;
DROP POLICY IF EXISTS "Allow users to create own products" ON public.planning_products;
DROP POLICY IF EXISTS "Allow users to update own products" ON public.planning_products;
DROP POLICY IF EXISTS "Allow users to delete own products" ON public.planning_products;

-- RLS Policies
CREATE POLICY "Allow read all products" ON public.planning_products
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow users to create own products" ON public.planning_products
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to update own products" ON public.planning_products
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to delete own products" ON public.planning_products
  FOR DELETE USING (user_id = auth.uid());

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_planning_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planning_products_update_timestamp ON public.planning_products;

CREATE TRIGGER planning_products_update_timestamp
  BEFORE UPDATE ON public.planning_products
  FOR EACH ROW
  EXECUTE FUNCTION update_planning_products_updated_at();
