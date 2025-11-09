# Game Features Integration Guide

This guide explains how to integrate all the new game features into your PlayCurrency game.

## New Components & Systems

### 1. Collapsible Minimap
**File:** `src/components/game/CollapsibleMinimap.jsx`

```jsx
import CollapsibleMinimap from './game/CollapsibleMinimap'

<CollapsibleMinimap
  properties={properties}
  character={character}
  avatarPos={avatarPos}
  zoom={zoom}
  cameraPos={cameraPos}
  onMinimapClick={(coords) => {
    // Handle minimap click to move character
    moveTo(coords.x, coords.y)
  }}
  city="Manila"
/>
```

**Features:**
- Collapsible/expandable view (toggle between full and compact)
- Shows all properties on the map with color coding
- Player position indicator with glow effect
- Viewport indicator showing current camera view
- Click to navigate directly to locations

### 2. Floating Rewards System
**File:** `src/components/game/FloatingRewards.jsx`

```jsx
import { RewardsContainer, showReward } from './game/FloatingRewards'

// Add RewardsContainer once at root level
<RewardsContainer />

// Show rewards anywhere
showReward('money', 500)
showReward('xp', 50)
showReward('level', 5)
showReward('achievement', 'Millionaire')
showReward('property', 'House')

// With custom options
showReward('money', 1000, {
  x: 100,  // pixel position
  y: 200,
  duration: 2000,
  text: 'Bonus!'
})
```

**Reward Types:**
- `money` - Money earned (💰)
- `xp` - Experience points (⭐)
- `level` - Level up (🎉)
- `item` - Item obtained (📦)
- `achievement` - Achievement unlocked (🏆)
- `property` - Property acquired (🏠)

### 3. Character Movement System
**File:** `src/lib/gameMovementSystem.js`

```jsx
import { CharacterMovement, CameraController, PathfindingEngine } from '../lib/gameMovementSystem'

// Initialize movement system
const movement = new CharacterMovement()
const camera = new CameraController()
const pathfinding = new PathfindingEngine()

// Handle WASD input
const handleKeyDown = (e) => {
  const inputVector = { x: 0, y: 0 }
  
  if (e.key === 'w' || e.key === 'ArrowUp') inputVector.y = -1
  if (e.key === 's' || e.key === 'ArrowDown') inputVector.y = 1
  if (e.key === 'a' || e.key === 'ArrowLeft') inputVector.x = -1
  if (e.key === 'd' || e.key === 'ArrowRight') inputVector.x = 1
  
  movement.applyInput(inputVector)
}

// Click to move
const handleMapClick = (x, y) => {
  movement.moveTo(x, y)
}

// In animation loop
const gameLoop = () => {
  movement.update(16) // deltaTime in ms
  camera.update(movement.position.x, movement.position.y, 16)
  
  setAvatarPos(movement.position)
  setCameraPos(camera.position)
  
  requestAnimationFrame(gameLoop)
}
```

**Features:**
- Smooth WASD/arrow key movement
- Pathfinding for click-to-move
- Smooth camera following character
- Velocity and acceleration based movement

### 4. Sound Effects System
**File:** `src/lib/gameSoundSystem.js`

```jsx
import { soundManager, playSounds } from '../lib/gameSoundSystem'

// Play sounds
playSounds.reward()
playSounds.levelup()
playSounds.work()
playSounds.property()
playSounds.achievement()
playSounds.trading()

// Configure volume
soundManager.setMasterVolume(0.7)
soundManager.setSoundVolume('work', 0.5)
soundManager.setMuted(true)
```

**Sound Types:**
- `reward` - Positive reward notification
- `levelup` - Level up jingle
- `work` - Job completion tone
- `property` - Property transaction sound
- `click` - UI click sound
- `achievement` - Achievement unlock
- `trading` - Trade completion

### 5. Achievement System
**File:** `src/lib/gameAchievementSystem.js`

```jsx
import { AchievementTracker } from '../lib/gameAchievementSystem'

// Initialize tracker
const achievements = new AchievementTracker(characterId)

// Update stats and check for new achievements
const newUnlocked = achievements.updateStats({
  level: 5,
  totalEarned: 5000,
  totalWealth: 50000,
  jobsCompleted: 10,
  propertiesOwned: 2,
  maxedSkills: 1,
  friends: 3,
  citiesVisited: 2,
  loginStreak: 7,
  dailyRewardsCollected: 5
})

// Show newly unlocked achievements
newUnlocked.forEach(ach => {
  showReward('achievement', ach.title)
})

// Get progress
const progress = achievements.getProgress('first_million')
const unlockedCount = achievements.getUnlockedCount()
const completionPercent = achievements.getCompletionPercentage()
```

**Achievement Categories:**
- Wealth (earning money)
- Experience (leveling)
- Work (completing jobs)
- Property (buying/owning properties)
- Skills (skill mastery)
- Social (friends, interactions)
- Exploration (visiting locations)
- Combo (streaks, patterns)

### 6. Achievement Display Panel
**File:** `src/components/game/AchievementsPanel.jsx`

```jsx
import AchievementsPanel from './game/AchievementsPanel'

<AchievementsPanel
  achievements={achievementTracker.getAllAchievements()}
  stats={characterStats}
/>
```

### 7. Property Management Overlay
**File:** `src/components/game/PropertyManagementOverlay.jsx`

