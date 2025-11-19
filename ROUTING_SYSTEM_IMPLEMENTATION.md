# Advanced Routing System Implementation Guide

## Overview

This document describes the comprehensive routing system implementation for the Rides feature, which provides real-time route estimation with multiple data sources (Google Maps API, MapTiler, and Leaflet fallback).

## Features Implemented

### 1. **Multi-Source Routing with Automatic Fallback**

The system attempts to fetch routes from multiple sources in priority order:

1. **Google Maps Directions API** - Premium routing with detailed turn-by-turn directions
2. **MapTiler Directions API** - Open-source alternative with reliable routing
3. **Leaflet (Haversine)** - Fast fallback calculation using straight-line distance

```javascript
// Usage example
import { getRoute } from './lib/routingService'

const route = await getRoute(startLat, startLng, endLat, endLng, {
  preferredSource: 'google', // Optional: prefer a specific source
  timeout: 10000 // Optional: timeout in milliseconds
})

// Returns:
{
  success: true,
  distance: 12.5, // km
  duration: 25, // minutes
  geometry: [[lng, lat], ...], // GeoJSON coordinates
  steps: [ // Turn-by-turn directions
    { instruction: 'Head north', distance: '0.5', duration: 1 },
    ...
  ],
  source: 'Google Maps Directions API'
}
```

### 2. **Enhanced Map Component with Custom Markers**

The new `MapComponent.jsx` provides:

- **Green Pickup Marker** - Draggable location showing pickup point
- **Red Destination Marker** - Draggable location showing destination
- **Blue User Marker** - Current user location
- **Purple Driver Markers** - Active drivers nearby
- **Orange Rider Markers** - Active riders searching for rides
- **Route Polyline** - Visual representation of the calculated route
- **Route Source Badge** - Displays which API was used for routing
- **Animated Markers** - Pulsing animation to indicate active markers

```javascript
import MapComponent from './components/MapComponent'

<MapComponent
  userLocation={location}
  pickupLocation={startCoord}
  destinationLocation={endCoord}
  drivers={driversList}
  riders={ridersList}
  routeGeometry={route.geometry}
  routeSource={route.source}
  onPickupDrag={handlePickupUpdate}
  onDestinationDrag={handleDestinationUpdate}
  onMapClick={handleMapClick}
/>
```

### 3. **Real-Time Route Estimation Service**

The `RouteEstimationService` provides:

- **Continuous Monitoring** - Track route changes in real-time
- **Automatic Database Sync** - Save route updates to Supabase
- **ETA Calculation** - Compute and format estimated arrival times
- **Queue Management** - Batch sync operations to avoid database overload

```javascript
import { routeEstimationService } from './lib/routeEstimationService'

// Start monitoring a route
await routeEstimationService.startMonitoring(
  routeId,
  startLat, startLng,
  endLat, endLng,
  (update) => {
    console.log(`Route updated: ${update.distance}km, ${update.duration}min`)
  },
  {
    updateInterval: 30000, // Update every 30 seconds
    enableSync: true, // Auto-sync to database
    rideId: rideId,
    userId: userId
  }
)

// Stop monitoring when ride ends
routeEstimationService.stopMonitoring(routeId)

// Get current route data from cache
const currentData = routeEstimationService.getRouteData(routeId)

// Get service status
const status = routeEstimationService.getMonitoringStatus()
```

### 4. **Extended Database Schema**

The rides table includes:

```sql
-- Route geometry and details
route_geometry JSONB, -- GeoJSON geometry coordinates
route_steps JSONB, -- Detailed turn-by-turn directions
route_metadata JSONB, -- Additional route metadata (source, timestamps, etc)

-- Distance and duration
estimated_distance DECIMAL(10, 3), -- in kilometers
estimated_duration INTEGER, -- in minutes
actual_distance DECIMAL(10, 3), -- actual distance traveled
actual_duration INTEGER, -- actual duration in minutes

-- Sync tracking
synced_at TIMESTAMP WITH TIME ZONE -- Last sync timestamp
```

### 5. **Route Source Information Display**

The UI displays which routing service is being used:

```javascript
import { getRouteSourceInfo } from './lib/routingService'

const info = getRouteSourceInfo('Google Maps Directions API')
// Returns: { name: 'Google Maps', color: '#4285F4', icon: '🗺️' }
```

### 6. **Comprehensive Testing Utilities**

Use the test utilities to verify the routing system:

```javascript
import { runComprehensiveRoutingTests } from './lib/routeTestUtils'

// Run all tests
const results = await runComprehensiveRoutingTests(
  14.5995, 120.9842, // Start coordinates (Manila)
  14.6349, 121.0243  // End coordinates
)
```

## Architecture

### Service Layer

```
┌─────────────────────────────────────────────────────────┐
│                   Rides Component                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │          MapComponent                            │  │
│  │  ┌───────────────────────────────────────────┐   │  │
│  │  │  Markers (Pickup, Destination, Drivers)  │   │  │
│  │  │  RoutePolyline                           │   │  │
│  │  │  Route Source Indicator                  │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  └─���─────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │          routingService                          │  │
│  │  ├─ getRoute() [Multi-source]                    │  │
│  │  ├─ tryGoogleMapsRoute()                         │  │
│  │  ├─ tryMapTilerRoute()                           │  │
│  │  ├─ calculateDirectRoute() [Haversine]           │  │
│  │  └─ monitorRouteRealtime()                       │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │       routeEstimationService                      │  │
│  │  ├─ startMonitoring()                            │  │
│  │  ├─ stopMonitoring()                             │  │
│  │  ├─ syncRouteToDatabase()                        │  │
│  │  └─ calculateETA()                               │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │          Supabase Database                       │  │
│  │  rides table with extended schema                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables Required

```env
# Google Maps API
VITE_GOOGLE_API_KEY=your_google_maps_api_key

