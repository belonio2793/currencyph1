import { createClient } from '@supabase/supabase-js'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(PROJECT_URL, ANON_KEY)

async function checkSchema() {
  try {
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error:', error)
      return
    }

    if (data && data.length > 0) {
      const listing = data[0]
      console.log('\n📊 Sample Listing Fields:')
      console.log('━'.repeat(50))
      
      const imageFields = [
        'image_url',
        'image_urls', 
        'primary_image_url',
        'featured_image_url',
        'photo_urls',
        'stored_image_path',
        'image_downloaded_at'
      ]

      imageFields.forEach(field => {
        const value = listing[field]
        if (value) {
          console.log(`✓ ${field}:`, Array.isArray(value) ? `[${value.length} items]` : value?.substring(0, 60) + '...')
        } else {
          console.log(`⊘ ${field}: null/undefined`)
        }
      })

      console.log('\n📝 All available fields:')
      Object.keys(listing).forEach(key => {
        console.log(`  - ${key}`)
      })
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

checkSchema()
