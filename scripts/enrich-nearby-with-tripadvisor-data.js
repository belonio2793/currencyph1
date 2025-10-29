#!/usr/bin/env node

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SCRAPINGBEE_KEYS = [
  "Z3CQBBBPQIA4FQAQOHWJVO40ZKIRMM7LNUBVOQVAN2VP2PE2F1PQO9JGJZ5C9U9C9LRWK712V7P963C9",
  "OPYAXOKXYQ0SBE7LR23GJ3NH1R4M66NUM85WJO1SCFUOFGJ11LJP6ZKD1JBVKNGMGC3E1RQXF81NT4YS",
  "IQA11BPV1NYZEFAX4Q3SMM3DQZIBZWXY4O47IPRDBQPGAVZTQPKB4C2GAMXOEZJTEJ9TU5J2GQJJXSOP",
  "DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG",
  "8WKM4CAOLMHF8GXKHB3G1QPURA4X4LCIG9EGCXRWS7QMUJ7S7E3M6WQBYYV2FTFG5EWXR6Y4XM7TM4QX"
];

let stats = {
  processed: 0,
  enriched: 0,
  failed: 0,
  totalPhotos: 0,
  totalAmenities: 0
};

let beeKeyIndex = 0;

function getNextBeeKey() {
  const key = SCRAPINGBEE_KEYS[beeKeyIndex % SCRAPINGBEE_KEYS.length];
  beeKeyIndex++;
  return key;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPhotoUrls(html) {
  if (!html) return [];
  const urls = [];
  
  const patterns = [
    /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[a-zA-Z]\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[^"\s<>]+\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tacdn\.com[^"\s<>]*\.jpg/gi,
    /https:\/\/[a-z0-9\-]*\.tacdn\.com[^"\s<>]*\.(jpg|jpeg|png|webp)/gi,
    /"image":"(https:\/\/[^"]*tacdn[^"]*\.jpg)"/gi,
    /src="(https:\/\/[^"]*tacdn[^"]*\.jpg)"/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[0];
      if (url.includes('"')) {
        url = match[1] || url;
      }
      if (url && !urls.includes(url) && urls.length < 20 && url.includes('http')) {
        urls.push(url);
      }
    }
  }

  return [...new Set(urls)].slice(0, 20);
}

function extractAmenities(html) {
  if (!html) return [];
  const amenities = [];
  
  const amenityPatterns = [
    /Amenities:\s*<[^>]*>([^<]*(?:<[^>]*>[^<]*)*)/gi,
    /amenities['":\s]+([^<]*(?:,\s*[^<]*)*)/gi,
    /<span[^>]*>([A-Z][a-z\s&]+(?:Free|Paid|Available)?)<\/span>/g
  ];

  const found = new Set();

  for (const pattern of amenityPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[1]?.replace(/<[^>]*>/g, '').trim();
      if (text && text.length > 3 && text.length < 50) {
        found.add(text);
      }
    }
  }

  return Array.from(found).slice(0, 15);
}

function extractOperatingHours(html) {
  if (!html) return null;
  
  const hoursObject = {};
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (const day of days) {
    const patterns = [
      new RegExp(`${day}[^0-9]*([0-9]{1,2}:[0-9]{2}[AP]M)?[^0-9]*[-–][^0-9]*([0-9]{1,2}:[0-9]{2}[AP]M)?`, 'i'),
      new RegExp(`${day}[^0-9]*([0-9]{2}:[0-9]{2})?[^0-9]*[-–][^0-9]*([0-9]{2}:[0-9]{2})?`, 'i')
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[2]) {
        hoursObject[day] = {
          open: match[1],
          close: match[2],
          closed: false
        };
        break;
      }
    }

    if (!hoursObject[day]) {
      if (html.includes(`${day}`) && html.includes('Closed')) {
        hoursObject[day] = { closed: true };
      }
    }
  }

  return Object.keys(hoursObject).length > 0 ? hoursObject : null;
}

