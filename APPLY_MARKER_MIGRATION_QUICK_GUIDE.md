# Quick: Apply Marker Type Migration

## 🚀 In 2 Minutes

### Step 1: Copy This SQL

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

### Step 2: Go to Supabase

1. Open https://app.supabase.com
2. Select your project (corcofbmafdxehvlbesx)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Paste the SQL above
6. Click **Run**

### ✅ Done!

The marker type feature is now ready to use!

---

## 🎯 The Feature

- **Add markers** with 9 different types to your planning map
- **Color-coded** markers for easy identification
- **Store descriptions** with each marker
- **Real-time sync** across users

## 📖 Full Documentation

See `PLANNING_MARKERS_FEATURE_GUIDE.md` for complete details and usage instructions.
