-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GAME CHARACTERS TABLE
CREATE TABLE IF NOT EXISTS game_characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  level INT DEFAULT 0,
  experience BIGINT DEFAULT 0,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  current_location TEXT DEFAULT 'Manila',
  home_city TEXT DEFAULT 'Manila',
  health INT DEFAULT 100,
  max_health INT DEFAULT 100,
  energy INT DEFAULT 100,
  max_energy INT DEFAULT 100,
  hunger INT DEFAULT 100,
  base_speed INT DEFAULT 5,
  money BIGINT DEFAULT 1000,
  appearance JSONB DEFAULT '{"gender":"male","skin_tone":"medium","hair_style":"short","height":175,"build":"average","hair_color":"black","rpm":{"model_url":null,"thumbnail":null,"meta":null}}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- GAME ITEMS TABLE (definitions)
CREATE TABLE IF NOT EXISTS game_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL, -- clothing, equipment, tool, consumable, property_deed, vehicle, business
  equipment_slot TEXT, -- head, body, legs, feet, right_hand, left_hand, necklace, ring, backpack
  brand TEXT, -- Nike, Adidas, Gucci, etc.
  base_price BIGINT DEFAULT 100,
  stats JSONB DEFAULT '{}', -- {speed_bonus: 1.1, exp_gain: 1.05, etc}
  image_url TEXT,
  is_tradeable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name)
);

-- GAME CHARACTER EQUIPMENT TABLE
CREATE TABLE IF NOT EXISTS game_character_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  equipment_slot TEXT NOT NULL,
  item_id UUID,
  equipped_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES game_items(id),
  UNIQUE(character_id, equipment_slot)
);

-- GAME INVENTORY TABLE
CREATE TABLE IF NOT EXISTS game_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  item_id UUID NOT NULL,
  quantity INT DEFAULT 1,
  acquired_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES game_items(id),
  UNIQUE(character_id, item_id)
);

-- GAME PROPERTIES TABLE (houses, businesses, farms)
CREATE TABLE IF NOT EXISTS game_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  property_type TEXT NOT NULL, -- house, business, farm, shop, factory
  location_x FLOAT NOT NULL,
  location_y FLOAT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  purchase_price BIGINT NOT NULL,
  current_value BIGINT,
  revenue_per_day BIGINT DEFAULT 0,
  workers_count INT DEFAULT 0,
  max_workers INT DEFAULT 5,
  inventory_slots JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (owner_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- GAME MARKETPLACE LISTINGS TABLE
CREATE TABLE IF NOT EXISTS game_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL,
  item_id UUID,
  property_id UUID,
  quantity INT DEFAULT 1,
  unit_price BIGINT NOT NULL,
  total_price BIGINT NOT NULL,
  listing_type TEXT NOT NULL, -- item, property, service
  status TEXT DEFAULT 'active', -- active, sold, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES game_characters(id),
  FOREIGN KEY (item_id) REFERENCES game_items(id),
  FOREIGN KEY (property_id) REFERENCES game_properties(id)
);

-- GAME TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS game_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID,
  seller_id UUID,
  item_id UUID,
  quantity INT,
  unit_price BIGINT,
  total_price BIGINT,
  transaction_type TEXT NOT NULL, -- buy, sell, trade, rent, property_sale
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (buyer_id) REFERENCES game_characters(id),
  FOREIGN KEY (seller_id) REFERENCES game_characters(id),
  FOREIGN KEY (item_id) REFERENCES game_items(id)
);

-- GAME QUESTS TABLE (definitions)
CREATE TABLE IF NOT EXISTS game_quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL, -- combat, gathering, trading, business, social, transportation
  category TEXT, -- daily, weekly, special, story
  xp_reward INT DEFAULT 100,
  money_reward BIGINT DEFAULT 0,
  item_rewards JSONB DEFAULT '[]',
  min_level INT DEFAULT 0,
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name)
);

