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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

let stats = {
  total: 0,
  enriched: 0,
  failed: 0,
  skipped: 0,
  alreadyProcessed: 0
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(text) {
  if (!text) return '';
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
      timeout: 15000
    });

    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.warn(`  ⚠️  Fetch failed: ${error.message?.substring(0, 60)}`);
    return null;
  }
}

function extractJsonLd(html) {
  if (!html) return null;
  try {
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
  } catch (error) {
    return null;
  }
  return null;
}

function extractCoordinates(html) {
  if (!html) return { latitude: null, longitude: null };
  
  try {
    // Try to extract from various script tags
    const geoMatch = html.match(/"geo":\s*\{\s*"latitude":\s*([-\d.]+)[^}]*"longitude":\s*([-\d.]+)/);
    if (geoMatch) {
      return {
        latitude: parseFloat(geoMatch[1]),
        longitude: parseFloat(geoMatch[2])
      };
    }

    // Try map data
    const mapMatch = html.match(/{"lat":\s*([-\d.]+)[^}]*"lng":\s*([-\d.]+)/);
    if (mapMatch) {
      return {
        latitude: parseFloat(mapMatch[1]),
        longitude: parseFloat(mapMatch[2])
      };
    }
  } catch (error) {
    return { latitude: null, longitude: null };
  }

  return { latitude: null, longitude: null };
}

