import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyMigration() {
  try {
    console.log('Applying migration 038: Add extended project fields...')
    
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec', {
      sql: `
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS min_investment DECIMAL(12, 2) DEFAULT 1000;

CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_status_funding ON projects(status) WHERE status = 'funding';
      `
    })

    if (error) {
      console.error('Migration error:', error)
      return
    }

    console.log('✓ Migration 038 applied successfully!')
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

applyMigration()
