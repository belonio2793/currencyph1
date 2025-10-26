-- Nearby Listings Feature - Supabase Schema
-- Execute this SQL in your Supabase SQL Editor to add nearby listings and community features

-- Create nearby_listings table (approved/saved listings)
CREATE TABLE IF NOT EXISTS nearby_listings (
  id BIGSERIAL PRIMARY KEY,
  tripadvisor_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(3, 1),
  category VARCHAR(100),
  source VARCHAR(50) DEFAULT 'tripadvisor',
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create pending_listings table (user-submitted businesses awaiting approval)
CREATE TABLE IF NOT EXISTS pending_listings (
  id BIGSERIAL PRIMARY KEY,
  submitted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(3, 1),
  category VARCHAR(100),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approval_count INT DEFAULT 0,
  rejection_count INT DEFAULT 0,
  approved_by_user_id UUID,
  rejected_by_user_id UUID,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create listing_votes table (thumbs up/down from users)
CREATE TABLE IF NOT EXISTS listing_votes (
  id BIGSERIAL PRIMARY KEY,
  listing_id VARCHAR(255) NOT NULL,
  listing_type VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(listing_id, listing_type, user_id)
);

-- Create approval_votes table (for community approvals of pending listings)
CREATE TABLE IF NOT EXISTS approval_votes (
  id BIGSERIAL PRIMARY KEY,
  pending_listing_id BIGINT NOT NULL REFERENCES pending_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pending_listing_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_nearby_listings_tripadvisor ON nearby_listings(tripadvisor_id);
CREATE INDEX idx_nearby_listings_category ON nearby_listings(category);
CREATE INDEX idx_nearby_listings_name ON nearby_listings(name);
CREATE INDEX idx_pending_listings_status ON pending_listings(status);
CREATE INDEX idx_pending_listings_submitted_by ON pending_listings(submitted_by_user_id);
CREATE INDEX idx_listing_votes_listing ON listing_votes(listing_id, listing_type);
CREATE INDEX idx_listing_votes_user ON listing_votes(user_id);
CREATE INDEX idx_approval_votes_pending ON approval_votes(pending_listing_id);
CREATE INDEX idx_approval_votes_user ON approval_votes(user_id);

-- Enable Row Level Security
ALTER TABLE nearby_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Anyone can view nearby_listings
CREATE POLICY "Anyone can view nearby listings" ON nearby_listings
  FOR SELECT USING (true);

-- Anyone can view pending_listings
CREATE POLICY "Anyone can view pending listings" ON pending_listings
  FOR SELECT USING (true);

-- Authenticated users can submit pending listings
CREATE POLICY "Users can submit pending listings" ON pending_listings
  FOR INSERT WITH CHECK (auth.uid() = submitted_by_user_id);

-- Only submitter can view their own pending listing details
CREATE POLICY "Users can update own pending listings" ON pending_listings
  FOR UPDATE USING (auth.uid() = submitted_by_user_id);

-- Authenticated users can vote on listings
CREATE POLICY "Users can vote on listings" ON listing_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view listing votes" ON listing_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can update own votes" ON listing_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes" ON listing_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Authenticated users can vote on approvals
CREATE POLICY "Users can vote on approvals" ON approval_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view approval votes" ON approval_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can update own approval votes" ON approval_votes
  FOR UPDATE USING (auth.uid() = user_id);
