# Character Cosmetics System Implementation Guide

## Overview
This guide documents the complete implementation of the character cosmetics system, including skin tones, hair styles/colors, clothing, and accessories.

## Components Created

### 1. CharacterCustomizer (src/components/game/CharacterCustomizer.jsx)
A draggable, toggleable UI panel for character customization.

**Features:**
- **Draggable Window**: Click and drag the header to move the panel
- **Multiple Tabs**: Skin, Hair, Outfit, and Accessories customization
- **Real-time Preview**: Visual previews of cosmetics changes
- **Persistent Styling**: Cosmetics are saved automatically

**Usage:**
```jsx
<CharacterCustomizer
  cosmetics={cosmetics}
  onUpdateCosmetics={handleUpdateCosmetics}
  isOpen={customizationOpen}
  onToggle={() => setCustomizationOpen(!customizationOpen)}
/>
```

### 2. DuelMatch (src/components/game/DuelMatch.jsx)
A minigame component for player-vs-player duels.

**Features:**
- **Turn-based Combat**: Attack, Heavy Attack, Defend, and Heal actions
- **Health System**: Dynamic health bars and status tracking
- **Action Log**: Real-time battle log showing all actions
- **Rewards**: Winners earn wealth and XP

**Actions:**
- ⚔️ Attack (15-25 damage)
- 💥 Heavy Attack (25-35 damage)
- 🛡️ Defend (reduces incoming damage)
- 💚 Heal (restore health)

### 3. MatchHistory (src/components/game/MatchHistory.jsx)
Display component for tracking duel history.

**Features:**
- **Match Records**: Shows past matches with results
- **Opponent Info**: Track who you've battled
- **Refresh Capability**: Reload match data on demand

### 4. IsometricGameMap Enhancements
The existing IsometricGameMap component already includes:

**Visual Features:**
- **Isometric Rendering**: 3D-style tile-based world
- **Avatar Rendering**: Character sprites with cosmetics applied
- **Property Visualization**: Color-coded buildings and businesses
- **Height Mapping**: Visual elevation based on property value/upgrades

**Interactive Features:**
- **Mini-map**: Top-right corner showing world overview
- **Tooltips**: Property details on hover
- **Particle Effects**: Movement trails when avatar moves
- **Smooth Animations**: Camera panning and zoom controls
- **Keyboard Controls**: WASD or Arrow keys to move

## Data Structure

### Cosmetics Object
```javascript
{
  skinTone: 'fair',           // skin tone ID
  hairStyle: 'medium',        // hair style ID
  hairColor: '#1a1a1a',       // hair color hex
  outfit: 'casual',           // outfit ID
  accessories: {
    head: 'none',
    eyes: 'none',
    neck: 'none',
    back: 'none',
    hand: 'none'
  }
}
```

### Available Options

**Skin Tones:**
- pale, fair, light-brown, medium-brown, dark-brown, tan

**Hair Styles:**
- short, medium, long, spiky, curly, bald

**Hair Colors:**
- black, brown, blonde, red, purple, blue, green, gray

**Outfits:**
- casual, formal, tech, farmer, business, athletic, delivery

**Accessories:**
- head: hat, cap, none
- eyes: glasses, sunglasses, none
- neck: necklace, none
- back: backpack, none
- hand: briefcase, none

## Database Schema

### game_characters Table
Added column:
```sql
cosmetics JSONB DEFAULT '{}'::jsonb
```

### game_matches Table
New table for tracking duels:
```sql
CREATE TABLE public.game_matches (
  id text PRIMARY KEY,
  session_id text,
  player1_id text,
  player1_name text,
  player2_id text,
  player2_name text,
  winner_id text,
  player1_score integer,
  player2_score integer,
  duration_seconds integer,
  match_type text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  FOREIGN KEY (player1_id) REFERENCES public.game_characters(id),
  FOREIGN KEY (player2_id) REFERENCES public.game_characters(id),
  FOREIGN KEY (winner_id) REFERENCES public.game_characters(id)
);
```

