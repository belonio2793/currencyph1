#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'
)

async function main() {
  console.log('🔍 Searching for "roger"...\n')

  // Try profiles table
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', '%roger%')

  if (profiles && profiles.length > 0) {
    console.log('Found in profiles table:')
    for (const p of profiles) {
      console.log(`  ID: ${p.id}`)
      console.log(`  Username: ${p.username}`)
      console.log('')
    }
  } else {
    console.log('Not found in profiles table')
  }

  // Get all users and check manually
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  const rogerUsers = users.filter(u => 
    (u.full_name && u.full_name.toLowerCase().includes('roger')) ||
    (u.email && u.email.toLowerCase().includes('roger'))
  )

  if (rogerUsers.length > 0) {
    console.log('\nFound users with "roger":')
    for (const u of rogerUsers) {
      console.log(`  ID: ${u.id}`)
      console.log(`  Name: ${u.full_name}`)
      console.log(`  Email: ${u.email}`)
      console.log('')
    }
  } else {
    console.log('\nNo users found with "roger" in name or email')
    console.log('\nNote: If the user was created with a different name,')
    console.log('you can use their user ID directly to fix their wallets.')
  }
}

main()
