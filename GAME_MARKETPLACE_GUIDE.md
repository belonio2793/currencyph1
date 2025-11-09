# Game Marketplace System - Complete Implementation Guide

## Overview

The Game Marketplace is a full-featured peer-to-peer trading system that enables players to buy, sell, and trade items and properties. It includes listings management, real-time updates, trade offers, player ratings, and marketplace analytics.

## Architecture

### Core Components

#### 1. **GameMarketplace.jsx** - Main Marketplace Interface
The primary UI component for browsing, creating, and managing marketplace listings.

**Features:**
- Browse active listings with search and filtering
- Sort by recent, price (low-high, high-low)
- Create new listings for items and properties
- View and manage personal listings
- Make trade offers
- Accept/reject incoming offers
- View complete trade history
- Real-time updates via Supabase subscriptions

**Usage:**
```jsx
import GameMarketplace from './components/GameMarketplace'

<GameMarketplace 
  userId={userId}
  characterId={characterId}
  onClose={() => setShowMarketplace(false)}
/>
```

#### 2. **gameMarketplace.js** - API Service Layer
Complete backend service for all marketplace operations.

**Key Functions:**

- `createItemListing(sellerId, itemId, quantity, unitPrice)` - List an item for sale
- `createPropertyListing(sellerId, propertyId, askingPrice)` - List a property for sale
- `getListings(filters = {})` - Fetch listings with optional filters
- `purchaseItem(buyerId, listingId, quantity)` - Buy items from marketplace
- `purchaseProperty(buyerId, listingId)` - Buy property from marketplace
- `createTradeOffer(listingId, buyerId, sellerId, offeredPrice)` - Make an offer on a listing
- `acceptTradeOffer(offerId, acceptorId)` - Accept a trade offer
- `rejectTradeOffer(offerId, rejectingUserId)` - Reject a trade offer
- `getTrendingListings(limit)` - Get trending items
- `getMarketStats()` - Get 7-day market statistics

**Example:**
```javascript
import { gameMarketplace } from './lib/gameMarketplace'

// Create an item listing
const listing = await gameMarketplace.createItemListing(
  characterId,      // seller
  itemId,          // what to sell
  5,               // quantity
  1000             // price per item
)

// Accept a trade offer
await gameMarketplace.acceptTradeOffer(offerId, characterId)
```

#### 3. **CreateMarketplaceListing.jsx** - Listing Creation
Modal component for creating new marketplace listings.

**Features:**
- Item or property type selection
- Real-time inventory loading
- Quantity selection for items
- Price input with market value comparison
- 30-day expiration for items, 60-day for properties

**Usage:**
```jsx
import CreateMarketplaceListing from './components/CreateMarketplaceListing'

<CreateMarketplaceListing
  characterId={characterId}
  onClose={() => setShowCreateListing(false)}
  onSuccess={() => {
    console.log('Listing created!')
    refreshListings()
  }}
/>
```

#### 4. **GamePlayerProfile.jsx** - Player Trading Profile
Shows player statistics, trading history, and trust indicators.

**Features:**
- Player avatar and level
- Trading statistics (total trades, average rating, volume)
- Trust badge for verified sellers
- Active listings preview
- Character stats and location

**Usage:**
```jsx
import GamePlayerProfile from './components/GamePlayerProfile'

<GamePlayerProfile
  playerId={playerId}
  onClose={() => setShowProfile(false)}
/>
```

#### 5. **GameInventoryUI.jsx** - Inventory Management
Displays player inventory with rarity filtering and search.

**Features:**
- Item search and filtering by rarity
- Visual rarity indicators
- Item descriptions and values
- Total inventory value calculation
- Click to expand item details

**Usage:**
```jsx
import GameInventoryUI from './components/GameInventoryUI'

<GameInventoryUI
  characterId={characterId}
  onClose={() => setShowInventory(false)}
/>
```

