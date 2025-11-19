-- Live locations table for real-time tracking during active rides
CREATE TABLE IF NOT EXISTS ride_live_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES ride_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INTEGER, -- GPS accuracy in meters
  speed DECIMAL(5, 2), -- speed in km/h
  heading INTEGER, -- bearing in degrees
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ride_live_locations_match_id ON ride_live_locations(match_id);
CREATE INDEX IF NOT EXISTS idx_ride_live_locations_user_id ON ride_live_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_live_locations_updated_at ON ride_live_locations(updated_at);
