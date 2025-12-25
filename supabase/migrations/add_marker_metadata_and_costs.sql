-- Add metadata column to planning_markers table for flexible marker type-specific data
-- This allows different marker types to have different fields without creating many columns

-- Add metadata column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planning_markers'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create index on metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_planning_markers_metadata 
  ON public.planning_markers USING GIN (metadata);

-- Add exchange_rate column to store the PHP to USD rate at time of creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planning_markers'
      AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD COLUMN exchange_rate DECIMAL(10, 4) DEFAULT NULL;
  END IF;
END $$;

-- Add rate_updated_at column to track when the exchange rate was last updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planning_markers'
      AND column_name = 'rate_updated_at'
  ) THEN
    ALTER TABLE public.planning_markers
      ADD COLUMN rate_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- No need to change RLS policies - they already allow all authenticated users to read, 
-- and only creators to update/delete
