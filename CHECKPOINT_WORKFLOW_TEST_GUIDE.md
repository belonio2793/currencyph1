# Checkpoint Workflow Testing Guide

## Overview
This guide documents the complete checkpoint marking system with JSONB array storage and map visualization.

## System Components

### 1. Database Schema
**Table:** `addresses_shipping_labels`
- **Column:** `checkpoints_jsonb` (JSONB array)
- **Index:** `idx_shipping_labels_checkpoints_jsonb` (GIN)
- **Migration:** `supabase/migrations/053_add_checkpoints_jsonb.sql`

**Checkpoint Object Structure:**
```json
{
  "id": "cp-{timestamp}-{random}",
  "latitude": number,
  "longitude": number,
  "checkpoint_name": string,
  "address_text": string,
  "checkpoint_type": "scanned|in_transit|out_for_delivery|delivered",
  "notes": string (optional),
  "timestamp": ISO8601,
  "user_id": UUID,
  "metadata": {
    "userAgent": string,
    "accuracy": number,
    "source": "barcode_scan|quick_checkpoint"
  }
}
```

### 2. Service Functions (`src/lib/shippingLabelService.js`)

#### Core JSONB Operations
- **`addCheckpointToJsonbArray(trackingCode, checkpointData)`**
  - Adds new checkpoint to array
  - Updates label status fields (status, last_scanned_at, current_checkpoint)
  - Returns: { checkpoint, label }

- **`getCheckpointsFromJsonbArray(trackingCode)`**
  - Retrieves all checkpoints for a label
  - Returns: Array of checkpoint objects

- **`getLabelWithCheckpoints(trackingCode)`**
  - Fetches label with all checkpoints
  - Includes origin/destination address relationships
  - Returns: Label object with checkpoints property

- **`removeCheckpointFromJsonbArray(trackingCode, checkpointId)`**
  - Removes specific checkpoint from array
  - Returns: Updated checkpoint array

- **`updateCheckpointInJsonbArray(trackingCode, checkpointId, updates)`**
  - Updates checkpoint properties
  - Preserves all other data
  - Returns: Updated checkpoint array

- **`clearCheckpointsFromJsonbArray(trackingCode)`**
  - Clears all checkpoints for a label
  - Useful for testing/resets

### 3. UI Components

#### QuickCheckpointButton (`src/components/QuickCheckpointButton.jsx`)
**Reusable component for rapid checkpoint marking**
- Props:
  - `trackingCode`: Required tracking code
  - `onCheckpointAdded`: Callback function
  - `buttonText`: Custom button label (default: '⚡ Mark Checkpoint')
- Features:
  - Modal-based quick form
  - Geolocation integration
  - Checkpoint name, status, notes
  - Validation feedback

#### BarcodeScanner (`src/components/BarcodeScanner.jsx`)
**Enhanced with quick checkpoint access**
- New Section: `.checkpoint-actions`
- Contains: QuickCheckpointButton for rapid marking
- Flows: Input → Camera/Manual → Results + Quick Checkpoint

#### PackageTracker (`src/components/PackageTracker.jsx`)
**Added quick checkpoint in map view**
- Section: `.quick-actions` in map sidebar
- Location: Between route info and checkpoint history
- Allows marking packages during tracking

#### DefaultAddressesTab (`src/components/DefaultAddressesTab.jsx`)
**Top-level quick checkpoint access**
- Input form for tracking code entry
- Launches QuickCheckpointButton modal
- One-click quick checkpoint marking from main tab

#### PackageCheckpointMap (`src/components/PackageCheckpointMap.jsx`)
**Visualization component (existing)**
- Displays all checkpoints on map
- Shows route polyline
- Color-coded markers by position
- Sidebar timeline view

## Testing Workflows

### Workflow 1: Generate and Mark via Barcode Scanner

**Steps:**
1. Navigate to "Default" → "Generate Labels"
2. Create a test shipping label
3. Copy the tracking code
4. Navigate to "Scan Barcode"
5. Enter tracking code in input field
6. Click "Search Label"
7. Click "⚡ Quick Checkpoint" button
8. Fill checkpoint form:
   - Name: "Warehouse"
   - Status: "Scanned"
   - Notes: (optional)
9. Click "Save Checkpoint"
10. Verify checkpoint appears in "Checkpoint History"

