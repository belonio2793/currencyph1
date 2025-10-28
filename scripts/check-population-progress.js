#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkProgress() {
  const { data: allCount } = await supabase.from('nearby_listings').select('id').limit(1)
  const { count: total } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: false })
  
  const { data: withCostData } = await supabase.from('nearby_listings').select('id').not('avg_cost', 'is', null).limit(1)
  const { count: withCost } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: false }).not('avg_cost', 'is', null)
  
  const remaining = total && withCost ? total - withCost : 0
  const percent = total && withCost ? Math.round((withCost / total) * 100) : 0
  
  console.log(`\n📊 Cost Population Progress`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Total listings:    ${total || 0}`)
  console.log(`With costs:        ${withCost || 0} ✓`)
  console.log(`Remaining:         ${remaining}`)
  console.log(`Progress:          ${percent}%`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

checkProgress().catch(console.error)
