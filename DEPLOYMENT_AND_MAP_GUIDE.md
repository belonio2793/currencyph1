# Deployment & Isometric Game Map Guide

## 🎮 New Features Implemented

### 1. **Enhanced Isometric Game Map**
A fully interactive tycoon-style game map with the following features:

#### Interactive Map Controls
- **Drag to Pan**: Click and drag anywhere on the map to move the camera
- **Scroll to Zoom**: Use mouse wheel to zoom in/out (50% - 300%)
- **WASD Movement**: Press W/A/S/D or Arrow Keys to move your avatar around the map
- **Property Interaction**: Click any property to view details and manage your investments

#### Avatar System
- **Character Animation**: Your avatar animates while moving with realistic running animation
- **Directional Facing**: Avatar faces the direction of movement (left/right)
- **Position Tracking**: Real-time position display showing game coordinates
- **City Selection**: Switch between Manila, Cebu City, and Davao City

#### Philippines Geography Integration
- **Real Coordinates**: Properties mapped with actual Philippine latitude/longitude data
- **City Neighborhoods**: Distinct neighborhood zones within each city
- **Street Names**: Realistic street layouts (Ayala Avenue, Paseo de Roxas, Quirino Ave, etc.)
- **Multiple Cities**: Full support for 3+ major Philippine cities with expandable system

#### Visual Features
- **Neighborhood Zones**: Color-coded neighborhood areas for easy identification
- **Property Types**: 8+ property type colors (houses, businesses, farms, shops, etc.)
- **Height Variation**: Owned properties display 3D height; taller = more valuable
- **Hover Effects**: Properties brighten and highlight yellow on hover
- **Rich Tooltips**: Property name, type, value, and ownership status on hover
- **Dynamic Legend**: In-game legend showing property types and controls

#### Game Settings Integration
- **Avatar Speed Control**: Adjust how fast your avatar moves (0.5x - 5.0x)
- **Camera Pan Speed**: Control map dragging sensitivity (0.3x - 3.0x)
- **Avatar Trail Option**: Toggle movement history display (planned)
- **Persistent Settings**: All preferences saved across sessions

---

## 🚀 Deployment Guide

### Quick Start Deployment

#### Option 1: Build Only (No Deployment)
```bash
npm run build
# Output: dist/ folder with compiled assets
```

#### Option 2: Build & Deploy to Fly.dev
```bash
npm run deploy:fly
# Builds, commits changes, pushes to git, and deploys to Fly.dev
```

#### Option 3: Dry Run (Preview What Would Happen)
```bash
npm run deploy:dry-run
# Shows all steps without making actual changes
```

#### Option 4: Full Deployment with All Options
```bash
npm run deploy -- --fly --verbose
# Builds, tests, commits, pushes, and deploys with detailed logging
```

### Deployment Scripts

#### Node.js Deployment Script
```bash
npm run deploy [OPTIONS]

Options:
  -d, --dry-run      Show plan without executing
  -f, --fly          Deploy to Fly.dev
  -s, --skip-tests   Skip test execution
  -g, --skip-git     Skip Git commit/push
  -v, --verbose      Detailed logging

Examples:
  npm run deploy                 # Build only
  npm run deploy --fly           # Build and deploy
  npm run deploy --dry-run       # Preview deployment
  npm run deploy -f -s -v        # Full deployment with logs
```

#### Bash Deployment Script
```bash
bash scripts/deploy.sh [OPTIONS]

Options:
  -f, --fly          Deploy to Fly.dev
  -s, --skip-tests   Skip tests
  -d, --dry-run      Preview without changes
  -v, --verbose      Detailed output
  -h, --help         Show help
```

### What the Deployment Script Does

1. **Prerequisite Checks**
   - Verifies Node.js, npm, and Git are installed
   - Checks for Fly.dev CLI if deployment enabled
   - Validates Git configuration

2. **Dependency Management**
   - Runs `npm install` to ensure all packages are up-to-date
   - Uses Yarn if configured (preserves lock file)

3. **Testing** (optional)
   - Runs `npm test` if test script exists
   - Continues even if tests fail (use --skip-tests to disable)

4. **Build Process**
   - Executes `npm run build` using Vite
   - Validates build output in dist/ folder
   - Reports build size and file count

5. **Version Control**
   - Commits all changes with timestamp
   - Skips if no changes detected
   - Use --skip-git to disable

6. **Remote Push**
   - Pushes to current branch on remote repository
   - Requires valid Git credentials
   - Detects branch name automatically

7. **Fly.dev Deployment** (if --fly enabled)
   - Executes `flyctl deploy`
   - Monitors deployment status
   - Provides application URL

---

## 📊 File Structure

### New Files Created
```
src/
├── components/game/
│   └── IsometricGameMap.jsx          # Enhanced map with avatar and dragging
├── data/
│   └── philippinesGeography.ts       # Philippines cities, streets, coords
└── game/
    └── GameSettings.jsx              # Updated with map controls

scripts/
├── deploy.js                         # Node.js deployment script
└── deploy.sh                         # Bash deployment script

Configuration:
├── package.json                      # Updated with deploy commands
└── DEPLOYMENT_AND_MAP_GUIDE.md      # This file
```

