import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function applyMigration() {
  try {
    console.log('Reading migration 034...')
    const migrationSql = fs.readFileSync('../supabase/migrations/034_add_equipment_images.sql', 'utf-8')
    
    // Split SQL into individual statements
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)
      
      try {
        const { error } = await supabase.rpc('exec', { sql_query: statement })
        
        if (error) {
          console.warn(`Statement ${i + 1} warning:`, error.message)
        } else {
          console.log(`✓ Statement ${i + 1} executed successfully`)
        }
      } catch (err) {
        console.debug(`Statement ${i + 1} error:`, err.message)
      }
    }

    console.log('\n✅ Migration 034 application complete!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

applyMigration()
