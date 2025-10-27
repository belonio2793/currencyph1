#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PHILIPPINE_CITIES = [
  'Manila', 'Cebu', 'Davao', 'Quezon-City', 'Makati',
  'Boracay', 'Palawan', 'El-Nido', 'Coron', 'Siargao',
  'Baguio', 'Iloilo', 'Bacolod', 'Puerto-Princesa', 'Dumaguete',
  'Vigan', 'Subic-Bay', 'Tagaytay', 'Taguig', 'Antipolo',
  'Cavite', 'Laguna', 'Pampanga', 'Clark-Freeport-Zone', 'Batangas',
  'Olongapo', 'Calapan', 'Romblon', 'Kalibo', 'Caticlan'
];

const CATEGORIES = ['attractions', 'hotels', 'restaurants'];
const BASE_URL = 'https://www.tripadvisor.com/Tourism-g';
const CITY_MAP = {
  'Manila': '298573',
  'Cebu': '298447',
  'Davao': '295426',
  'Quezon-City': '315645',
  'Makati': '315641',
  'Boracay': '296720',
  'Palawan': '298444',
  'El-Nido': '296721',
  'Coron': '296722',
  'Siargao': '296735',
  'Baguio': '295411',
  'Iloilo': '296898',
  'Bacolod': '298352',
  'Puerto-Princesa': '295421',
  'Dumaguete': '295436',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateSlug(name, id) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${String(id).slice(-4)}`.substring(0, 150);
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(`  ✗ Error fetching page: ${error.message}`);
    return null;
  }
}

async function scrapeListingsForCity(cityName, cityId, category) {
  try {
    const url = `https://www.tripadvisor.com/Tourism-g${cityId}-${category.charAt(0).toUpperCase() + category.slice(1)}-${cityName}.html`;
    
    console.log(`  📍 ${category} (${url.substring(0, 60)}...)`);
    
    const html = await fetchPage(url);
    if (!html) {
      console.log(`    ⚠️ Failed to fetch`);
      return [];
    }

    const $ = cheerio.load(html);
    const listings = [];

    // Parse listings from the page
    $('[data-test="result-card"]').each((index, element) => {
      try {
        const $card = $(element);
        
        const name = $card.find('[data-test="title"]').text().trim();
        const rating = parseFloat($card.find('[data-test="rating"]').text()) || null;
        const reviewCount = parseInt($card.find('[data-test="review-count"]').text().match(/\d+/)?.[0]) || 0;
        const address = $card.find('[data-test="address"]').text().trim();
        const link = $card.find('a').attr('href');

        if (name) {
          const listing = {
            tripadvisor_id: `ta_${cityId}_${category}_${index}`,
            name: name,
            slug: generateSlug(name, `${cityId}_${index}`),
            city: cityName.replace(/-/g, ' '),
            country: 'Philippines',
            category: category,
            location_type: category === 'attractions' ? 'Attraction' : category === 'hotels' ? 'Hotel' : 'Restaurant',
            rating: rating,
            review_count: reviewCount,
            address: address,
            web_url: link ? `https://www.tripadvisor.com${link}` : null,
            source: 'tripadvisor_web',
            verified: false,
            fetch_status: 'success',
            description: `${name} in ${cityName.replace(/-/g, ' ')}, Philippines. ${rating ? `Rated ${rating}/5 with ${reviewCount} reviews.` : 'Popular destination.'}`,
            highlights: [
              rating ? `Rated ${rating}/5` : null,
              reviewCount > 0 ? `${reviewCount} reviews` : null,
              'From TripAdvisor'
            ].filter(Boolean),
            raw: {
              city: cityName,
              category: category,
              scraped_at: new Date().toISOString()
            }
          };

          listings.push(listing);
        }
      } catch (err) {
        // Skip malformed entries
      }
    });

    if (listings.length > 0) {
      console.log(`    ✓ Found ${listings.length} listings`);
    } else {
      console.log(`    ℹ️ No listings found`);
    }

    return listings;
  } catch (error) {
    console.log(`    ✗ Error: ${error.message}`);
    return [];
  }
}

async function upsertListings(listings) {
  if (!listings || listings.length === 0) {
    return 0;
  }

  let count = 0;
  const batchSize = 20;

  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('nearby_listings')
        .upsert(batch, { onConflict: 'tripadvisor_id' });

      if (error) {
        console.error(`  ✗ Upsert error: ${error.message}`);
      } else {
        count += batch.length;
      }
    } catch (error) {
      console.error(`  ✗ Exception during upsert: ${error.message}`);
    }

    await sleep(100);
  }

  return count;
}

async function main() {
  console.log('\n🚀 TripAdvisor Philippines Web Scraper');
  console.log('======================================\n');

  let totalScraped = 0;
  let totalUpserted = 0;
  const startTime = Date.now();
  
  // Use cities we have IDs for first
  const citiesToProcess = Object.keys(CITY_MAP).length > 0 ? Object.keys(CITY_MAP) : PHILIPPINE_CITIES;

  for (let cityIndex = 0; cityIndex < citiesToProcess.length; cityIndex++) {
    const cityName = citiesToProcess[cityIndex];
    const cityId = CITY_MAP[cityName] || cityIndex;
    const progress = `[${cityIndex + 1}/${citiesToProcess.length}]`;

    console.log(`\n${progress} Scraping ${cityName.replace(/-/g, ' ')}...`);

    const cityListings = [];

    for (const category of CATEGORIES) {
      const listings = await scrapeListingsForCity(cityName, cityId, category);

      if (listings.length > 0) {
        cityListings.push(...listings);
      }

      await sleep(1000); // Rate limiting between requests
    }

    if (cityListings.length > 0) {
      console.log(`\n  💾 Saving ${cityListings.length} listings...`);
      const saved = await upsertListings(cityListings);
      totalScraped += cityListings.length;
      totalUpserted += saved;
      console.log(`  ✓ Saved ${saved}/${cityListings.length}`);
    }

    await sleep(2000); // Longer delay between cities
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n\n📊 Final Summary');
  console.log('================');
  console.log(`Cities Processed: ${citiesToProcess.length}`);
  console.log(`Total Scraped:    ${totalScraped}`);
  console.log(`Total Upserted:   ${totalUpserted}`);
  console.log(`Duration:         ${duration} minutes`);
  console.log(`Timestamp:        ${new Date().toISOString()}`);
  console.log('\n✅ Complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
