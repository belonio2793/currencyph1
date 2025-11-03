# Currency Game - Monopoly-Like Real Estate & Business Simulator

A comprehensive implementation of a Monopoly-like game called **Currency** that allows players to buy properties, manage businesses, earn income, trade items, and compete in a dynamic economy based on real Philippine street maps and locations.

## 🎮 Game Overview

**Currency** is a free-roaming economic simulation game where players:
- Explore real-world street maps and neighborhoods
- Purchase properties (houses, businesses, farms, shops, factories)
- Generate passive income from property ownership
- Work jobs to earn money
- Upgrade properties to increase value and income
- Trade items and properties in a player-driven marketplace
- Build wealth through strategic investments

## 🏗️ Architecture & Components

### Core Systems

#### 1. **3D World Rendering** (`src/lib/world3D.js` & `src/lib/world3DEnhancements.js`)

Enhanced Three.js-based 3D world with:
- Real Google Street Maps satellite imagery as terrain
- Dynamic property building visualization
- Street grid with real street names
- Property markers showing price, owner, and daily revenue
- First-person, third-person, isometric, and top-down camera modes
- Real-time player presence and NPC interactions

**New Enhancements:**
- `PropertyBuildingRenderer`: Creates 3D buildings for each property with height based on property value
- `StreetGridRenderer`: Renders street grids and labels with real street names
- `PropertyMarkerEnhanced`: Advanced visual markers showing property details

```javascript
// Usage
const buildingRenderer = new PropertyBuildingRenderer(scene)
buildingRenderer.createPropertyBuilding(propertyId, position, type, value)
```

#### 2. **Currency Game Engine** (`src/lib/currencyGameEngine.js`)

Core business logic for:
- Property purchasing and selling
- Property value calculation and upgrades
- Passive income generation from properties
- Character balance management
- Real-time income tick (every minute)

```javascript
const engine = new CurrencyGameEngine(characterId)
const properties = await engine.loadProperties(characterId)
engine.startIncomeGeneration(characterId)
```

#### 3. **Street Map Integration** (`src/lib/streetMapUtils.js`)

Real geographic data for Philippine cities:
- **Manila**: Ayala Avenue, Paseo de Roxas, EDSA, BGC
- **Cebu**: IT Park, business zones
- **Davao**: CBD, commercial areas
- **Iloilo**: Business parks

Features:
- Street property generation
- District multipliers for property values
- Market trends and price forecasting
- Property suggestions based on budget
- Location-based pricing

```javascript
const suggestions = getPropertySuggestions('Manila', 1000000)
const trends = getMarketTrends('Manila')
const locationName = getLocationName(lat, lng, 'Manila')
```

### UI Components

#### 1. **CurrencyGameUI** (`src/components/game/CurrencyGameUI.jsx`)

Main game interface with tabs:
- **Overview**: Daily income, portfolio value, stats dashboard
- **Properties**: View all owned properties with management options
- **Work**: Complete jobs to earn money
- **Property Details**: View and interact with specific properties

Features:
- Real-time income tracking
- Property portfolio management
- Character stats display (level, experience, energy)

#### 2. **PropertyInteractionModal** (`src/components/game/PropertyInteractionModal.jsx`)

Property interaction system:
- **View**: Detailed property information and ROI calculations
- **Buy**: Purchase available properties
- **Upgrade**: Increase property value and revenue
- **Sell**: Liquidate property assets

Information displayed:
- Current value and revenue
- Annual ROI percentage
- Owner information
- Property specifications

#### 3. **GameWork** (`src/components/game/GameWork.jsx`)

Job system with 6 different jobs:
- **Street Merchant**: ₱50 base wage, 30s duration
- **Courier**: ₱75 base wage, 45s duration
- **Construction Worker**: ₱100 base wage, 60s duration
- **Security Guard**: ₱80 base wage, 120s duration
- **Market Vendor**: ₱120 base wage, 90s duration
- **Tutor**: ₱150 base wage, 60s duration

Features:
- Energy cost per job
- Experience rewards
- Level-based wage multipliers
- Real-time job progress tracking
- Job completion rewards

#### 4. **CurrencyMarketplace** (`src/components/game/CurrencyMarketplace.jsx`)

Player-driven economy:
- Buy and sell items
- Trade properties
- Create custom listings
- Filter by type and price
- Real-time transaction tracking

Transaction Types:
- Item purchases
- Property sales
- Service offerings

#### 5. **PlayCurrency Integration** (`src/components/PlayCurrency.jsx`)

Main game hub integrating:
- 3D immersive world
- Character management
- Game systems access
- Modal dialogs for different activities

## 📊 Database Schema Integration

### Game Tables Used

**game_characters**: Core player data
```sql
- id, user_id, name, level, experience
- money, energy, health
- current_location, home_city
- appearance (ReadyPlayer.me avatar)
```

**game_properties**: Player-owned properties
```sql
- id, owner_id, property_type
- location_x, location_y, city, province
- purchase_price, current_value, revenue_per_day
- workers_count, status
```

**game_marketplace_listings**: Player economy
```sql
- id, seller_id, item_id, property_id
- quantity, unit_price, total_price
- listing_type (item/property/service)
- status (active/sold/cancelled)
```

**game_transactions**: Transaction history
```sql
- id, buyer_id, seller_id
- quantity, unit_price, total_price
- transaction_type (purchase/sale/trade/property_sale)
```

**game_inventory**: Character items
```sql
- id, character_id, item_id
- quantity, acquired_at
```

## 🎯 Game Mechanics

### Income Generation

**Daily Income Calculation**:
```
Total Daily Income = Sum of (Property Revenue per Day)
Monthly Income = Daily Income × 30
Annual Income = Daily Income × 365
```

