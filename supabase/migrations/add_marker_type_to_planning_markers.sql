-- Add marker_type column to planning_markers table
-- This enables categorization of markers by their purpose

-- Add the column if it doesn't exist
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

-- Create index on marker_type for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_markers_type 
  ON public.planning_markers(marker_type);
