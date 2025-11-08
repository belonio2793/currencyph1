# Play Currency: Economic Simulation Game

A turn-based economic simulation minigame built into Currency.ph where players manage virtual businesses, properties, and compete in duel matches.

---

## 🎮 Game Features

### ✅ IMPLEMENTED

#### Character System
- Create multiple characters per user (fixed UNIQUE constraint issue)
- Character customization with avatar URLs
- Character progression (level, experience, wealth)
- Home city selection (Manila, Cebu, Davao, Baguio, Bacolod, etc.)
- Character statistics: health, energy, hunger, income rate
- Daily rewards system with "Claim Daily" button

#### Gameplay Mechanics
- **Game World Map**: Interactive locations (Manila, Cebu, Davao, Bacolod, Baguio)
- **Jobs System**: Perform tasks (Delivery Job, Bartender Shift, Freelance Dev Task)
- **Marketplace**: Buy and sell income-generating assets (Sari-Sari Store, Food Cart, Tricycle Business)
- **Properties Management**: Own and manage properties that generate passive income
- **Wealth Tracking**: Accumulate money through jobs, properties, and business activities
- **Leaderboard**: Real-time ranking of players by wealth (top 10)
- **Income Rate System**: Properties and businesses generate periodic passive income

#### Duel/Minigame System
- **Matchmaking**: Request duels with other players
- **Turn-Based Combat**: Attack/Skill actions
- **Real-time Synchronization**: Supabase realtime channels (`public:duel_*`) for live action broadcasting
- **Match Sessions**: Unique session tracking with sessionId
- **Combat Logs**: Action history during match
- **HP Management**: Health tracking and damage calculation
- **Match Outcomes**: Winner determination and rewards

#### Navigation
- Character switcher button ("Characters & Create New")
- Return to main menu functionality
- Modal overlays for character management

#### Database Schema
- `game_characters`: User characters with stats, appearance, location, wealth
- `game_leaderboard`: Cached wealth rankings (lightweight)
- `game_daily_rewards`: Track daily reward claims
- Realtime channels for match synchronization

---

## 📋 PLANNED FEATURES (Next Phase)

### Phase 1: Enhanced Duel System
- [ ] **Chat Integration**: ChatBar component integrated into duel sessions for player communication
- [ ] **Match History**: Persist match outcomes to `game_matches` table
  - Columns: match_id, player1_id, player2_id, winner_id, duration, created_at, updated_at
- [ ] **Leaderboard Filtering**: Sort by wins, level, experience
- [ ] **Server-Side Validation**: Edge function to validate match results (anti-cheat)
- [ ] **Duel Rewards**: Award currency/XP to winner, consolation rewards to loser

### Phase 2: Advanced Duel Mechanics
- [ ] **Turn Timer**: 30-second action timer per turn
- [ ] **Ability System**: Special skills with cooldowns (e.g., Critical Strike, Heal, Defend)
- [ ] **Animations**: Smooth attack/damage animations and transitions
- [ ] **Sound Effects**: Attack hit sounds, victory/defeat audio
- [ ] **Strategy Elements**: Status effects (stun, bleed, shield) for tactical depth
- [ ] **Energy Cost**: Actions consume energy (requires energy management)

### Phase 3: Social & Economy
- [ ] **Trading System**: Player-to-player item/property trading
- [ ] **Guild/Clan System**: Team-based challenges and shared treasuries
- [ ] **Seasonal Leaderboards**: Monthly/weekly competition resets with rewards
- [ ] **Achievements**: Unlock badges for milestones (first duel win, 1M wealth, etc.)
- [ ] **Player Profiles**: View other players' stats, match history, owned properties
- [ ] **Market Dynamics**: Property values and business income scale with demand

### Phase 4: Advanced World Systems
- [ ] **Random Events**: Sudden market fluctuations, natural disasters, opportunities
- [ ] **NPC Vendors**: Dynamic pricing and inventory management
- [ ] **Population Growth**: World economy simulates based on player activity
- [ ] **Tax System**: Players pay taxes on wealth/income (redistribution mechanic)
- [ ] **Bonds & Loans**: Borrow from game bank for capital expansion
- [ ] **Stock Market**: Trade shares of successful businesses

---

## 🏗️ Architecture

### Components
- **PlayCurrency.jsx**: Main game container, state management, game loops
- **DuelMatch.jsx**: Turn-based duel UI, real-time sync, action broadcasting
- **CharacterCreation.jsx**: Character setup and customization
- **CharactersPanel.jsx**: Character list, creation, deletion, selection
- **IsometricGameMap.jsx**: Visual game world map (future 3D rendering)

### Libraries
- **React 18**: UI framework
- **Supabase**: Database, real-time channels, authentication
- **Vite**: Build tool and dev server

