-- Migration: Create extended rides table with comprehensive routing details
-- This migration sets up the main rides table with full route calculation, 
-- distance/duration/fare estimation, and real-time sync capabilities

-- ============================================================================
-- CREATE RIDES TABLE - Main table for ride requests and tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User information
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Pickup and destination coordinates
  start_latitude DECIMAL(10, 8) NOT NULL,
  start_longitude DECIMAL(11, 8) NOT NULL,
  start_address VARCHAR(500),
  
  end_latitude DECIMAL(10, 8) NOT NULL,
  end_longitude DECIMAL(11, 8) NOT NULL,
  end_address VARCHAR(500),
  
  -- Route and distance details
  estimated_distance DECIMAL(10, 3), -- in kilometers
  estimated_duration INTEGER, -- in minutes
  actual_distance DECIMAL(10, 3), -- actual distance traveled
  actual_duration INTEGER, -- actual duration in minutes
  
  -- Fare information
  estimated_fare DECIMAL(10, 2), -- estimated fare in PHP
  actual_fare DECIMAL(10, 2), -- actual fare paid
  base_fare DECIMAL(10, 2),
  distance_fare DECIMAL(10, 2),
  time_fare DECIMAL(10, 2),
  surge_multiplier DECIMAL(5, 2) DEFAULT 1.0,
  
  -- Route geometry and details
  route_geometry JSONB, -- GeoJSON geometry coordinates
  route_steps JSONB, -- Detailed turn-by-turn directions
  route_metadata JSONB, -- Additional route metadata
  
  -- Ride details
  ride_type VARCHAR(50) DEFAULT 'ride-share', -- e.g., 'ride-share', 'premium', 'package'
  vehicle_type VARCHAR(50), -- e.g., 'car', 'tricycle'
  service_type VARCHAR(50), -- service tier
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',
    'accepted',
    'arrived',
    'in-progress',
    'completed',
    'cancelled'
  )),
  
  -- Timestamps
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional details
  passenger_count INTEGER DEFAULT 1,
  notes TEXT,
  cancellation_reason VARCHAR(255),
  cancelled_by VARCHAR(20), -- 'rider' or 'driver'
  
  -- Sync and metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_ride_type ON rides(ride_type);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at);
CREATE INDEX IF NOT EXISTS idx_rides_requested_at ON rides(requested_at);
CREATE INDEX IF NOT EXISTS idx_rides_completed_at ON rides(completed_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rides_rider_status ON rides(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON rides(driver_id, status);

-- Spatial indexes for location-based queries (if PostGIS is available)
CREATE INDEX IF NOT EXISTS idx_rides_start_location 
ON rides USING GIST (
  ST_SetSRID(ST_MakePoint(start_longitude, start_latitude), 4326)
);
CREATE INDEX IF NOT EXISTS idx_rides_end_location 
ON rides USING GIST (
  ST_SetSRID(ST_MakePoint(end_longitude, end_latitude), 4326)
);

-- ============================================================================
-- CREATE RIDE TRANSACTIONS TABLE - For payment tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'fare_payment',
    'tip',
    'cancellation_fee',
    'refund'
  )),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  from_user_id UUID NOT NULL REFERENCES auth.users(id),
  to_user_id UUID NOT NULL REFERENCES auth.users(id),
  payment_method VARCHAR(50), -- 'cash', 'gcash', 'card', etc.
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ride_transactions_ride_id ON ride_transactions(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_transactions_from_user ON ride_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_transactions_to_user ON ride_transactions(to_user_id);

-- ============================================================================
-- CREATE RIDE CHAT MESSAGES TABLE - For in-ride communication
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) CHECK (sender_type IN ('rider', 'driver')),
  message TEXT,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'location')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_chat_messages_ride_id ON ride_chat_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_chat_messages_sender_id ON ride_chat_messages(sender_id);

-- ============================================================================
-- CREATE RIDE RATINGS TABLE - For post-ride reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id),
  ratee_id UUID NOT NULL REFERENCES auth.users(id),
  rating_type VARCHAR(50) CHECK (rating_type IN (
    'driver-for-rider',
    'rider-for-driver'
  )),
  rating_score INTEGER CHECK (rating_score >= 1 AND rating_score <= 5),
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  safety_rating INTEGER CHECK (safety_rating >= 1 AND safety_rating <= 5),
  friendliness_rating INTEGER CHECK (friendliness_rating >= 1 AND friendliness_rating <= 5),
  review_text TEXT,
  tags TEXT[], -- e.g., ['polite', 'clean', 'safe', 'professional']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_ratings_ride_id ON ride_ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_rater_id ON ride_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_ratee_id ON ride_ratings(ratee_id);

