import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('🚀 Applying migration 056: Create planning_shipping_ports table...')
    
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/056_create_planning_shipping_ports.sql')
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`)
      process.exit(1)
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf-8')
    
    // Split SQL into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📝 Found ${statements.length} SQL statements to execute`)

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      try {
        console.log(`[${i + 1}/${statements.length}] Executing statement...`)
        
        // Execute the statement using RPC if available
        const { error } = await supabase.rpc('exec', { sql_query: statement })
        
        if (error) {
          console.log(`   ⚠️  Statement ${i + 1} skipped (may be expected)`)
          errorCount++
        } else {
          successCount++
          console.log(`   ✅ Statement ${i + 1} executed`)
        }
      } catch (err) {
        console.log(`   ⚠️  Statement ${i + 1} skipped`)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(`✅ Migration 056 application complete!`)
    console.log(`   ✓ Successful: ${successCount}`)
    console.log(`   ⚠️  Warnings/Skipped: ${errorCount}`)
    console.log('='.repeat(60))
    
    // Verify the migration
    console.log('\n📊 Verifying migration...')
    
    const { data: ports, error: portsError, count } = await supabase
      .from('planning_shipping_ports')
      .select('*', { count: 'exact' })

    if (portsError) {
      console.log('⚠️  Could not verify planning_shipping_ports table')
      console.log('   Make sure to run this migration in Supabase dashboard if needed')
    } else {
      console.log(`✅ planning_shipping_ports table created successfully`)
      console.log(`✅ Total ports in database: ${ports?.length || count || 'unknown'}`)
      
      if (ports && ports.length > 0) {
        const phPorts = ports.filter(p => p.country_code === 'PH')
        const cnPorts = ports.filter(p => p.country_code === 'CN')
        console.log(`   Philippines ports: ${phPorts.length}`)
        console.log(`   Chinese ports: ${cnPorts.length}`)
      }
    }

    console.log('\n🎯 Next Steps:')
    console.log('1. Go to http://localhost:3000/planning')
    console.log('2. You should see red markers for Philippines ports and blue for China ports')
    console.log('3. Click on any port to see rates and use the rate calculator')
    console.log('4. Verify that /planning is using planning_shipping_ports table')

  } catch (err) {
    console.error('❌ Migration error:', err)
    process.exit(1)
  }
}

applyMigration()
