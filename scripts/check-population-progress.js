#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkProgress() {
  const { count: total } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: true })
  const { count: withCost } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: true }).neq('avg_cost', null)
  
  const remaining = total - withCost
  const percent = Math.round((withCost / total) * 100)
  
  console.log(`\n📊 Cost Population Progress`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Total listings:    ${total}`)
  console.log(`With costs:        ${withCost} ✓`)
  console.log(`Remaining:         ${remaining}`)
  console.log(`Progress:          ${percent}%`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

checkProgress().catch(console.error)
