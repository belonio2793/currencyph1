# Rides Matching System - Implementation Guide

## Overview

This implementation creates a complete mutual-agreement ride-matching system where drivers and riders can discover each other, accept requests, confirm matches, and communicate in real-time.

## Architecture

### Database Schema

#### 1. **ride_requests** Table
Stores ride requests posted by either riders or drivers.

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users)
- user_type: VARCHAR(10) - 'rider' or 'driver'
- start_latitude/longitude: DECIMAL - Pickup location
- end_latitude/longitude: DECIMAL - Dropoff location
- estimated_distance: DECIMAL - in km
- estimated_duration: INTEGER - in minutes
- estimated_fare: DECIMAL
- vehicle_type: VARCHAR(50) - e.g., 'economy', 'premium'
- service_type: VARCHAR(50)
- status: VARCHAR(20) - 'active', 'accepted', 'completed', 'cancelled'
- created_at, updated_at, expires_at: TIMESTAMP
```

#### 2. **ride_matches** Table
Tracks mutual agreements between riders and drivers.

```sql
- id: UUID (Primary Key)
- ride_request_id: UUID (Foreign Key)
- rider_id, driver_id: UUID (Foreign Keys to users)
- status: VARCHAR(20) - Multi-step process:
  * 'pending' - Request created, awaiting responses
  * 'accepted_by_driver' - Driver accepted, waiting for rider confirmation
  * 'accepted_by_rider' - Rider accepted, waiting for driver confirmation
  * 'confirmed' - Both parties accepted (MUTUAL AGREEMENT)
  * 'in_progress' - Trip started
  * 'completed' - Trip finished
  * 'cancelled' - Cancelled by either party
  
- rider_confirmed, driver_confirmed: BOOLEAN
- rider_confirmed_at, driver_confirmed_at: TIMESTAMP
- route_geometry: JSONB - GeoJSON for the route
- estimated/actual_distance, _duration, _fare
- started_at, completed_at: TIMESTAMP
```

#### 3. **ride_ratings** Table
Stores ratings from completed trips.

```sql
- id: UUID (Primary Key)
- match_id, rater_id, ratee_id: UUID (Foreign Keys)
- rater_role: VARCHAR(10) - 'driver' or 'rider'
- rating: INTEGER (1-5)
- comment: TEXT
- created_at: TIMESTAMP
```

#### 4. **ride_match_chats** Table
Chat channels for matches.

```sql
- id: UUID (Primary Key)
- match_id: UUID (Foreign Key, UNIQUE)
- created_at: TIMESTAMP
```

#### 5. **ride_match_messages** Table
Messages in ride match chats.

```sql
- id: UUID (Primary Key)
- match_id, user_id: UUID (Foreign Keys)
- message: TEXT
- created_at: TIMESTAMP
```

#### 6. **ride_live_locations** Table
Real-time location tracking during active rides.

```sql
- id: UUID (Primary Key)
- match_id, user_id: UUID (Foreign Keys)
- latitude, longitude: DECIMAL
- accuracy, speed, heading: INTEGER
- updated_at: TIMESTAMP
```

### Services

#### 1. **ridesMatchingService** (`src/lib/ridesMatchingService.js`)
Main service for ride request and match operations:
- `createRideRequest()` - Post a request
- `getActiveRequests()` - Get opposite user type's requests
- `createMatch()` - Create a match between users
- `acceptRequest()` - Accept and confirm matches
- `getUserMatches()` - Get user's matches
- `getPendingMatches()` - Get pending confirmations
- `updateMatchStatus()` - Update trip status
- `submitRating()` - Rate after trip
- `subscribeToMatches()` - Real-time match updates
- `subscribeToRideRequests()` - Real-time request updates
- `cancelRequest()` - Cancel request or match

#### 2. **ridesChatService** (`src/lib/ridesChatService.js`)
Chat functionality for matches:
- `getOrCreateChatChannel()` - Initialize chat for match
- `sendMessage()` - Send message
- `getMessages()` - Load message history
- `subscribeToMatchMessages()` - Real-time messages

#### 3. **rideLocationService** (`src/lib/rideLocationService.js`)
Location tracking and route syncing:
- `updateLiveLocation()` - Send location update during trip
- `getLiveLocations()` - Get current locations of both users
- `updateRouteInfo()` - Update route geometry and stats
- `calculateDistance()` - Haversine distance formula
- `calculateETA()` - Estimate time to destination
- `subscribeToLiveLocations()` - Real-time location updates
- `subscribeToMatchUpdates()` - Real-time match status updates

### Components

#### 1. **DriverInterface** (`src/components/DriverInterface.jsx`)
Driver mode UI:
- List of active rider requests
- Accept request → mutual agreement workflow
- Pending confirmations tab
- Active trips tab
- Driver profile and rating display
- Messages integration

#### 2. **RiderInterface** (`src/components/RiderInterface.jsx`)
Rider mode UI:
- Browse available drivers
- Book a driver → mutual agreement workflow
- Pending confirmations tab
- Active rides tab
- Driver profile and rating display
- Messages integration

#### 3. **RideUserProfileModal** (`src/components/RideUserProfileModal.jsx`)
Detailed user profile with:
- User stats (trips, earnings, rating)
- Rating distribution breakdown
- Trip history
- Individual ratings from other users

#### 4. **RideMatchChat** (`src/components/RideMatchChat.jsx`)
In-match chat interface:
- Real-time messaging
- Message history
- Status indicators
- Timestamp display

## Workflow: Mutual Agreement Process

### Scenario: Driver Accepts Rider Request

```
1. Rider posts request
   └─ Creates ride_request (user_type='rider')
   
