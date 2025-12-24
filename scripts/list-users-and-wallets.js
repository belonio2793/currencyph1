#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  try {
    console.log('\n📋 Fetching all users...\n')

    // List all users
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .order('full_name')

    if (allError) {
      console.error('Error fetching users:', allError)
      return
    }

    console.log(`Found ${allUsers.length} user(s):`)
    for (const user of allUsers) {
      console.log(`  ${user.full_name || '(no name)'} | ${user.email}`)
      console.log(`    ID: ${user.id}`)
    }

    console.log('\n📋 Fetching all wallets...\n')

    // List all wallets with user info
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('id, user_id, currency_code, type, created_at')
      .order('user_id')
      .order('currency_code')

    if (walletError) {
      console.error('Wallet error:', walletError)
      return
    }

    console.log(`Found ${walletData.length} wallet(s):\n`)

    // Group by user
    const byUser = {}
    for (const wallet of walletData) {
      const user = allUsers.find(u => u.id === wallet.user_id)
      const userName = user?.full_name || '(unknown user)'

      if (!byUser[userName]) {
        byUser[userName] = []
      }
      byUser[userName].push(wallet)
    }

    // Display grouped
    for (const [userName, wallets] of Object.entries(byUser)) {
      console.log(`User: ${userName}`)
      for (const w of wallets) {
        const issue = w.type === 'fiat' && ['BTC', 'BCH', 'ETH'].includes(w.currency_code) ? ' ⚠️ WRONG TYPE' : ''
        console.log(`  - ${w.currency_code}: type=${w.type}${issue}`)
      }
      console.log('')
    }

  } catch (err) {
    console.error('Error:', err)
  }
}

main()
