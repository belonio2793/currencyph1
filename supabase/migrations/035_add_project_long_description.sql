-- Migration: 035 - Add Long Description to Projects
-- Purpose: Allow storing detailed project overviews/descriptions

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS long_description TEXT;

-- Add index for searching/filtering if needed
CREATE INDEX IF NOT EXISTS idx_projects_long_description ON projects USING GIN(to_tsvector('english', COALESCE(long_description, '')));

COMMENT ON COLUMN projects.long_description IS 'Extended project overview and description with detailed information about components, products, and industry requirements';
