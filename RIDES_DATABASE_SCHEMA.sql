-- ============================================================================
-- RIDES FEATURE - COMPREHENSIVE DATABASE SCHEMA
-- ============================================================================
-- This schema supports a full-featured Uber-like ride-sharing application
-- for the Philippines with real-time tracking, ratings, and payments.

-- ============================================================================
-- 1. RIDE PROFILES TABLE - Store driver and rider information
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'rider', -- 'rider' or 'driver'
  
  -- Personal info
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  profile_photo_url VARCHAR(500),
  city VARCHAR(100),
  
  -- Driver-specific info
  vehicle_type VARCHAR(50), -- 'car', 'tricycle', 'motorcycle'
  vehicle_plate VARCHAR(20),
  vehicle_brand VARCHAR(100),
  vehicle_color VARCHAR(50),
  driver_license VARCHAR(50),
  license_expiry DATE,
  
  -- Status and location
  status VARCHAR(20) DEFAULT 'offline', -- 'offline', 'available', 'on-job'
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Rating and statistics
  average_rating DECIMAL(3, 2) DEFAULT 5.0,
  total_rides INT DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  cancellation_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  is_identity_verified BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_location_update TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ride_profiles_user_id ON ride_profiles(user_id);
CREATE INDEX idx_ride_profiles_role ON ride_profiles(role);
CREATE INDEX idx_ride_profiles_status ON ride_profiles(status);
CREATE INDEX idx_ride_profiles_city ON ride_profiles(city);
CREATE INDEX idx_ride_profiles_location ON ride_profiles(latitude, longitude);

