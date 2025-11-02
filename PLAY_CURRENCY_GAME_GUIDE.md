# Play Currency - RPG Life Simulation Game

## Overview
Play Currency is a full-featured RPG life simulation game integrated into currency.ph. Players create customizable characters and progress through a persistent world with real-time economy systems, property ownership, combat, and trading.

## Architecture

### Database Schema (supabase/migrations/game_schema.sql)
- **game_characters**: Core character data with appearance, level, XP, position
- **game_items**: Item definitions (clothing, equipment, consumables)
- **game_character_equipment**: What items are equipped in each slot
- **game_inventory**: Player's owned items
- **game_properties**: Houses, businesses, farms with revenue generation
- **game_marketplace_listings**: Item/property sales
- **game_transactions**: Trading history
- **game_quests**: Quest definitions
- **game_character_quests**: Player quest progress
- **game_combat_log**: Combat encounter history
- **game_bank_accounts**: In-game banking
- **game_bank_transactions**: Money transfers
- **game_daily_rewards**: Login streaks and daily bonuses
- **game_achievements**: Unlockable achievements

### Game API (src/lib/gameAPI.js)
Core game logic abstraction layer with methods for:
- Character management (create, update, stats)
- Experience system (addExperience, leveling)
- Inventory (add/remove items)
- Equipment (equip/unequip)
- Properties (purchase, revenue)
- Marketplace (list/buy items)
- Combat (initiate fights, loot)
- Banking (transfers, accounts)
- Quests (start, complete)
- Daily rewards (login bonuses)

## Game Components

### PlayCurrency (src/components/PlayCurrency.jsx)
Main game orchestrator component. Features:
- Character creation/selection
- Tab navigation (World, Inventory, Equipment, Marketplace, Properties, Banking)
- Character customization modal
- Experience bar
- Real-time balance display
- Integrates all sub-components

### CharacterCreation (src/components/game/CharacterCreation.jsx)
Character creation wizard with:
- Name selection
- Gender choice (male/female/other)
- Skin tone (4 options)
- Hair style (5 options)
- Hair color picker
- Height slider (150-210cm)
- Build selection (slim/average/athletic/stocky)

### GameWorld (src/components/game/GameWorld.jsx)
2D canvas-based world navigation:
- Philippines map with real cities (Manila, Cebu, Davao, etc.)
- Arrow keys / WASD movement
- Click-to-move
- 8x8 tile visible area
- Random enemy encounters
- Health bar display

### GameInventory (src/components/game/GameInventory.jsx)
Item management system:
- Display all owned items with icons
- Sell items to marketplace
- Price negotiation
- Item descriptions and brands
- Estimated inventory value

### GameMarketplace (src/components/game/GameMarketplace.jsx)
Trading system:
- Browse listings (items, properties, services)
- Filter by type
- Purchase with balance checking
- Seller information
- Price comparison

### GameProperties (src/components/game/GameProperties.jsx)
Property/business management:
- Purchase properties (house, business, farm, shop, factory)
- Property values and prices
- Daily revenue tracking
- Monthly income calculation
- Passive income system

### GameCombat (src/components/game/GameCombat.jsx)
Combat encounter system:
- Win/loss animations
- Experience gain on victory
- Loot drops
- Enemy difficulty scaling

## Game Mechanics

### Leveling System
- Player level = floor(experience / 1000)
- Visual experience bar shows progress to next level
- Level gates access to higher tier quests and items

### XP Sources
- Combat victories (50+ XP base, scales with enemy level)
- Quest completion (100+ XP depending on quest)
- Daily login bonus (50+ XP + streak multiplier)
- Transaction fees (1-5% of transaction value as XP)
- Business revenue (passive XP generation)

### Equipment Slots
- head, body, legs, feet
- right_hand, left_hand (hands/weapons)
- necklace, ring (jewelry)
- backpack (storage)

### Economy
- Base currency: PHP (Philippine Peso)
- Player money system
- Property ownership generates daily revenue
- Bank accounts with interest rates
- Marketplace price fluctuations over time

### Combat
- Turn-based simple combat
- Player power = level + 5 + equipment bonuses
- Enemy power = enemy_level + random(0-3)
- Victory yields: XP, items, money
- Defeat yields: retry available

### Properties
- House: ₱50,000, ₱100/day revenue
- Business: ₱100,000, ₱500/day revenue
- Farm: ₱75,000, ₱300/day revenue
- Shop: ₱80,000, ₱400/day revenue
- Factory: ₱200,000, ₱1,000/day revenue

