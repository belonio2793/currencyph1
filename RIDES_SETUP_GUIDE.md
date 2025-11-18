# Uber-Style Rides Feature - Setup & Implementation Guide

## Overview
This is a comprehensive guide to set up and configure the new Rides feature for the currency.ph platform. The Rides feature enables a full-fledged peer-to-peer ride-sharing application with real-time tracking, ratings, payments, and chat.

## Architecture

### Frontend Components
- **Rides.jsx** - Main rides component with tabs for finding rides, active rides, history, and profiles
- **Real-time map** with live driver/rider markers
- **Location selection** with start/end coordinate picking
- **Ride management** - Request, accept, cancel, complete rides

### Backend Database
- **ride_profiles** - Driver and rider information
- **rides** - Ride requests and bookings
- **ride_ratings** - Ratings and reviews
- **ride_transactions** - Payment tracking
- **ride_chat_messages** - Real-time messaging

### External Services
- Leaflet/OpenStreetMap for maps
- Supabase Realtime for live updates
- Supabase Auth for user management
- Currency.ph wallets for payments

## Setup Instructions

### Step 1: Create Database Tables

Run the SQL schema from `RIDES_DATABASE_SCHEMA.sql` in your Supabase SQL editor:

1. Go to https://app.supabase.com
2. Select your project (corcofbmafdxehvlbesx)
3. Click "SQL Editor" on the left sidebar
4. Create a new query
5. Copy the entire content of `RIDES_DATABASE_SCHEMA.sql`
6. Click "RUN"

### Step 2: Enable Realtime

In the Supabase SQL editor, run these commands:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE ride_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_chat_messages;
```

Or through the UI:
1. Go to "Realtime" in the left sidebar
2. Find each table (ride_profiles, rides, ride_chat_messages)
3. Toggle "Enable realtime" for each

### Step 3: Verify the App is Running

The Rides tab should now appear in the top navigation bar. If not:
1. Check browser console for errors
2. Verify database tables exist
3. Ensure user is authenticated

## Features Implemented

### ✅ Phase 1: Core Infrastructure
- [x] Rides tab in navigation
- [x] Basic Rides component with tabs
- [x] Database schema
- [x] Driver/Rider profile switching

### 🔄 Phase 2: Real-time Map & Location
- [ ] Interactive map with live markers
- [ ] Driver/rider list on map
- [ ] Location selection with dragging
- [ ] Pulse/signal animations

### ⏳ Phase 3: Core Ride Features
- [ ] Request ride functionality
- [ ] Accept/decline rides
- [ ] Real-time route tracking
- [ ] Time/distance estimation

### ⏳ Phase 4: Advanced Features
- [ ] Ratings and reviews
- [ ] Payment integration
- [ ] Flexible offer system
- [ ] Different ride types
- [ ] Chat system

## Usage

### For Riders:
1. Open the "Rides" tab
2. Go to "Find Ride"
3. Click on map to select pickup location
4. Click on map to select destination
5. Choose ride type (Ride Share, Package, Food, Laundry)
6. Click "Request Ride"
7. Wait for driver to accept

### For Drivers:
1. Open the "Rides" tab
2. Click "Switch to Driver"
3. Select vehicle type (Car, Tricycle)
4. Set driver status to "Available"
5. View incoming ride requests
6. Accept and complete rides

## Database Schema Details

### ride_profiles
Stores driver and rider information including:
- Personal info (name, phone, photo)
- Vehicle details (for drivers)
- Status (offline, available, on-job)
- Location (latitude, longitude)
- Rating and statistics
- Verification status

### rides
Stores ride requests and bookings:
- Route info (pickup/dropoff coords)
- Passenger count
- Ride type
- Status (requested, accepted, in-progress, completed)
- Pricing (estimated and actual)
- Payment method and status
- Timing information

### ride_ratings
Stores ratings and reviews:
- Rating score (1-5 stars)
- Review text
- Category ratings (cleanliness, safety, friendliness)
- Issue tags (rude, late, dirty_car, etc.)

### ride_transactions
Financial tracking:
- Transaction type (fare, tip, refund, cancellation fee)
- Amount and currency
- From/to users
- Payment status
- Wallet integration

### ride_chat_messages
Real-time messaging:
- Text messages
- Location sharing
- Image sharing
- Offer proposals
- Read status

## API Endpoints (Supabase Functions)

Future Edge Functions to create:

```
/rides/request - Request a ride
/rides/accept - Accept a ride request
/rides/cancel - Cancel a ride
/rides/complete - Complete a ride
/rides/rate - Rate a ride
/rides/pay - Process payment
/rides/estimate - Get fare estimate
```

## Environment Variables

Already configured in `.env`:
- VITE_SUPABASE_ANON_KEY
- VITE_SUPABASE_SERVICE_ROLE_KEY
- VITE_PROJECT_URL

## Cost Estimation Algorithm

Current formula (will be enhanced):
```
Base fare: ₱50
Per km: ₱20
Per minute: ₱5
Vehicle multiplier: 1.0 (car), 0.7 (tricycle)
Final price = (distance_km * 20 + duration_minutes * 5) * multiplier + base_fare
```

## Real-time Updates

The app uses Supabase Realtime for:
- Driver location updates
- Ride status changes
- Chat messages
- New ride requests

Subscribe to changes:
```javascript
supabase
  .channel('rides:user_id')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'rides'
  }, (payload) => {
    // Handle update
  })
  .subscribe()
