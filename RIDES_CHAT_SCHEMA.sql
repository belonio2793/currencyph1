-- Chat table for ride matches
CREATE TABLE IF NOT EXISTS ride_match_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL UNIQUE REFERENCES ride_matches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table for ride match chats
CREATE TABLE IF NOT EXISTS ride_match_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES ride_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ride_match_chats_match_id ON ride_match_chats(match_id);
CREATE INDEX IF NOT EXISTS idx_ride_match_messages_match_id ON ride_match_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_ride_match_messages_user_id ON ride_match_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_match_messages_created_at ON ride_match_messages(created_at);
