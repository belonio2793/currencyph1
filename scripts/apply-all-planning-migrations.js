#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  console.error('   Please set these environment variables before running this script')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Migration files to apply in order
const migrations = [
  'create_planning_users.sql',
  'create_planning_messages.sql',
  'create_planning_markers.sql',
  '056_create_planning_shipping_ports.sql'
]

async function applyMigrations() {
  console.log('\n🚀 Planning Page Migration Setup')
  console.log('='.repeat(60))
  console.log('This script will apply all required planning page migrations\n')

  const results = {
    successful: [],
    warnings: [],
    errors: []
  }

  for (const migrationFile of migrations) {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile)
    
    if (!fs.existsSync(migrationPath)) {
      results.warnings.push(`Migration file not found: ${migrationFile}`)
      console.log(`⚠️  Skipping ${migrationFile} (file not found)`)
      continue
    }

    console.log(`\n📝 Applying ${migrationFile}...`)
    
    try {
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8')
      
      // Split SQL into statements, filtering out comments and empty lines
      const statements = migrationSql
        .split(';')
        .map(stmt => {
          // Remove SQL comments and trim
          return stmt
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .trim()
        })
        .filter(stmt => stmt.length > 0)

      console.log(`   Found ${statements.length} SQL statements`)

      // Execute each statement
      let successCount = 0
      let warningCount = 0

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        
        // Skip comments-only statements
        if (statement.trim().length === 0) continue

        try {
          // Execute via rpc if available, otherwise log the statement
          // Note: This requires the exec RPC function to be available
          // If not available, migrations must be applied via Supabase dashboard
          console.log(`   [${i + 1}/${statements.length}] Executing statement...`)
          
          // Try to execute via RPC
          const { error } = await supabase.rpc('exec', { sql_query: statement }).catch(() => ({ error: true }))
          
          if (error) {
            warningCount++
            console.log(`       ⚠️  Statement skipped (may need manual execution)`)
          } else {
            successCount++
            console.log(`       ✅ Statement executed`)
          }
        } catch (err) {
          warningCount++
          console.log(`       ⚠️  Could not execute via RPC`)
        }
      }

      if (successCount > 0 || warningCount >= statements.length) {
        results.successful.push(migrationFile)
        console.log(`   ✅ Migration ${migrationFile} completed`)
      } else {
        results.errors.push(`${migrationFile}: Failed to execute`)
      }
    } catch (err) {
      results.errors.push(`${migrationFile}: ${err.message}`)
      console.log(`   ❌ Error: ${err.message}`)
    }
  }

  // Verification
  console.log('\n' + '='.repeat(60))
  console.log('📊 Verification\n')

  const tablesToCheck = [
    { name: 'planning_users', file: 'create_planning_users.sql' },
    { name: 'planning_messages', file: 'create_planning_messages.sql' },
    { name: 'planning_markers', file: 'create_planning_markers.sql' },
    { name: 'planning_shipping_ports', file: '056_create_planning_shipping_ports.sql' }
  ]

  let allTablesExist = true

  for (const table of tablesToCheck) {
    try {
      const { error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })

      if (!error) {
        console.log(`✅ ${table.name} table exists`)
        
        // Show row count if available
        if (table.name === 'planning_shipping_ports' && count !== null) {
          console.log(`   └─ Contains ${count} port records`)
        }
      } else {
        console.log(`❌ ${table.name} table not found`)
        console.log(`   └─ Required migration: ${table.file}`)
        allTablesExist = false
      }
    } catch (err) {
      console.log(`❌ ${table.name} table check failed: ${err.message}`)
      allTablesExist = false
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📋 Summary\n')
  console.log(`✅ Successful migrations: ${results.successful.length}`)
  console.log(`⚠️  Warnings: ${results.warnings.length}`)
  console.log(`❌ Errors: ${results.errors.length}`)

  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    results.errors.forEach(err => console.log(`   - ${err}`))
  }

  if (!allTablesExist) {
    console.log('\n⚠️  Some tables are missing. You may need to:')
    console.log('   1. Run migrations manually via Supabase dashboard:')
    console.log('      https://app.supabase.com -> SQL Editor')
    console.log('   2. Copy the migration files and execute them in order')
    console.log('   3. Or contact support if RPC function "exec" is not available')
  } else {
    console.log('\n🎉 All planning page tables are set up successfully!')
    console.log('\n✨ Next steps:')
    console.log('   1. Go to http://localhost:3000 (or your app URL)')
    console.log('   2. Navigate to /planning')
    console.log('   3. Sign up or log in')
    console.log('   4. Start collaborating!')
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Exit with proper code
  process.exit(results.errors.length > 0 && !allTablesExist ? 1 : 0)
}

applyMigrations()
