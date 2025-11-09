-- Random events that affect the economy
CREATE TABLE IF NOT EXISTS game_market_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- boom, crash, shortage, abundance, natural_disaster, tax_increase, tax_reduction
  description TEXT NOT NULL,
  icon TEXT,
  affected_properties TEXT[], -- array of property types affected
  price_multiplier NUMERIC DEFAULT 1.0,
  income_multiplier NUMERIC DEFAULT 1.0,
  duration_hours INT DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Player wealth tax records
CREATE TABLE IF NOT EXISTS game_taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  tax_amount NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0.05, -- 5% default
  reason TEXT,
  paid_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- Wealth redistribution pool
CREATE TABLE IF NOT EXISTS game_redistribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_collected NUMERIC DEFAULT 0,
  total_distributed NUMERIC DEFAULT 0,
  distribution_period TEXT,
  last_distributed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NPC vendors with dynamic pricing
CREATE TABLE IF NOT EXISTS game_npc_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  vendor_type TEXT NOT NULL, -- armorer, weaponsmith, potion_seller, equipment_dealer
  inventory JSONB, -- [{item_id, quantity, base_price}]
  reputation NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vendor transaction history
CREATE TABLE IF NOT EXISTS game_vendor_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  item_id UUID,
  quantity INT,
  price_paid NUMERIC,
  transaction_type TEXT, -- buy, sell
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES game_npc_vendors(id) ON DELETE CASCADE
);

-- Stock market shares
CREATE TABLE IF NOT EXISTS game_stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL, -- reference to a business property
  business_name TEXT NOT NULL,
  total_shares INT DEFAULT 100,
  current_price NUMERIC DEFAULT 10,
  previous_price NUMERIC DEFAULT 10,
  market_cap NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (business_id) REFERENCES game_properties(id) ON DELETE CASCADE
);

-- Player stock holdings
CREATE TABLE IF NOT EXISTS game_stock_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  stock_id UUID NOT NULL,
  quantity INT NOT NULL,
  purchase_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES game_stocks(id) ON DELETE CASCADE,
  UNIQUE(character_id, stock_id)
);

-- Stock transaction history
CREATE TABLE IF NOT EXISTS game_stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  stock_id UUID NOT NULL,
  transaction_type TEXT, -- buy, sell
  quantity INT NOT NULL,
  price_per_share NUMERIC NOT NULL,
  total_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES game_stocks(id) ON DELETE CASCADE
);

-- Create indices
CREATE INDEX IF NOT EXISTS idx_market_events_type ON game_market_events(event_type);
CREATE INDEX IF NOT EXISTS idx_market_events_active ON game_market_events(ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_taxes_character ON game_taxes(character_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transactions_character ON game_vendor_transactions(character_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transactions_vendor ON game_vendor_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_holdings_character ON game_stock_holdings(character_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_character ON game_stock_transactions(character_id);
CREATE INDEX IF NOT EXISTS idx_stock_price_history ON game_stock_transactions(stock_id, created_at);

-- RLS policies
ALTER TABLE game_market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_npc_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_vendor_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market events"
ON game_market_events FOR SELECT USING (true);

CREATE POLICY "Anyone can view taxes"
ON game_taxes FOR SELECT USING (true);

CREATE POLICY "Anyone can view vendors"
ON game_npc_vendors FOR SELECT USING (true);

CREATE POLICY "Anyone can view vendor transactions"
ON game_vendor_transactions FOR SELECT USING (true);

CREATE POLICY "Anyone can view stocks"
ON game_stocks FOR SELECT USING (true);

CREATE POLICY "Users can view their stock holdings"
ON game_stock_holdings FOR SELECT USING (true);

CREATE POLICY "Users can view stock transactions"
ON game_stock_transactions FOR SELECT USING (true);
