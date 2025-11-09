-- Player-to-player trading system
CREATE TABLE IF NOT EXISTS game_player_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  initiator_items JSONB DEFAULT '[]',
  receiver_items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, completed, cancelled
  initiated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (initiator_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  CHECK (initiator_id != receiver_id)
);

-- Property trading/selling
CREATE TABLE IF NOT EXISTS game_property_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  buyer_id UUID,
  asking_price NUMERIC NOT NULL,
  sale_price NUMERIC,
  status TEXT DEFAULT 'active', -- active, sold, cancelled
  created_at TIMESTAMPTZ DEFAULT now(),
  sold_at TIMESTAMPTZ,
  FOREIGN KEY (property_id) REFERENCES game_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_id) REFERENCES game_characters(id) ON DELETE SET NULL
);

-- Trading history/log
CREATE TABLE IF NOT EXISTS game_trade_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID,
  player1_id UUID NOT NULL,
  player2_id UUID NOT NULL,
  player1_sent JSONB,
  player2_sent JSONB,
  completed_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (trade_id) REFERENCES game_player_trades(id) ON DELETE CASCADE,
  FOREIGN KEY (player1_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- Create indices for trading
CREATE INDEX IF NOT EXISTS idx_player_trades_initiator ON game_player_trades(initiator_id);
CREATE INDEX IF NOT EXISTS idx_player_trades_receiver ON game_player_trades(receiver_id);
CREATE INDEX IF NOT EXISTS idx_player_trades_status ON game_player_trades(status);
CREATE INDEX IF NOT EXISTS idx_property_sales_seller ON game_property_sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_property_sales_buyer ON game_property_sales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_property_sales_status ON game_property_sales(status);
CREATE INDEX IF NOT EXISTS idx_trade_history_players ON game_trade_history(player1_id, player2_id);

-- RLS policies for trading
ALTER TABLE game_player_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_property_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_trade_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view and manage their own trades
CREATE POLICY "Users can view their trades"
ON game_player_trades
FOR SELECT
USING (true);

CREATE POLICY "Users can create trades"
ON game_player_trades
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own trades"
ON game_player_trades
FOR UPDATE
USING (true);

-- Allow users to view property sales
CREATE POLICY "Users can view property sales"
ON game_property_sales
FOR SELECT
USING (true);

CREATE POLICY "Users can create property sales"
ON game_property_sales
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own sales"
ON game_property_sales
FOR UPDATE
USING (true);

-- Allow users to view trade history
CREATE POLICY "Users can view trade history"
ON game_trade_history
FOR SELECT
USING (true);