2. Driver sees request in "Available Requests" tab
   └─ Shows all active rider requests
   
3. Driver clicks "Book" → Accepts request
   └─ Creates ride_match (status='pending')
   └─ Driver accepts from their side (driver_confirmed=true)
   └─ Match status changes to 'accepted_by_driver'
   
4. Rider sees match in "Pending Confirmation" tab
   └─ Shows requests awaiting rider confirmation
   
5. Rider confirms the driver
   └─ Sets rider_confirmed=true, rider_confirmed_at=NOW()
   └─ Both rider_confirmed AND driver_confirmed are true
   └─ Match status changes to 'confirmed'
   
6. Trip can begin
   └─ Either party clicks "Start Trip"
   └─ Match status changes to 'in_progress'
   └─ Location tracking begins
```

### Scenario: Rider Accepts Driver Offer

```
1. Driver posts request (availability)
   └─ Creates ride_request (user_type='driver')
   
2. Rider sees request in "Available Drivers" tab
   └─ Shows all active driver offers
   
3. Rider clicks "Book" → Accepts driver
   └─ Creates ride_match (status='pending')
   └─ Rider accepts from their side (rider_confirmed=true)
   └─ Match status changes to 'accepted_by_rider'
   
4. Driver sees match in "Pending Confirmation" tab
   └─ Shows requests awaiting driver confirmation
   
5. Driver confirms the rider
   └─ Sets driver_confirmed=true, driver_confirmed_at=NOW()
   └─ Both confirmed, status changes to 'confirmed'
   
6. Trip proceeds as above
```

## Real-Time Features

### Live Location Tracking
```javascript
// During active trip:
rideLocationService.updateLiveLocation(matchId, userId, lat, lon)

// Both parties receive updates via:
rideLocationService.subscribeToLiveLocations(matchId, callback)
```

### Real-Time Messaging
```javascript
// Send message:
ridesChatService.sendMessage(matchId, userId, message)

// Receive messages via:
ridesChatService.subscribeToMatchMessages(matchId, callback)
```

### Match Status Updates
```javascript
// Subscribe to status changes:
rideLocationService.subscribeToMatchUpdates(matchId, callback)
```

## Integration with Existing Rides Component

The `DriverInterface` component is conditionally rendered when `userRole === 'driver'`:

```jsx
{userRole === 'driver' ? (
  <DriverInterface userId={userId} userLocation={userLocation} />
) : (
  // Existing rider UI
)}
```

The toggle button switches between modes:
```jsx
<button onClick={() => setUserRole(userRole === 'rider' ? 'driver' : 'rider')}>
  Switch To {userRole === 'rider' ? 'Driver' : 'Rider'}