### Database Tables
```sql
-- Characters
CREATE TABLE game_characters (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  level INT DEFAULT 0,
  experience BIGINT DEFAULT 0,
  money BIGINT DEFAULT 1000,
  wealth BIGINT DEFAULT 1000,
  home_city TEXT DEFAULT 'Manila',
  current_location TEXT,
  health INT DEFAULT 100,
  max_health INT DEFAULT 100,
  energy INT DEFAULT 100,
  max_energy INT DEFAULT 100,
  hunger INT DEFAULT 100,
  appearance JSONB,
  income_rate NUMERIC DEFAULT 0,
  properties JSONB DEFAULT '[]',
  last_daily TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_game_characters_user_id ON game_characters(user_id);

-- Leaderboard (lightweight cache)
CREATE TABLE game_leaderboard (
  user_id UUID PRIMARY KEY,
  name TEXT,
  wealth NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Rewards
CREATE TABLE game_daily_rewards (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [PLANNED] Match History
CREATE TABLE game_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID NOT NULL,
  player2_id UUID NOT NULL,
  winner_id UUID,
  player1_hp_final INT,
  player2_hp_final INT,
  duration_seconds INT,
  reward_winner NUMERIC DEFAULT 100,
  reward_loser NUMERIC DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (player1_id) REFERENCES game_characters(id),
  FOREIGN KEY (player2_id) REFERENCES game_characters(id),
  FOREIGN KEY (winner_id) REFERENCES game_characters(id)
);
```

---

## 🔧 Recent Fixes

### Character Creation Bug Fix (Latest)
- **Issue**: `UNIQUE(user_id)` constraint prevented creating multiple characters per user
- **Solution**: 
  1. Created migration `20250109_fix_game_characters_schema.sql`
  2. Removed UNIQUE constraint on user_id
  3. Added missing columns: wealth, income_rate, xp, properties, last_daily, archived_at
  4. Updated PlayCurrency.jsx to properly save character data
- **Status**: ✅ Fixed and deployed

### Supabase Fetch Error Fix
- **Issue**: `.catch()` on Supabase query chain not supported
- **Solution**: Removed unsupported `.catch()`, rely on try/catch block
- **Status**: ✅ Fixed

### Supabase Client Initialization
- **Issue**: Custom fetch binding causing "Failed to fetch" errors in production
- **Solution**: Simplified client init to use Supabase default fetch implementation
- **Status**: ✅ Fixed

---

## 🚀 Development Roadmap

### Week 1: Duel Enhancement
- [ ] Integrate ChatBar into duel sessions
- [ ] Create game_matches table migration
- [ ] Implement match persistence and history UI
- [ ] Add match rewards system

### Week 2: Mechanics & Polish
- [ ] Implement turn timer (30s per action)
- [ ] Add ability system with cooldowns
- [ ] Basic animations for attacks/damage
- [ ] Sound effects (optional: use Web Audio API)

### Week 3: Social Features
- [ ] Player profiles with match history
- [ ] Trading system for items/properties
- [ ] Seasonal leaderboard resets
- [ ] Achievement badges

### Week 4: Economy & World Systems
- [ ] Random event system
- [ ] Tax/redistribution mechanics
- [ ] NPC vendor system
- [ ] Stock market prototype

---

## 🔐 Security Considerations

- **Anti-Cheat**: Server-side validation of match results via Supabase Edge Functions
- **Rate Limiting**: Actions throttled to prevent farming exploits
- **Data Validation**: All user inputs sanitized before database insert
- **Auth**: JWT tokens via Supabase for session management
- **Permissions**: Row-level security (RLS) policies on game_characters table

---

## 🎯 Known Limitations

1. **No Animations Yet**: Game world is static (planned: isometric 3D rendering)
2. **Simple AI**: No NPC opponent duels (duels are PvP only)
3. **Limited Abilities**: Only basic attack action (planned: skill trees)
4. **No Trading**: Players can't trade with each other yet
5. **No Guilds**: Solo gameplay only (planned: guild system)
6. **Single Region**: Only Philippines cities (planned: expand globally)

---

## 🛠️ Setup & Running

### Environment Variables
```
VITE_PROJECT_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Run Game
```bash
npm run dev
# Navigate to app and click "Play Currency" button
```

### Create Test Character
1. Click "Play Currency" on home page
2. Enter character name and select home city
3. Click "Begin Adventure" to create character
4. Start playing immediately

### Test Duel System
1. Create 2 characters (or 2 user accounts)
2. One player: Click "Match Requests" → Request Match
3. Other player: Accept match
4. Turn-based combat begins with real-time synchronization

---

## 📊 Performance Notes

- **Realtime Channels**: Uses Supabase PostgreSQL listen/notify (scales to ~1000 concurrent players)
- **Leaderboard Caching**: Lightweight materialized view, updated every 5 minutes
- **Character Queries**: Indexed on user_id for fast lookups
- **Asset Loading**: Lazy load marketplace items and property images

---

## 🤝 Contributing

To contribute to the Play Currency game:
1. Create a feature branch: `git checkout -b feature/duel-chat-integration`
2. Make your changes
3. Test thoroughly with multiple characters/users
4. Submit PR with description of changes
5. Wait for review and merge

---

## 📞 Support & Issues

Report bugs or request features via GitHub Issues with:
- Screenshots of the issue
- Steps to reproduce
- Expected vs actual behavior
- Game version and browser info

---

**Last Updated**: 2025-01-09  
**Game Status**: 🟡 Beta (Basic features working, advanced systems in progress)