function extractFromHTML(html, listing) {
  if (!html) return listing;

  const $ = cheerio.load(html);
  const enriched = { ...listing };

  try {
    // Extract JSON-LD structured data first (most reliable)
    const jsonLd = extractJsonLd(html);
    if (jsonLd) {
      if (jsonLd.name) enriched.name = jsonLd.name;
      if (jsonLd.description) enriched.description = jsonLd.description.substring(0, 1000);
      if (jsonLd.address && jsonLd.address.streetAddress) {
        enriched.address = jsonLd.address.streetAddress;
      }
      if (jsonLd.telephone) enriched.phone_number = jsonLd.telephone;
      if (jsonLd.url) enriched.website = jsonLd.url;
      if (jsonLd.aggregateRating) {
        enriched.rating = parseFloat(jsonLd.aggregateRating.ratingValue);
        enriched.review_count = parseInt(jsonLd.aggregateRating.reviewCount);
      }
      if (jsonLd.image) {
        if (typeof jsonLd.image === 'string') {
          enriched.image_url = jsonLd.image;
        } else if (Array.isArray(jsonLd.image)) {
          enriched.image_url = jsonLd.image[0];
        }
      }
      if (jsonLd.priceRange) {
        enriched.price_level = jsonLd.priceRange.replace(/\$/g, '').length;
        enriched.price_range = jsonLd.priceRange;
      }
    }

    // Extract rating and review count from data attributes
    const ratingEl = $('[data-test="rating"]').first();
    if (ratingEl.length > 0) {
      const ratingText = ratingEl.text();
      const ratingMatch = ratingText.match(/([\d.]+)/);
      if (ratingMatch && !enriched.rating) {
        enriched.rating = parseFloat(ratingMatch[1]);
      }
    }

    // Extract review count
    const reviewEl = $('[data-test="review_count"]').first();
    if (reviewEl.length > 0) {
      const reviewText = reviewEl.text();
      const reviewMatch = reviewText.match(/(\d+)\s*review/i);
      if (reviewMatch && !enriched.review_count) {
        enriched.review_count = parseInt(reviewMatch[1]);
      }
    }

    // Extract address - try multiple selectors
    if (!enriched.address) {
      const addressEl = $('[data-test="address"]').first() ||
                       $('[class*="address"]').first() ||
                       $('span:contains("Address")').next();
      if (addressEl.length > 0) {
        enriched.address = addressEl.text().trim();
      }
    }

    // Extract phone - try multiple selectors
    if (!enriched.phone_number) {
      const phoneEl = $('[data-test="phone"]').first() ||
                     $('a[href^="tel:"]').first();
      if (phoneEl.length > 0) {
        let phoneText = phoneEl.text() || phoneEl.attr('href');
        if (phoneText) {
          const phoneMatch = phoneText.match(/[\d\s\-\+\(\)]+/);
          if (phoneMatch) {
            enriched.phone_number = phoneMatch[0].trim();
          }
        }
      }
    }

    // Extract website
    if (!enriched.website) {
      const websiteEl = $('a[href*="www"], a[href*="http"]').not('[href*="tripadvisor"]').first();
      if (websiteEl.length > 0) {
        const href = websiteEl.attr('href');
        if (href && href.includes('http')) {
          enriched.website = href;
        }
      }
    }

    // Extract operating hours
    if (!enriched.hours_of_operation) {
      const hours = {};
      const dayPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      dayPatterns.forEach(day => {
        const dayEl = $(`span:contains("${day}"), [data-test*="${day}"]`).first();
        if (dayEl.length > 0) {
          const timeText = dayEl.parent().text();
          const timeMatch = timeText.match(new RegExp(`${day}[\\s\\S]*?([0-9]{1,2}:[0-9]{2}[APap\\.m]*)[\\s\\S]*?([0-9]{1,2}:[0-9]{2}[APap\\.m]*)`));
          if (timeMatch) {
            hours[day] = `${timeMatch[1]} - ${timeMatch[2]}`;
          }
        }
      });

      if (Object.keys(hours).length > 0) {
        enriched.hours_of_operation = hours;
      }
    }

    // Extract description/about section
    if (!enriched.description || enriched.description.length < 50) {
      const descEl = $('[data-test="about"], [class*="description"]').first() ||
                    $('p[class*="detail"]').first();
      if (descEl.length > 0) {
        const descText = descEl.text().trim();
        if (descText && descText.length > 20) {
          enriched.description = descText.substring(0, 1000);
        }
      }
    }

    // Extract price level from visual indicators
    if (!enriched.price_level) {
      const priceEl = $('[class*="price"], [data-test*="price"]').first();
      if (priceEl.length > 0) {
        const priceText = priceEl.text();
        const dollarCount = (priceText.match(/\$/g) || []).length;
        if (dollarCount > 0) {
          enriched.price_level = Math.min(dollarCount, 4);
          enriched.price_range = '$'.repeat(enriched.price_level);
        }
      }
    }

    // Extract highlights/features
    if (!enriched.highlights) {
      const highlights = [];
      $('[class*="highlight"], [class*="feature"]').each((i, elem) => {
        if (highlights.length < 10) {
          const text = $(elem).text().trim();
          if (text && text.length > 2 && text.length < 100) {
            highlights.push(text);
          }
        }
      });
      if (highlights.length > 0) {
        enriched.highlights = highlights;
      }
    }

    // Extract amenities/facilities
    if (!enriched.amenities) {
      const amenities = [];
      $('[class*="amenity"], [class*="facility"], [data-test*="amenity"]').each((i, elem) => {
        if (amenities.length < 20) {
          const text = $(elem).text().trim();
          if (text && text.length > 2 && text.length < 100) {
            amenities.push({ name: text, available: true });
          }
        }
      });
      if (amenities.length > 0) {
        enriched.amenities = amenities;
      }
    }

    // Extract photo URLs with better filtering
    if (!enriched.photo_urls || enriched.photo_urls.length === 0) {
      const photoUrls = [];
      
      // Try multiple image selectors
      $('img[class*="photo"], img[src*="tacdn"], img[src*="media"], img[src*="tripadvisor"]').each((i, elem) => {
        if (photoUrls.length < 25) {
          let src = $(elem).attr('src') || $(elem).attr('data-src') || $(elem).attr('data-lazy-src');
          if (src && src.includes('http') && (src.includes('tacdn') || src.includes('tripadvisor') || src.includes('media'))) {
            // Remove query parameters and duplicates
            src = src.split('?')[0];
            if (!photoUrls.includes(src) && src.length > 10) {
              photoUrls.push(src);
            }
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
    }

    // Extract coordinates from various sources
    const coords = extractCoordinates(html);
    if (coords.latitude && !enriched.latitude) {
      enriched.latitude = coords.latitude;
      enriched.lat = coords.latitude;
    }
    if (coords.longitude && !enriched.longitude) {
      enriched.longitude = coords.longitude;
      enriched.lng = coords.longitude;
    }

    // Extract ranking information
    if (!enriched.ranking_in_city) {
      const rankEl = $('[class*="ranking"], [data-test*="ranking"]').first();
      if (rankEl.length > 0) {
        enriched.ranking_in_city = rankEl.text().trim();
      }
    }

    // Generate slug if not present
    if (!enriched.slug) {
      enriched.slug = `${slugify(enriched.name)}-${enriched.city ? slugify(enriched.city) : 'ph'}-${enriched.tripadvisor_id}`;
    }

    // Ensure country is set
    if (!enriched.country) {
      enriched.country = 'Philippines';
    }

    // Set verification flags
    enriched.verified = true;
    enriched.last_verified_at = new Date().toISOString();
    enriched.fetch_status = 'success';

  } catch (error) {
    console.warn(`  ⚠️  HTML parsing error: ${error.message?.substring(0, 60)}`);
  }

  return enriched;
}

async function enrichListing(listing) {
  try {
    // Check if already enriched
    if (listing.verified || (listing.fetch_status === 'success' && listing.rating)) {
      stats.alreadyProcessed++;
      return false;
    }

    if (!listing.web_url) {
      stats.skipped++;
      return false;
    }

    console.log(`  🔗 ${listing.name} (${listing.city})`);

    const html = await fetchTripAdvisorPage(listing.web_url);
    if (!html) {
      console.log(`    ⚠️  Failed to fetch page`);
      stats.failed++;
      return false;
    }

    let enriched = extractFromHTML(html, listing);

    // Validate minimum required fields
    if (!enriched.name || !enriched.city) {
      console.log(`    ⚠️  Missing critical fields`);
      stats.failed++;
      return false;
    }

    // Update fetch status
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

    console.log(`    ✓ Enriched`);
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
  console.log('🔗 ENRICH NEARBY_LISTINGS - COMPREHENSIVE POPULATION');
  console.log('='.repeat(70));

  // Get listings with pending/incomplete status
  console.log('\n📥 Fetching listings to enrich...');
  const { data: listings, error } = await supabase
    .from('nearby_listings')
    .select('*')
    .or('fetch_status.eq.pending,verified.is.null,rating.is.null')
    .order('created_at', { ascending: true })
    .limit(200);

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

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    console.log(`[${i + 1}/${listings.length}]`);
    await enrichListing(listing);
    
    // Progressive rate limiting
    if ((i + 1) % 10 === 0) {
      await sleep(3000); // Longer delay every 10 listings
    } else {
      await sleep(1500); // Regular delay
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('📈 SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total Processed: ${stats.total}`);
  console.log(`  Newly Enriched: ${stats.enriched}`);
  console.log(`  Already Complete: ${stats.alreadyProcessed}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Duration: ${duration} minutes`);
  console.log(`  Success Rate: ${((stats.enriched / (stats.total - stats.alreadyProcessed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));
  console.log('\n✅ Enrichment complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
