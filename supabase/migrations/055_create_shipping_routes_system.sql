-- Create addresses_shipment_routes table for route management
CREATE TABLE IF NOT EXISTS addresses_shipment_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_name VARCHAR(255) NOT NULL,
  route_description TEXT,
  route_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  origin_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  destination_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  origin_latitude DECIMAL(10, 8),
  origin_longitude DECIMAL(11, 8),
  destination_latitude DECIMAL(10, 8),
  destination_longitude DECIMAL(11, 8),
  waypoints JSONB DEFAULT '[]',
  route_waypoints JSONB DEFAULT '{}',
  distance_km DECIMAL(10, 2),
  estimated_duration_hours DECIMAL(10, 2),
  cost_per_kg DECIMAL(10, 4),
  base_cost DECIMAL(12, 2),
  max_weight_kg DECIMAL(10, 2),
  priority_level VARCHAR(50) DEFAULT 'normal',
  vehicle_type VARCHAR(100),
  estimated_delivery_time_hours DECIMAL(10, 2),
  notes TEXT,
  shipments_count INTEGER DEFAULT 0,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_shipment_route_waypoints table for detailed waypoints
CREATE TABLE IF NOT EXISTS addresses_shipment_route_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES addresses_shipment_routes(id) ON DELETE CASCADE,
  waypoint_number INTEGER NOT NULL,
  location_name VARCHAR(255),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_address TEXT,
  waypoint_type VARCHAR(50) DEFAULT 'waypoint',
  arrival_time_minutes INTEGER,
  stop_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_shipment_route_assignments table for shipment-to-route assignments
CREATE TABLE IF NOT EXISTS addresses_shipment_route_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES addresses_shipment_routes(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES addresses_shipment_labels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_status VARCHAR(50) DEFAULT 'assigned',
  estimated_pickup_time TIMESTAMP WITH TIME ZONE,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_pickup_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  cost_applied DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_shipment_network_orders table for global order tracking
CREATE TABLE IF NOT EXISTS addresses_shipment_network_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES addresses_shipment_labels(id) ON DELETE SET NULL,
  order_number VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'normal',
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  origin_latitude DECIMAL(10, 8),
  origin_longitude DECIMAL(11, 8),
  destination_latitude DECIMAL(10, 8),
  destination_longitude DECIMAL(11, 8),
  package_weight_kg DECIMAL(10, 3),
  estimated_cost DECIMAL(12, 2),
  actual_cost DECIMAL(12, 2),
  assigned_route_id UUID REFERENCES addresses_shipment_routes(id) ON DELETE SET NULL,
  carrier_assigned VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_route_cost_aggregates table for cost tracking
CREATE TABLE IF NOT EXISTS addresses_route_cost_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES addresses_shipment_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aggregation_period VARCHAR(50) DEFAULT 'daily',
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_weight_kg DECIMAL(12, 2) DEFAULT 0,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  total_cost DECIMAL(15, 2) DEFAULT 0,
  average_cost_per_kg DECIMAL(10, 4),
  average_revenue_per_order DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for addresses_shipment_routes
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_routes_user_id 
ON addresses_shipment_routes(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_routes_status 
ON addresses_shipment_routes(status);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_routes_created_at 
ON addresses_shipment_routes(created_at);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_routes_origin_dest 
ON addresses_shipment_routes(origin_address_id, destination_address_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_routes_coordinates 
ON addresses_shipment_routes(origin_latitude, origin_longitude, destination_latitude, destination_longitude);

-- Create indexes for addresses_shipment_route_waypoints
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_route_waypoints_route_id 
ON addresses_shipment_route_waypoints(route_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_route_waypoints_coordinates 
ON addresses_shipment_route_waypoints(latitude, longitude);

-- Create indexes for addresses_shipment_route_assignments
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_route_assignments_route_id 
ON addresses_shipment_route_assignments(route_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_route_assignments_shipment_id 
ON addresses_shipment_route_assignments(shipment_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_route_assignments_user_id 
ON addresses_shipment_route_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_route_assignments_status 
ON addresses_shipment_route_assignments(assignment_status);

-- Create indexes for addresses_shipment_network_orders
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_network_orders_user_id 
ON addresses_shipment_network_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_network_orders_status 
ON addresses_shipment_network_orders(status);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_network_orders_created_at 
ON addresses_shipment_network_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_network_orders_route_id 
ON addresses_shipment_network_orders(assigned_route_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_network_orders_coordinates 
ON addresses_shipment_network_orders(origin_latitude, origin_longitude, destination_latitude, destination_longitude);

-- Create indexes for addresses_route_cost_aggregates
CREATE INDEX IF NOT EXISTS idx_addresses_route_cost_aggregates_route_id 
ON addresses_route_cost_aggregates(route_id);

CREATE INDEX IF NOT EXISTS idx_addresses_route_cost_aggregates_user_id 
ON addresses_route_cost_aggregates(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_route_cost_aggregates_period 
ON addresses_route_cost_aggregates(period_start_date, period_end_date);

-- Enable Row Level Security
ALTER TABLE addresses_shipment_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_shipment_route_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_shipment_route_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_shipment_network_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_route_cost_aggregates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for addresses_shipment_routes
CREATE POLICY "Users can view their own shipping routes"
ON addresses_shipment_routes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shipping routes"
ON addresses_shipment_routes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping routes"
ON addresses_shipment_routes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping routes"
ON addresses_shipment_routes FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for addresses_shipment_route_waypoints
CREATE POLICY "Users can view waypoints for their routes"
ON addresses_shipment_route_waypoints FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM addresses_shipment_routes asr
    WHERE asr.id = addresses_shipment_route_waypoints.route_id
    AND asr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create waypoints for their routes"
ON addresses_shipment_route_waypoints FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM addresses_shipment_routes asr
    WHERE asr.id = addresses_shipment_route_waypoints.route_id
    AND asr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update waypoints for their routes"
ON addresses_shipment_route_waypoints FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM addresses_shipment_routes asr
    WHERE asr.id = addresses_shipment_route_waypoints.route_id
    AND asr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete waypoints for their routes"
ON addresses_shipment_route_waypoints FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM addresses_shipment_routes asr
    WHERE asr.id = addresses_shipment_route_waypoints.route_id
    AND asr.user_id = auth.uid()
  )
);

-- RLS Policies for addresses_shipment_route_assignments
CREATE POLICY "Users can view assignments for their routes"
ON addresses_shipment_route_assignments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create assignments for their routes"
ON addresses_shipment_route_assignments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update assignments for their routes"
ON addresses_shipment_route_assignments FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for addresses_shipment_network_orders
CREATE POLICY "Users can view their own network orders"
ON addresses_shipment_network_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own network orders"
ON addresses_shipment_network_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own network orders"
ON addresses_shipment_network_orders FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for addresses_route_cost_aggregates
CREATE POLICY "Users can view cost aggregates for their routes"
ON addresses_route_cost_aggregates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create cost aggregates for their routes"
ON addresses_route_cost_aggregates FOR INSERT
WITH CHECK (auth.uid() = user_id);
