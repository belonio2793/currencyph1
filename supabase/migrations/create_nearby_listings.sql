-- Create nearby_listings table
CREATE TABLE IF NOT EXISTS nearby_listings (
  id BIGSERIAL PRIMARY KEY,
  tripadvisor_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(3, 2),
  category VARCHAR(255),
  source VARCHAR(50) DEFAULT 'tripadvisor',
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nearby_listings_name ON nearby_listings(name);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_address ON nearby_listings USING GIN(to_tsvector('english', address));
CREATE INDEX IF NOT EXISTS idx_nearby_listings_rating ON nearby_listings(rating DESC);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_category ON nearby_listings(category);
CREATE INDEX IF NOT EXISTS idx_nearby_listings_tripadvisor_id ON nearby_listings(tripadvisor_id);

-- Create listing_votes table for voting functionality
CREATE TABLE IF NOT EXISTS listing_votes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id VARCHAR(255) NOT NULL REFERENCES nearby_listings(tripadvisor_id) ON DELETE CASCADE,
  listing_type VARCHAR(50) DEFAULT 'nearby',
  vote_type VARCHAR(10) NOT NULL, -- 'up' or 'down'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, listing_id, listing_type)
);

-- Create index for vote queries
CREATE INDEX IF NOT EXISTS idx_listing_votes_listing ON listing_votes(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_votes_user ON listing_votes(user_id);

-- Create pending_listings table for user submissions
CREATE TABLE IF NOT EXISTS pending_listings (
  id BIGSERIAL PRIMARY KEY,
  submitted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(3, 2),
  category VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for pending queries
CREATE INDEX idx_pending_listings_status ON pending_listings(status);
CREATE INDEX idx_pending_listings_user ON pending_listings(submitted_by_user_id);

-- Create approval_votes table for community moderation
CREATE TABLE IF NOT EXISTS approval_votes (
  id BIGSERIAL PRIMARY KEY,
  pending_listing_id BIGINT NOT NULL REFERENCES pending_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote VARCHAR(50) NOT NULL, -- 'approve' or 'reject'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pending_listing_id, user_id)
);

-- Create index for approval votes
CREATE INDEX idx_approval_votes_pending ON approval_votes(pending_listing_id);
CREATE INDEX idx_approval_votes_user ON approval_votes(user_id);

-- Enable RLS for listing_votes
ALTER TABLE listing_votes ENABLE ROW LEVEL SECURITY;

-- Create policy for listing_votes
CREATE POLICY "Users can view all votes" ON listing_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can vote" ON listing_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes" ON listing_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes" ON listing_votes
  FOR DELETE USING (auth.uid() = user_id);
