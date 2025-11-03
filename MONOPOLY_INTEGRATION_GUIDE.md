# Monopoly-Style Philippines RPG - Integration Guide

## ✅ What's Been Implemented

### 1. **Database Schema** (`supabase/migrations/add_monopoly_properties.sql`)
   - `monopoly_properties` - Property definitions with Philippines locations
   - `player_property_ownership` - Player ownership and state
   - `property_upgrades` - Upgrade tracking
   - `property_color_groups` - Monopoly set bonuses
   - `income_history` - Income transaction log
   - `unlocked_properties` - Feature unlocking
   - `property_leases` - NPC tenant system (future)

### 2. **Game Mechanics Engine** (`src/lib/monopolyGameEngine.js`)
   - Property purchasing and ownership
   - House/hotel upgrades with income scaling
   - Mortgage and unmortgage system
   - Monopoly set bonuses (2x income when owning full color group)
   - Passive income calculation
   - Property unlocking based on player level
   - Property suggestions based on wealth

### 3. **UI Components**
   - **SpriteCustomizer** - Character customization (replaces ReadyPlayer.me)
   - **PropertyMarket** - Buy/sell/upgrade properties interface

### 4. **Edge Function** (`supabase/functions/collect-passive-income/`)
   - Hourly passive income collection for all players
   - Monopoly bonus detection
   - Income history logging

## 📋 Properties Included

### Manila Central (Red) - Premium District
- Ayala Center Makati (₱2.5M base)
- Glorietta Mall (₱2.2M base)
- Boni Avenue Strip (₱1.8M base)

### Ortigas & BGC (Yellow/Gold) - Business Hub
- Ortigas Center (₱1.6M base)
- BGC Financial Hub (₱2.8M base)

### Quezon City (Green) - Commerce
- Araneta Center (₱1.9M base)
- SM North EDSA (₱2.0M base)

### Provincial (Blue) - Expansion
- SM Cebu (₱1.2M base)
- Davao Central Terminal (₱1.0M base)

### Utilities & Landmarks
- Manila Water, Meralco, Rizal Park, Intramuros

## 🚀 Deployment Steps

### Step 1: Deploy Database Migrations
```bash
# Run the migration manually in Supabase SQL editor, or use:
supabase db push
```

**Copy & paste this into Supabase SQL editor:**
- Go to Supabase Dashboard > SQL Editor
- Create new query
- Paste content from `supabase/migrations/add_monopoly_properties.sql`
- Run it

### Step 2: Update PlayCurrency Component
Add PropertyMarket to `src/components/PlayCurrency.jsx`:

```jsx
// Add import at top
import PropertyMarket from './game/PropertyMarket'

// Add tab for PropertyMarket in the game tabs section:
{showCurrencyGame && (
  <>
    <div className="mb-6 flex items-center gap-2 border-b border-slate-700">
      <button onClick={() => setOpenModal('properties')} className="...">Properties</button>
      <button onClick={() => setOpenModal('currency')} className="...">Currency</button>
      {/* ... other tabs ... */}
    </div>

    {openModal === 'properties' && (
      <PropertyMarket 
        userId={userId} 
        character={character} 
        onPropertyUpdate={loadCharacter}
      />
    )}
  </>
)}
```

### Step 3: Deploy Edge Function
```bash
# Deploy the passive income collection function
supabase functions deploy collect-passive-income
```

### Step 4: Schedule Income Collection
- Go to Supabase Dashboard > Cron Jobs (or use an external scheduler)
- Create a cron job that calls: `{YOUR_PROJECT_URL}/functions/v1/collect-passive-income`
- Set to run every 1 hour (adjust based on game balance)

**Alternative:** Use a service like EasyCron or Temporal:
- URL: `https://YOUR_PROJECT.supabase.co/functions/v1/collect-passive-income`
- Method: POST
- Authorization: Add header `Authorization: Bearer {SERVICE_ROLE_KEY}`
- Schedule: Every hour (or adjust)

### Step 5: Test the System

#### As a Player:
1. Create a character (uses new SpriteCustomizer)
2. Navigate to Properties tab
3. View available properties (filtered by level)
4. Purchase a property
5. Wait for passive income tick (check in 1 hour or trigger manually)
6. Check money increased