function extractAccessibilityInfo(html) {
  if (!html) return null;
  
  const info = {};
  const checks = {
    wheelchair_accessible: ['wheelchair', 'accessible', 'wc'],
    pet_friendly: ['pet', 'dog', 'cat'],
    elevator: ['elevator', 'lift'],
    accessible_parking: ['parking', 'accessible parking'],
    accessible_restroom: ['restroom', 'bathroom', 'toilet']
  };

  const htmlLower = html.toLowerCase();

  for (const [key, keywords] of Object.entries(checks)) {
    for (const keyword of keywords) {
      if (htmlLower.includes(keyword)) {
        info[key] = true;
        break;
      }
    }
  }

  return Object.keys(info).length > 0 ? info : null;
}

function extractPhoneAndWebsite(html) {
  if (!html) return { phone: null, website: null };
  
  const result = { phone: null, website: null };

  const phonePattern = /(?:\+63|0)[0-9\s\-()]{9,}/;
  const phoneMatch = html.match(phonePattern);
  if (phoneMatch) {
    result.phone = phoneMatch[0].trim();
  }

  const websitePattern = /https?:\/\/(?:www\.)?[a-z0-9]+\.[a-z]{2,}/i;
  const websiteMatches = html.match(websitePattern);
  if (websiteMatches) {
    result.website = websiteMatches[0];
  }

  return result;
}

function extractAddress(html) {
  if (!html) return null;
  
  const patterns = [
    /Address:\s*([^<\n]+)/i,
    /Located at:\s*([^<\n]+)/i,
    /<span[^>]*>([^<]*(?:St|Ave|Rd|Boulevard|Street|Avenue|Road)[^<]*)<\/span>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 255);
    }
  }

  return null;
}

