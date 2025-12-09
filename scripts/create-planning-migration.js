import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Please ensure your .env file is configured properly')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function executeSql(sql) {
  try {
    const { data, error } = await supabase.rpc('exec', { sql })
    if (error) throw error
    return data
  } catch (err) {
    // Try alternative approach - use fetch directly
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-client-info': 'supabase-js/2.0'
      },
      body: JSON.stringify({ sql })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to execute SQL: ${response.statusText}`)
    }
    
    return await response.json()
  }
}

async function createPlanningTables() {
  console.log('🔄 Setting up planning tables in Supabase...\n')

  const statements = [
    {
      name: 'planning_users table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.planning_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE,
          email TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'member',
          status TEXT DEFAULT 'pending',
          joined_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'planning_messages table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.planning_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          planning_user_id UUID NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
          CONSTRAINT fk_planning_user FOREIGN KEY (planning_user_id) REFERENCES public.planning_users(id) ON DELETE CASCADE
        );
      `
    },
    {
      name: 'planning_markers table',
      sql: `
        CREATE TABLE IF NOT EXISTS public.planning_markers (
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
          CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES public.planning_users(id) ON DELETE SET NULL
        );
      `
    },
    {
      name: 'indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_planning_messages_user ON public.planning_messages(user_id);
        CREATE INDEX IF NOT EXISTS idx_planning_messages_created ON public.planning_messages(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_planning_users_status ON public.planning_users(status);
        CREATE INDEX IF NOT EXISTS idx_planning_markers_type ON public.planning_markers(marker_type);
      `
    },
    {
      name: 'enable RLS on planning_users',
      sql: `ALTER TABLE public.planning_users ENABLE ROW LEVEL SECURITY;`
    },
    {
      name: 'enable RLS on planning_messages',
      sql: `ALTER TABLE public.planning_messages ENABLE ROW LEVEL SECURITY;`
    },
    {
      name: 'enable RLS on planning_markers',
      sql: `ALTER TABLE public.planning_markers ENABLE ROW LEVEL SECURITY;`
    },
    {
      name: 'RLS policy - view all planning_users',
      sql: `CREATE POLICY "planning_users_can_view_all" ON public.planning_users FOR SELECT USING (true);`
    },
    {
      name: 'RLS policy - insert own planning_user',
      sql: `CREATE POLICY "planning_users_can_insert_own" ON public.planning_users FOR INSERT WITH CHECK (user_id = auth.uid());`
    },
    {
      name: 'RLS policy - update own planning_user',
      sql: `CREATE POLICY "planning_users_can_update_own" ON public.planning_users FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());`
    },
    {
      name: 'RLS policy - view all messages',
      sql: `CREATE POLICY "planning_messages_can_view_all" ON public.planning_messages FOR SELECT USING (true);`
    },
    {
      name: 'RLS policy - insert own messages',
      sql: `CREATE POLICY "planning_messages_can_insert_own" ON public.planning_messages FOR INSERT WITH CHECK (user_id = auth.uid());`
    },
    {
      name: 'RLS policy - view all markers',
      sql: `CREATE POLICY "planning_markers_can_view_all" ON public.planning_markers FOR SELECT USING (true);`
    },
    {
      name: 'RLS policy - insert own markers',
      sql: `CREATE POLICY "planning_markers_can_insert_own" ON public.planning_markers FOR INSERT WITH CHECK (
        created_by IN (SELECT id FROM public.planning_users WHERE user_id = auth.uid())
      );`
    },
    {
      name: 'RLS policy - update own markers',
      sql: `CREATE POLICY "planning_markers_can_update_own" ON public.planning_markers FOR UPDATE USING (
        created_by IN (SELECT id FROM public.planning_users WHERE user_id = auth.uid())
      );`
    }
  ]

  let completed = 0
  let failed = 0

  for (const stmt of statements) {
    try {
      console.log(`⏳ Creating ${stmt.name}...`)
      await executeSql(stmt.sql)
      console.log(`✅ ${stmt.name} created successfully\n`)
      completed++
    } catch (error) {
      console.error(`❌ Failed to create ${stmt.name}`)
      console.error(`   Error: ${error.message}\n`)
      failed++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Completed: ${completed} statements`)
  if (failed > 0) {
    console.log(`⚠️  Failed: ${failed} statements`)
    console.log('\nNote: Some failures may be expected (e.g., if tables already exist)')
  }
  console.log('='.repeat(60))
  console.log('\n🎉 Planning tables setup complete!')
  console.log('\nYour /planning page is now ready to use:')
  console.log('  • Visit /planning to access the planning group chat')
  console.log('  • Sign in or register to join the planning group')
  console.log('  • Only approved members can fully participate')
}

createPlanningTables().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
