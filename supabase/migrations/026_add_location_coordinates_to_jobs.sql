-- Add location coordinates to jobs table
-- This allows job postings to include precise location data using maps

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create index for geographic queries if needed in the future
CREATE INDEX IF NOT EXISTS idx_jobs_coordinates ON public.jobs(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.jobs.latitude IS 'Latitude coordinate for job location (e.g., 12.8761, for Manila)';
COMMENT ON COLUMN public.jobs.longitude IS 'Longitude coordinate for job location (e.g., 121.7740, for Manila)';