### Modified Files
- `src/components/PlayCurrency.jsx` - Added map settings state and handlers
- `src/components/game/GameSettings.jsx` - Added map controls UI
- `package.json` - Added deploy scripts

---

## 🛠️ Technical Details

### Philippines Geography Data (src/data/philippinesGeography.ts)

The geography system includes:

#### Cities Supported
1. **Manila** - 10 neighborhoods with detailed street network
2. **Cebu City** - 4 neighborhoods with street data
3. **Davao City** - 2 neighborhoods with street data
4. **Quezon City, Makati, Caloocan** - Base data for expansion
5. **Iloilo City, Cagayan de Oro** - Expandable framework

#### Coordinate System
- **Real Latitude/Longitude**: Uses actual Philippine geographic coordinates
- **Game Coordinate Conversion**: Automatic conversion between:
  - Game coords (x: 0-300, y: 0-350)
  - Real lat/lng coordinates
- **Neighborhood Bounds**: Each neighborhood has defined geographic boundaries

#### Streets Included
- Ayala Avenue (Makati)
- Paseo de Roxas (Makati)
- JP Vargas Street (Makati)
- Makati Avenue (Makati)
- Quirino Avenue (Manila)
- Roxas Boulevard (Manila)
- Escolta (Binondo)
- Jones Bridge Road (Santa Cruz)
- Plaza Miranda (Quiapo)
- España Boulevard (Sampaloc)
- Recto Avenue (Sampaloc)
- Taft Avenue (Manila)
- Osmeña Boulevard (Cebu)
- Colon Street (Cebu)
- San Pedro Street (Davao)

### Map Rendering System

#### Coordinate Conversions
```javascript
// Convert game coordinates to isometric screen position
gridToIsometric(gridX, gridY) → { x, y }

// Convert isometric screen position back to game coordinates
isometricToGrid(isoX, isoY) → { x, y }

// Convert game coordinates to real world lat/lng
convertGameCoordsToLatLng(x, y, city) → { lat, lng }

// Convert real world coordinates to game coordinates
convertLatLngToGameCoords(lat, lng, city) → { x, y }
```

#### Rendering Engine
- **Canvas-based**: High performance 2D rendering
- **Isometric Projection**: Proper 3D-like perspective
- **Dynamic Properties**: Real-time property data visualization
- **Animation Loop**: 60 FPS avatar animation
- **Raycasting**: Accurate property hit detection

---

## 🎮 Game Settings Integration

The enhanced Game Settings modal now includes:

### Map & Avatar Controls Section
- **Avatar Speed** (0.5x - 5.0x)
  - Controls how many pixels avatar moves per key press
  - Affects WASD/Arrow key responsiveness

- **Camera Pan Speed** (0.3x - 3.0x)
  - Controls drag sensitivity
  - Lower = slower camera movement
  - Higher = faster/more responsive dragging

- **Avatar Trail** (toggle)
  - When enabled: Shows movement history
  - Helps visualize exploration patterns
  - Optional visual enhancement

### Integration with Other Settings
- All 3D camera settings still available (if using 3D world)
- Both 2D map and 3D world settings coexist
- Settings persist between sessions

---

## 🔧 Customization Guide

### Adding New Cities
Edit `src/data/philippinesGeography.ts`:

```typescript
const NEW_CITY_NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'downtown',
    name: 'Downtown Area',
    centerLat: 14.5995,    // Real latitude
    centerLng: 120.9842,   // Real longitude
    bounds: { northLat: 14.6, southLat: 14.5, westLng: 120.9, eastLng: 121.0 }
  }
  // ... more neighborhoods
]

const NEW_CITY_STREETS: Street[] = [
  {
    id: 'main-street',
    name: 'Main Street',
    startLat: 14.5950,
    startLng: 120.9800,
    endLat: 14.6050,
    endLng: 120.9800,
    neighborhood: 'downtown'
  }
  // ... more streets
]

// Add to PHILIPPINES_CITIES array
PHILIPPINES_CITIES.push({
  id: 'new-city',
  name: 'New City',
  region: 'Region Name',
  centerLat: 14.5995,
  centerLng: 120.9842,
  population: 1000000,
  neighborhoods: NEW_CITY_NEIGHBORHOODS,
  streets: NEW_CITY_STREETS
})
```

### Changing Map Colors
In `IsometricGameMap.jsx`:

```javascript
const PROPERTY_COLORS = {
  house: '#ff9800',          // Orange
  business: '#2196f3',       // Blue
  farm: '#4caf50',           // Green
  shop: '#e91e63',           // Pink
  factory: '#9c27b0',        // Purple
  restaurant: '#ff5722',     // Red-orange
  hotel: '#00bcd4',          // Cyan
  office: '#3f51b5',         // Indigo
  default: '#00bcd4'
}
```

