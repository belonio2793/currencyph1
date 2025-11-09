# Character Cosmetics System - Quick Start Guide

## 🚀 Quick Start (5 minutes)

### For Players
1. Open the Play Currency game
2. Create a new character
3. Click the "🎨 Customize" button in the character card
4. Choose your skin tone, hair style, hair color, outfit, and accessories
5. Drag the panel to your preferred location
6. Click "Done" - changes auto-save!
7. See your character in the isometric game world

### For Developers

#### Adding a New Skin Tone
Edit `src/lib/characterCosmetics.js`:
```javascript
export const COSMETICS = {
  skinTones: [
    // ... existing tones ...
    { id: 'olive', name: 'Olive', hex: '#a8b494', label: '🌿' },
  ],
  // ...
}
```

#### Adding a New Outfit
```javascript
  outfits: [
    // ... existing outfits ...
    { id: 'cyberpunk', name: 'Cyberpunk', top: '#00ff00', bottom: '#00aa00', label: '🤖' },
  ],
```

#### Adding a New Hair Color
```javascript
  hairColors: [
    // ... existing colors ...
    { id: 'silver', name: 'Silver', hex: '#c0c0c0' },
  ],
```

#### Using Cosmetics in Your Component
```javascript
import { COSMETICS, validateCosmetics } from '../lib/characterCosmetics'

function MyComponent({ cosmetics }) {
  // Validate cosmetics
  const validCosmetics = validateCosmetics(cosmetics)
  
  // Access options
  const skinTone = COSMETICS.skinTones.find(s => s.id === validCosmetics.skinTone)
  const hairColor = validCosmetics.hairColor // hex value
  
  // Use in rendering
  return <div style={{ color: skinTone?.hex }}>...</div>
}
```

#### Updating Character Cosmetics
```javascript
import { gameAPI } from '../lib/gameAPI'

// Update cosmetics
const updated = await gameAPI.updateCharacterCosmetics(characterId, {
  skinTone: 'fair',
  hairStyle: 'long',
  hairColor: '#f4d03f',
  outfit: 'formal',
  accessories: {
    head: 'hat',
    eyes: 'glasses',
    neck: 'necklace',
    back: 'backpack',
    hand: 'none'
  }
})

// Get cosmetics
const cosmetics = await gameAPI.getCharacterCosmetics(characterId)
```

## 🎨 Cosmetics Options Reference

### Skin Tones
```
pale | fair | light-brown | medium-brown | dark-brown | tan
```

### Hair Styles
```
short | medium | long | spiky | curly | bald
```

### Hair Colors
```
black | brown | blonde | red | purple | blue | green | gray
```

### Outfits
```
casual | formal | tech | farmer | business | athletic | delivery
```

### Accessories
**Head Slot**: hat, cap, none
**Eyes Slot**: glasses, sunglasses, none
**Neck Slot**: necklace, none
**Back Slot**: backpack, none
**Hand Slot**: briefcase, none

## 📋 Component API

### CharacterCustomizer
```jsx
<CharacterCustomizer
  cosmetics={cosmetics}              // Current cosmetics object
  onUpdateCosmetics={handleUpdate}   // Callback when cosmetics change
  isOpen={true}                      // Show/hide panel
  onToggle={() => setOpen(!open)}    // Toggle visibility
/>
```

### DuelMatch
```jsx
<DuelMatch
  sessionId="unique-id"              // Match session ID
  player={character}                 // Player object {id, name}
  opponent={opponent}                // Opponent object {id, name}
  onEnd={handleDuelEnd}              // Callback when match ends
  userId={userId}                    // User ID for tracking
  userEmail={userEmail}              // User email for records
/>
```

### MatchHistory
```jsx
<MatchHistory
  characterId={charId}               // Character to show history for
  maxMatches={8}                     // Number of matches to display
/>
```

## 🗄️ Database Operations

### Check if Cosmetics Column Exists
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name='game_characters' AND column_name='cosmetics';
```

### Add Cosmetics Column (if missing)
```sql
ALTER TABLE public.game_characters 
ADD COLUMN cosmetics JSONB DEFAULT '{}'::jsonb;
```

### Query Characters with Specific Cosmetics
```sql
SELECT id, name, cosmetics 
FROM public.game_characters 
WHERE cosmetics->>'skinTone' = 'fair';
```

### Update Cosmetics via SQL
```sql
UPDATE public.game_characters 
SET cosmetics = jsonb_set(cosmetics, '{hairColor}', '"#1a1a1a"')
WHERE id = 'character-uuid';
```

## 🔍 Debugging

### Log Cosmetics
```javascript
const cosmetics = { skinTone: 'fair', hairStyle: 'medium' }
const valid = validateCosmetics(cosmetics)
console.log('Valid cosmetics:', valid)
```

### Check Database Connection
```javascript
const { data, error } = await supabase
  .from('game_characters')
  .select('id, cosmetics')
  .limit(1)