**Property Revenue Factors**:
- Base revenue by property type
- District multiplier (varies 0.9-1.4x)
- Property upgrade level
- Current market conditions

### Property Value

**Price Calculation**:
```
Property Value = Base Price × District Multiplier × Market Condition
Base Prices:
- House: ₱500,000
- Business: ₱2,000,000
- Farm: ₱750,000
- Shop: ₱800,000
- Factory: ₱2,000,000+
```

### Work System

**Wage Calculation**:
```
Earned = Base Wage × (1 + Level × 0.1) + Random(0 to 50%)
Experience Gain = Base XP + Random(0 to 5)
Energy Cost = Deducted from character pool (max 100)
```

### Marketplace Economy

**Dynamic Pricing**:
- Player-set prices
- Supply and demand
- Historical price tracking
- Price trends visualization

## 🚀 How to Use

### Starting the Currency Game

1. **Log in** to your character
2. Click **"💰 Currency Game"** button in the main interface
3. Choose an activity from the tabs:
   - **Overview**: View income and portfolio
   - **Properties**: Manage your properties
   - **Work**: Complete jobs for money
   - **Property Details**: Interact with specific properties

### Buying Your First Property

1. Navigate to **Work** tab
2. Complete a job to earn money
3. Click on a property in the 3D world
4. Click **"Buy"** in the property modal
5. Confirm purchase to own the property

### Earning Passive Income

1. Purchase properties
2. Income automatically generates (every minute)
3. Check **Overview** tab to see daily/monthly income
4. Upgrade properties to increase revenue

### Upgrading Properties

1. Click on your property
2. Enter upgrade cost
3. Property value increases by upgrade cost
4. Daily revenue increases by 25%

### Trading in Marketplace

1. Go to **Marketplace** (main menu)
2. Browse listings or create your own
3. Set quantity and price
4. Other players can purchase your items/properties

## 📍 Real Street Map Features

### Philippine Cities Supported

**Manila**:
- Ayala Avenue (commercial, 1.4x multiplier)
- Paseo de Roxas (commercial, 1.3x)
- EDSA (highway corridor)
- BGC (business, 1.3x)
- Quezon City (mixed, 1.1x)

**Cebu**:
- IT Park (commercial, 1.15x)
- Business zones
- Mactan area

**Davao**:
- CBD (commercial)
- Mixed residential/commercial

**Iloilo**:
- Business parks
- Commercial centers

### Street Integration

Properties are placed on real streets with:
- Accurate latitude/longitude
- District-based pricing multipliers
- Neighborhood quality ratings
- Local demand levels

```javascript
// Example: Generate property on real street
const property = generatePropertyOnStreet('Ayala Avenue', 'commercial')
// Returns property with real coordinates and pricing
```

## ⚙️ Configuration & Customization

### Job Configuration (`GameWork.jsx`)

Modify job properties:
```javascript
{
  id: 'custom_job',
  name: 'Custom Work',
  description: 'Description here',
  icon: '🎯',
  baseWage: 100,
  duration: 60,
  energy: 25,
  experience: 15
}
```

### Property Types

Add new property types in `PropertyInteractionModal.jsx`:
```javascript
const PROPERTY_TYPES = {
  newtype: { 
    name: 'Type Name',
    emoji: '🏢',
    basePrice: 1000000,
    dailyRevenue: 500
  }
}
```

### Street Customization

Add streets to `streetMapUtils.js`:
```javascript
const CUSTOM_STREETS = {
  'Street Name': { 
    lat: 14.5599, 
    lng: 120.9873, 
    type: 'commercial', 
    district: 'District Name' 
  }
}
```

## 🎓 Learning Resources

### Key Files
- `src/lib/currencyGameEngine.js` - Core game logic
- `src/components/game/CurrencyGameUI.jsx` - Main UI
- `src/lib/world3D.js` - 3D rendering
- `src/lib/world3DEnhancements.js` - Property visualization

### Usage Patterns

**Loading game data**:
```javascript
const engine = new CurrencyGameEngine(characterId)
const properties = await engine.loadProperties(characterId)
const totalIncome = engine.getTotalDailyIncome()
```

**Character updates**:
```javascript
const character = await engine.loadCharacter(characterId)
const roi = engine.getPropertyROI(property)
```

**Street integration**:
```javascript
const location = getLocationName(lat, lng, city)
const trends = getMarketTrends(city)
```

## 🐛 Troubleshooting

### Properties not showing
- Ensure properties have `location_x` and `location_y` OR `lat` and `lng`
- Check World3D renderer is initialized
- Verify properties are in current city

### Income not updating
- Ensure `startIncomeGeneration()` is called
- Check browser console for errors
- Verify character has properties with `revenue_per_day > 0`

### Jobs not completing
- Verify character has enough energy
- Check energy is properly deducted
- Ensure job duration is reached

### Marketplace not showing listings
- Check database has active listings
- Verify `status = 'active'` filter
- Clear browser cache

## 🎮 Future Enhancements

Potential features for expansion:
- Property rental system
- Stock market integration
- Business hiring and management
- Land development and zoning
- NPC AI trading
- Property taxes and maintenance costs
- Cooperative properties with other players
- International property investment
- Currency exchange system
- Real economic indicators

## 📝 Notes

- All prices in Philippine Pesos (₱)
- Income ticks every minute (configurable)
- Energy regenerates slowly over time
- Properties generate income 24/7
- Marketplace transactions are permanent
- Price history tracked in database
- ROI calculated as annual return percentage

---

**Currency Game v1.0** - A complete Monopoly-like economic simulation for the Philippines
