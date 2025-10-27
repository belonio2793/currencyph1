import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function checkImages() {
  try {
    console.log('📊 Checking image coverage...\n')

    // Check image_url
    const { count: hasImageUrl } = await supabase
      .from('nearby_listings')
      .select('*', { count: 'exact', head: true })
      .not('image_url', 'is', null)

    // Check image_urls array
    const { data: withImageUrls } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact' })
      .gt('image_urls', 'null')

    // Check photo_urls array
    const { data: withPhotoUrls } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact' })
      .gt('photo_urls', 'null')

    // Check stored_image_path
    const { count: hasStoredPath } = await supabase
      .from('nearby_listings')
      .select('*', { count: 'exact', head: true })
      .not('stored_image_path', 'is', null)

    // Total
    const { count: total } = await supabase
      .from('nearby_listings')
      .select('*', { count: 'exact', head: true })

    console.log(`Total listings: ${total}`)
    console.log(`Has image_url: ${hasImageUrl}`)
    console.log(`Has photo_urls array: ${withPhotoUrls?.length || 0}`)
    console.log(`Has image_urls array: ${withImageUrls?.length || 0}`)
    console.log(`Has stored_image_path: ${hasStoredPath}`)

    // Sample listings with no images
    const { data: noImages } = await supabase
      .from('nearby_listings')
      .select('id, name, image_url, image_urls, photo_urls, stored_image_path')
      .is('image_url', null)
      .limit(5)

    if (noImages && noImages.length > 0) {
      console.log(`\n⚠️  Sample listings without images (first 5):`)
      noImages.forEach((l, i) => {
        console.log(`${i + 1}. ${l.name}`)
        console.log(`   image_url: ${l.image_url}`)
        console.log(`   image_urls: ${l.image_urls?.length || 0} items`)
        console.log(`   photo_urls: ${l.photo_urls?.length || 0} items`)
      })
    }

  } catch (err) {
    console.error('Error:', err)
  }
}

checkImages()
