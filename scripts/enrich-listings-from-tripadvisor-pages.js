import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

let stats = {
  total: 0,
  enriched: 0,
  failed: 0,
  skipped: 0
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-');
}

async function fetchTripAdvisorPage(url) {
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      timeout: 10000
    });

    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.warn(`  ⚠️  Fetch failed: ${error.message?.substring(0, 60)}`);
    return null;
  }
}

function extractFromHTML(html, listing) {
  if (!html) return listing;

  const $ = cheerio.load(html);
  const enriched = { ...listing };

  try {
    // Extract rating
    const ratingText = $('[data-test="rating"]').first().text() || 
                       $('span[class*="Rating"]').first().text();
    if (ratingText) {
      const ratingMatch = ratingText.match(/([\d.]+)/);
      if (ratingMatch) {
        enriched.rating = parseFloat(ratingMatch[1]);
      }
    }

    // Extract review count
    const reviewText = $('[data-test="review_count"]').first().text() || 
                       $('span[class*="review"]').text();
    if (reviewText) {
      const reviewMatch = reviewText.match(/(\d+)\s*review/i);
      if (reviewMatch) {
        enriched.review_count = parseInt(reviewMatch[1]);
      }
    }

    // Extract address
    const addressText = $('[data-test="address"], [class*="address"]').first().text();
    if (addressText) {
      enriched.address = addressText.trim();
    }

    // Extract phone
    const phoneText = $('[data-test="phone"], [class*="phone"]').first().text();
    if (phoneText) {
      const phoneMatch = phoneText.match(/[\d\s\-\+\(\)]+/);
      if (phoneMatch) {
        enriched.phone_number = phoneMatch[0].trim();
      }
    }

    // Extract website
    const websiteLink = $('a[href*="www"], a[href*="http"]').not('[href*="tripadvisor"]').first();
    if (websiteLink && websiteLink.attr('href')) {
      const href = websiteLink.attr('href');
      if (href && href.includes('http')) {
        enriched.website = href;
      }
    }

    // Extract hours (look for operating hours section)
    const hoursSection = $('[data-test="hours"]').html() || 
                        $('section:contains("Hours")').html() || 
                        $('[class*="hours"]').html();
    if (hoursSection) {
      const hours = {};
      const dayMatch = hoursSection.matchAll(/([A-Z][a-z]+)[:\s]*([0-9:APM\s\-]*)/gi);
      for (const match of dayMatch) {
        hours[match[1]] = match[2]?.trim() || 'Call for hours';
      }
      if (Object.keys(hours).length > 0) {
        enriched.hours_of_operation = hours;
      }
    }

    // Extract description (from About section)
    const descText = $('[data-test="about"], [class*="description"]').first().text();
    if (descText && descText.length > 20) {
      enriched.description = descText.substring(0, 1000);
    }

    // Extract price level
    const priceText = $('[data-test="price_level"], [class*="price"]').first().text();
    if (priceText) {
      const dollarCount = (priceText.match(/\$/g) || []).length;
      if (dollarCount > 0) {
        enriched.price_level = Math.min(dollarCount, 4);
        enriched.price_range = '$'.repeat(enriched.price_level);
      }
    }

    // Extract highlights
    const highlights = [];
    $('[class*="highlight"]').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && highlights.length < 10) {
        highlights.push(text);
      }
    });
    if (highlights.length > 0) {
      enriched.highlights = highlights;
    }

    // Extract amenities
    const amenities = [];
    $('[class*="amenity"], [class*="feature"]').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && amenities.length < 15) {
        amenities.push({ name: text, available: true });
      }
    });
    if (amenities.length > 0) {
      enriched.amenities = amenities;
    }

    // Extract photo URLs
    const photoUrls = [];
    $('img[class*="photo"], img[src*="tacdn"], img[src*="media"]').each((i, elem) => {
      if (i < 20) {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src && src.includes('http')) {
          photoUrls.push(src);
        }
      }
    });
    if (photoUrls.length > 0) {
      enriched.photo_urls = photoUrls;
      enriched.photo_count = photoUrls.length;
      if (!enriched.image_url && photoUrls[0]) {
        enriched.image_url = photoUrls[0];
      }
    }

    // Extract rankings
    const rankingText = $('[class*="ranking"]').text();
    if (rankingText) {
      enriched.ranking_in_city = rankingText.trim();
    }

    enriched.verified = true;
    enriched.last_verified_at = new Date().toISOString();

  } catch (error) {
    console.warn(`  ⚠️  HTML parsing error: ${error.message?.substring(0, 60)}`);
  }

  return enriched;
}

async function enrichListing(listing) {
  try {
    if (!listing.web_url) {
      stats.skipped++;
      return false;
    }

    console.log(`  Fetching: ${listing.name} (${listing.city})`);

    const html = await fetchTripAdvisorPage(listing.web_url);
    if (!html) {
      stats.failed++;
      return false;
    }

    let enriched = extractFromHTML(html, listing);

    // Generate slug if not present
    if (!enriched.slug) {
      enriched.slug = `${slugify(enriched.name)}-${enriched.city ? slugify(enriched.city) : 'ph'}`;
    }

    // Update fetch status
    enriched.fetch_status = 'success';
    enriched.updated_at = new Date().toISOString();

    // Upsert to database
    const { error } = await supabase
      .from('nearby_listings')
      .update(enriched)
      .eq('tripadvisor_id', listing.tripadvisor_id);

    if (error) {
      console.warn(`    ✗ Update failed: ${error.message}`);
      stats.failed++;
      return false;
    }

    console.log(`    ✓ Enriched successfully`);
    stats.enriched++;
    return true;

  } catch (error) {
    console.warn(`    ✗ Error: ${error.message}`);
    stats.failed++;
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔗 ENRICH NEARBY_LISTINGS FROM TRIPADVISOR PAGES');
  console.log('='.repeat(70));

  // Get listings with pending fetch status
  console.log('\n📥 Fetching listings to enrich...');
  const { data: listings, error } = await supabase
    .from('nearby_listings')
    .select('*')
    .eq('fetch_status', 'pending')
    .is('verified', null)
    .limit(100)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching listings:', error);
    process.exit(1);
  }

  if (!listings || listings.length === 0) {
    console.log('✓ No listings to enrich');
    process.exit(0);
  }

  console.log(`Found ${listings.length} listings to enrich\n`);
  stats.total = listings.length;

  const startTime = Date.now();

  for (const listing of listings) {
    await enrichListing(listing);
    await sleep(2000); // Rate limiting
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('📈 SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total Processed: ${stats.total}`);
  console.log(`  Enriched: ${stats.enriched}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Duration: ${duration} minutes`);
  console.log('='.repeat(70));
  console.log('\n✅ Enrichment complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
