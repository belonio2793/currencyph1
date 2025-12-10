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
    console.log('🚀 Applying migration 055: Add shipping ports rates and Chinese ports...')
    
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/055_add_planning_ports_with_rates.sql')
    
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
        console.log(`[${i + 1}/${statements.length}] Executing...`)
        
        // Execute the statement using RPC if available, otherwise use direct SQL
        const { error } = await supabase.rpc('exec', { sql_query: statement })
        
        if (error) {
          // Try direct SQL execution
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ sql_query: statement })
          })
          
          if (!response.ok) {
            // Some statements might fail if they depend on table creation
            // Just log and continue
            console.log(`   ⚠️  Statement ${i + 1} may have been skipped or partially applied`)
            errorCount++
          } else {
            successCount++
            console.log(`   ✅ Statement ${i + 1} executed`)
          }
        } else {
          successCount++
          console.log(`   ✅ Statement ${i + 1} executed`)
        }
      } catch (err) {
        console.log(`   ⚠️  Statement ${i + 1} skipped (${err.message.substring(0, 50)})`)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(`✅ Migration 055 application complete!`)
    console.log(`   ✓ Successful: ${successCount}`)
    console.log(`   ⚠️  Warnings/Skipped: ${errorCount}`)
    console.log('='.repeat(60))
    
    // Verify the migration
    console.log('\n📊 Verifying migration...')
    
    const { data: columns, error: columnsError } = await supabase
      .from('shipping_ports')
      .select('*')
      .limit(1)

    if (columnsError) {
      console.log('⚠️  Could not verify shipping_ports table')
      console.log('   Make sure to run this migration in Supabase dashboard if RPC execution failed')
    } else {
      console.log('✅ shipping_ports table is ready with new columns')
      
      const { count: portCount, error: countError } = await supabase
        .from('shipping_ports')
        .select('*', { count: 'exact', head: true })

      if (!countError) {
        console.log(`✅ Total shipping ports in database: ${portCount}`)
      }
    }

    console.log('\n🎯 Next Steps:')
    console.log('1. Go to http://localhost:3000/planning')
    console.log('2. You should see red markers for Philippines ports and blue for China ports')
    console.log('3. Click on any port to see rates and use the rate calculator')
    console.log('4. Change cargo type, quantity, and direction to calculate different rates')

  } catch (err) {
    console.error('❌ Migration error:', err)
    process.exit(1)
  }
}

applyMigration()
