-- Monopoly Properties System for Philippines RPG
-- Seed data: Real Philippines locations mapped to Monopoly property mechanics

CREATE TABLE IF NOT EXISTS monopoly_properties (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_city TEXT,
  location_district TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Property type and mechanics
  property_type TEXT CHECK (property_type IN ('business', 'utility', 'landmark', 'special')),
  color_group TEXT, -- "manila_central", "makati_district", "provincial", etc.
  
  -- Pricing and income
  base_price NUMERIC(12, 2) NOT NULL,
  base_income NUMERIC(12, 2) NOT NULL,
  house_cost NUMERIC(12, 2),
  hotel_cost NUMERIC(12, 2),
  mortgage_value NUMERIC(12, 2),
  
  -- Income progression by upgrade level
  income_levels JSONB DEFAULT '[0, 10, 30, 90, 160, 250]'::jsonb, -- income by house count (0-4) + hotel
  
  -- RPG progression
  unlock_level INT DEFAULT 1,
  unlock_requirement TEXT, -- "complete_mission_xyz", "reputation_100", etc.
  
  -- Visuals
  sprite_path TEXT,
  icon_color TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Player property ownership and state
CREATE TABLE IF NOT EXISTS player_property_ownership (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES monopoly_properties(id) ON DELETE CASCADE,
  
  -- Ownership state
  houses INT DEFAULT 0 CHECK (houses >= 0 AND houses <= 5),
  mortgaged BOOLEAN DEFAULT FALSE,
  mortgage_received NUMERIC(12, 2) DEFAULT 0,
  
  -- Income tracking
  passive_income_rate NUMERIC(12, 2) DEFAULT 0,
  last_income_collected_at TIMESTAMP,
  total_income_earned NUMERIC(15, 2) DEFAULT 0,
  
  -- Metadata
  acquired_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(player_id, property_id)
);

-- Property upgrades and improvements
CREATE TABLE IF NOT EXISTS property_upgrades (
  id SERIAL PRIMARY KEY,
  property_ownership_id INT NOT NULL REFERENCES player_property_ownership(id) ON DELETE CASCADE,
  
  -- Upgrade details
  upgrade_type TEXT, -- "basic_shop", "sari_sari_store", "small_cafe", "mall_extension", "enterprise"
  upgrade_level INT DEFAULT 0,
  upgrade_cost NUMERIC(12, 2),
  income_boost_multiplier NUMERIC(5, 2) DEFAULT 1.0,
  
  -- Workers and production
  workers_count INT DEFAULT 0,
  max_workers INT DEFAULT 5,
  worker_cost_per_day NUMERIC(10, 2) DEFAULT 50,
  
  -- Timing
  upgraded_at TIMESTAMP DEFAULT now(),
  activated_at TIMESTAMP,
  
  -- Metadata
  custom_name TEXT,
  custom_description TEXT
);

-- Property color group bonuses (monopoly sets)
CREATE TABLE IF NOT EXISTS property_color_groups (
  id SERIAL PRIMARY KEY,
  color_group_code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  color_hex TEXT,
  
  -- Monopoly bonus mechanics
  base_income_multiplier NUMERIC(5, 2) DEFAULT 1.0,
  num_properties_in_group INT,
  
  -- Description and story
  description TEXT,
  
  created_at TIMESTAMP DEFAULT now()
);

-- Income collection history
CREATE TABLE IF NOT EXISTS income_history (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INT REFERENCES monopoly_properties(id) ON DELETE SET NULL,
  
  -- Income details
  amount NUMERIC(12, 2) NOT NULL,
  income_source TEXT, -- "passive_generation", "upgrade_bonus", "mission_reward"
  
  -- Metadata
  generated_at TIMESTAMP DEFAULT now(),
  period_type TEXT DEFAULT 'hourly' -- hourly, daily, weekly, etc.
);

-- Property interactions (visits, missions, events)
CREATE TABLE IF NOT EXISTS property_interactions (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES monopoly_properties(id) ON DELETE CASCADE,
  
  -- Interaction type
  interaction_type TEXT, -- "visited", "completed_mission", "worked_shift", "collected_income"
  
  -- Rewards
  xp_earned INT DEFAULT 0,
  money_earned NUMERIC(12, 2) DEFAULT 0,
  items_earned JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  duration_minutes INT
);

-- Property leasing (can rent properties to NPCs)
CREATE TABLE IF NOT EXISTS property_leases (
  id SERIAL PRIMARY KEY,
  property_ownership_id INT NOT NULL REFERENCES player_property_ownership(id) ON DELETE CASCADE,
  
  -- Lease details
  tenant_name TEXT NOT NULL,
  tenant_type TEXT, -- "npc_merchant", "npc_family", "business"
  
  -- Income
  monthly_lease_income NUMERIC(12, 2) NOT NULL,
  
  -- Lease term
  started_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(property_ownership_id, started_at)
);

-- Unlocked properties (tracking which properties player can access)
CREATE TABLE IF NOT EXISTS unlocked_properties (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES monopoly_properties(id) ON DELETE CASCADE,
  
  unlocked_at TIMESTAMP DEFAULT now(),
  unlock_reason TEXT, -- "level_reached", "mission_completed", "achieved_reputation"
  
  UNIQUE(player_id, property_id)
);

-- Indexes for performance
CREATE INDEX idx_player_properties_player ON player_property_ownership(player_id);
CREATE INDEX idx_player_properties_property ON player_property_ownership(property_id);
CREATE INDEX idx_income_history_player ON income_history(player_id);
CREATE INDEX idx_income_history_property ON income_history(property_id);
CREATE INDEX idx_unlocked_properties_player ON unlocked_properties(player_id);
CREATE INDEX idx_property_groups ON monopoly_properties(color_group);

-- Insert Philippines Monopoly board properties
-- Manila Central District (Red)
INSERT INTO monopoly_properties (slug, name, description, location_city, location_district, property_type, color_group, base_price, base_income, house_cost, hotel_cost, mortgage_value, unlock_level, sprite_path, icon_color) VALUES
('makati-ayala', 'Ayala Center Makati', 'Premium shopping and business district', 'Makati', 'Ayala', 'business', 'makati_premium', 2500000, 200, 250000, 1000000, 1250000, 5, '/sprites/properties/ayala.png', '#D32F2F'),
('makati-glorietta', 'Glorietta Mall', 'Large shopping complex with offices', 'Makati', 'Ayala', 'business', 'makati_premium', 2200000, 180, 220000, 900000, 1100000, 5, '/sprites/properties/glorietta.png', '#D32F2F'),
('boni-avenue', 'Boni Avenue Strip', 'Busy commercial avenue', 'Mandaluyong', 'Shaw', 'business', 'ortigas_avenue', 1800000, 140, 180000, 700000, 900000, 4, '/sprites/properties/boni.png', '#E91E63');

-- Ortigas District (Yellow)
INSERT INTO monopoly_properties (slug, name, description, location_city, location_district, property_type, color_group, base_price, base_income, house_cost, hotel_cost, mortgage_value, unlock_level, sprite_path, icon_color) VALUES
('ortigas-center', 'Ortigas Center', 'Major business and shopping district', 'Pasig', 'Ortigas', 'business', 'ortigas_avenue', 1600000, 120, 160000, 650000, 800000, 4, '/sprites/properties/ortigas.png', '#FBC02D'),
('bgc-strip', 'BGC Financial Hub', 'Bonifacio Global City business hub', 'Taguig', 'BGC', 'business', 'bgc_taguig', 2800000, 220, 280000, 1100000, 1400000, 6, '/sprites/properties/bgc.png', '#FBC02D');

-- Quezon City (Green)
INSERT INTO monopoly_properties (slug, name, description, location_city, location_district, property_type, color_group, base_price, base_income, house_cost, hotel_cost, mortgage_value, unlock_level, sprite_path, icon_color) VALUES
('qc-araneta', 'Araneta Center', 'Largest shopping mall in Philippines', 'Quezon City', 'Cubao', 'business', 'qc_commercial', 1900000, 150, 190000, 750000, 950000, 4, '/sprites/properties/araneta.png', '#388E3C'),
('qc-sm-north', 'SM North EDSA', 'Major shopping and entertainment', 'Quezon City', 'North', 'business', 'qc_commercial', 2000000, 160, 200000, 800000, 1000000, 4, '/sprites/properties/sm-north.png', '#388E3C');

-- Provincial Cities (Blue)
INSERT INTO monopoly_properties (slug, name, description, location_city, location_district, property_type, color_group, base_price, base_income, house_cost, hotel_cost, mortgage_value, unlock_level, sprite_path, icon_color) VALUES
('cebu-sm', 'SM Cebu', 'Cebu largest shopping center', 'Cebu', 'Banilad', 'business', 'provincial_cebu', 1200000, 100, 120000, 500000, 600000, 3, '/sprites/properties/sm-cebu.png', '#1976D2'),
('davao-terminal', 'Davao Central Terminal', 'Major trade center', 'Davao', 'Downtown', 'business', 'provincial_davao', 1000000, 80, 100000, 400000, 500000, 2, '/sprites/properties/davao.png', '#1976D2');

-- Utilities and Special
INSERT INTO monopoly_properties (slug, name, description, location_city, location_district, property_type, color_group, base_price, base_income, house_cost, mortgage_value, unlock_level, sprite_path, icon_color) VALUES
('water-utility', 'Manila Water Company', 'Water distribution utility', 'Metro Manila', 'Multiple', 'utility', 'utilities', 300000, 25, NULL, 150000, 1, '/sprites/properties/water.png', '#4FC3F7'),
('power-utility', 'Meralco Power Grid', 'Electricity distribution', 'Metro Manila', 'Multiple', 'utility', 'utilities', 300000, 25, NULL, 150000, 1, '/sprites/properties/power.png', '#FFD54F'),
('rizal-park', 'Rizal Park', 'Historic landmark and park', 'Manila', 'Intramuros', 'landmark', 'landmarks', 200000, 15, NULL, 100000, 0, '/sprites/properties/rizal-park.png', '#A1887F'),
('intramuros', 'Intramuros District', 'Historic walled city', 'Manila', 'Intramuros', 'landmark', 'landmarks', 220000, 18, NULL, 110000, 1, '/sprites/properties/intramuros.png', '#A1887F');

-- Create property color group bonuses
INSERT INTO property_color_groups (color_group_code, display_name, color_hex, num_properties_in_group, description) VALUES
('makati_premium', 'Makati Premium District', '#D32F2F', 2, 'High-end shopping and business district'),
('ortigas_avenue', 'Ortigas Avenue Commercial', '#E91E63', 2, 'Busy commercial and business avenue'),
('bgc_taguig', 'BGC Financial Hub', '#FBC02D', 1, 'Modern financial and business district'),
('qc_commercial', 'Quezon City Commerce', '#388E3C', 2, 'Large shopping and entertainment centers'),
('provincial_cebu', 'Cebu Provincial Hub', '#1976D2', 1, 'Major Visayan trading center'),
('provincial_davao', 'Davao Provincial Hub', '#1976D2', 1, 'Major Mindanao trading center'),
('utilities', 'Essential Utilities', '#4FC3F7', 2, 'Water and power utilities'),
('landmarks', 'Historic Landmarks', '#A1887F', 2, 'Historic sites with cultural value');