</button>
```

## Database Setup

Run these SQL migrations in order:

1. **RIDES_MATCHING_SCHEMA.sql** - Core matching tables
2. **RIDES_CHAT_SCHEMA.sql** - Chat infrastructure
3. **RIDES_LIVE_LOCATIONS_SCHEMA.sql** - Location tracking

## Testing Checklist

### Database Setup
- [ ] All three schema files have been executed in Supabase
- [ ] Tables are created and indexes are built
- [ ] RLS policies are configured (if needed)

### Driver Mode
- [ ] Toggle to Driver Mode works
- [ ] Driver sees active rider requests
- [ ] Driver can click "View Details" and see full trip info
- [ ] Driver can accept a request
- [ ] Match appears in "Pending Confirmation" tab
- [ ] Driver can send messages to rider

### Rider Mode
- [ ] Toggle to Rider Mode works
- [ ] After selecting pickup/dropoff, available drivers appear
- [ ] Rider can see driver details
- [ ] Rider can book a driver
- [ ] Match appears in "Pending Confirmation" tab
- [ ] Rider can send messages to driver

### Mutual Agreement
- [ ] Driver accepts → status becomes 'accepted_by_driver'
- [ ] Rider confirms → status becomes 'confirmed'
- [ ] Once confirmed, both can start trip
- [ ] Match moves to "Active Trips" tab
- [ ] Status updates in real-time (test with two browser windows)

### Messaging
- [ ] Messages send successfully
- [ ] Messages appear in real-time on both sides
- [ ] Message history loads
- [ ] Timestamps are displayed correctly

### Location Tracking
- [ ] Location updates save to database
- [ ] Location updates broadcast in real-time
- [ ] ETA calculations are accurate

### Ratings
- [ ] After trip completion, rating modal appears
- [ ] Ratings save to database
- [ ] User profiles show ratings and distribution
- [ ] Average rating updates

### Profile View
- [ ] Clicking user profile shows modal
- [ ] Stats display correctly
- [ ] Rating distribution shows
- [ ] Trip history displays

## Common Issues & Solutions

### Matches Not Appearing in Real-Time
- Check Supabase Realtime is enabled
- Verify postgres_changes filters match table names
- Check network tab for channel subscription errors

### Chat Messages Not Sending
- Ensure ride_match_messages table exists
- Check user_id is valid
- Verify match_id is valid UUID

### Location Updates Not Syncing
- Ensure ride_live_locations table created
- Check UNIQUE constraint on (match_id, user_id)
- Verify latitude/longitude format

### Rating Modal Not Appearing
- Check ride_ratings table exists
- Verify match status is 'completed'
- Ensure ratee_id is different from rater_id

## Future Enhancements

1. **Automatic Matching** - Auto-match compatible requests
2. **Route Optimization** - Use routing service API
3. **Payment Integration** - Process payments after trip
4. **Driver Verification** - License and background checks
5. **Surge Pricing** - Demand-based pricing
6. **Accessibility** - Wheelchair accessible vehicles
7. **Scheduled Rides** - Book future rides
8. **Group Rides** - Multiple passengers
9. **Ride Sharing** - Split rides between users
10. **Analytics Dashboard** - Driver earnings, trip stats

## File Structure

```
src/
├── components/
│   ├── DriverInterface.jsx          (Driver UI)
│   ├── RiderInterface.jsx           (Rider UI)
│   ├── RideUserProfileModal.jsx    (User profiles)
│   ├── RideMatchChat.jsx           (Chat UI)
│   └── Rides.jsx                   (Updated with driver mode toggle)
└── lib/
    ├── ridesMatchingService.js     (Core matching logic)
    ├── ridesChatService.js         (Chat service)
    └── rideLocationService.js      (Location & route sync)

SQL/
├── RIDES_MATCHING_SCHEMA.sql
├── RIDES_CHAT_SCHEMA.sql
└── RIDES_LIVE_LOCATIONS_SCHEMA.sql
```

## Performance Considerations

- Ride requests expire after 30 minutes by default
- Use indexes on frequently queried columns
- Implement pagination for large lists
- Cache user ratings in ride_profiles table
- Limit real-time subscriptions to active matches only
- Clean up old completed matches periodically

## Security Considerations

- Implement Row Level Security (RLS) on all tables
- Users can only see matches they're part of
- Messages are isolated to specific matches
- Location updates only visible to match participants
- Ratings are immutable once submitted
- Verify user_id matches auth token

