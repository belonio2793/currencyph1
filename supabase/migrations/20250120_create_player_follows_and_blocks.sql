-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GAME PLAYER FOLLOWS TABLE
CREATE TABLE IF NOT EXISTS game_player_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (follower_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- GAME PLAYER BLOCKS TABLE
CREATE TABLE IF NOT EXISTS game_player_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (blocker_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- Create indices for faster queries
CREATE INDEX IF NOT EXISTS idx_game_player_follows_follower ON game_player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_game_player_follows_following ON game_player_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_game_player_blocks_blocker ON game_player_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_game_player_blocks_blocked ON game_player_blocks(blocked_id);

-- RLS Policies for game_player_follows
ALTER TABLE game_player_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follows"
ON game_player_follows
FOR SELECT
USING (true);

CREATE POLICY "Users can insert follows for themselves"
ON game_player_follows
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own follows"
ON game_player_follows
FOR DELETE
USING (true);

-- RLS Policies for game_player_blocks
ALTER TABLE game_player_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocks"
ON game_player_blocks
FOR SELECT
USING (true);

CREATE POLICY "Users can insert blocks for themselves"
ON game_player_blocks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own blocks"
ON game_player_blocks
FOR DELETE
USING (true);