# MapTiler API
VITE_MAPTILER_API_KEY=your_maptiler_api_key

# Supabase
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_PROJECT_URL=your_supabase_url
```

### API Keys Setup

1. **Google Maps API**: https://cloud.google.com/maps-platform
   - Enable Directions API
   - Generate API key with appropriate restrictions

2. **MapTiler API**: https://www.maptiler.com
   - Create account and API key
   - No credits needed for basic directions API

3. **Supabase**: Already configured in project

## Usage Examples

### Example 1: Request a Ride with Route Display

```javascript
// In Rides component
const [startCoord, setStartCoord] = useState(null)
const [endCoord, setEndCoord] = useState(null)
const [routeDetails, setRouteDetails] = useState(null)
const [routeSource, setRouteSource] = useState(null)

useEffect(() => {
  if (!startCoord || !endCoord) return

  const calculateRoute = async () => {
    const route = await getRoute(
      startCoord.latitude, startCoord.longitude,
      endCoord.latitude, endCoord.longitude
    )

    if (route.success) {
      setRouteDetails(route)
      setRouteSource(route.source)
    }
  }

  calculateRoute()
}, [startCoord, endCoord])

// Render map with route
<MapComponent
  userLocation={userLocation}
  pickupLocation={startCoord}
  destinationLocation={endCoord}
  routeGeometry={routeDetails?.geometry}
  routeSource={routeSource}
/>
```

### Example 2: Monitor Active Ride

```javascript
useEffect(() => {
  if (!activeRideId || !startCoord || !endCoord) return

  const unsubscribe = routeEstimationService.startMonitoring(
    activeRideId,
    startCoord.latitude, startCoord.longitude,
    endCoord.latitude, endCoord.longitude,
    (update) => {
      if (update.success) {
        console.log(`ETA: ${update.duration} minutes`)
        // Update UI with new ETA
      }
    },
    { enableSync: true, rideId: activeRideId, userId }
  )

  return () => {
    routeEstimationService.stopMonitoring(activeRideId)
  }
}, [activeRideId, startCoord, endCoord, userId])
```

### Example 3: Compare Routing Options

```javascript
import { compareRoutes } from './lib/routingService'

const allRoutes = await compareRoutes(startLat, startLng, endLat, endLng)

// Results array with distance/duration from each provider
allRoutes.forEach(route => {
  console.log(`${route.provider}: ${route.distance}km in ${route.duration}min`)
})
```

## Testing

### Run Comprehensive Tests

```javascript
import { runComprehensiveRoutingTests } from './lib/routeTestUtils'

// In browser console or test file
const results = await runComprehensiveRoutingTests(14.5995, 120.9842, 14.6349, 121.0243)

// Check results
console.log(results.tests.singleRoute)     // Single route test
console.log(results.tests.routeComparison) // Multi-source comparison
console.log(results.tests.routeMonitoring) // Real-time monitoring
console.log(results.tests.estimationService) // Service integration
```

## Fallback Behavior

The system automatically handles API failures:

1. **Google Maps Down**: Falls back to MapTiler
2. **MapTiler Down**: Falls back to Leaflet (Haversine)
3. **All APIs Down**: Uses direct calculation with distance estimate
4. **Timeout**: Immediately uses fallback without waiting

```javascript
// The flow is automatic - developers don't need to handle it
const route = await getRoute(lat1, lng1, lat2, lng2)
// Will use whichever source is available
```

## Performance Considerations

- **Route Caching**: Routes are cached in `routeEstimationService`
- **Batch Sync**: Database updates are queued and processed in batches
- **Update Intervals**: Default 30 seconds for route monitoring
- **Timeouts**: 10 second timeout per API call to prevent hanging

## Error Handling

All functions include proper error handling:

```javascript
try {
  const route = await getRoute(lat1, lng1, lat2, lng2)
  if (!route.success) {
    console.error('Route calculation failed')
  }
} catch (error) {
  console.error('Route error:', error.message)
  // Falls back to Haversine automatically
}
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support with responsive UI

## Future Enhancements

1. **Traffic Prediction**: Integrate real-time traffic data
2. **Alternative Routes**: Show multiple route options
3. **Polyline Styling**: Different colors for different route types
4. **Custom Avoidances**: Allow users to avoid tolls/highways
5. **Offline Mode**: Cache routes for offline access

## Troubleshooting

### "Route API not available"
- Check environment variables are set
- Verify API keys are valid
- Check browser console for detailed errors

### "Routes not updating"
- Verify `routeEstimationService.startMonitoring()` was called
- Check database sync status with `getMonitoringStatus()`
- Ensure Supabase connection is working

### "Wrong route displayed"
- Verify coordinates are in correct [lat, lng] format
- Check if API responded with errors
- Try refreshing the page

## Support

For issues or questions, check:
1. Console logs for detailed error messages
2. Test utilities to verify individual components
3. Browser DevTools Network tab for API calls
