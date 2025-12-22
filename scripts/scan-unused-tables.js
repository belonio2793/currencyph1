#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function scanTables() {
  try {
    console.log('🔍 Scanning database for unused tables...')
    console.log('')

    // Get all tables with row counts and sizes
    const { data: tables, error } = await supabase.rpc('get_table_stats')

    if (error) {
      // Fallback: Try to query information_schema directly
      console.log('📋 Using direct information_schema query...')
      return await scanTablesDirectly()
    }

    if (!tables || tables.length === 0) {
      console.log('No tables found')
      return
    }

    // Display results
    console.log('📊 === TABLE ANALYSIS REPORT ===')
    console.log('')
    console.log(
      'TABLE_NAME'.padEnd(40) +
      'ROWS'.padEnd(10) +
      'SIZE'.padEnd(12) +
      'STATUS'
    )
    console.log('-'.repeat(80))

    const candidates = []

    tables.forEach(table => {
      const status =
        table.row_count === 0 && table.has_incoming_fk === 0
          ? '⚠️ CANDIDATE FOR DELETION'
          : table.row_count === 0
          ? '⚠️ EMPTY (has references)'
          : '✓ IN USE'

      console.log(
        (table.tablename || '').padEnd(40) +
        (table.row_count || '0').toString().padEnd(10) +
        (table.size || '0 B').padEnd(12) +
        status
      )

      if (status === '⚠️ CANDIDATE FOR DELETION') {
        candidates.push(table)
      }
    })

    console.log('')
    console.log('📌 DROP STATEMENTS (Review Before Executing)')
    console.log('---')
    console.log(
      '-- ⚠️  WARNING: Always backup your database before dropping tables'
    )
    console.log('-- Copy and paste these in Supabase SQL Editor')
    console.log('')

    if (candidates.length === 0) {
      console.log('-- No empty unused tables found')
    } else {
      candidates.forEach(table => {
        const schema = table.schemaname || 'public'
        console.log(`DROP TABLE IF EXISTS "${schema}"."${table.tablename}" CASCADE;`)
      })
    }

    console.log('')
    console.log('✅ Scan complete!')
    console.log('')
    console.log(`📊 Statistics:`)
    console.log(`   Total tables: ${tables.length}`)
    console.log(`   Empty tables: ${tables.filter(t => t.row_count === 0).length}`)
    console.log(`   Candidates for deletion: ${candidates.length}`)
  } catch (err) {
    console.error('❌ Error scanning database:', err.message)
    console.log('')
    console.log(
      'Try running this SQL directly in Supabase SQL Editor instead:'
    )
    console.log('')
    console.log(`
-- Get all tables with stats
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  (SELECT COUNT(*) FROM information_schema.key_column_usage 
   WHERE referenced_table_schema = schemaname 
   AND referenced_table_name = tablename) as incoming_fk_count
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime')
ORDER BY n_live_tup ASC, tablename;

-- Drop empty tables (review results first!)
-- DELETE FROM DROP STATEMENTS BELOW FOR TABLES YOU WANT TO KEEP
    `)
    process.exit(1)
  }
}

async function scanTablesDirectly() {
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('*')
      .eq('table_schema', 'public')

    if (error) throw error

    console.log('Found', data.length, 'tables')

    const results = []
    for (const table of data) {
      const { data: stats } = await supabase.rpc(
        'pg_stat_get_live_tuple_count',
        { table_schema: 'public', table_name: table.table_name }
      )

      results.push({
        schemaname: 'public',
        tablename: table.table_name,
        row_count: stats?.[0]?.count || 0,
        has_incoming_fk: 0
      })
    }

    displayResults(results)
  } catch (err) {
    throw err
  }
}

function displayResults(tables) {
  console.log('📊 === TABLE ANALYSIS REPORT ===')
  console.log('')
  console.log(
    'TABLE_NAME'.padEnd(40) +
    'ROWS'.padEnd(10) +
    'STATUS'
  )
  console.log('-'.repeat(70))

  const candidates = []

  tables.forEach(table => {
    const status =
      table.row_count === 0 && table.has_incoming_fk === 0
        ? '⚠️ CANDIDATE FOR DELETION'
        : table.row_count === 0
        ? '⚠️ EMPTY (has references)'
        : '✓ IN USE'

    console.log(
      (table.tablename || '').padEnd(40) +
      (table.row_count || '0').toString().padEnd(10) +
      status
    )

    if (status === '⚠️ CANDIDATE FOR DELETION') {
      candidates.push(table)
    }
  })

  console.log('')
  console.log('DROP STATEMENTS (Review Before Executing):')
  console.log('---')

  if (candidates.length === 0) {
    console.log('-- No empty unused tables found')
  } else {
    console.log(
      '-- ⚠️  WARNING: Always backup your database before dropping tables'
    )
    candidates.forEach(table => {
      const schema = table.schemaname || 'public'
      console.log(`DROP TABLE IF EXISTS "${schema}"."${table.tablename}" CASCADE;`)
    })
  }
}

scanTables()
