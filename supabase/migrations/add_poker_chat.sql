-- Create poker_chat table for in-game table chat
CREATE TABLE IF NOT EXISTS poker_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_poker_chat_table_id ON poker_chat(table_id);
CREATE INDEX IF NOT EXISTS idx_poker_chat_created_at ON poker_chat(created_at);

-- Enable RLS
ALTER TABLE poker_chat ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read poker chat" ON poker_chat FOR SELECT USING (true);
CREATE POLICY "Users can insert their own messages" ON poker_chat FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE poker_chat IS 'In-game chat messages for poker tables';
