import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// TripAdvisor URLs for attractions - these are the exact pages to scrape
const ATTRACTIONS = [
  {
    name: 'Intramuros',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d548076-Reviews-Intramuros-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Manila Cathedral',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1185653-Reviews-Manila_Cathedral-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Rizal Park (Luneta Park)',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d543849-Reviews-Rizal_Park_Luneta_Park-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'National Museum of Fine Arts',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1187471-Reviews-National_Museum_of_the_Philippines-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'San Agustin Church',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d549048-Reviews-San_Agustin_Church-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Fort Santiago',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d553063-Reviews-Fort_Santiago-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Minor Basilica of the Black Nazarene (Quiapo Church)',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d549047-Reviews-Quiapo_Church-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Casa Manila',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d551389-Reviews-Casa_Manila-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Chinese Cemetery of Manila',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1087821-Reviews-Chinese_Cemetery_of_Manila-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Marikina Shoe Museum',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d2204932-Reviews-Marikina_Shoe_Museum-Marikina_Metro_Manila_Calabarzon_Calabarzon_Region_Luzon.html'
  },
  {
    name: 'National Library of the Philippines',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1187480-Reviews-National_Library_of_the_Philippines-Manila_Metro_Manila_Luzon.html'
  },
  {
    name: 'Manila Planetarium',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1185829-Reviews-Manila_Planetarium-Manila_Metro_Manila_Luzon.html'
  }
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapeAttractionPage(page, attractionName, url) {
  try {
    console.log(`\nScraping ${attractionName}...`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    // Scroll to trigger lazy loading
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight))
      await sleep(500)
    }

    // Extract data
    const data = await page.evaluate(() => {
      const photoUrls = new Set()
      const reviews = []

      // Get unique photo URLs from all image elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || ''
        if (src.includes('tripadvisor.com') && src.includes('/media/')) {
          const cleanUrl = src.split('?')[0]
          if (cleanUrl && !cleanUrl.includes('/profile_s/')) {
            photoUrls.add(cleanUrl)
          }
        }
      })

      // Get reviews from the page
      const reviewElements = document.querySelectorAll('[data-testid="review-card"], .review-card, [class*="Review"][class*="Card"]')
      
      reviewElements.forEach((element, idx) => {
        if (reviews.length >= 15) return

        try {
          // Try multiple selectors for author
          let author = 'Anonymous'
          let authorElem = element.querySelector('[data-testid="review-title"], .reviewer-name, [class*="author"]')
          if (authorElem) {
            author = authorElem.textContent.trim().split('\n')[0]
          } else {
            const allText = element.textContent
            const match = allText.match(/^(\w+\s+\w+\.?)/m)
            if (match) author = match[1]
          }

          // Get rating
          let rating = 4
          const ratingElem = element.querySelector('[class*="Rating"], [role="img"]')
          if (ratingElem) {
            const ariaLabel = ratingElem.getAttribute('aria-label') || ratingElem.title
            const ratingMatch = ariaLabel?.match(/(\d)/)
            if (ratingMatch) rating = parseInt(ratingMatch[1])
          }

          // Get review text
          let text = ''
          const textElem = element.querySelector('[data-testid="review-text"], .review-text, [class*="review__text"]')
          if (textElem) {
            text = textElem.textContent.trim()
          }

          // Get date
          let date = new Date().toISOString().split('T')[0]
          const dateElem = element.querySelector('[class*="review-date"], time, [data-testid="review-date"]')
          if (dateElem) {
            const dateText = dateElem.textContent.trim()
            if (dateText) date = dateText
          }

          if (text && text.length > 15) {
            reviews.push({
              author: author.substring(0, 50),
              rating: Math.min(5, Math.max(1, rating)),
              text: text.substring(0, 500),
              date: date
            })
          }
        } catch (err) {
          // Skip problematic reviews
        }
      })

      return {
        photos: Array.from(photoUrls).slice(0, 20),
        reviews: reviews.slice(0, 15)
      }
    })

    console.log(`  ✓ Found ${data.photos.length} photos and ${data.reviews.length} reviews`)
    return data
  } catch (err) {
    console.error(`  ✗ Error scraping ${attractionName}:`, err.message)
    return { photos: [], reviews: [] }
  }
}

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function buildReviewsCode(reviews) {
  return reviews.map(r => `{
        author: "${escapeString(r.author)}",
        rating: ${r.rating},
        text: "${escapeString(r.text)}",
        date: "${r.date}"
      }`).join(',\n      ')
}

function buildImagesCode(photos) {
  if (photos.length === 0) return '[]'
  return `[\n      "${photos.join('",\n      "')}"\n    ]`
}

async function updateListingsFile(scrapedDataMap) {
  try {
    const listingsPath = path.join(__dirname, '../src/data/manila-listings.ts')
    let content = fs.readFileSync(listingsPath, 'utf-8')

    // Update each attraction's data
    for (const [name, data] of Object.entries(scrapedDataMap)) {
      if (data.reviews.length === 0 && data.photos.length === 0) {
        console.log(`  Skipping ${name} - no data scraped`)
        continue
      }

      // Find the listing block for this attraction
      const listingRegex = new RegExp(
        `\\{\\s*id:\\s*"[^"]*",\\s*name:\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*?reviews:\\s*\\[([\\s\\S]*?)\\]\\s*\\}`,
        'g'
      )

      const match = content.match(listingRegex)
      if (!match) {
        console.log(`  ⚠ Could not find listing for ${name}`)
        continue
      }

      // Replace the reviews array
      const oldReviewsMatch = match[0].match(/reviews:\s*\[([\s\S]*?)\]/)
      if (oldReviewsMatch) {
        const newReviewsCode = buildReviewsCode(data.reviews)
        const updated = match[0].replace(
          /reviews:\s*\[[\s\S]*?\]/,
          `reviews: [\n      ${newReviewsCode}\n    ]`
        )
        content = content.replace(match[0], updated)
        console.log(`  ✓ Updated ${name} - ${data.reviews.length} reviews, ${data.photos.length} photos`)
      }
    }

    fs.writeFileSync(listingsPath, content, 'utf-8')
    console.log('\n✓ Successfully updated src/data/manila-listings.ts')
  } catch (err) {
    console.error('Failed to update listings file:', err.message)
    throw err
  }
}

async function main() {
  let browser
  try {
    console.log('Starting TripAdvisor data scraper for Manila attractions...\n')

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 800 })
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    )

    // Scrape all attractions
    const scrapedData = {}
    for (const attraction of ATTRACTIONS) {
      const data = await scrapeAttractionPage(page, attraction.name, attraction.url)
      scrapedData[attraction.name] = data
      await sleep(2500) // Rate limiting between requests
    }

    // Update the listings file
    console.log('\nUpdating listings file...')
    await updateListingsFile(scrapedData)

    console.log('\n✓ Scraping completed successfully!')
  } catch (err) {
    console.error('\n✗ Scraper failed:', err)
    process.exit(1)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

main()