### game_match_log Table
Detailed move tracking for duels:
```sql
CREATE TABLE public.game_match_log (
  id text PRIMARY KEY,
  match_id text,
  player_id text,
  action text,
  damage integer,
  health_before integer,
  health_after integer,
  turn_number integer,
  created_at timestamptz,
  FOREIGN KEY (match_id) REFERENCES public.game_matches(id),
  FOREIGN KEY (player_id) REFERENCES public.game_characters(id)
);
```

## API Methods (gameAPI.js)

### Cosmetics Management
```javascript
// Update character cosmetics
await gameAPI.updateCharacterCosmetics(characterId, cosmetics)

// Get character cosmetics
const cosmetics = await gameAPI.getCharacterCosmetics(characterId)

// Update appearance (includes legacy support)
await gameAPI.updateCharacterAppearance(characterId, appearance)
```

## Integration with PlayCurrency

The cosmetics system is fully integrated into the PlayCurrency game:

1. **Character Creation**: Initial cosmetics set to defaults
2. **Customization Panel**: Toggle with button in character card
3. **Avatar Rendering**: Cosmetics applied in IsometricGameMap
4. **Persistence**: Automatically saved to database on changes
5. **Multiplayer**: Cosmetics visible to other players in duels

## Testing Checklist

- [ ] Create new character with default cosmetics
- [ ] Open customization panel and change skin tone
- [ ] Change hair style and color
- [ ] Change outfit
- [ ] Add/remove accessories
- [ ] Verify changes persist after page reload
- [ ] Check avatar rendering updates correctly
- [ ] Test dragging customization panel
- [ ] Test mini-map functionality
- [ ] Test tooltip display on property hover
- [ ] Test duel system with multiple players
- [ ] Verify match history tracking
- [ ] Test particle effects during movement
- [ ] Verify camera smoothing and zoom
- [ ] Test keyboard controls (WASD/Arrows)

## Known Limitations & Future Enhancements

### Current Limitations
- Cosmetics are cosmetic-only (no stat bonuses)
- One cosmetics set per character
- Accessories are emoji-based visual indicators

### Recommended Enhancements
1. **Multiple Outfit Slots**: Save 3-5 outfit presets
2. **Cosmetics Shop**: Purchase cosmetics with in-game currency
3. **Cosmetics Rarity**: Common, Rare, Epic, Legendary cosmetics
4. **Animated Cosmetics**: Hair animations, particle effects
5. **Custom Colors**: RGB color picker for more variety
6. **Cosmetics Trading**: Allow players to trade cosmetics
7. **Seasonal Items**: Limited-time cosmetics for events
8. **Achievement Cosmetics**: Unlock items by completing challenges

## Performance Notes

- Cosmetics rendering happens in the avatar sprite draw function
- Minimal performance impact due to simple SVG-style graphics
- Mini-map updates efficiently with canvas clearing
- Particle effects are capped to prevent memory issues

## Troubleshooting

### Cosmetics Not Saving
1. Check browser console for errors
2. Verify Supabase connection is active
3. Ensure cosmetics column exists in database
4. Check user has write permissions to game_characters table

### Avatar Not Updating
1. Verify cosmetics object is valid (use validateCosmetics)
2. Check that IsometricGameMap receives cosmetics prop
3. Ensure hair color is a valid hex value
4. Clear browser cache and reload

### Mini-map Not Displaying
1. Verify miniMapRef is properly connected
2. Check canvas element is created
3. Ensure MAP_WIDTH and MAP_HEIGHT are correct
4. Check browser console for canvas context errors

## File Locations
- Cosmetics definitions: `src/lib/characterCosmetics.js`
- Customizer component: `src/components/game/CharacterCustomizer.jsx`
- Duel system: `src/components/game/DuelMatch.jsx`
- Match history: `src/components/game/MatchHistory.jsx`
- Game map: `src/components/game/IsometricGameMap.jsx`
- Game API: `src/lib/gameAPI.js`
- Database migrations: `supabase/migrations/20250115_add_cosmetics_and_matches.sql`
