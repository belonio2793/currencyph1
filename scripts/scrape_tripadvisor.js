import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer'

const PROJECT_URL = process.env.PROJECT_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PROJECT_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

const cities = [
  'Manila',
  'Cebu',
  'Davao',
  'Baguio',
  'Iloilo',
  'Bacolod',
  'Cagayan de Oro',
  'Zamboanga',
  'Boracay',
  'Puerto Princesa',
  'El Nido',
  'Tagbilaran',
  'General Luna',
  'Olongapo',
  'San Juan La Union',
  'Vigan',
  'Legazpi',
  'Tagaytay',
  'Bohol',
  'Coron'
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapeCity(page, city) {
  try {
    console.log(`\nScraping ${city}...`)
    
    const searchUrl = `https://www.tripadvisor.com.ph/Search?q=${encodeURIComponent(city + ' Philippines')}`
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    
    // Wait for search results to load
    await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 10000 }).catch(() => {
      console.log(`No search results found with selector for ${city}`)
    })
    
    // Scroll to load more results
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 3)
    })
    await sleep(1000)
    
    // Extract listings
    const listings = await page.evaluate(() => {
      const items = []
      const elements = document.querySelectorAll('[data-testid="search-result-item"]')
      
      elements.forEach((el, idx) => {
        if (idx >= 10) return // Get only top 10
        
        try {
          const nameEl = el.querySelector('h3, [class*="name"], span[class*="title"]')
          const ratingEl = el.querySelector('[class*="rating"], [aria-label*="rating"]')
          const addressEl = el.querySelector('[class*="address"], [class*="location"]')
          
          const name = nameEl?.textContent?.trim()
          const ratingText = ratingEl?.textContent?.trim()
          const rating = ratingText ? parseFloat(ratingText.split(' ')[0]) : null
          const address = addressEl?.textContent?.trim()
          
          if (name) {
            items.push({
              name,
              rating,
              address,
              category: null
            })
          }
        } catch (err) {
          console.error('Error parsing element:', err.message)
        }
      })
      
      return items
    })
    
    return listings
  } catch (err) {
    console.error(`Error scraping ${city}:`, err.message)
    return []
  }
}

async function upsertBatch(rows) {
  if (!rows || rows.length === 0) return 0
  
  const chunkSize = 100
  let upsertedCount = 0
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('nearby_listings').upsert(chunk, { onConflict: 'tripadvisor_id' })
    
    if (error) {
      console.error('Upsert error:', error)
    } else {
      console.log(`  ✓ Upserted ${chunk.length} rows`)
      upsertedCount += chunk.length
    }
    
    await sleep(300)
  }
  
  return upsertedCount
}

async function main() {
  let browser
  try {
    console.log('Starting TripAdvisor scraper...')
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 800 })
    
    const allListings = []
    
    for (const city of cities) {
      const listings = await scrapeCity(page, city)
      
      const listingsWithId = listings.map((l, idx) => ({
        tripadvisor_id: `${city.toLowerCase().replace(/\s+/g, '-')}-${idx}-${Date.now()}`,
        name: l.name,
        address: l.address || null,
        latitude: null,
        longitude: null,
        rating: l.rating,
        category: l.category,
        raw: { city, source: 'tripadvisor_scrape' }
      }))
      
      console.log(`  Found ${listings.length} listings in ${city}`)
      allListings.push(...listingsWithId)
      
      await sleep(2000)
    }
    
    console.log(`\nTotal listings collected: ${allListings.length}`)
    
    if (allListings.length > 0) {
      console.log('Upserting to database...')
      const upserted = await upsertBatch(allListings)
      console.log(`✓ Successfully upserted ${upserted} listings`)
    }
    
  } catch (err) {
    console.error('Scraper failed:', err)
    process.exit(2)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

main()