#### 6. **MarketplaceWidget.jsx** - Dashboard Widget
Compact widget showing marketplace stats and quick access.

**Features:**
- 7-day market volume
- Average prices
- Trending listings
- Pending offers notification
- Quick action buttons

**Usage:**
```jsx
import MarketplaceWidget from './components/MarketplaceWidget'

<MarketplaceWidget
  characterId={characterId}
  onOpenMarketplace={() => setShowMarketplace(true)}
/>
```

## Database Schema

### Key Tables

#### game_marketplace_listings
```sql
id                    UUID PRIMARY KEY
seller_id             UUID (references game_characters)
item_id              UUID (optional, references game_items)
property_id          UUID (optional, references game_properties)
item_type            TEXT
description          TEXT
quantity             INTEGER
unit_price           NUMERIC
total_price          NUMERIC
listing_type         TEXT ('item' or 'property')
status               TEXT ('active', 'sold', 'cancelled')
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
expires_at           TIMESTAMPTZ
```

#### game_trade_offers
```sql
id                 UUID PRIMARY KEY
listing_id         UUID (references game_marketplace_listings)
buyer_id           UUID (references game_characters)
seller_id          UUID (references game_characters)
offered_price      NUMERIC
offered_items      JSONB (array of offered items)
status             TEXT ('pending', 'completed', 'rejected')
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ
```

#### game_trades_completed
```sql
id                 UUID PRIMARY KEY
buyer_id           UUID (references game_characters)
seller_id          UUID (references game_characters)
item_type          TEXT
description        TEXT
price_paid         NUMERIC
buyer_rating       INT
seller_rating      INT
completed_at       TIMESTAMPTZ
```

#### player_trade_stats (View)
```sql
player_id          UUID
total_trades       INTEGER
avg_rating         DECIMAL
total_volume       NUMERIC
```

### Indexes
- `idx_marketplace_seller` - Fast seller lookups
- `idx_marketplace_status` - Filter by status
- `idx_marketplace_created` - Sort by recent
- `idx_trade_offers_listing` - Listings to offers
- `idx_trade_offers_buyer` - Buyer offers
- `idx_trade_offers_status` - Filter offers
- `idx_trades_completed_buyer` - Buyer history
- `idx_trades_completed_seller` - Seller history

## Integration Steps

### 1. Add to PlayCurrency Component
```jsx
import GameMarketplace from './components/GameMarketplace'
import MarketplaceWidget from './components/MarketplaceWidget'

export default function PlayCurrency({ userId, userEmail }) {
  const [showMarketplace, setShowMarketplace] = useState(false)
  
  return (
    <div>
      {/* Add widget to sidebar */}
      <MarketplaceWidget
        characterId={character?.id}
        onOpenMarketplace={() => setShowMarketplace(true)}
      />
      
      {/* Add marketplace modal */}
      {showMarketplace && (
        <GameMarketplace
          userId={userId}
          characterId={character?.id}
          onClose={() => setShowMarketplace(false)}
        />
      )}
    </div>
  )
}
```

### 2. Add to Navbar
```jsx
// In Navbar.jsx
<button
  onClick={() => setShowMarketplace(true)}
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
>
  🛍️ Marketplace
</button>

{showMarketplace && (
  <GameMarketplace
    userId={userId}
    characterId={activeCharacter?.id}
    onClose={() => setShowMarketplace(false)}
  />
)}
```

### 3. Add to Game World
```jsx
// In game world UI
<div className="marketplace-section">
  <h3>Player Marketplace</h3>
  <button onClick={() => setShowMarketplace(true)}>
    Browse Marketplace
  </button>
  
  <button onClick={() => setShowCreateListing(true)}>
    Create Listing
  </button>
  
  {showMarketplace && (
    <GameMarketplace
      userId={userId}
      characterId={characterId}
      onClose={() => setShowMarketplace(false)}
    />
  )}
</div>
```

## Usage Examples

