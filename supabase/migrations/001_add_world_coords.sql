-- Migration: add world_x and world_y columns to nearby_listings
ALTER TABLE IF EXISTS public.nearby_listings
  ADD COLUMN IF NOT EXISTS world_x INTEGER,
  ADD COLUMN IF NOT EXISTS world_y INTEGER;

-- Optional: create index for fast spatial lookups
CREATE INDEX IF NOT EXISTS idx_nearby_world_coords ON public.nearby_listings (world_x, world_y);
