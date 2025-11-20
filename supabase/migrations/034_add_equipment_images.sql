-- Migration: 034 - Add Equipment Images Support
-- Adds image storage and management for equipment items

-- ============================================================================
-- EQUIPMENT IMAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipment_images (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  equipment_id BIGINT NOT NULL REFERENCES project_equipment(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path VARCHAR(500),
  alt_text VARCHAR(255),
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  file_size INT,
  mime_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_equipment_images_equipment ON equipment_images(equipment_id);
CREATE INDEX idx_equipment_images_project ON equipment_images(project_id);
CREATE INDEX idx_equipment_images_primary ON equipment_images(equipment_id, is_primary);

-- Enable RLS
ALTER TABLE equipment_images ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY equipment_images_select ON equipment_images
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update/delete their project images
CREATE POLICY equipment_images_insert ON equipment_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = equipment_images.project_id
    )
  );

CREATE POLICY equipment_images_update ON equipment_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = equipment_images.project_id
    )
  );

CREATE POLICY equipment_images_delete ON equipment_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = equipment_images.project_id
    )
  );