```

## Security & Privacy

### Row Level Security (RLS)
- Users can only see their own rides
- Drivers can only see assigned rides
- Riders can only update their own profile

### Data Protection
- Location data is encrypted in transit
- Payment info never stored in ride records
- Chat messages are user-accessible only

## Testing

### Test as a Rider:
1. Login with test account
2. Switch to "Rider" mode
3. Request a ride on the map
4. Check ride status

### Test as a Driver:
1. Login with different account
2. Switch to "Driver" mode
3. Set availability to "Available"
4. Accept ride requests

### Test Real-time:
1. Open app in two browser windows
2. Request ride in one window
3. See request appear in driver window immediately

## Troubleshooting

### Tables don't exist
- Check Supabase SQL error messages
- Ensure you're in the correct project
- Verify table names in schema match

### Realtime not working
- Check if tables are enabled in Realtime
- Verify subscription code in component
- Check browser console for errors

### Map not displaying
- Ensure Leaflet CSS is imported
- Check map container has height
- Verify geolocation permissions

### Location not updating
- Check geolocation permission in browser
- Verify presence.js is configured
- Check network connectivity

## Next Steps

1. **Implement Location Services**
   - Add background location tracking
   - Implement geofencing
   - Add push notifications

2. **Add Payment Integration**
   - Connect to currency.ph wallets
   - Add Stripe/PayMongo integration
   - Implement refund logic

3. **Build Chat System**
   - Real-time messaging UI
   - Location sharing
   - Image sharing
   - Quick reply templates

4. **Add Ratings System**
   - Star rating UI
   - Review form
   - Ratings dashboard

5. **Implement Route Optimization**
   - Use Google Maps API for routes
   - Add distance/time calculation
   - Implement route polylines

6. **Add Push Notifications**
   - Ride request notifications
   - Driver arrival alerts
   - Payment confirmations

## File References

- Frontend: `src/components/Rides.jsx`
- Database Schema: `RIDES_DATABASE_SCHEMA.sql`
- Setup: `RIDES_SETUP_GUIDE.md` (this file)

## Support

For issues or questions:
1. Check browser console for error messages
2. Review Supabase logs
3. Verify database tables exist
4. Check user authentication status

## Performance Considerations

### Optimization Tips:
- Use pagination for ride history
- Batch location updates
- Cache driver availability
- Implement map clustering for many markers

### Database:
- All tables have proper indexes
- RLS policies are optimized
- Foreign keys prevent orphaned data

## Future Enhancements

- [ ] Push notifications
- [ ] Advanced routing (Waze-like)
- [ ] Multi-stop rides
- [ ] Driver tips
- [ ] Preferred driver bookmarks
- [ ] Corporate accounts
- [ ] Scheduled rides
- [ ] Ride pooling
- [ ] Premium driver program
- [ ] Advanced analytics
