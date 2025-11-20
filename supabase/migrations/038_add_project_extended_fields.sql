-- Migration: 038 - Add Extended Project Fields
-- Adds fields to support detailed project investment opportunities: project_type, total_cost, currency_code, min_investment

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS min_investment DECIMAL(12, 2) DEFAULT 1000;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_status_funding ON projects(status) WHERE status = 'funding';

-- Add comments
COMMENT ON COLUMN projects.project_type IS 'Type of project: agriculture, water_processing, tech, manufacturing, etc.';
COMMENT ON COLUMN projects.total_cost IS 'Total capital required for the project in the specified currency';
COMMENT ON COLUMN projects.currency_code IS 'Currency code for total_cost and min_investment (ISO 4217, default USD)';
COMMENT ON COLUMN projects.min_investment IS 'Minimum investment amount required per investor in the specified currency';
