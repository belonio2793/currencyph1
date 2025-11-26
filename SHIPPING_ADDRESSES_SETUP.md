# Shipping and Addresses System Setup Guide

## Overview

The Shipping and Addresses system provides a complete solution for managing shipments, addresses, shipping routes, and shipping handlers. It consists of multiple tabs:

1. **Default** - System-wide default addresses
2. **My Addresses** - User's saved addresses
3. **Shipping** - Track and manage shipments
4. **Route Calculator** - Calculate shipping routes
5. **Shipping Handlers** - Manage shipping/logistics partners
6. **Public Shipping Ports** - View available shipping ports

## Issue Fixed

**Error**: "TypeError: Failed to execute 'text' on 'Response': body stream already read"

**Cause**: Attempting to access error messages from database responses multiple times

**Solution**: Implemented safe error handling utilities that prevent reading response bodies multiple times

## Database Setup

### Run Migration

The migration file `supabase/migrations/shipping_tables_init.sql` creates all necessary tables:

```sql
- shipments
- shipment_tracking_history
- user_addresses
- default_addresses
- shipping_handlers
- shipping_ports
- shipping_routes
```

All tables include:
- Proper foreign key relationships
- Performance indexes
- Row Level Security (RLS) policies
- Timestamp tracking (created_at, updated_at)

### Tables Description

#### shipments
Tracks user shipments and packages:
```
id, user_id, tracking_number, package_weight, package_dimensions,
origin_address, destination_address, carrier, status, estimated_delivery, notes
```

#### shipment_tracking_history
History of shipment status updates:
```
id, shipment_id, status, location, notes, timestamp
```

#### user_addresses
Personal addresses saved by users:
```
id, user_id, label, street_address, city, province, postal_code,
country, latitude, longitude, is_default
```

#### default_addresses
System-wide default addresses (warehouses, HQ, etc.):
```
id, name, address_type, street_address, city, province, postal_code,
country, latitude, longitude, contact_person, contact_phone, contact_email, is_active
```

#### shipping_ports
Public shipping ports and facilities:
```
id, port_name, port_code, city, province, country, latitude, longitude,
port_type, facilities, contact_person, contact_phone, contact_email, operating_hours
```

#### shipping_handlers
Shipping/logistics providers and partners:
```
id, business_id, handler_name, handler_type, contact_person,
contact_phone, contact_email, coverage_areas, service_types, rates
```

#### shipping_routes
Predefined shipping routes between locations:
```
id, origin_address_id, destination_address_id, origin_city, destination_city,
estimated_days, cost
```

## Error Handling

### Safe Error Handler Utility

Location: `src/lib/safeErrorHandler.js`

Provides three main functions:

#### getSafeErrorMessage(error)
Safely extracts error message without reading Response body twice:
```javascript
import { getSafeErrorMessage } from './lib/safeErrorHandler'

try {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw error
} catch (err) {
  const safeMessage = getSafeErrorMessage(err)
  setError(safeMessage)
}
```

#### logErrorSafely(context, error)
Safely logs errors without triggering body stream errors:
```javascript
import { logErrorSafely } from './lib/safeErrorHandler'

try {
  // some operation
} catch (err) {
  logErrorSafely('MyComponent.myFunction', err)
}
```

#### handleSupabaseError(supabaseError)
Normalizes Supabase errors:
```javascript
import { handleSupabaseError } from './lib/safeErrorHandler'

const { message, code, status } = handleSupabaseError(error)
```

## Usage Examples

### ShippingTrackingTab

The `ShippingTrackingTab` component now uses safe error handling:

```javascript
// Load shipments with safe error handling
const loadShipments = async () => {
  try {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
    
    if (error) throw error
    setShipments(data || [])
  } catch (err) {
    logErrorSafely('ShippingTrackingTab.loadShipments', err)
    const safeErrorMessage = getSafeErrorMessage(err)
    setError(safeErrorMessage || 'Failed to load shipments')
  }
}
```

### Create a Shipment

```javascript
const handleSubmit = async (formData) => {
  try {
    const { error } = await supabase
      .from('shipments')
      .insert([{
        user_id: userId,
        ...formData
      }])
    
    if (error) throw error
    await loadShipments() // Reload list
  } catch (err) {
    logErrorSafely('createShipment', err)
    setError(getSafeErrorMessage(err))
  }
}
```

### Track Shipment

```javascript
const loadTrackingHistory = async (shipmentId) => {
  try {
    const { data, error } = await supabase
      .from('shipment_tracking_history')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('timestamp', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (err) {
    logErrorSafely('loadTrackingHistory', err)
    return []
  }
}
```

