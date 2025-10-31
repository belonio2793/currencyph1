# Chess Database Setup

Run these SQL statements in your Supabase dashboard to create the necessary tables for the Chess game feature.

## Create chess_games table

```sql
CREATE TABLE chess_games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  white_player_id UUID NOT NULL REFERENCES auth.users(id),
  white_player_email TEXT NOT NULL,
  black_player_id UUID,
  black_player_email TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
  result TEXT CHECK (result IN ('white_wins', 'black_wins', 'draw', NULL)),
  time_control TEXT DEFAULT 'rapid' CHECK (time_control IN ('blitz', 'rapid', 'classical', 'unlimited')),
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves JSONB DEFAULT '[]',
  last_move_by UUID,
  last_move_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX chess_games_white_player_idx ON chess_games(white_player_id);
CREATE INDEX chess_games_black_player_idx ON chess_games(black_player_id);
CREATE INDEX chess_games_status_idx ON chess_games(status);
CREATE INDEX chess_games_created_at_idx ON chess_games(created_at DESC);
```

## Enable Row Level Security (RLS)

```sql
-- Enable RLS on chess_games
ALTER TABLE chess_games ENABLE ROW LEVEL SECURITY;

-- Players can view games they're part of or waiting games
CREATE POLICY chess_games_select ON chess_games
  FOR SELECT USING (
    auth.uid() = white_player_id 
    OR auth.uid() = black_player_id 
    OR status = 'waiting'
  );

-- Players can insert their own games
CREATE POLICY chess_games_insert ON chess_games
  FOR INSERT WITH CHECK (auth.uid() = white_player_id);

-- Players can update their own games
CREATE POLICY chess_games_update ON chess_games
  FOR UPDATE USING (
    auth.uid() = white_player_id 
    OR auth.uid() = black_player_id
  );

-- Delete own games
CREATE POLICY chess_games_delete ON chess_games
  FOR DELETE USING (
    auth.uid() = white_player_id 
    OR auth.uid() = black_player_id
  );
```

## Steps to Apply

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the SQL statements above
5. Click "Run" to execute
6. Verify the tables were created in the Tables section

The chess_games table will now be ready for the Chess game feature!
