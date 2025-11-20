-- Migration: 033 - Fix Investments Foreign Keys
-- Ensures investments table properly references users and projects tables with cascading deletes

-- ============================================================================
-- ADD FOREIGN KEY CONSTRAINTS TO INVESTMENTS TABLE
-- ============================================================================

-- First, drop existing foreign keys if they exist (using DO block for safety)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_name = 'investments' 
      AND constraint_name = 'investments_user_id_fkey'
  ) THEN
    ALTER TABLE investments DROP CONSTRAINT investments_user_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_name = 'investments' 
      AND constraint_name = 'investments_project_id_fkey'
  ) THEN
    ALTER TABLE investments DROP CONSTRAINT investments_project_id_fkey;
  END IF;
END $$;

-- Add proper foreign keys with cascading delete
ALTER TABLE investments
ADD CONSTRAINT investments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE investments
ADD CONSTRAINT investments_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_project_id ON investments(project_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_date ON investments(investment_date DESC);

-- ============================================================================
-- ENSURE INVESTMENTS TABLE HAS NECESSARY COLUMNS
-- ============================================================================
ALTER TABLE investments ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'PHP';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS investment_date TIMESTAMP DEFAULT NOW();

-- ============================================================================
-- ROW LEVEL SECURITY FOR INVESTMENTS
-- ============================================================================
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- Users can view their own investments
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (auth.uid() = user_id);

-- Investors can view investments for projects they're interested in (optional - make public for discovery)
CREATE POLICY "Public can view project investments" ON investments
  FOR SELECT USING (true);

-- Users can only insert their own investments
CREATE POLICY "Users can insert own investments" ON investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own investments
CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (auth.uid() = user_id);
