import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// TripAdvisor attraction IDs for Manila attractions (manually mapped)
const ATTRACTION_MAPPINGS = {
  'Intramuros': {
    id: '548076',
    locationId: '298573'
  },
  'Manila Cathedral': {
    id: '1185653',
    locationId: '298573'
  },
  'Rizal Park (Luneta Park)': {
    id: '543849',
    locationId: '298573'
  },
  'National Museum of Fine Arts': {
    id: '1187471',
    locationId: '298573'
  },
  'San Agustin Church': {
    id: '549048',
    locationId: '298573'
  },
  'Fort Santiago': {
    id: '553063',
    locationId: '298573'
  },
  'Minor Basilica of the Black Nazarene (Quiapo Church)': {
    id: '549047',
    locationId: '298573'
  },
  'Casa Manila': {
    id: '551389',
    locationId: '298573'
  },
  'Chinese Cemetery of Manila': {
    id: '1087821',
    locationId: '298573'
  },
  'Marikina Shoe Museum': {
    id: '2204932',
    locationId: '298573'
  },
  'National Library of the Philippines': {
    id: '1187480',
    locationId: '298573'
  },
  'Manila Planetarium': {
    id: '1185829',
    locationId: '298573'
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapeAttraction(page, attractionName, mapping) {
  try {
    console.log(`\nScraping ${attractionName}...`)

    const url = `https://www.tripadvisor.com.ph/Attraction_Review-g${mapping.locationId}-d${mapping.id}-Reviews.html`
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(1000)

    // Extract photos
    console.log('  Extracting photos...')
    const photos = await page.evaluate(() => {
      const photoLinks = []
      const photoElements = document.querySelectorAll('img[src*="tripadvisor.com"]')
      
      photoElements.forEach((img) => {
        const src = img.src || img.getAttribute('data-src')
        if (src && src.includes('photo')) {
          const photoUrl = src.replace(/\?.*/, '?w=1400&h=500&s=1')
          if (!photoLinks.includes(photoUrl) && photoLinks.length < 20) {
            photoLinks.push(photoUrl)
          }
        }
      })
      
      return photoLinks
    })

    console.log(`    Found ${photos.length} photos`)

    // Extract reviews
    console.log('  Extracting reviews...')
    const reviews = []
    
    // Scroll and load more reviews
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight)
      })
      await sleep(500)
    }

    const pageReviews = await page.evaluate(() => {
      const reviewList = []
      const reviewElements = document.querySelectorAll('[class*="Review"] [data-testid="review-card"], .review-card, [class*="ReviewItem"]')
      
      let count = 0
      reviewElements.forEach((el) => {
        if (count >= 10) return

        try {
          const authorEl = el.querySelector('[class*="reviewer"], .review__author, [data-testid="review-author"]')
          const ratingEl = el.querySelector('[class*="rating"], .rating, [aria-label*="of 5"]')
          const textEl = el.querySelector('[class*="review__text"], .review__body, [data-testid="review-text"]')
          const dateEl = el.querySelector('[class*="review-date"], .review__date, [data-testid="review-date"]')

          const author = authorEl?.textContent?.trim() || 'Anonymous'
          const ratingText = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || '4'
          const rating = parseInt(ratingText.match(/\d/)?.[0]) || 4
          const text = textEl?.textContent?.trim() || ''
          const dateStr = dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0]

          if (text && text.length > 10) {
            reviewList.push({
              author,
              rating: Math.min(5, Math.max(1, rating)),
              text: text.substring(0, 500),
              date: dateStr
            })
            count++
          }
        } catch (err) {
          // Skip invalid reviews
        }
      })

      return reviewList
    })

    reviews.push(...pageReviews)
    console.log(`    Found ${reviews.length} reviews`)

    return {
      photos: photos.slice(0, 15),
      reviews: reviews.slice(0, 10)
    }
  } catch (err) {
    console.error(`  Error scraping ${attractionName}:`, err.message)
    return {
      photos: [],
      reviews: []
    }
  }
}

async function main() {
  let browser
  try {
    console.log('Starting TripAdvisor scraper for Manila attractions...')
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 800 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

    // Read the current listings file
    const listingsPath = path.join(__dirname, '../src/data/manila-listings.ts')
    let fileContent = fs.readFileSync(listingsPath, 'utf-8')

    const scrapedData = {}

    // Scrape each attraction
    for (const [name, mapping] of Object.entries(ATTRACTION_MAPPINGS)) {
      const data = await scrapeAttraction(page, name, mapping)
      scrapedData[name] = data
      await sleep(2000) // Rate limiting
    }

    // Update the listings file with scraped data
    console.log('\n\nUpdating listings file with scraped data...')
    
    let updatedContent = fileContent
    for (const [name, data] of Object.entries(scrapedData)) {
      if (data.photos.length === 0 && data.reviews.length === 0) {
        console.log(`  Skipping ${name} - no data scraped`)
        continue
      }

      // Build images array JSON
      const imagesArray = data.photos.length > 0 
        ? `[\n      "${data.photos.join('",\n      "')}" \n    ]`
        : '[]'

      // Build reviews array JSON
      const reviewsArray = data.reviews.map(r => `{
        author: "${r.author.replace(/"/g, '\\"')}",
        rating: ${r.rating},
        text: "${r.text.replace(/"/g, '\\"')}",
        date: "${r.date}"
      }`).join(',\n      ')

      // Find and replace the reviews section for this listing
      const reviewsRegex = new RegExp(
        `(reviews: \\[([\\s\\S]*?)\\])(?=\\s*}\\s*(?:,|\\]))`,
        'g'
      )

      // More targeted approach: find by listing name
      const nameRegex = new RegExp(
        `name: "${name}",[\\s\\S]*?reviews: \\[(.*?)\\]`,
        'g'
      )

      // Update with new reviews
      updatedContent = updatedContent.replace(
        nameRegex,
        (match, oldReviews) => {
          return match.substring(0, match.lastIndexOf('[')) + '[' + reviewsArray + ']'
        }
      )

      console.log(`  ✓ Updated ${name} with ${data.photos.length} photos and ${data.reviews.length} reviews`)
    }

    fs.writeFileSync(listingsPath, updatedContent, 'utf-8')
    console.log('\n✓ Successfully updated manila-listings.ts')

  } catch (err) {
    console.error('Scraper failed:', err)
    process.exit(1)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

main()
