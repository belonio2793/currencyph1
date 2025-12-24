#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'
)

async function main() {
  console.log('🔍 Debugging roger search...\n')

  // Search with ilike
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', '%roger%')

  console.log('Search result:')
  console.log(`  Error: ${error ? error.message : 'None'}`)
  console.log(`  Count: ${profiles?.length || 0}`)

  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      console.log(`\n  Profile:`)
      console.log(`    id: ${p.id}`)
      console.log(`    username: ${p.username}`)
      console.log(`    user_id: ${p.user_id}`)
      console.log(`    full_name: ${p.full_name}`)

      // Check wallets for this user_id
      if (p.user_id) {
        const { data: wallets, error: walletError } = await supabase
          .from('wallets')
          .select('currency_code, type')
          .eq('user_id', p.user_id)

        console.log(`\n    Wallets for user_id ${p.user_id}:`)
        if (wallets && wallets.length > 0) {
          for (const w of wallets) {
            console.log(`      ${w.currency_code}: ${w.type}`)
          }
        } else {
          console.log('      (none)')
        }
      }
    }
  }
}

main()