```jsx
import PropertyManagementOverlay from './game/PropertyManagementOverlay'

<PropertyManagementOverlay
  properties={character.properties || []}
  character={character}
  onBuyProperty={(property) => {
    // Handle property purchase
    // Deduct cost from wealth
    // Add property to inventory
    showReward('property', property.name)
  }}
  onUpgradeProperty={(propertyId, upgrades) => {
    // Handle property upgrade
    // Update property level and income
  }}
  onSellProperty={(propertyId, salePrice) => {
    // Handle property sale
    // Add funds to wealth
  }}
  onClose={() => setShowPropertyUI(false)}
/>
```

**Features:**
- Buy properties from marketplace
- Upgrade properties (5 levels)
- Sell properties for income
- View property stats and income
- Real-time balance display

### 8. Enhanced Leaderboard
**File:** `src/components/game/EnhancedLeaderboard.jsx`

```jsx
import EnhancedLeaderboard from './game/EnhancedLeaderboard'

<EnhancedLeaderboard
  leaderboard={leaderboardData}
  currentUserId={userId}
/>
```

**Features:**
- Multiple seasons (all-time, seasonal, monthly, weekly)
- Sort by different categories (wealth, level, properties, income, jobs, XP)
- Search players
- Trend indicators
- Seasonal rewards display

### 9. Trading System
**File:** `src/lib/gameTradingSystem.js`

```jsx
import { tradingSystem, marketplace } from '../lib/gameTradingSystem'

// Create a trade
const trade = tradingSystem.createTrade(
  playerId,
  otherPlayerId,
  itemsToGive,
  itemsToReceive,
  moneyAmount
)

// Accept/reject trade
tradingSystem.acceptTrade(tradeId)
tradingSystem.rejectTrade(tradeId)

// Marketplace
const listing = marketplace.listItem(
  sellerId,
  item,
  price,
  quantity
)

marketplace.buyItem(buyerId, listingId, quantity)
```

### 10. UI Enhancements
**File:** `src/components/game/GameUIEnhancements.jsx`

```jsx
import {
  AnimatedStatDisplay,
  AnimatedButton,
  AnimatedProgressBar,
  GameCard,
  StatusBadge,
  Tooltip,
  LoadingSpinner,
  AnimatedCounter
} from './game/GameUIEnhancements'

// Animated stat display
<AnimatedStatDisplay
  label="Wealth"
  value={character.wealth}
  icon="💰"
  color="cyan"
  trend={+500}
/>

// Animated progress bar
<AnimatedProgressBar
  value={character.xp}
  max={1000}
  label="Experience"
  color="cyan"
/>

// Animated button
<AnimatedButton
  onClick={handleClick}
  variant="primary"
  size="md"
>
  Click me!
</AnimatedButton>

// Status badge
<StatusBadge status="working" />

// Tooltip
<Tooltip text="This shows more information">
  <button>Hover me</button>
</Tooltip>

// Loading spinner
<LoadingSpinner size="md" />

// Animated counter
<AnimatedCounter from={0} to={1000} duration={1000} />
```

## Integration Checklist

- [ ] Import and add `RewardsContainer` to your main App component
- [ ] Add `CollapsibleMinimap` to your IsometricGameMap view
- [ ] Implement WASD/arrow key movement in IsometricGameMap
- [ ] Initialize `soundManager` and play sounds on events
- [ ] Create `AchievementTracker` instance for character
- [ ] Add `AchievementsPanel` to a game view/menu
- [ ] Integrate `PropertyManagementOverlay` into property UI
- [ ] Replace leaderboard with `EnhancedLeaderboard`
- [ ] Use UI enhancement components throughout your game
- [ ] Test all systems and balance gameplay

## Performance Optimization Tips

1. **Minimap:** Use canvas rendering, update only when needed
2. **Animations:** Use CSS animations over JavaScript where possible
3. **Sound:** Keep audio context initialized, use Web Audio API
4. **Pathfinding:** Cache paths, limit recalculation frequency
5. **Achievements:** Check in batches, not on every stat change
6. **Leaderboard:** Paginate results, fetch incrementally

## Event Emission Pattern

The system uses browser events for cross-component communication:

```jsx
// Emit a reward event
window.dispatchEvent(new CustomEvent('game-reward', {
  detail: {
    type: 'money',
    amount: 500
  }
}))

// Listen for events
window.addEventListener('game-reward', (e) => {
  console.log('Reward:', e.detail)
})
```

## File Structure

```
src/
├── components/game/
│   ├── CollapsibleMinimap.jsx
│   ├── FloatingRewards.jsx
│   ├── AchievementsPanel.jsx
│   ├── PropertyManagementOverlay.jsx
│   ├── EnhancedLeaderboard.jsx
│   ├── GameUIEnhancements.jsx
│   └── [existing components]
├── lib/
│   ├── gameMovementSystem.js
│   ├── gameSoundSystem.js
│   ├── gameAchievementSystem.js
│   ├── gameTradingSystem.js
│   └── [existing systems]
```

## Next Steps

1. Integrate all components into PlayCurrency.jsx
2. Add keyboard event listeners for movement
3. Create settings panel for sound/UI preferences
4. Balance property prices and income rates
5. Add more achievement milestones
6. Implement social/trading UI
7. Optimize performance for mobile devices
8. Add analytics for player behavior

For detailed implementation, refer to individual component files.