## RLS (Row Level Security) Policies

All tables have RLS enabled for multi-tenancy:

### User Data (shipments, user_addresses)
- Users can only see/edit their own data
- Policy checks `auth.uid() = user_id`

### Public Data (ports, routes)
- Anyone can read
- No write access for regular users

### Business Data (shipping_handlers)
- Only business owners can see their handlers
- Policy checks business ownership via businesses table

## API Integration

### Getting Shipments
```javascript
const { data: shipments, error } = await supabase
  .from('shipments')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

### Adding Tracking Update
```javascript
const { error } = await supabase
  .from('shipment_tracking_history')
  .insert([{
    shipment_id: shipmentId,
    status: 'in-transit',
    location: 'Manila',
    notes: 'Package picked up'
  }])
```

### Saving User Address
```javascript
const { data, error } = await supabase
  .from('user_addresses')
  .insert([{
    user_id: userId,
    label: 'Home',
    street_address: '123 Main St',
    city: 'Manila',
    province: 'Metro Manila',
    postal_code: '1005',
    country: 'Philippines',
    is_default: true
  }])
```

## Component Structure

### Addresses.jsx
Main container component that manages tabs:
- Displays tab navigation
- Renders active tab component
- Manages tab state

### ShippingTrackingTab.jsx
Handles shipment tracking:
- Create new shipments
- Search and filter shipments
- View tracking history
- Interactive map of shipment routes
- Generate barcode/QR labels

### DefaultAddressesTab.jsx
Browse system-wide addresses (HQ, warehouses, etc.)

### MyAddressesTab.jsx
Manage personal saved addresses

### RouteCalculatorTab.jsx
Calculate shipping routes and estimates

### PartnersHandlersTab.jsx
Manage shipping partners and handlers

### PublicShippingPorts.jsx
Browse available shipping ports

## Performance Optimizations

1. **Indexes**: Created on frequently queried fields
   - `shipments.user_id, status, created_at`
   - `shipment_tracking_history.shipment_id, timestamp`
   - `shipping_ports.city, port_code`
   - etc.

2. **Pagination**: Components support pagination for large datasets

3. **Caching**: Consider adding client-side caching for read-only data

4. **Lazy Loading**: Tracking history loads only when shipment selected

## Security Considerations

1. **RLS Enabled**: All tables have Row Level Security
2. **Auth Checks**: User operations checked against auth.uid()
3. **No Sensitive Data**: API keys, credentials stored in environment only
4. **Audit Trail**: Timestamps track when records created/updated

## Troubleshooting

### "TypeError: Failed to execute 'text' on 'Response': body stream already read"

**Solution**: Use the safe error handler:
```javascript
import { getSafeErrorMessage, logErrorSafely } from './lib/safeErrorHandler'

try {
  // database operation
} catch (err) {
  logErrorSafely('context', err)
  setError(getSafeErrorMessage(err))
}
```

### Tables Don't Exist
Make sure the migration `shipping_tables_init.sql` has been run:
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and run the migration SQL
4. Verify tables appear in Table Editor

### RLS Blocking Queries
If you get "403 Forbidden" errors:
1. Check RLS policies are correct
2. Ensure user is authenticated
3. Verify policy conditions match your data structure

### Slow Queries
Check if indexes are created:
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('shipments', 'shipment_tracking_history', 'shipping_ports')
```

## Next Steps

1. **Deploy Migration**: Run the SQL migration in Supabase
2. **Test Components**: Open Shipping tab and test each feature
3. **Customize**: Modify components to match your design
4. **Add Real Data**: Populate default addresses and ports
5. **Monitor Performance**: Check database query times
6. **User Testing**: Get feedback from users

## Complete Feature Checklist

- [x] Database tables created with RLS
- [x] Safe error handling implemented
- [x] ShippingTrackingTab component updated
- [x] Error messages display safely
- [x] Indexes created for performance
- [ ] DefaultAddressesTab completed
- [ ] MyAddressesTab completed
- [ ] RouteCalculatorTab completed
- [ ] PartnersHandlersTab completed
- [ ] PublicShippingPorts completed
- [ ] Map integration for routes
- [ ] Barcode/QR code generation
- [ ] Export shipment labels
- [ ] Email notifications
- [ ] SMS tracking updates

## Support

If you encounter issues:
1. Check browser console for detailed error messages
2. Review network tab to see API responses
3. Verify migration was applied to database
4. Check RLS policies in Supabase dashboard
5. Review component console logs for safe error messages
