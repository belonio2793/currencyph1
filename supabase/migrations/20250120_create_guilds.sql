-- Guild/Clan system
CREATE TABLE IF NOT EXISTS game_guilds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  leader_id UUID NOT NULL,
  founded_at TIMESTAMPTZ DEFAULT now(),
  member_count INT DEFAULT 1,
  total_wealth NUMERIC DEFAULT 0,
  level INT DEFAULT 1,
  treasury NUMERIC DEFAULT 0,
  icon TEXT,
  banner TEXT,
  status TEXT DEFAULT 'active', -- active, disbanded
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (leader_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- Guild members with roles
CREATE TABLE IF NOT EXISTS game_guild_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id UUID NOT NULL,
  character_id UUID NOT NULL,
  role TEXT DEFAULT 'member', -- leader, officer, member
  joined_at TIMESTAMPTZ DEFAULT now(),
  contribution NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (guild_id) REFERENCES game_guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  UNIQUE(guild_id, character_id)
);

-- Guild treasury transactions
CREATE TABLE IF NOT EXISTS game_guild_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id UUID NOT NULL,
  character_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT, -- deposit, withdrawal, raid_reward
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (guild_id) REFERENCES game_guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE
);

-- Guild challenges/quests
CREATE TABLE IF NOT EXISTS game_guild_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id UUID NOT NULL,
  challenge_type TEXT, -- raid, siege, tournament, cooperative_trade
  title TEXT NOT NULL,
  description TEXT,
  difficulty INT DEFAULT 1, -- 1-5
  reward_credits NUMERIC,
  reward_guild_xp NUMERIC,
  status TEXT DEFAULT 'active', -- active, completed, failed
  created_at TIMESTAMPTZ DEFAULT now(),
  deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (guild_id) REFERENCES game_guilds(id) ON DELETE CASCADE
);

-- Guild challenge participants
CREATE TABLE IF NOT EXISTS game_guild_challenge_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL,
  character_id UUID NOT NULL,
  contribution_score INT DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, completed, failed
  joined_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (challenge_id) REFERENCES game_guild_challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES game_characters(id) ON DELETE CASCADE,
  UNIQUE(challenge_id, character_id)
);

-- Guild raids with enemy waves
CREATE TABLE IF NOT EXISTS game_guild_raids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id UUID NOT NULL,
  raid_name TEXT NOT NULL,
  difficulty_level INT DEFAULT 1,
  wave_count INT DEFAULT 3,
  current_wave INT DEFAULT 0,
  status TEXT DEFAULT 'scheduled', -- scheduled, active, completed, failed
  reward_pool NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  FOREIGN KEY (guild_id) REFERENCES game_guilds(id) ON DELETE CASCADE
);

-- Guild perks/bonuses
CREATE TABLE IF NOT EXISTS game_guild_perks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guild_id UUID NOT NULL,
  perk_type TEXT NOT NULL, -- income_boost, tax_reduction, fast_travel, market_discount
  level INT DEFAULT 1,
  effect_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (guild_id) REFERENCES game_guilds(id) ON DELETE CASCADE,
  UNIQUE(guild_id, perk_type)
);

-- Create indices
CREATE INDEX IF NOT EXISTS idx_guilds_leader ON game_guilds(leader_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON game_guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_character ON game_guild_members(character_id);
CREATE INDEX IF NOT EXISTS idx_guild_transactions_guild ON game_guild_transactions(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_transactions_character ON game_guild_transactions(character_id);
CREATE INDEX IF NOT EXISTS idx_guild_challenges_guild ON game_guild_challenges(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_challenges_status ON game_guild_challenges(status);
CREATE INDEX IF NOT EXISTS idx_guild_challenge_participants_challenge ON game_guild_challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_guild_challenge_participants_character ON game_guild_challenge_participants(character_id);
CREATE INDEX IF NOT EXISTS idx_guild_raids_guild ON game_guild_raids(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_raids_status ON game_guild_raids(status);
CREATE INDEX IF NOT EXISTS idx_guild_perks_guild ON game_guild_perks(guild_id);

-- RLS policies
ALTER TABLE game_guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_guild_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_guild_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_guild_challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_guild_raids ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_guild_perks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view guilds"
ON game_guilds FOR SELECT USING (true);

CREATE POLICY "Anyone can view guild members"
ON game_guild_members FOR SELECT USING (true);

CREATE POLICY "Guild members can view transactions"
ON game_guild_transactions FOR SELECT USING (true);

CREATE POLICY "Anyone can view challenges"
ON game_guild_challenges FOR SELECT USING (true);

CREATE POLICY "Anyone can view challenge participants"
ON game_guild_challenge_participants FOR SELECT USING (true);

CREATE POLICY "Anyone can view raids"
ON game_guild_raids FOR SELECT USING (true);

CREATE POLICY "Anyone can view perks"
ON game_guild_perks FOR SELECT USING (true);