function extractRatingAndReviews(html) {
  if (!html) return { rating: null, reviewCount: null };
  
  const result = { rating: null, reviewCount: null };

  const ratingPatterns = [
    /(\d+\.?\d*)\s*\/\s*5/,
    /rating['":\s]+(\d+\.?\d*)/i,
    /score['":\s]+(\d+\.?\d*)/i
  ];

  for (const pattern of ratingPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const rating = parseFloat(match[1]);
      if (rating >= 0 && rating <= 5) {
        result.rating = rating;
        break;
      }
    }
  }

  const reviewPatterns = [
    /(\d+(?:,\d{3})*)\s+reviews?/i,
    /(\d+(?:,\d{3})*)\s+ratings?/i,
    /"reviewCount"['":\s]+(\d+)/i
  ];

  for (const pattern of reviewPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result.reviewCount = parseInt(match[1].replace(/,/g, ''), 10);
      break;
    }
  }

  return result;
}

function extractPriceLevel(html) {
  if (!html) return null;

  const patterns = [
    /(\${1,4})/,
    /price['":\s]+['"]*(\${1,4})/i,
    /budget:\s*(\${1,4})/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const dollarCount = (match[1].match(/\$/g) || []).length;
      if (dollarCount > 0 && dollarCount <= 4) {
        return dollarCount;
      }
    }
  }

  return null;
}

function extractTripadvisorIdFromUrl(url) {
  if (!url) return null;
  const patterns = [/-d(\d+)-/, /location\/(\d+)/, /-d(\d+)(?:[\-_]|$)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function generateSlug(name, id) {
  const base = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
  return id ? `${base}-${id}` : base;
}

async function fetchViaScrapingBee(url) {
  try {
    const beeKey = getNextBeeKey();
    const beeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${beeKey}&url=${encodeURIComponent(url)}&render_javascript=false&premium_proxy=true`;

    const response = await fetch(beeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 45000
    });

    if (!response.ok) {
      console.log(`    ⚠️  ScrapingBee ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(`    ⚠️  Fetch error: ${error.message?.substring(0, 40)}`);
    return null;
  }
}

async function enrichListing(listing) {
  stats.processed++;
  
  console.log(`\n[${stats.processed}] 📍 ${listing.name?.substring(0, 45)} (${listing.city})`);

  if (!listing.web_url) {
    console.log(`  ❌ No web_url available - skipping`);
    stats.failed++;
    return;
  }

  console.log(`  📄 Fetching TripAdvisor page...`);
  const html = await fetchViaScrapingBee(listing.web_url);

  if (!html) {
    console.log(`  ❌ Could not fetch page`);
    stats.failed++;
    await sleep(2000);
    return;
  }

  const updateData = {
    updated_at: new Date().toISOString()
  };

  const photoUrls = extractPhotoUrls(html);
  if (photoUrls.length > 0) {
    updateData.photo_urls = photoUrls;
    updateData.image_url = photoUrls[0];
    updateData.primary_image_url = photoUrls[0];
    updateData.featured_image_url = photoUrls[0];
    updateData.photo_count = photoUrls.length;
    console.log(`  📸 Found ${photoUrls.length} photos`);
    stats.totalPhotos += photoUrls.length;
  }

  const amenities = extractAmenities(html);
  if (amenities.length > 0) {
    updateData.amenities = amenities.map(name => ({ name, available: true }));
    console.log(`  🏢 Found ${amenities.length} amenities`);
    stats.totalAmenities += amenities.length;
  }

  const hours = extractOperatingHours(html);
  if (hours) {
    updateData.hours_of_operation = hours;
    console.log(`  ⏰ Extracted operating hours`);
  }

  const accessibility = extractAccessibilityInfo(html);
  if (accessibility) {
    updateData.accessibility_info = accessibility;
    console.log(`  ♿ Extracted accessibility info`);
  }

  const { phone, website } = extractPhoneAndWebsite(html);
  if (phone) {
    updateData.phone_number = phone;
    console.log(`  📞 Found phone: ${phone}`);
  }
  if (website) {
    updateData.website = website;
    console.log(`  🌐 Found website`);
  }

  const address = extractAddress(html);
  if (address) {
    updateData.address = address;
    console.log(`  📮 Found address`);
  }

  const { rating, reviewCount } = extractRatingAndReviews(html);
  if (rating && !listing.rating) {
    updateData.rating = rating;
    console.log(`  ⭐ Rating: ${rating}/5`);
  }
  if (reviewCount && !listing.review_count) {
    updateData.review_count = reviewCount;
    console.log(`  💬 Reviews: ${reviewCount}`);
  }

  const priceLevel = extractPriceLevel(html);
  if (priceLevel) {
    updateData.price_level = priceLevel;
    updateData.price_range = '$'.repeat(priceLevel);
    console.log(`  💰 Price level: ${updateData.price_range}`);
  }

  updateData.verified = true;
  updateData.fetch_status = 'success';

  try {
    const { error } = await supabase
      .from('nearby_listings')
      .update(updateData)
      .eq('id', listing.id);

    if (error) {
      console.log(`  ❌ Update failed: ${error.message?.substring(0, 50)}`);
      stats.failed++;
    } else {
      console.log(`  ✅ Enriched successfully`);
      stats.enriched++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message?.substring(0, 50)}`);
    stats.failed++;
  }

  const delay = 2000 + Math.random() * 3000;
  await sleep(delay);
}

async function fetchListingsToEnrich(limit = 50) {
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id, name, city, web_url, rating, review_count, photo_urls, amenities')
    .eq('source', 'google_custom_search')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ENRICH NEARBY_LISTINGS WITH TRIPADVISOR DATA');
  console.log('='.repeat(80));
  console.log('\nExtracting comprehensive data from TripAdvisor pages:');
  console.log('  • Photos and images');
  console.log('  • Operating hours');
  console.log('  • Amenities and facilities');
  console.log('  • Accessibility information');
  console.log('  • Contact details (phone, website)');
  console.log('  • Address information');
  console.log('  • Rating and review counts');
  console.log('  • Price level');
  console.log('='.repeat(80));

  const limit = parseInt(process.env.LIMIT || '50', 10);
  
  console.log(`\nFetching up to ${limit} recently added listings to enrich...`);
  const listings = await fetchListingsToEnrich(limit);

  if (!listings.length) {
    console.log('\n✅ No listings to enrich. Run the Google Search script first:');
    console.log('   npm run populate-nearby-google\n');
    return;
  }

  console.log(`Found ${listings.length} listings to enrich\n`);

  for (const listing of listings) {
    await enrichListing(listing);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📈 ENRICHMENT REPORT');
  console.log('='.repeat(80));
  console.log(`  Total processed: ${stats.processed}`);
  console.log(`  ✅ Successfully enriched: ${stats.enriched}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  📸 Total photos extracted: ${stats.totalPhotos}`);
  console.log(`  🏢 Total amenities extracted: ${stats.totalAmenities}`);
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