-- ============================================================================
-- ENABLE REALTIME FOR RIDES TABLES
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_ratings;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION haversine_distance_km(
  lat1 FLOAT8, 
  lon1 FLOAT8, 
  lat2 FLOAT8, 
  lon2 FLOAT8
) RETURNS FLOAT8 AS $$
DECLARE
  R FLOAT8 := 6371; -- Earth radius in kilometers
  d_lat FLOAT8;
  d_lon FLOAT8;
  a FLOAT8;
  c FLOAT8;
BEGIN
  d_lat := (lat2 - lat1) * pi() / 180.0;
  d_lon := (lon2 - lon1) * pi() / 180.0;
  a := sin(d_lat/2) * sin(d_lat/2) + 
       cos(lat1 * pi() / 180.0) * cos(lat2 * pi() / 180.0) * 
       sin(d_lon/2) * sin(d_lon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby rides based on location and radius
CREATE OR REPLACE FUNCTION find_nearby_rides(
  user_lat FLOAT8,
  user_lon FLOAT8,
  radius_km FLOAT8 DEFAULT 5,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  start_latitude DECIMAL,
  start_longitude DECIMAL,
  end_latitude DECIMAL,
  end_longitude DECIMAL,
  estimated_distance DECIMAL,
  estimated_duration INT,
  estimated_fare DECIMAL,
  status VARCHAR,
  distance_to_user FLOAT8
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.start_latitude,
    r.start_longitude,
    r.end_latitude,
    r.end_longitude,
    r.estimated_distance,
    r.estimated_duration,
    r.estimated_fare,
    r.status,
    haversine_distance_km(user_lat, user_lon, r.start_latitude::FLOAT8, r.start_longitude::FLOAT8) as distance
  FROM rides r
  WHERE haversine_distance_km(user_lat, user_lon, r.start_latitude::FLOAT8, r.start_longitude::FLOAT8) <= radius_km
    AND r.status IN ('requested', 'accepted')
  ORDER BY distance
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to update ride status with timestamps
CREATE OR REPLACE FUNCTION update_ride_status(
  p_ride_id UUID,
  p_new_status VARCHAR
) RETURNS rides AS $$
DECLARE
  v_ride rides;
BEGIN
  UPDATE rides
  SET 
    status = p_new_status,
    updated_at = NOW(),
    accepted_at = CASE WHEN p_new_status = 'accepted' THEN NOW() ELSE accepted_at END,
    started_at = CASE WHEN p_new_status = 'in-progress' THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END
  WHERE id = p_ride_id
  RETURNING * INTO v_ride;
  
  RETURN v_ride;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all rides tables
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_ratings ENABLE ROW LEVEL SECURITY;

-- Rides policies
CREATE POLICY "Users can view their own rides"
  ON rides FOR SELECT
  USING (auth.uid() = rider_id OR auth.uid() = driver_id);

CREATE POLICY "Users can create rides"
  ON rides FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Users can update their rides"
  ON rides FOR UPDATE
  USING (auth.uid() = rider_id OR auth.uid() = driver_id);

-- Transactions policies
CREATE POLICY "Users can view their transactions"
  ON ride_transactions FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "System can create transactions"
  ON ride_transactions FOR INSERT
  WITH CHECK (TRUE);

-- Chat messages policies
CREATE POLICY "Users can view ride chat"
  ON ride_chat_messages FOR SELECT
  USING (
    ride_id IN (
      SELECT id FROM rides 
      WHERE auth.uid() = rider_id OR auth.uid() = driver_id
    )
  );

CREATE POLICY "Users can send messages"
  ON ride_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Ratings policies
CREATE POLICY "Users can view ride ratings"
  ON ride_ratings FOR SELECT
  USING (
    ride_id IN (
      SELECT id FROM rides 
      WHERE auth.uid() = rider_id OR auth.uid() = driver_id
    )
  );

CREATE POLICY "Users can create ratings"
  ON ride_ratings FOR INSERT
  WITH CHECK (auth.uid() = rater_id);
