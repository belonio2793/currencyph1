import { createClient } from '@supabase/supabase-js'
import process from 'process'

const supabase = createClient(
  process.env.VITE_PROJECT_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkPhotoUrls() {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id, name, slug, photo_urls, photo_count')
    .eq('slug', 'luxury-resort-cebu-71')
    .single()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Listing found:')
  console.log('- Name:', data.name)
  console.log('- Slug:', data.slug)
  console.log('- photo_count:', data.photo_count)
  console.log('- photo_urls type:', typeof data.photo_urls)
  console.log('- photo_urls is array?:', Array.isArray(data.photo_urls))
  console.log('- photo_urls value:', data.photo_urls)
  
  if (data.photo_urls) {
    if (typeof data.photo_urls === 'string') {
      console.log('- photo_urls is a STRING, length:', data.photo_urls.length)
      console.log('- First 200 chars:', data.photo_urls.substring(0, 200))
    } else if (Array.isArray(data.photo_urls)) {
      console.log('- photo_urls is an ARRAY, length:', data.photo_urls.length)
      console.log('- First URL:', data.photo_urls[0])
    }
  }
}

checkPhotoUrls()
