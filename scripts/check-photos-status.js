#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkStatus() {
  const { count: total } = await supabase.from('nearby_listings').select('id', { count: 'exact', head: true })
  
  const { data: withPhotos } = await supabase
    .from('nearby_listings')
    .select('id', { count: 'exact', head: false })
    .not('photo_urls', 'is', null)
    .not('photo_urls', 'eq', '{}')
  
  const { count: photoCount } = await supabase
    .from('nearby_listings')
    .select('id', { count: 'exact', head: false })
    .not('photo_urls', 'is', null)
    .not('photo_urls', 'eq', '{}')

  const withPhotosCount = withPhotos?.length || 0
  const remaining = total - withPhotosCount

  console.log(`\n📸 Photo Population Status`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Total listings:     ${total}`)
  console.log(`With photos:        ${withPhotosCount} ✓`)
  console.log(`Without photos:     ${remaining}`)
  console.log(`Progress:           ${Math.round((withPhotosCount/total)*100)}%`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
}

checkStatus().catch(console.error)
