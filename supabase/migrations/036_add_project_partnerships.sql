-- Migration: 036 - Add Project Partnerships Table
-- Adds partnerships table for tracking strategic partnerships, revenue sharing, and collaborations

-- ============================================================================
-- PROJECT PARTNERSHIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_partnerships (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  partner_name VARCHAR(255) NOT NULL,
  partnership_type VARCHAR(50) NOT NULL, -- 'distribution', 'manufacturing', 'joint_venture', 'supplier_partnership', 'technology', 'marketing', 'financial'
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  
  -- Partnership Details
  partnership_status VARCHAR(30) DEFAULT 'active', -- 'active', 'pending', 'terminated', 'suspended'
  start_date DATE,
  end_date DATE,
  revenue_share_percentage DECIMAL(5, 2), -- percentage of revenue shared
  investment_amount_usd DECIMAL(15, 2), -- if partner is investing
  
  -- Terms
  payment_terms VARCHAR(255),
  contract_duration_months INT,
  key_terms TEXT,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_partnerships_project ON project_partnerships(project_id);
CREATE INDEX idx_project_partnerships_type ON project_partnerships(partnership_type);
CREATE INDEX idx_project_partnerships_status ON project_partnerships(partnership_status);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE project_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view partnerships for their projects"
  ON project_partnerships
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.id = project_id
    )
  );

CREATE POLICY "Users can insert partnerships for their projects"
  ON project_partnerships
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update partnerships"
  ON project_partnerships
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete partnerships"
  ON project_partnerships
  FOR DELETE
  USING (true);
