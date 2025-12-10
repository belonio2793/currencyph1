# Planning Map Markers with Types - Implementation Guide

## 🎯 Overview

Added a complete "Add Marker" feature to the Planning page that allows users to:
- Create custom markers on the map with different types
- Drag and drop markers (native Leaflet feature)
- Select from 9 predefined marker types
- Add customizable descriptions for each marker
- Store all marker data in Supabase with automatic timestamps
- See color-coded markers on the map based on type

## 📊 Marker Types Available

| Type | Emoji | Color | Use Case |
|------|-------|-------|----------|
| Landowner | 🏘️ | Blue (#3B82F6) | Property owners |
| Machinery | ⚙️ | Orange (#F97316) | Manufacturing equipment |
| Equipment | 🔧 | Green (#10B981) | Equipment locations |
| Warehouse | 🏭 | Purple (#A855F7) | Storage facilities |
| Seller | 🛒 | Red (#EF4444) | Sales points |
| Vendor | 👨‍💼 | Yellow (#FBBF24) | Vendor locations |
| Manufacturing | 🏗️ | Brown (#92400E) | Manufacturing plants |
| Processing | ⚗️ | Cyan (#06B6D4) | Processing facilities |
| Transportation | 🚚 | Gray (#6B7280) | Logistics/transport |

## 🔧 Database Changes

### New Migration: `add_marker_type_to_planning_markers.sql`

A new column has been added to the `planning_markers` table:

```sql
ALTER TABLE public.planning_markers
  ADD COLUMN marker_type VARCHAR(50) DEFAULT 'Seller';

CREATE INDEX IF NOT EXISTS idx_planning_markers_type 
  ON public.planning_markers(marker_type);
```

**Column Details:**
- `marker_type` (VARCHAR 50): Stores the marker type
- Default value: 'Seller'
- Indexed for performance

## 📋 How to Apply the Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the SQL below:

```sql
-- Add marker_type column to planning_markers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planning_markers'
      AND column_name = 'marker_type'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD COLUMN marker_type VARCHAR(50) DEFAULT 'Seller';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_planning_markers_type 
  ON public.planning_markers(marker_type);
```

6. Click **Run** button
7. You should see "Query executed successfully"

### Option 2: Via CLI (if you have supabase-cli installed)

```bash
supabase db push
```

### Option 3: Via Node Script

```bash
npm run apply-marker-migration
```

(If this command doesn't work, manually execute the SQL above)

## 🚀 Using the Feature

### For Users

1. **Go to Planning Group** page
2. **Click "+ Add Location"** button in the map controls
3. **Select a Marker Type** from the dropdown (new feature!)
4. **Enter Location Name** (required)
5. **Add Description** (optional) - e.g., "Facility details"
6. **Click on the map** to select coordinates or see them pre-filled
7. **Click "Save Location"** to create the marker

### Features:

✅ **Color-coded markers** - Each type has a distinct color
✅ **Type badges** - Shows marker type with emoji in popup
✅ **Editable** - All existing functionality preserved
✅ **Real-time updates** - Markers sync across users via Supabase subscriptions
✅ **Coordinates** - All markers show lat/long in popup
✅ **Creator info** - Shows who added the marker

## 🎨 Code Changes

### Updated Files:

1. **src/components/PlanningChat.jsx**
   - Added `markerTypeColorMap` object for color mappings
   - Added `markerTypeEmojis` object for emoji display
   - Updated `createColoredMarker()` function to support hex colors
   - Added `marker_type` to `locationForm` state
   - Updated form modal with type selector dropdown
   - Updated `handleSaveLocation()` to include marker_type
   - Updated marker rendering with color icons
   - Updated popup display to show type badge with emoji

2. **supabase/migrations/add_marker_type_to_planning_markers.sql**
   - Migration file to add the marker_type column

### New Script:

3. **scripts/apply-marker-type-migration.js**
   - Helper script to apply migration (informational)

## 🔐 Security

- Row Level Security (RLS) is already enabled on planning_markers table
- Users can only edit their own markers (existing functionality maintained)
- Users can view all markers (existing functionality)

## 📱 Responsive Design

- Works on desktop and mobile
- Form is centered in a modal overlay
- Dropdown menus are touch-friendly
- Marker popups display cleanly on all screen sizes

## 🐛 Troubleshooting

### Markers not showing up?
1. Check that the migration was applied successfully
2. Refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Check browser console for errors

### Type dropdown not appearing?
1. Make sure PlanningChat.jsx was saved correctly
2. Clear browser cache
3. Restart the dev server

### Migration script not working?
1. Execute the SQL manually in Supabase dashboard
2. The code will work with or without the migration (defaults to 'Seller' type)

## 🔄 Default Behavior

- Existing markers without a `marker_type` will default to 'Seller'
- New markers require a type selection
- All new markers created will have a type

## 📚 Related Documentation

- [Leaflet Marker Documentation](https://leafletjs.com/reference.html#marker)
- [Supabase Real-time Documentation](https://supabase.com/docs/guides/realtime)
- [React Leaflet Documentation](https://react-leaflet.js.org/)

## ✨ Future Enhancements

Possible additions:
- Edit marker type and description inline
- Marker clustering for dense areas
- Filter markers by type
- Export markers as GeoJSON
- Import markers from file
- Custom marker icons
- Marker categories/groups

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify the migration was applied
3. Make sure you're logged in
4. Check that your Supabase credentials are correct
