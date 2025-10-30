#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or service role key. Set VITE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function getMatchingIds(limit = 1000, offset = 0) {
  // condition: latitude IS NULL OR longitude IS NULL OR website IS NULL OR phone_number IS NULL
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id')
    .or('latitude.is.null,longitude.is.null,website.is.null,phone_number.is.null')
    .range(offset, offset + limit - 1)

  if (error) throw error
  return (data || []).map(r => r.id)
}

async function deleteBatch(ids) {
  if (!ids || ids.length === 0) return { count:0 }
  const { data, error } = await supabase
    .from('nearby_listings')
    .delete()
    .in('id', ids)

  if (error) throw error
  return { count: data?.length || 0 }
}

async function main() {
  console.log('Starting deletion of nearby_listings missing lat/lon or website or phone_number')
  let offset = 0
  const page = 500
  let totalDeleted = 0
  while (true) {
    const ids = await getMatchingIds(page, offset)
    if (!ids || ids.length === 0) break
    console.log(`Fetched ${ids.length} candidate ids (offset ${offset})`)
    try {
      const res = await deleteBatch(ids)
      totalDeleted += res.count
      console.log(`Deleted ${res.count} rows in this batch. Total deleted: ${totalDeleted}`)
    } catch (err) {
      console.error('Error deleting batch:', err)
      break
    }
    // don't increment offset because after deletion next items shift; continue fetching from offset 0
    await new Promise(r => setTimeout(r, 200))
  }

  // Final check: fetch any remaining matched count
  const { data: remaining } = await supabase
    .from('nearby_listings')
    .select('id', { count: 'exact' })
    .or('latitude.is.null,longitude.is.null,website.is.null,phone_number.is.null')
    .limit(1)

  const remainingCount = remaining?.length === 0 ? 0 : remaining?._count || 0

  console.log('Deletion complete. Total deleted:', totalDeleted)
  console.log('Remaining matching rows (approx):', remainingCount)
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