## User Engagement & Retention Features

### Daily Rewards
- Login streak tracking
- Streak-based multiplier (1.1x per day)
- Day 1: 50 XP, 100 PHP
- Day 10: 150 XP, 300 PHP
- Day 30: 350 XP, 700 PHP

### Achievements
- First Blood: Defeat first monster
- Level 10: Reach level 10
- Wealthy: Collect 100k PHP
- Property Owner: Own a property
- Trader: Complete 10 trades
- Fashionista: Equip all slots

### Long-term Progression
- Slow XP curve (1000 XP per level)
- Long-term property investment
- Marketplace-based wealth building
- Character customization variety

### Social Features
- Marketplace interactions with other players
- Visible character appearances
- Property showcases
- Trading communities

## Integration with Currency.ph

### XP Rewards for Real Actions
```
- Transfer money: 0.1% of amount as XP
- Add business listing: 200 XP
- Pay bills: 50 XP
- Make investment: 100 XP
- Complete loan: 500 XP
```

### Real-World Simulation
- Banking system mirrors real concepts
- Property revenue like real estate
- Trading/marketplace like e-commerce
- Business simulation with workers
- Cryptocurrency integration potential

## Setup & Deployment

### 1. Deploy Schema
```bash
# Apply SQL migration to Supabase
# supabase/migrations/game_schema.sql
```

### 2. Seed Initial Data
```bash
# Run seed script
node scripts/seed-game-data.js
```

### 3. Verify Components
- Check src/components/PlayCurrency.jsx loads
- Check Navbar includes "Play Currency" tab
- Verify gameAPI.js imports correctly

### 4. Test Game Flow
1. Navigate to "Play Currency" tab
2. Create character
3. Complete character customization
4. Explore world with arrow keys
5. Encounter enemies and fight
6. Check inventory and properties
7. List items on marketplace

## Performance Considerations

### Database Indexes
- User lookups (game_characters.user_id)
- Character status queries (level, experience)
- Marketplace filters (status, property type)
- Transaction history (buyer/seller)

### Optimization Recommendations
- Lazy-load marketplace listings
- Pagination for large inventories
- Cache item definitions
- Batch experience updates
- Debounce position updates

## Future Enhancements

### Phase 2
- Social trading (player-to-player)
- Guilds/cooperatives
- PvP combat arena
- Stock market integration
- Real estate development
- Manufacturing chains

### Phase 3
- Mobile app native version
- 3D character models
- Multiplayer dungeons
- Economy simulation with inflation
- Cryptocurrency integration (real)
- Blockchain property deeds (NFT)

### Phase 4
- AI NPCs in world
- Procedural quests
- Seasonal events
- Leaderboards
- Tournaments
- Real money integration

## Configuration

### Game Balance Variables (src/lib/gameAPI.js)
```javascript
// Adjust these for balance:
const EXP_PER_LEVEL = 1000
const COMBAT_POWER = level + 5
const DAILY_BONUS_BASE = 50
const STREAK_MULTIPLIER = 1.1
```

### Item Pricing Strategy
- Base prices in game_items table
- Market adjustments over time
- Supply/demand simulation
- NPC buyback prices (75% of base)

## Troubleshooting

### Character Not Loading
- Check user_id is set in App.jsx
- Verify game_characters table exists
- Check Supabase auth status

### Items Not Appearing
- Ensure seed-game-data.js ran successfully
- Verify game_items table has entries
- Check item_type matches filters

### Combat Not Working
- Verify game_combat_log table exists
- Check character has stats
- Ensure enemy types match system

### Marketplace Failing
- Check buyer has sufficient funds
- Verify seller still exists
- Check listing status is 'active'

## Credits & Design Notes

### Design Philosophy
- **Engagement**: Daily rewards, streaks, progression
- **Retention**: Long-term goals, social features, customization
- **Monetization**: Optional cosmetics, battle pass model
- **Accessibility**: Simple combat, clear progression, helpful UI

### Game Balance
- Early game: Fast progression (motivation)
- Mid game: Slower curve (investment strategy)
- Late game: Exponential returns (wealth building)
- Catch-up mechanics for new players

## Security Considerations

- All transactions use Supabase RLS
- User can only access own character data
- Marketplace has anti-exploit safeguards
- Experience/money grants are auditable
- Combat results are server-verified
