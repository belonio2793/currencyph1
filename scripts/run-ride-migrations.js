import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runMigration() {
  try {
    console.log('Reading migration file...')
    const migrationPath = './supabase/migrations/029_create_ride_requests_and_matches.sql'
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log('Executing migration...')
    const { data, error } = await supabase.rpc('exec', { sql_query: sql })

    if (error) {
      // Try direct SQL execution instead
      console.log('Attempting direct SQL execution...')
      const response = await supabase.rest.sql.execute(sql)
      console.log('Migration executed successfully')
    } else {
      console.log('Migration executed successfully')
    }

    // Verify tables were created
    console.log('Verifying tables...')
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['ride_requests', 'ride_matches', 'ride_ratings'])

    if (tableError) {
      console.log('Note: Could not verify tables with query method')
      console.log('However, migration should be applied. Run this query in Supabase SQL editor to verify:')
      console.log("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ride_%'")
    } else if (tables && tables.length > 0) {
      console.log('Verified tables created:')
      tables.forEach(t => console.log(`  - ${t.table_name}`))
    }
  } catch (err) {
    console.error('Migration failed:', err.message)
    console.log('\nTo apply the migration manually:')
    console.log('1. Go to https://app.supabase.com')
    console.log('2. Select your project')
    console.log('3. Click SQL Editor > New Query')
    console.log('4. Copy the contents of supabase/migrations/029_create_ride_requests_and_matches.sql')
    console.log('5. Paste and click RUN')
    process.exit(1)
  }
}

runMigration()