console.log('DB connection:', error ? 'ERROR' : 'OK')
```

### Test Cosmetics Rendering
```javascript
// Add this to IsometricGameMap
console.log('Avatar cosmetics:', {
  skin: getCosmeticOption('skinTones', cosmetics?.skinTone),
  hair: cosmetics?.hairColor,
  outfit: getCosmeticOption('outfits', cosmetics?.outfit)
})
```

## 🎯 Common Tasks

### Task: Change Default Cosmetics
Edit `src/lib/characterCosmetics.js`:
```javascript
export const DEFAULT_COSMETICS = {
  skinTone: 'dark-brown',      // Changed from 'fair'
  hairStyle: 'curly',           // Changed from 'medium'
  hairColor: '#f4d03f',         // Changed from '#1a1a1a'
  outfit: 'tech',               // Changed from 'casual'
  accessories: { /* ... */ }
}
```

### Task: Add Gender Support
```javascript
// In characterCosmetics.js
export const COSMETICS = {
  genders: [
    { id: 'male', label: '👨' },
    { id: 'female', label: '👩' },
    { id: 'other', label: '🧑' }
  ],
  // ... other cosmetics ...
}

export const DEFAULT_COSMETICS = {
  gender: 'male',
  // ... other fields ...
}
```

### Task: Make Cosmetics Purchasable
```javascript
async function purchaseCosmetics(characterId, cosmeticId, price) {
  // 1. Check player wealth
  const char = await gameAPI.getCharacter(characterId)
  if (char.wealth < price) throw new Error('Insufficient funds')
  
  // 2. Deduct cost
  await gameAPI.updateCharacterStats(characterId, {
    wealth: char.wealth - price
  })
  
  // 3. Add to inventory
  // TODO: Implement inventory system
}
```

### Task: Create Achievement for Customization
```javascript
async function checkCustomizationAchievements(characterId, cosmetics) {
  const achievements = []
  
  // Rainbow Hair Achievement
  if (cosmetics.hairColor === '#9c27b0') {
    achievements.push('rainbow_hair')
  }
  
  // Formal Attire Achievement
  if (cosmetics.outfit === 'formal' && cosmetics.accessories.neck === 'necklace') {
    achievements.push('formal_attire')
  }
  
  return achievements
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Cosmetics not showing | Check cosmetics prop passed to IsometricGameMap |
| Panel won't drag | Click header, not content area |
| Changes not saved | Check browser dev tools for errors |
| Avatar looks wrong | Validate cosmetics with validateCosmetics() |
| Database error | Run migration: `20250115_add_cosmetics_and_matches.sql` |

## 📚 File Reference

| File | Purpose |
|------|---------|
| `src/lib/characterCosmetics.js` | Cosmetics definitions |
| `src/components/game/CharacterCustomizer.jsx` | Customizer UI |
| `src/components/game/DuelMatch.jsx` | Duel system |
| `src/components/game/MatchHistory.jsx` | Match records |
| `src/components/game/IsometricGameMap.jsx` | World & rendering |
| `src/lib/gameAPI.js` | Database operations |

## 🔗 Related Components

- **PlayCurrency.jsx** - Main game component
- **IsometricGameMap.jsx** - Game world rendering
- **Avatar Renderer** - Inside IsometricGameMap.drawAvatar()

## 💡 Tips & Tricks

1. **Hot Reload**: Edit cosmetics in `characterCosmetics.js` and refresh
2. **Testing**: Use browser dev tools to manually set state
3. **Performance**: Cache cosmetics in memory, not local state
4. **Validation**: Always run `validateCosmetics()` on user input
5. **UI**: Use emoji labels for quick visual identification

## 🎓 Next Steps

1. Read `CHARACTER_COSMETICS_IMPLEMENTATION.md` for details
2. Check `COSMETICS_FEATURE_SHOWCASE.md` for features
3. Review component source code
4. Test in browser dev tools
5. Extend with custom cosmetics
6. Add to your own game!

---

**Last Updated**: January 2025
**Version**: 1.0
**Questions?** Check IMPLEMENTATION_SUMMARY.md