**Expected Results:**
- Checkpoint saved to JSONB array
- Label status updated to "in_transit"
- Location captured (if geolocation enabled)
- Timestamp recorded

### Workflow 2: Quick Mark from Package Tracker

**Steps:**
1. Navigate to "Default" → "Track Package"
2. Search for tracking code or click package from list
3. Switch to "Map" view
4. Click "⚡ Add Checkpoint" button in sidebar
5. Fill quick checkpoint form
6. Save checkpoint
7. Verify on map view

**Expected Results:**
- Checkpoint appears on map
- Route markers updated
- Timeline refreshes
- Distance calculation updated

### Workflow 3: Quick Checkpoint from Main Tab

**Steps:**
1. Navigate to "Default" tab (top level)
2. See "🚀 Quick Checkpoint - Enter tracking code..." input
3. Enter tracking code
4. Click "Mark" button
5. Fill checkpoint form in modal
6. Save checkpoint

**Expected Results:**
- Input clears after completion
- Quick checkpoint form closes
- System ready for next tracking code

### Workflow 4: Map Visualization

**Steps:**
1. After marking 3+ checkpoints, view package in tracker
2. Switch to Map view
3. Verify:
   - Origin marker (blue)
   - Checkpoint markers (numbered 1, 2, 3... in orange/amber)
   - Destination marker (green)
   - Route polyline connecting checkpoints
4. Click on markers to view popup details
5. Check sidebar timeline

**Expected Results:**
- All checkpoints visible on map
- Proper color coding by type
- Accurate geolocation display
- Timeline shows all events in order

## Data Verification

### Database Query Examples

**View all checkpoints for a tracking code:**
```sql
SELECT tracking_code, checkpoints_jsonb, status, last_scanned_at
FROM addresses_shipping_labels
WHERE tracking_code = 'PH-2025-XXXX'
```

**Count checkpoints per label:**
```sql
SELECT tracking_code, array_length(checkpoints_jsonb, 1) as checkpoint_count
FROM addresses_shipping_labels
WHERE checkpoints_jsonb IS NOT NULL
AND array_length(checkpoints_jsonb, 1) > 0
ORDER BY checkpoint_count DESC
```

**Find labels by checkpoint location:**
```sql
SELECT tracking_code, checkpoints_jsonb ->> 'checkpoint_name' as last_checkpoint
FROM addresses_shipping_labels
WHERE checkpoints_jsonb @> '[{"checkpoint_type": "delivered"}]'
```

## Integration Testing Checklist

- [ ] QuickCheckpointButton imports correctly in all 3 locations
- [ ] Geolocation permission works in browser
- [ ] Checkpoint data saves to JSONB array
- [ ] Status updates on label (last_scanned_at, current_checkpoint)
- [ ] Multiple checkpoints can be added to same label
- [ ] Map displays all checkpoints
- [ ] Timeline shows correct order
- [ ] Checkpoint timestamps are accurate
- [ ] Route distance calculation works
- [ ] Modal forms validate input
- [ ] Error handling for missing data
- [ ] Quick checkpoint accessible from all 3 entry points
- [ ] Mobile responsive design
- [ ] Browser local storage persists tracking codes

## Performance Considerations

- JSONB array operations are indexed for fast queries
- GIN index on `checkpoints_jsonb` enables efficient searches
- Array append operation is atomic (single UPDATE)
- No N+1 queries when loading checkpoints
- Frontend filters history client-side to reduce payload

## Troubleshooting

**Checkpoints not saving:**
- Verify migration 053_add_checkpoints_jsonb.sql was applied
- Check browser console for errors
- Ensure geolocation permissions granted

**Map not showing markers:**
- Verify checkpoints have valid lat/lng
- Check leaflet library loaded
- Ensure addresses have coordinates

**Geolocation not working:**
- Must be HTTPS (or localhost for development)
- User must grant permission
- Check browser console for permission errors

**Quick checkpoint button not visible:**
- Verify QuickCheckpointButton.jsx file exists
- Check CSS imports
- Verify component is exported correctly

## Success Criteria

✅ All three "Mark As Checkpoint" entry points functional
✅ Checkpoints save to JSONB array in database
✅ Map visualization shows all checkpoints with routes
✅ Quick marking can be done in <5 seconds
✅ No external dependencies beyond existing (Leaflet, React)
✅ Works offline (geolocation) and online (API)
✅ Mobile-responsive design
✅ Proper error handling and validation
