-- Add location tracking to user_presence table

-- Alter user_presence table to add location fields
ALTER TABLE IF EXISTS public.user_presence
ADD COLUMN IF NOT EXISTS latitude decimal(10, 8),
ADD COLUMN IF NOT EXISTS longitude decimal(11, 8),
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS location_updated_at timestamptz DEFAULT now();

-- Create index for location queries
CREATE INDEX IF NOT EXISTS user_presence_location_idx ON public.user_presence (latitude, longitude) WHERE status = 'online';

-- Create index for querying online users
CREATE INDEX IF NOT EXISTS user_presence_status_idx ON public.user_presence (status, updated_at DESC);
