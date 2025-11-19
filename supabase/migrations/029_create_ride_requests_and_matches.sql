-- Migration: Create ride_requests and ride_matches tables for rides feature
-- This migration creates tables to support the peer-to-peer rides matching system

-- ============================================================================
-- RIDE REQUESTS TABLE - Store requests from riders or driver availability posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('rider', 'driver')), -- who posted: rider looking for driver or driver offering ride
  start_latitude DECIMAL(10, 8) NOT NULL,
  start_longitude DECIMAL(11, 8) NOT NULL,
  start_address VARCHAR(500),
  end_latitude DECIMAL(10, 8) NOT NULL,
  end_longitude DECIMAL(11, 8) NOT NULL,
  end_address VARCHAR(500),
  estimated_distance DECIMAL(10, 2), -- in kilometers
  estimated_duration INTEGER, -- in minutes
  estimated_fare DECIMAL(10, 2),
  vehicle_type VARCHAR(50), -- e.g., 'economy', 'premium'
  service_type VARCHAR(50), -- e.g., 'ride-share', 'private'
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'completed', 'cancelled')),
  passengers_count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- ============================================================================
-- RIDE MATCHES TABLE - Track mutual agreements between riders and drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_request_id UUID NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Request made, waiting for acceptance
    'accepted_by_driver', -- Driver accepted, waiting for rider confirmation
    'accepted_by_rider',  -- Rider accepted, waiting for driver confirmation
    'confirmed',          -- Both accepted - mutual agreement
    'in_progress',        -- Trip started
    'completed',          -- Trip finished
    'cancelled'           -- Cancelled by either party
  )),
  rider_confirmed BOOLEAN DEFAULT FALSE,
  driver_confirmed BOOLEAN DEFAULT FALSE,
  rider_confirmed_at TIMESTAMP WITH TIME ZONE,
  driver_confirmed_at TIMESTAMP WITH TIME ZONE,
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),
  dropoff_latitude DECIMAL(10, 8),
  dropoff_longitude DECIMAL(11, 8),
  route_geometry JSONB, -- GeoJSON geometry from routing engine
  estimated_distance DECIMAL(10, 2),
  estimated_duration INTEGER,
  estimated_fare DECIMAL(10, 2),
  actual_distance DECIMAL(10, 2),
  actual_duration INTEGER,
  actual_fare DECIMAL(10, 2),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- RATINGS TABLE - Store ratings for both riders and drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES ride_matches(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rater_role VARCHAR(10) NOT NULL CHECK (rater_role IN ('rider', 'driver')), -- who is rating
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ride_requests_user_id ON ride_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_user_type ON ride_requests(user_type);
CREATE INDEX IF NOT EXISTS idx_ride_requests_expires_at ON ride_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_ride_matches_rider_id ON ride_matches(rider_id);
CREATE INDEX IF NOT EXISTS idx_ride_matches_driver_id ON ride_matches(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_matches_status ON ride_matches(status);
CREATE INDEX IF NOT EXISTS idx_ride_matches_ride_request_id ON ride_matches(ride_request_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_rater_id ON ride_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_ratee_id ON ride_ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ride_ratings_match_id ON ride_ratings(match_id);

-- ============================================================================
-- ENABLE REALTIME FOR RIDES TABLES
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ride_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_ratings;