-- ============================================================================
-- 2. RIDES TABLE - Store ride requests and bookings
-- ============================================================================
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Route information
  start_latitude DECIMAL(10, 8) NOT NULL,
  start_longitude DECIMAL(11, 8) NOT NULL,
  end_latitude DECIMAL(10, 8) NOT NULL,
  end_longitude DECIMAL(11, 8) NOT NULL,
  start_address VARCHAR(500),
  end_address VARCHAR(500),
  
  -- Ride details
  ride_type VARCHAR(50) NOT NULL DEFAULT 'ride-share', -- 'ride-share', 'package', 'food', 'laundry'
  passenger_count INT DEFAULT 1,
  special_requests TEXT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'requested', -- 'requested', 'accepted', 'picked-up', 'in-progress', 'completed', 'cancelled'
  
  -- Pricing
  estimated_distance_km DECIMAL(10, 2),
  estimated_duration_minutes INT,
  estimated_base_fare DECIMAL(10, 2),
  estimated_total_price DECIMAL(10, 2),
  actual_distance_km DECIMAL(10, 2),
  actual_duration_minutes INT,
  final_price DECIMAL(10, 2),
  rider_offered_amount DECIMAL(10, 2), -- Rider's custom offer
  
  -- Payment
  payment_method VARCHAR(50) DEFAULT 'wallet', -- 'wallet', 'cash', 'card'
  payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Locations and timing
  pickup_time TIMESTAMP WITH TIME ZONE,
  dropoff_time TIMESTAMP WITH TIME ZONE,
  estimated_arrival_time TIMESTAMP WITH TIME ZONE,
  
  -- Cancellation
  cancelled_by VARCHAR(20), -- 'rider', 'driver', 'system'
  cancellation_reason VARCHAR(255),
  cancellation_fee DECIMAL(10, 2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rides_rider_id ON rides(rider_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_created_at ON rides(created_at DESC);
CREATE INDEX idx_rides_ride_type ON rides(ride_type);

-- ============================================================================
-- 3. RIDE RATINGS TABLE - Store ratings and reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  
  -- Who rated whom
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rating info
  rating_type VARCHAR(20) NOT NULL, -- 'driver-for-rider', 'rider-for-driver'
  rating_score INT NOT NULL CHECK (rating_score >= 1 AND rating_score <= 5),
  review_text TEXT,
  
  -- Rating categories
  cleanliness_rating INT CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  safety_rating INT CHECK (safety_rating >= 1 AND safety_rating <= 5),
  friendliness_rating INT CHECK (friendliness_rating >= 1 AND friendliness_rating <= 5),
  
  -- Tags/Issues
  tags TEXT[], -- Array of issue tags like 'rude', 'late', 'dirty_car', 'unsafe_driving'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ride_ratings_ride_id ON ride_ratings(ride_id);
CREATE INDEX idx_ride_ratings_rater_id ON ride_ratings(rater_id);
CREATE INDEX idx_ride_ratings_ratee_id ON ride_ratings(ratee_id);
CREATE INDEX idx_ride_ratings_created_at ON ride_ratings(created_at DESC);

-- ============================================================================
-- 4. RIDE TRANSACTIONS TABLE - Payment and financial tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type VARCHAR(50) NOT NULL, -- 'fare_payment', 'tip', 'refund', 'cancellation_fee'
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  
  -- From/To
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
  
  -- Payment method
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  
  -- Wallet integration
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  
  -- Description
  description VARCHAR(500),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ride_transactions_ride_id ON ride_transactions(ride_id);
CREATE INDEX idx_ride_transactions_from_user ON ride_transactions(from_user_id);
CREATE INDEX idx_ride_transactions_to_user ON ride_transactions(to_user_id);
CREATE INDEX idx_ride_transactions_status ON ride_transactions(status);
CREATE INDEX idx_ride_transactions_created_at ON ride_transactions(created_at DESC);

-- ============================================================================
-- 5. RIDE CHAT MESSAGES TABLE - Real-time messaging between driver and rider
-- ============================================================================
CREATE TABLE IF NOT EXISTS ride_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  
  -- Sender info
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL, -- 'driver' or 'rider'
  
  -- Message content
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'location', 'image', 'offer'
  
  -- Location message specifics
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  location_address VARCHAR(500),
  
  -- Image message specifics
  image_url VARCHAR(500),
  
  -- Offer message specifics (for custom fare offers)
  offer_amount DECIMAL(10, 2),
  offer_status VARCHAR(20), -- 'pending', 'accepted', 'rejected'
  
  -- Read status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ride_chat_messages_ride_id ON ride_chat_messages(ride_id);
CREATE INDEX idx_ride_chat_messages_sender_id ON ride_chat_messages(sender_id);
CREATE INDEX idx_ride_chat_messages_is_read ON ride_chat_messages(is_read);
CREATE INDEX idx_ride_chat_messages_created_at ON ride_chat_messages(created_at DESC);

-- ============================================================================
-- 6. RIDE HISTORY VIEW - Quick access to completed rides
-- ============================================================================
CREATE VIEW ride_history_view AS
SELECT 
  r.id,
  r.rider_id,
  r.driver_id,
  r.ride_type,
  r.status,
  r.final_price,
  r.tip_amount,
  r.start_address,
  r.end_address,
  r.pickup_time,
  r.dropoff_time,
  r.actual_distance_km,
  r.actual_duration_minutes,
  (SELECT COALESCE(AVG(rating_score), 0) FROM ride_ratings 
   WHERE ride_id = r.id AND rater_id = r.rider_id) as driver_rating,
  (SELECT COALESCE(AVG(rating_score), 0) FROM ride_ratings 
   WHERE ride_id = r.id AND rater_id = r.driver_id) as rider_rating,
  r.created_at,
  r.updated_at
FROM rides r
WHERE r.status = 'completed';

-- ============================================================================
-- 7. ENABLE REALTIME FOR NECESSARY TABLES
-- ============================================================================
-- Run these commands in Supabase dashboard to enable realtime:
-- ALTER PUBLICATION supabase_realtime ADD TABLE ride_profiles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE rides;
-- ALTER PUBLICATION supabase_realtime ADD TABLE ride_chat_messages;

-- ============================================================================
-- 8. CREATE RLS POLICIES
-- ============================================================================

-- Enable RLS on ride_profiles
ALTER TABLE ride_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON ride_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON ride_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON ride_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view driver profiles" ON ride_profiles
  FOR SELECT USING (role = 'driver' OR auth.uid() = user_id);

-- Enable RLS on rides
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rides" ON rides
  FOR SELECT USING (auth.uid() = rider_id OR auth.uid() = driver_id);

CREATE POLICY "Users can insert ride requests" ON rides
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Drivers can update ride status" ON rides
  FOR UPDATE USING (auth.uid() = driver_id);

-- Enable RLS on ride_ratings
ALTER TABLE ride_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings for their rides" ON ride_ratings
  FOR SELECT USING (auth.uid() = rater_id OR auth.uid() = ratee_id);

CREATE POLICY "Users can insert ratings for completed rides" ON ride_ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- Enable RLS on ride_transactions
ALTER TABLE ride_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON ride_transactions
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Enable RLS on ride_chat_messages
ALTER TABLE ride_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their rides" ON ride_chat_messages
  FOR SELECT USING (
    ride_id IN (
      SELECT id FROM rides 
      WHERE rider_id = auth.uid() OR driver_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their rides" ON ride_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    ride_id IN (
      SELECT id FROM rides 
      WHERE rider_id = auth.uid() OR driver_id = auth.uid()
    )
  );

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables created:
-- 1. ride_profiles - Driver and rider profiles
-- 2. rides - Ride requests and bookings
-- 3. ride_ratings - Ratings and reviews
-- 4. ride_transactions - Payment tracking
-- 5. ride_chat_messages - Real-time messaging
--
-- All tables have:
-- - Proper indexing for performance
-- - RLS policies for security
-- - Timestamps for audit trails
-- - Foreign key constraints
-- ============================================================================
