#!/usr/bin/env node
/*
  Cleanup script for nearby_listings:
  - Remove rows where both latitude and longitude are null
  - Remove rows where both phone_number and website are null
  - Replace the Unicode replacement character (�) from common text fields

  Requires environment variables:
  - VITE_PROJECT_URL (or SUPABASE_URL)
  - SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)

  Usage: node scripts/cleanup_nearby.js
*/

import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or service role key. Set VITE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function deleteRows() {
  console.log('Deleting rows with both latitude and longitude NULL...')
  const { data: del1, error: err1 } = await supabase
    .from('nearby_listings')
    .delete()
    .is('latitude', null)
    .is('longitude', null)

  if (err1) {
    console.error('Error deleting lat/lon null rows:', err1)
  } else {
    console.log('Deleted rows (lat/lon null):', del1?.length || 0)
  }

  console.log('Deleting rows with both phone_number and website NULL...')
  const { data: del2, error: err2 } = await supabase
    .from('nearby_listings')
    .delete()
    .is('phone_number', null)
    .is('website', null)

  if (err2) {
    console.error('Error deleting phone/website null rows:', err2)
  } else {
    console.log('Deleted rows (phone & website null):', del2?.length || 0)
  }
}

async function cleanReplacementChar() {
  const REPL = '�'
  console.log('Searching rows containing replacement char (\uFFFD) in text fields...')

  // Build ilike filter for multiple columns
  const orFilter = [
    `name.ilike.%${REPL}%`,
    `address.ilike.%${REPL}%`,
    `description.ilike.%${REPL}%`,
    `email.ilike.%${REPL}%`,
    `phone_number.ilike.%${REPL}%`,
    `website.ilike.%${REPL}%`
  ].join(',')

  let page = 0
  const pageSize = 200
  let totalUpdated = 0

  while (true) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or(orFilter)
      .range(from, to)

    if (error) {
      console.error('Error fetching rows to clean:', error)
      break
    }

    if (!data || data.length === 0) break

    for (const row of data) {
      const updates = {}
      const fields = ['name','address','description','email','phone_number','website']
      let changed = false
      for (const f of fields) {
        const v = row[f]
        if (v && typeof v === 'string' && v.includes(REPL)) {
          updates[f] = v.split(REPL).join('')
          changed = true
        }
      }
      if (changed) {
        const { error: upErr } = await supabase
          .from('nearby_listings')
          .update(updates)
          .eq('id', row.id)

        if (upErr) console.error('Failed updating row id', row.id, upErr)
        else totalUpdated++
      }
    }

    // If less than pageSize returned, we're done
    if (data.length < pageSize) break
    page++
  }

  console.log('Total rows cleaned for replacement char:', totalUpdated)
}

async function main() {
  try {
    console.log('Starting cleanup script')
    await cleanReplacementChar()
    await deleteRows()
    console.log('Cleanup complete')
  } catch (err) {
    console.error('Unexpected error during cleanup:', err)
  }
}

main()