### Adjusting Avatar Speed Defaults
In `PlayCurrency.jsx`:

```javascript
const [mapSettings, setMapSettings] = useState({
  avatarSpeed: 2,     // Pixels per key press
  cameraSpeed: 1,     // Pan sensitivity multiplier
  zoomLevel: 1        // Default zoom
})
```

---

## 🐛 Troubleshooting

### Map Not Displaying
1. Ensure `src/data/philippinesGeography.ts` is imported correctly
2. Check browser console for TypeScript errors
3. Verify canvas element is rendering (check DevTools Elements)
4. Try refreshing the page

### Avatar Not Moving
1. Click on the canvas first to ensure it has focus
2. Check that WASD/Arrow keys are not captured by other elements
3. Verify map settings avatar speed is not at 0
4. Check browser console for JavaScript errors

### Properties Not Showing
1. Verify properties have `location_x` and `location_y` fields
2. Ensure coordinates are within map bounds (0-300, 0-350)
3. Check that property type is supported in PROPERTY_COLORS
4. Inspect network tab to confirm properties are loaded

### Deployment Failures
1. **npm install fails**: Check Node/npm versions, try `npm cache clean --force`
2. **Build fails**: Check for TypeScript errors in console, verify all imports
3. **Git push fails**: Verify Git credentials, check network connection
4. **Fly.dev deploy fails**: Verify flyctl is installed, check Fly.io account status

---

## 📱 Browser Compatibility

- **Chrome/Chromium**: Full support ✓
- **Firefox**: Full support ✓
- **Safari**: Full support ✓
- **Edge**: Full support ✓
- **Mobile browsers**: Limited (touch events partially supported)

### Performance Requirements
- **Minimum**: 4GB RAM, modern processor
- **Recommended**: 8GB RAM, 2018+ processor
- **Graphics**: Any GPU with WebGL support
- **Network**: Stable connection for Fly.dev deployment

---

## 📚 API Reference

### IsometricGameMap Props
```typescript
interface IsometricGameMapProps {
  properties: Property[]              // List of properties to display
  character: Character                // Current character (optional)
  city: string                        // Current city name
  onPropertyClick: (prop) => void    // Property click handler
  mapSettings: MapSettings           // User preferences
  onCharacterMove: (pos) => void     // Movement callback
}

interface MapSettings {
  avatarSpeed: number                // 0.5 - 5.0
  cameraSpeed: number               // 0.3 - 3.0
  showAvatarTrail?: boolean          // Future feature
}

interface CharacterPosition {
  x: number                          // Game X coordinate
  y: number                          // Game Y coordinate
  lat?: number                       // Real latitude
  lng?: number                       // Real longitude
  city: string                       // Current city
}
```

### Philippines Geography API
```typescript
// Get city by ID
getCityById(cityId: string): City | undefined

// Get neighborhood by city and ID
getNeighborhoodById(cityId: string, neighborhoodId: string): Neighborhood | undefined

// Convert lat/lng to game coordinates
convertLatLngToGameCoords(lat, lng, city, mapWidth, mapHeight): { x, y }

// Convert game coordinates to lat/lng
convertGameCoordsToLatLng(x, y, city, mapWidth, mapHeight): { lat, lng }
```

---

## 🚀 Deployment Checklist

Before deploying, ensure:

- [ ] All local changes are committed
- [ ] `npm run build` succeeds without errors
- [ ] No TypeScript compilation errors
- [ ] Properties display correctly on map
- [ ] Avatar movement works smoothly
- [ ] Game settings apply changes immediately
- [ ] Git is configured with user.name and user.email
- [ ] Fly.dev CLI is installed (if deploying to Fly)
- [ ] Sufficient disk space for build output
- [ ] Network connection is stable

---

## 📞 Support & Documentation

- **Fly.dev Docs**: https://fly.io/docs/
- **Vite Guide**: https://vitejs.dev/guide/
- **React Docs**: https://react.dev/
- **Three.js Docs**: https://threejs.org/docs/
- **Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

---

## 🎯 Future Enhancements

Planned features for future updates:

1. **Avatar Trail Visualization**: Show player movement history
2. **Dynamic Streets**: Render actual street networks on map
3. **NPC Interactions**: Meet and interact with NPCs at locations
4. **Real-time Multiplayer**: See other players moving on map
5. **Weather System**: Dynamic weather affecting gameplay
6. **Day/Night Cycle**: Time-based lighting changes
7. **Mobile Optimization**: Full touch control support
8. **Voice Chat Integration**: In-game communication
9. **Trading at Locations**: Buy/sell directly on map
10. **Fast Travel System**: Quick teleport between cities

---

## 📄 License & Credits

This isometric map system uses:
- **Three.js**: 3D graphics library
- **React Canvas**: Component-based rendering
- **Real Philippine Data**: OpenStreetMap, public records

---

**Last Updated**: 2024
**Version**: 1.0.0
**Status**: Production Ready ✓
