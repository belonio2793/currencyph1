import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function setupPlanningTables() {
  try {
    console.log('Setting up planning tables...')

    // Create planning_users table
    const { error: planningUsersError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS planning_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE,
          email TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'member',
          status TEXT DEFAULT 'pending',
          joined_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
        )
      `
    })
    
    if (planningUsersError) {
      console.log('Creating planning_users via direct SQL...')
      // Try direct approach
      const { error } = await supabase.from('planning_users').select('*').limit(1)
      if (error && error.code === 'PGRST116') {
        // Table doesn't exist, need to use exec_sql or similar
        console.log('Will create tables - using Supabase SQL editor or migrations')
      }
    }

    console.log('Note: Please create the following tables manually in Supabase SQL Editor:')
    console.log(`
    
    -- Create planning_users table
    CREATE TABLE IF NOT EXISTS planning_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE,
      email TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'pending',
      joined_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
    );

    -- Create planning_messages table
    CREATE TABLE IF NOT EXISTS planning_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      planning_user_id UUID NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      FOREIGN KEY (planning_user_id) REFERENCES planning_users(id) ON DELETE CASCADE
    );

    -- Create planning_markers table
    CREATE TABLE IF NOT EXISTS planning_markers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      latitude DECIMAL(10, 8) NOT NULL,
      longitude DECIMAL(11, 8) NOT NULL,
      marker_type TEXT DEFAULT 'facility',
      status TEXT DEFAULT 'planned',
      details JSONB DEFAULT '{}',
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (created_by) REFERENCES planning_users(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_planning_messages_user ON planning_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_planning_messages_created ON planning_messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_planning_users_status ON planning_users(status);
    
    -- Enable RLS
    ALTER TABLE planning_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE planning_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE planning_markers ENABLE ROW LEVEL SECURITY;
    
    -- RLS Policies for planning_users
    CREATE POLICY "planning_users_can_view_all" ON planning_users FOR SELECT USING (true);
    CREATE POLICY "planning_users_can_insert_own" ON planning_users FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY "planning_users_can_update_own" ON planning_users FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    
    -- RLS Policies for planning_messages
    CREATE POLICY "planning_messages_can_view_all" ON planning_messages FOR SELECT USING (true);
    CREATE POLICY "planning_messages_can_insert_own" ON planning_messages FOR INSERT WITH CHECK (user_id = auth.uid());
    
    -- RLS Policies for planning_markers
    CREATE POLICY "planning_markers_can_view_all" ON planning_markers FOR SELECT USING (true);
    CREATE POLICY "planning_markers_can_insert_own" ON planning_markers FOR INSERT WITH CHECK (created_by = (SELECT id FROM planning_users WHERE user_id = auth.uid()));
    CREATE POLICY "planning_markers_can_update_own" ON planning_markers FOR UPDATE USING (created_by = (SELECT id FROM planning_users WHERE user_id = auth.uid()));
    `)

    console.log('Tables setup instructions printed above.')
  } catch (error) {
    console.error('Error setting up tables:', error)
    process.exit(1)
  }
}

setupPlanningTables()
