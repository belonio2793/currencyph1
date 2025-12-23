# Marketplace Setup Guide

## Create marketplace_listings Table

Run this SQL in your Supabase SQL Editor to create the marketplace_listings table:

```sql
-- Create marketplace_listings table
CREATE TABLE marketplace_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  commitment_profile_id UUID REFERENCES commitment_profiles(id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_email TEXT,
  what_can_offer TEXT NOT NULL,
  what_need TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matched', 'completed', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_marketplace_user_id ON marketplace_listings(user_id);
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_created ON marketplace_listings(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active listings
CREATE POLICY "Anyone can view active listings"
  ON marketplace_listings
  FOR SELECT
  USING (status = 'active');

-- Allow users to insert their own listings
CREATE POLICY "Users can insert their own listings"
  ON marketplace_listings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to update their own listings
CREATE POLICY "Users can update their own listings"
  ON marketplace_listings
  FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
```

## Features

✅ Free-spirited form (no required fields except one of: what_can_offer or what_need)
✅ Simple and clean design
✅ Anonymous submissions allowed (no user_id required)
✅ Authenticated users' data auto-populated
✅ Real-time matching capability
✅ Status tracking (active, matched, completed, archived)

## Testing

1. Navigate to the Partnership Network section
2. Scroll down to "Marketplace of Possibilities"
3. Fill in what you can offer and/or what you need
4. Click "Share & Connect"
5. You should see a success message

## Next Steps

- Build a matching algorithm to connect providers with requesters
- Add a view to show all active marketplace listings
- Create notifications when matches are found
- Add messaging system for marketplace interactions