#### Manual Testing:
```bash
# Trigger income collection manually:
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/collect-passive-income \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## 💰 Game Economy

### Income Progression (Per House Level)
- 0 houses: Base income (varies by property)
- 1 house: 10x base income
- 2 houses: 30x base income
- 3 houses: 90x base income
- 4 houses: 160x base income
- Hotel (5): 250x base income

### Monopoly Bonus
- Own all properties in color group = 2x income (if no houses)
- Bonus applies to passive income, not active rent

### Example Earnings
**Ayala Center (₱2.5M property, ₱200 base income per hour)**
- Without upgrades: ₱200/hour = ₱4,800/day
- With 1 house (₱250K): ₱2,000/hour = ₱48,000/day
- With hotel (₱1M): ₱50,000/hour = ₱1.2M/day
- Own both Makati properties: 2x income without upgrades

## 🔓 Property Unlocking

Properties unlock based on player level:
- Level 1: BGC (₱2.8M), Davao, Utilities
- Level 2: Cebu
- Level 3: BGC, Ortigas, Provincial
- Level 4+: All properties available

**Future Enhancement:** Tie unlocks to:
- Mission completion
- District reputation
- Special achievements

## 🏗️ Upgrade Mechanics

1. **Building Houses**
   - Cost: `property.house_cost` per house
   - Max: 5 houses (last = hotel)
   - Income scales with house count
   - Must have money available

2. **Mortgage System**
   - Get 50% of property value immediately
   - Property generates 0 income while mortgaged
   - Unmortgage costs 110% of mortgage value (10% interest)
   - Useful for quick cash when needed

3. **Future Upgrades**
   - Custom business types (sari-sari store, café, mall)
   - Worker system (hire NPCs to boost income)
   - Leasing to NPCs (passive income without player involvement)

## 📊 Real-Time Monitoring

Monitor player progress:
```sql
-- Total player wealth
SELECT 
  u.email,
  gc.name,
  gc.money,
  SUM(ppo.passive_income_rate) as hourly_income,
  COUNT(ppo.id) as properties_owned
FROM game_characters gc
JOIN auth.users u ON u.id = gc.user_id
LEFT JOIN player_property_ownership ppo ON ppo.player_id = gc.user_id
GROUP BY u.email, gc.id;

-- Income history
SELECT 
  player_id,
  SUM(amount) as total_earned,
  COUNT(*) as transactions
FROM income_history
WHERE income_source = 'passive_generation'
GROUP BY player_id;

-- Property ownership
SELECT 
  mp.name,
  COUNT(ppo.id) as times_owned,
  AVG(ppo.houses) as avg_upgrades
FROM monopoly_properties mp
LEFT JOIN player_property_ownership ppo ON ppo.property_id = mp.id
GROUP BY mp.id;
```

## 🎮 Game Flow

1. **Early Game (Level 1-2)**
   - Player can unlock provincial properties
   - Limited to cheaper locations
   - Low income generation
   - Focus: Learn system, save money

2. **Mid Game (Level 3-4)**
   - Metro Manila properties unlock
   - Can start buying multiple properties
   - Monopoly bonuses become valuable
   - Focus: Build property portfolio

3. **Late Game (Level 5+)**
   - All properties available
   - Can own full color groups
   - High passive income
   - Focus: Maximize income, unlock other content

## 🐛 Troubleshooting

### Income Not Generating
- Check if edge function is deployed
- Verify cron job is running
- Check browser console for errors
- Properties might be mortgaged (check DB)

### Properties Not Showing
- Player level too low (check `unlock_level`)
- Insufficient money (try buying cheaper property)
- Database migration not applied

### Upgrade Failed
- Check sufficient funds
- Verify property ownership
- Check max houses not exceeded

## 📝 Next Steps

### Immediate (This Week)
- [ ] Deploy database migration
- [ ] Test PropertyMarket UI
- [ ] Verify income collection works
- [ ] Balance property prices if needed

### Short Term (Next Week)
- [ ] Add SpriteCustomizer to character creation
- [ ] Integrate PropertyMarket into PlayCurrency
- [ ] Test complete end-to-end flow
- [ ] Monitor economy and adjust multipliers

### Medium Term (2-3 Weeks)
- [ ] Add property leasing to NPCs
- [ ] Implement business upgrade cosmetics
- [ ] Add property-specific missions
- [ ] Create property investment guides

### Long Term (Future)
- [ ] Player-to-player property trading
- [ ] Property auctions
- [ ] Investment funds (pools)
- [ ] Real estate market dynamics

## 🎨 Asset Integration

Properties can have custom sprites/icons:
- `sprite_path` field in database
- Map to `/public/sprites/properties/` folder
- Icons shown in PropertyMarket component
- Color-coded by `icon_color` field

To add custom assets:
1. Place sprite in `/public/sprites/properties/`
2. Update database `sprite_path` field
3. UI automatically loads and displays

## 📞 Support

If you encounter issues:
1. Check Supabase logs
2. Verify edge function deployment
3. Review SQL migration output
4. Check browser console for JS errors
5. Verify `monopolyGameEngine` imports correctly

---

**Status**: ✅ Core system implemented and ready for deployment
**Schema**: Philippines-themed Monopoly board with 10+ properties
**Economy**: Balanced income progression from ₱200/hour to ₱50,000/hour
**Next**: Deploy migrations and test with live players
