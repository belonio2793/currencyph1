#!/usr/bin/env node

/**
 * Fix ride_profiles default role
 * 
 * This script:
 * 1. Updates all existing ride_profiles with role='driver' to role='rider'
 * 2. Verifies the updates were successful
 * 3. Shows before/after statistics
 */

import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getStats() {
  try {
    const { data, error } = await supabase
      .from('ride_profiles')
      .select('role', { count: 'exact' })

    if (error) {
      console.error('Error getting stats:', error)
      return null
    }

    const stats = {
      total: data.length,
      rider: data.filter(p => p.role === 'rider').length,
      driver: data.filter(p => p.role === 'driver').length,
      other: data.filter(p => p.role !== 'rider' && p.role !== 'driver').length
    }

    return stats
  } catch (err) {
    console.error('Error getting stats:', err.message)
    return null
  }
}

async function fixProfiles() {
  try {
    // Get before stats
    console.log('📊 Getting current statistics...')
    const beforeStats = await getStats()

    if (!beforeStats) {
      console.error('Failed to get statistics')
      process.exit(1)
    }

    console.log('\n📈 Before Fix:')
    console.log(`   Total profiles: ${beforeStats.total}`)
    console.log(`   Rider profiles: ${beforeStats.rider}`)
    console.log(`   Driver profiles: ${beforeStats.driver}`)
    console.log(`   Other/Unknown roles: ${beforeStats.other}`)

    if (beforeStats.driver === 0 && beforeStats.other === 0) {
      console.log('\n✅ All profiles already have role="rider". No fixes needed!')
      return
    }

    // Ask for confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      rl.question('\n⚠️  This will update all non-rider profiles to rider. Continue? (yes/no): ', async (answer) => {
        rl.close()

        if (answer.toLowerCase() !== 'yes') {
          console.log('Aborted.')
          resolve()
          return
        }

        try {
          console.log('\n🔧 Updating profiles...')

          // Update all profiles to role='rider'
          const { error } = await supabase
            .from('ride_profiles')
            .update({ role: 'rider', updated_at: new Date().toISOString() })
            .neq('role', 'rider')

          if (error) {
            console.error('❌ Error updating profiles:', error)
            resolve()
            return
          }

          // Get after stats
          console.log('📊 Getting updated statistics...')
          const afterStats = await getStats()

          if (afterStats) {
            console.log('\n📈 After Fix:')
            console.log(`   Total profiles: ${afterStats.total}`)
            console.log(`   Rider profiles: ${afterStats.rider}`)
            console.log(`   Driver profiles: ${afterStats.driver}`)
            console.log(`   Other/Unknown roles: ${afterStats.other}`)

            if (afterStats.driver === 0 && afterStats.other === 0) {
              console.log('\n✅ Success! All profiles now have role="rider"')
            }
          }

          resolve()
        } catch (err) {
          console.error('❌ Error:', err.message)
          resolve()
        }
      })
    })
  } catch (err) {
    console.error('Fatal error:', err.message)
    process.exit(1)
  }
}

async function main() {
  console.log('🚀 Ride Profiles Default Role Fixer')
  console.log('====================================\n')

  await fixProfiles()

  console.log('\n✨ Done!')
  process.exit(0)
}

main()
