#!/usr/bin/env node

/**
 * Comprehensive Philippines TripAdvisor Listings Fetcher
 * 
 * This script fetches ALL listings from TripAdvisor for every Philippine city
 * and fills the nearby_listings schema with complete data.
 * 
 * Usage:
 *   node scripts/fetch-all-philippines-comprehensive.js [limit]
 * 
 * Examples:
 *   node scripts/fetch-all-philippines-comprehensive.js        # 30 per city/category (default)
 *   node scripts/fetch-all-philippines-comprehensive.js 50     # 50 per city/category
 *   node scripts/fetch-all-philippines-comprehensive.js 10     # 10 per city/category (quick test)
 * 
 * Environment Variables Required:
 *   VITE_PROJECT_URL or PROJECT_URL     - Supabase project URL
 *   VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY - Supabase anon key
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set VITE_PROJECT_URL and VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PHILIPPINE_CITIES = [
  { name: "Manila", id: "298573" },
  { name: "Cebu", id: "298447" },
  { name: "Davao", id: "295426" },
  { name: "Quezon City", id: "315645" },
  { name: "Makati", id: "315641" },
  { name: "Boracay", id: "296720" },
  { name: "Palawan", id: "298444" },
  { name: "El Nido", id: "296721" },
  { name: "Coron", id: "296722" },
  { name: "Siargao", id: "296735" },
  { name: "Baguio", id: "295411" },
  { name: "Iloilo", id: "296898" },
  { name: "Bacolod", id: "298352" },
  { name: "Puerto Princesa", id: "295421" },
  { name: "Dumaguete", id: "295436" },
  { name: "Vigan", id: "298496" },
  { name: "Subic Bay", id: "297631" },
  { name: "Tagaytay", id: "298563" },
  { name: "Taguig", id: "315654" },
  { name: "Antipolo", id: "315612" },
  { name: "Cavite City", id: "315616" },
  { name: "Bacoor", id: "315614" },
  { name: "Imus", id: "315635" },
  { name: "Dasmariñas", id: "315625" },
  { name: "Calamba", id: "315620" },
  { name: "Biñan", id: "315618" },
  { name: "Laguna", id: "298572" },
  { name: "Pampanga", id: "298571" },
  { name: "Batangas City", id: "298574" },
  { name: "Clark Freeport", id: "295413" },
  { name: "Olongapo", id: "298570" },
  { name: "Calapan", id: "298566" },
  { name: "Romblon", id: "298494" },
  { name: "Kalibo", id: "296897" },
  { name: "Caticlan", id: "296719" },
  { name: "Roxas", id: "298493" },
  { name: "Capiz", id: "298449" },
  { name: "Guimaras", id: "298450" },
  { name: "Antique", id: "298446" },
  { name: "Aklan", id: "298445" },
  { name: "Negros Occidental", id: "298352" },
  { name: "Negros Oriental", id: "298434" },
  { name: "Siquijor", id: "298435" },
  { name: "Bohol", id: "298441" },
  { name: "Camiguin", id: "298426" },
  { name: "Cagayan de Oro", id: "298425" },
  { name: "Butuan", id: "298428" },
  { name: "Surigao City", id: "298432" },
  { name: "Agusan", id: "298427" },
  { name: "Misamis Oriental", id: "298430" },
  { name: "Misamis Occidental", id: "298429" },
  { name: "Cotabato", id: "298458" },
  { name: "General Santos", id: "298459" },
  { name: "Sultan Kudarat", id: "298460" },
  { name: "South Cotabato", id: "298461" },
  { name: "Sarangani", id: "298462" },
  { name: "Davao del Sur", id: "295427" },
  { name: "Davao del Norte", id: "295425" },
  { name: "Davao Oriental", id: "295428" },
  { name: "Davao Occidental", id: "295429" },
  { name: "Zamboanga del Norte", id: "298464" },
  { name: "Zamboanga del Sur", id: "298465" },
  { name: "Zamboanga Sibugay", id: "298466" },
  { name: "Zamboanga City", id: "298467" }
];

const CATEGORIES = [
  "attractions",
  "hotels",
  "restaurants",
  "things_to_do",
  "tours",
  "vacation_rentals"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callComprehensiveScrapeFn(limit = 30) {
  try {
    console.log(`\n📡 Calling comprehensive scraping function...`);
    console.log(`   Supabase URL: ${supabaseUrl}`);
    console.log(`   Cities to scrape: ${PHILIPPINE_CITIES.length}`);
    console.log(`   Categories per city: ${CATEGORIES.length}`);
    console.log(`   Listings per city/category: ${limit}`);
    console.log(`   Total combinations: ${PHILIPPINE_CITIES.length * CATEGORIES.length}`);
    
    const functionUrl = `${supabaseUrl}/functions/v1/scrape-nearby-listings-comprehensive`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ limit })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (err) {
    console.error('❌ Function call failed:', err.message);
    throw err;
  }
}

async function verifyResults() {
  console.log('\n📊 Verifying results in database...');
  
  try {
    // Get total count
    const { count, error: countErr } = await supabase
      .from('nearby_listings')
      .select('*', { count: 'exact', head: true });
    
    if (countErr) throw countErr;
    
    // Get stats
    const { data: stats } = await supabase
      .from('nearby_listings')
      .select('category, city, rating')
      .not('tripadvisor_id', 'is', null)
      .limit(0);

    // Count by category
    const { data: byCategory } = await supabase
      .rpc('get_listings_by_category', {});

    console.log(`\n✅ Total listings in database: ${count || 0}`);
    
    // Get sample of cities
    const { data: citySample } = await supabase
      .from('nearby_listings')
      .select('city')
      .limit(1)
      .single();
    
    const { data: cities } = await supabase
      .from('nearby_listings')
      .select('city', { count: 'exact' })
      .distinct()
      .not('city', 'is', null);

    console.log(`✅ Cities represented: ${cities?.length || 0}`);

    // Get sample listings
    const { data: samples } = await supabase
      .from('nearby_listings')
      .select('name, city, category, rating, image_urls, amenities')
      .not('name', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (samples && samples.length > 0) {
      console.log(`\n📋 Sample listings (5 most recent):`);
      samples.forEach((s, i) => {
        console.log(`   ${i+1}. ${s.name}`);
        console.log(`      City: ${s.city} | Category: ${s.category}`);
        console.log(`      Rating: ${s.rating || 'N/A'} | Images: ${(s.image_urls || []).length}`);
        console.log(`      Amenities: ${((s.amenities || []).length)} items`);
      });
    }
  } catch (err) {
    console.error('❌ Verification error:', err.message);
  }
}

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 30;

  console.log(`\n${'='.repeat(70)}`);
  console.log('🌏 COMPREHENSIVE PHILIPPINES TRIPADVISOR SCRAPER');
  console.log(`${'='.repeat(70)}`);

  console.log(`\n⚙️  Configuration:`);
  console.log(`   Listings per city/category: ${limit}`);
  console.log(`   Total cities: ${PHILIPPINE_CITIES.length}`);
  console.log(`   Categories: ${CATEGORIES.length}`);
  console.log(`   Expected combinations: ${PHILIPPINE_CITIES.length * CATEGORIES.length}`);
  console.log(`   Expected max listings: ${PHILIPPINE_CITIES.length * CATEGORIES.length * limit}`);

  try {
    const result = await callComprehensiveScrapeFn(limit);

    if (!result.success) {
      console.error('❌ Scraping failed:', result.error);
      process.exit(1);
    }

    console.log(`\n✅ Scraping completed!`);
    console.log(`   Total scraped: ${result.totalScraped || 0}`);
    console.log(`   Unique listings: ${result.uniqueListings || 0}`);
    console.log(`   Upserted to DB: ${result.upserted || 0}`);
    console.log(`   Success count: ${result.successCount || 0}`);
    console.log(`   Error count: ${result.errorCount || 0}`);
    console.log(`   Timestamp: ${result.timestamp}`);

    await verifyResults();

    console.log(`\n${'='.repeat(70)}`);
    console.log('✨ All Philippine TripAdvisor listings have been fetched!');
    console.log('   Visit /nearby page to see all listings');
    console.log(`${'='.repeat(70)}\n`);

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
}

main();