-- GAME CHARACTER QUESTS (progress)
CREATE TABLE IF NOT EXISTS game_character_quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  quest_id UUID NOT NULL,
  progress INT DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, completed, failed, abandoned
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (quest_id) REFERENCES game_quests(id),
  UNIQUE(character_id, quest_id)
);

-- GAME COMBAT LOG TABLE
CREATE TABLE IF NOT EXISTS game_combat_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  enemy_type TEXT NOT NULL, -- bug, rat, mosquito, etc.
  enemy_level INT DEFAULT 1,
  result TEXT NOT NULL, -- win, loss, flee
  xp_gained INT DEFAULT 0,
  items_dropped JSONB DEFAULT '[]',
  location_x FLOAT,
  location_y FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- GAME ECONOMY PRICES TABLE
CREATE TABLE IF NOT EXISTS game_economy_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL,
  price BIGINT NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (item_id) REFERENCES game_items(id)
);

-- GAME BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS game_bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  account_type TEXT NOT NULL, -- savings, checking, crypto_wallet
  currency_code TEXT DEFAULT 'PHP',
  balance BIGINT DEFAULT 0,
  interest_rate FLOAT DEFAULT 0.02,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- GAME BANK TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS game_bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_account_id UUID,
  to_account_id UUID,
  amount BIGINT NOT NULL,
  currency_code TEXT DEFAULT 'PHP',
  transaction_type TEXT NOT NULL, -- transfer, deposit, withdrawal, loan, interest, salary
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (from_account_id) REFERENCES game_bank_accounts(id),
  FOREIGN KEY (to_account_id) REFERENCES game_bank_accounts(id)
);

-- GAME DAILY REWARDS TABLE
CREATE TABLE IF NOT EXISTS game_daily_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  reward_date DATE NOT NULL,
  xp_earned INT DEFAULT 50,
  money_earned BIGINT DEFAULT 100,
  items_earned JSONB DEFAULT '[]',
  streak_days INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, reward_date)
);

-- GAME ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS game_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT, -- combat, wealth, social, exploration, business
  reward_xp INT DEFAULT 50,
  unlock_condition JSONB DEFAULT '{}', -- {type: "level", value: 10}
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name)
);

-- GAME CHARACTER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS game_character_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  achievement_id UUID NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES game_achievements(id),
  UNIQUE(character_id, achievement_id)
);

-- GAME EXPERIENCE LOG (for tracking XP sources)
CREATE TABLE IF NOT EXISTS game_experience_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL,
  amount INT NOT NULL,
  source TEXT NOT NULL, -- combat, quest, trading, business, daily_login, transaction
  reference_id UUID, -- quest_id, transaction_id, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- GAME SETTINGS (global economy settings)
CREATE TABLE IF NOT EXISTS game_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(setting_key)
);

-- Create indexes for performance
CREATE INDEX idx_game_characters_user_id ON game_characters(user_id);
CREATE INDEX idx_game_characters_level ON game_characters(level);
CREATE INDEX idx_game_inventory_character_id ON game_inventory(character_id);
CREATE INDEX idx_game_properties_owner_id ON game_properties(owner_id);
CREATE INDEX idx_game_properties_province ON game_properties(province);
CREATE INDEX idx_game_marketplace_seller_id ON game_marketplace_listings(seller_id);
CREATE INDEX idx_game_marketplace_status ON game_marketplace_listings(status);
CREATE INDEX idx_game_transactions_buyer_id ON game_transactions(buyer_id);
CREATE INDEX idx_game_transactions_seller_id ON game_transactions(seller_id);
CREATE INDEX idx_game_combat_log_character_id ON game_combat_log(character_id);
CREATE INDEX idx_game_bank_accounts_character_id ON game_bank_accounts(character_id);
CREATE INDEX idx_game_daily_rewards_character_id ON game_daily_rewards(character_id);
CREATE INDEX idx_game_experience_log_character_id ON game_experience_log(character_id);
CREATE INDEX idx_game_character_quests_character_id ON game_character_quests(character_id);
CREATE INDEX idx_game_character_quests_status ON game_character_quests(status);