### Browse Marketplace
```jsx
// Users can:
// 1. Search for items by name
// 2. Filter by type (items vs properties)
// 3. Sort by price or recency
// 4. Click on listings to see details
// 5. Click "Offer" to make an offer
```

### Create a Listing
```javascript
// Example: List 5 health potions at 100 PHP each
await gameMarketplace.createItemListing(
  playerId,
  'health-potion-id',
  5,
  100
)

// Example: List a property for 50,000 PHP
await gameMarketplace.createPropertyListing(
  playerId,
  'property-id',
  50000
)
```

### Make a Trade Offer
```javascript
// Player A offers 1500 PHP for an item listed at 2000 PHP
await gameMarketplace.createTradeOffer(
  listingId,
  buyerId,
  sellerId,
  1500
)

// Player B (seller) accepts
await gameMarketplace.acceptTradeOffer(offerId, sellerId)
```

### Check Market Stats
```javascript
const stats = await gameMarketplace.getMarketStats()
console.log(`7-Day Volume: ${stats.totalVolume}`)
console.log(`Avg Price: ${stats.averagePrice}`)
console.log(`Transactions: ${stats.transactionCount}`)
```

## Features

### Real-Time Updates
All components subscribe to Supabase real-time updates for listings and offers. Changes appear instantly across all open marketplace windows.

### Trust System
- Player profiles display trading statistics
- "Trusted Seller" badge appears after 10+ successful trades
- Average ratings visible on player profiles
- Complete trade history available

### Inventory Integration
- Items must exist in player's inventory to be listed
- Quantities updated automatically on purchase
- Properties must be owned to be listed for sale

### Price History
- All transactions logged
- Price trends visible through `getPriceHistory()`
- Market statistics available for 7-day periods

### Expiration
- Item listings: 30-day expiration
- Property listings: 60-day expiration
- Expired listings automatically removed from browsing

## Error Handling

All components include:
- Input validation
- Error messages displayed to users
- Loading states during operations
- Success notifications after completion
- Rollback on transaction failure

## Performance Optimizations

1. **Pagination**: Listings limited to 50 per query
2. **Indexes**: Database indexes on frequently queried fields
3. **Caching**: Market stats cached locally
4. **Real-time**: Subscriptions only for active components

## Security

1. **Row-Level Security (RLS)**: Database enforces ownership
2. **Validation**: All inputs validated before submission
3. **Constraints**: Foreign keys prevent orphaned records
4. **Auditing**: All trades logged in completion table

## Future Enhancements

- [ ] Auction system with bidding
- [ ] Bulk buying/selling
- [ ] Player wishlists
- [ ] Price alerts
- [ ] Marketplace analytics dashboard
- [ ] Trading guilds/cooperatives
- [ ] Item rating system
- [ ] Commission-based marketplace fees

## Troubleshooting

### Listings not appearing
- Check Supabase subscriptions are active
- Verify listing status is 'active'
- Confirm expiration date hasn't passed
- Check character/item ownership

### Offers not being created
- Verify buyer has sufficient funds
- Check listing still exists and is active
- Ensure buyer and seller are different characters
- Review error message in console

### Trade not completing
- Verify both parties still exist
- Check funds haven't been spent since offer
- Confirm inventory has space for items
- Review transaction logs in Supabase

## Testing

Suggested test scenarios:
1. Create item listing with multiple quantities
2. Create property listing above market value
3. Make offer at lower price than asking
4. Accept offer and verify inventory transfer
5. Check player trade stats updated
6. Browse marketplace and verify search/filter
7. Test on multiple characters simultaneously
8. Verify expiration logic

## Support

For issues or questions:
1. Check browser console for errors
2. Review Supabase logs
3. Verify database schema is current
4. Check character ownership/permissions
5. Test with fresh character if needed

---

**Last Updated:** 2024
**Status:** Production Ready
**Version:** 1.0.0
