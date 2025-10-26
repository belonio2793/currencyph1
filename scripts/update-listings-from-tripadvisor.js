import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ATTRACTIONS = [
  {
    searchName: 'Intramuros',
    dataName: 'Intramuros',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d548076-Reviews-Intramuros-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Manila Cathedral',
    dataName: 'Manila Cathedral',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1185653-Reviews-Manila_Cathedral-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Rizal Park',
    dataName: 'Rizal Park (Luneta Park)',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d543849-Reviews-Rizal_Park_Luneta_Park-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'National Museum',
    dataName: 'National Museum of Fine Arts',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1187471-Reviews-National_Museum_of_the_Philippines-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'San Agustin',
    dataName: 'San Agustin Church',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d549048-Reviews-San_Agustin_Church-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Fort Santiago',
    dataName: 'Fort Santiago',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d553063-Reviews-Fort_Santiago-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Quiapo Church',
    dataName: 'Minor Basilica of the Black Nazarene (Quiapo Church)',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d549047-Reviews-Quiapo_Church-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Casa Manila',
    dataName: 'Casa Manila',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d551389-Reviews-Casa_Manila-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Chinese Cemetery',
    dataName: 'Chinese Cemetery of Manila',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1087821-Reviews-Chinese_Cemetery_of_Manila-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Marikina Shoe',
    dataName: 'Marikina Shoe Museum',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d2204932-Reviews-Marikina_Shoe_Museum-Marikina_Metro_Manila_Calabarzon_Calabarzon_Region_Luzon.html'
  },
  {
    searchName: 'National Library',
    dataName: 'National Library of the Philippines',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1187480-Reviews-National_Library_of_the_Philippines-Manila_Metro_Manila_Luzon.html'
  },
  {
    searchName: 'Planetarium',
    dataName: 'Manila Planetarium',
    url: 'https://www.tripadvisor.com.ph/Attraction_Review-g298573-d1185829-Reviews-Manila_Planetarium-Manila_Metro_Manila_Luzon.html'
  }
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapeAttraction(page, name, url) {
  try {
    console.log(`\nFetching ${name}...`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight))
      await sleep(400)
    }

    const data = await page.evaluate(() => {
      const photos = []
      const reviews = []
      const photoSet = new Set()

      // Extract photos
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || ''
        if (src.includes('tripadvisor.com') && src.includes('/media/')) {
          const cleanUrl = src.replace(/\?.*/, '?w=600&h=400&s=1')
          photoSet.add(cleanUrl)
        }
      })
      photos.push(...Array.from(photoSet).slice(0, 20))

      // Extract reviews with better selectors
      const reviewDivs = document.querySelectorAll('[data-testid="review-card"]')
      reviewDivs.forEach((div, idx) => {
        if (reviews.length >= 12) return
        try {
          const author = div.querySelector('[data-testid="review-title"]')?.textContent?.trim() || 'Visitor'
          
          let rating = 4
          const ratingSpan = div.querySelector('[role="img"][aria-label]')
          if (ratingSpan) {
            const label = ratingSpan.getAttribute('aria-label')
            const match = label.match(/(\d)/)
            rating = match ? parseInt(match[1]) : 4
          }

          const reviewText = div.querySelector('[data-testid="review-text"]')?.textContent?.trim() || ''
          const dateSpan = div.querySelector('[data-testid="review-date"]')?.textContent?.trim() || new Date().toISOString().split('T')[0]

          if (reviewText.length > 20) {
            reviews.push({
              author: author.substring(0, 50),
              rating: Math.min(5, Math.max(1, rating)),
              text: reviewText.substring(0, 500),
              date: dateSpan.substring(0, 10)
            })
          }
        } catch (e) {
          // Skip
        }
      })

      return { photos, reviews }
    })

    console.log(`  ✓ ${data.photos.length} photos, ${data.reviews.length} reviews`)
    return data
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`)
    return { photos: [], reviews: [] }
  }
}

async function main() {
  let browser
  try {
    console.log('Starting TripAdvisor data fetch...\n')

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 800 })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

    // Read current listings
    const listingsPath = path.join(__dirname, '../src/data/manila-listings.ts')
    const content = fs.readFileSync(listingsPath, 'utf-8')

    // Parse to get current structure (keep everything as-is, only update reviews)
    let updatedContent = content

    for (const attr of ATTRACTIONS) {
      const scrapedData = await scrapeAttraction(page, attr.searchName, attr.url)

      if (scrapedData.reviews.length > 0) {
        // Find and replace the reviews section for this listing name
        const escapedName = attr.dataName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        
        // Build new reviews code
        const newReviewsCode = scrapedData.reviews.map(r => {
          const text = r.text.replace(/"/g, '\\"').replace(/\n/g, ' ')
          const author = r.author.replace(/"/g, '\\"')
          return `{
        author: "${author}",
        rating: ${r.rating},
        text: "${text}",
        date: "${r.date}"
      }`
        }).join(',\n      ')

        // Replace the reviews array for this listing
        const pattern = new RegExp(
          `(name: "${escapedName}",[\\s\\S]*?reviews: \\[)[\\s\\S]*?(\\])`,
          'g'
        )

        updatedContent = updatedContent.replace(
          pattern,
          `$1\n      ${newReviewsCode}\n    $2`
        )
      }

      await sleep(2000)
    }

    fs.writeFileSync(listingsPath, updatedContent, 'utf-8')
    console.log('\n✓ Updated manila-listings.ts successfully!')

  } catch (err) {
    console.error('\n✗ Error:', err.message)
    process.exit(1)
  } finally {
    if (browser) await browser.close()
  }
}

main()
