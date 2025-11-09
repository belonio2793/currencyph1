# Quick Start Integration Checklist

Complete integration of all new game features in 5 minutes.

## Step 1: Add Floating Rewards Container (1 min)

In your `src/components/PlayCurrency.jsx`, add at the top level:

```jsx
import { RewardsContainer } from './game/FloatingRewards'

// In your JSX, add this once at the root:
<RewardsContainer />
```

This enables floating reward animations globally.

---

## Step 2: Import and Display Minimap (2 min)

In your game view component:

```jsx
import CollapsibleMinimap from './game/CollapsibleMinimap'

// In your JSX:
<CollapsibleMinimap
  properties={properties}
  character={character}
  avatarPos={avatarPos}
  zoom={zoom}
  cameraPos={cameraPos}
  onMinimapClick={(coords) => {
    // Handle click to navigate
    moveTo(coords.x, coords.y)
  }}
  city="Manila"
/>
```

---

## Step 3: Wire Up Sound System (1 min)

In your event handlers:

```jsx
import { playSounds } from '../lib/gameSoundSystem'

// Play sounds on events
function handleJobComplete() {
  playSounds.reward()
  showReward('money', jobReward)
}

function handleLevelUp() {
  playSounds.levelup()
  showReward('level', newLevel)
}
```

---

## Step 4: Add Achievement Tracking (1 min)

Initialize in your component:

```jsx
import { AchievementTracker } from '../lib/gameAchievementSystem'

const achievementTracker = useRef(new AchievementTracker(character?.id))

// Update after stat changes
function updateStats() {
  const newUnlocked = achievementTracker.current.updateStats({
    level: character.level,
    totalWealth: character.wealth,
    jobsCompleted: character.jobs_completed,
    propertiesOwned: character.properties?.length || 0
  })
  
  // Show new achievements
  newUnlocked.forEach(ach => {
    showReward('achievement', ach.title)
    playSounds.achievement()
  })
}
```

---

## Step 5: Add UI Buttons and Displays (1 min)

Display key stats and add action buttons:

```jsx
import { AnimatedStatDisplay, AnimatedButton } from './game/GameUIEnhancements'

// Show stats
<AnimatedStatDisplay
  label="Wealth"
  value={character.wealth}
  icon="💰"
  color="green"
/>

// Add buttons
<AnimatedButton
  onClick={() => setShowProperties(true)}
  variant="primary"
  size="md"
>
  🏠 Properties
</AnimatedButton>

<AnimatedButton
  onClick={() => setShowLeaderboard(true)}
  variant="secondary"
  size="md"
>
  🏆 Leaderboard
</AnimatedButton>
```

---

## Bonus Features (Optional)

### Add Property Management
```jsx
import PropertyManagementOverlay from './game/PropertyManagementOverlay'

{showProperties && (
  <PropertyManagementOverlay
    properties={character.properties}
    character={character}
    onBuyProperty={handleBuyProperty}
    onUpgradeProperty={handleUpgradeProperty}
    onSellProperty={handleSellProperty}
    onClose={() => setShowProperties(false)}
  />
)}
```

### Add Leaderboard
```jsx
import EnhancedLeaderboard from './game/EnhancedLeaderboard'

{showLeaderboard && (
  <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
    <EnhancedLeaderboard
      leaderboard={leaderboardData}
      currentUserId={userId}
    />
  </div>
)}
```

### Add Achievements Panel
```jsx
import AchievementsPanel from './game/AchievementsPanel'

{showAchievements && (
  <AchievementsPanel
    achievements={achievementTracker.current.getAllAchievements()}
  />
)}
```

---

## What You Get After Integration

✅ **Visual Feedback**
- Floating rewards for all actions
- Smooth animations and transitions
- Status indicators and badges

✅ **Audio Feedback**
- Sound effects for rewards, level ups, properties
- Configurable volume levels
- No external audio files needed

✅ **Player Progression**
- 19 achievements to unlock
- Level and XP tracking
- Wealth milestones

✅ **Navigation**
- Collapsible minimap
- Click-to-navigate pathfinding
- WASD movement support

✅ **Social Features**
- 6-season leaderboard
- 6 ranking categories
- Search and filtering

✅ **Property Management**
- Buy/sell/upgrade properties
- Income tracking
- Investment planning

---

## Testing Checklist

After integration, test these scenarios:

- [ ] 🎮 WASD keys move character around
- [ ] 🗺️ Minimap shows and hides correctly
- [ ] 💰 Floating rewards appear on money earn
- [ ] ⭐ XP rewards display correctly
- [ ] 🎉 Level up shows celebration
- [ ] 🏠 Property purchase shows notification
- [ ] 🔊 Sound effects play on events
- [ ] 🏆 Achievements unlock and display
- [ ] 📊 Leaderboard shows top players
- [ ] ��� All animations are smooth

---

## Performance Tips

1. **Only render what's visible** - Use React.memo for components
2. **Cache achievements** - Don't update every frame
3. **Debounce stat updates** - Group updates into batches
4. **Use canvas for minimap** - More efficient than SVG
5. **Limit particle effects** - Cap floating rewards to 10-15 active

---

## Troubleshooting

**Sounds not playing:**
- Check browser Web Audio API support
- Verify volume settings not muted
- Test in console: `playSounds.click()`

**Minimap not showing:**
- Ensure properties have `location_x` and `location_y`
- Check z-index isn't hidden behind other elements
- Verify canvas is rendering (check browser console)

**Achievements not unlocking:**
- Verify stats are being updated
- Check achievement unlock conditions
- Test achievement tracker in console

**Movement not working:**
- Add keyboard event listeners in useEffect
- Check key codes match (WASD vs arrow keys)
- Verify game loop is running (requestAnimationFrame)

---

## Next Steps

1. ✅ Complete integration checklist above
2. ✅ Test all features work
3. ✅ Customize achievement goals
4. ✅ Balance property prices/income
5. ✅ Add more sound effects
6. ✅ Deploy and enjoy!

---

## Files You'll Need

**Components to Import:**
- CollapsibleMinimap.jsx
- FloatingRewards.jsx
- AchievementsPanel.jsx (optional)
- PropertyManagementOverlay.jsx (optional)
- EnhancedLeaderboard.jsx (optional)
- GameUIEnhancements.jsx

**Systems to Import:**
- gameSoundSystem.js
- gameAchievementSystem.js
- gameMovementSystem.js (optional)
- gameTradingSystem.js (optional)

**All files are in:**
- `src/components/game/` - Components
- `src/lib/` - Systems

---

## You're All Set! 🚀

All new features are ready to use. Start with the 5-minute setup above, then explore the integration guide for advanced customization.

Enjoy your enhanced game! 🎮
