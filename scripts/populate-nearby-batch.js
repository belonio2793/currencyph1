#!/usr/bin/env node

import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkListingCount() {
  try {
    const { count, error } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error checking listing count:', error);
    return 0;
  }
}

async function checkGoogleSearchListingCount() {
  try {
    const { count, error } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'google_custom_search');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function getListingStats() {
  try {
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('id, rating, review_count, photo_urls, amenities, verified')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const stats = {
      total: 0,
      withPhotos: 0,
      withRatings: 0,
      withAmenities: 0,
      verified: 0
    };

    for (const item of data || []) {
      if (item.id) stats.total++;
      if (item.photo_urls?.length > 0) stats.withPhotos++;
      if (item.rating) stats.withRatings++;
      if (item.amenities?.length > 0) stats.withAmenities++;
      if (item.verified) stats.verified++;
    }

    return stats;
  } catch (error) {
    return null;
  }
}

function runCommand(command, args = []) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`Error running command: ${err}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 COMPREHENSIVE NEARBY_LISTINGS BATCH POPULATION');
  console.log('='.repeat(80));

  const currentCount = await checkListingCount();
  console.log(`\n📊 Current Status:`);
  console.log(`  Total listings in database: ${currentCount}`);

  const stats = await getListingStats();
  if (stats) {
    console.log(`  With photos: ${stats.withPhotos}`);
    console.log(`  With ratings: ${stats.withRatings}`);
    console.log(`  With amenities: ${stats.withAmenities}`);
    console.log(`  Verified: ${stats.verified}`);
  }

  console.log('\n📋 This batch process will:');
  console.log('  1️⃣  Search TripAdvisor.com.ph via Google Custom Search');
  console.log('  2️⃣  Extract TripAdvisor listing information');
  console.log('  3️⃣  Fetch complete TripAdvisor pages');
  console.log('  4️⃣  Extract photos, hours, amenities, ratings');
  console.log('  5️⃣  Populate entire nearby_listings table');
  console.log('  6️⃣  Fill all available data columns');

  console.log('\n⏱️  Estimated Duration:');
  console.log('  • Step 1 (Google Search): 60-90 minutes (150+ cities)');;
  console.log('  • Step 2 (TripAdvisor Enrichment): 90-150 minutes');
  console.log('  • Total: 150-240 minutes (~2.5-4 hours)');;

  console.log('\n🎯 Target Results:');
  console.log('  • ~30,000+ total listings across 150+ Philippine cities');
  console.log('  • 3 categories: restaurants, hotels, attractions');
  console.log('  • Full data including photos, ratings, hours, amenities');

  console.log('\n' + '='.repeat(80));
  console.log('📝 Configuration Check:');
  console.log('='.repeat(80));

  if (!process.env.GOOGLE_CUSTOM_SEARCH_API) {
    console.log('  ❌ GOOGLE_CUSTOM_SEARCH_API not set');
    process.exit(1);
  } else {
    console.log('  ✅ GOOGLE_CUSTOM_SEARCH_API configured');
  }

  if (!process.env.CX) {
    console.log('  ❌ CX not set');
    process.exit(1);
  } else {
    console.log('  ✅ CX (search engine ID) configured');
  }

  console.log('  ✅ Supabase credentials configured');

  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: POPULATION VIA GOOGLE CUSTOM SEARCH');
  console.log('='.repeat(80));
  console.log('\nStarting Google Custom Search population...');
  console.log('(Searching 150+ cities × 3 categories = 450+ searches)\n');

  const populateSuccess = await runCommand('npm', ['run', 'populate-nearby-google']);

  if (!populateSuccess) {
    console.log('\n❌ Google Search population failed. Aborting batch process.');
    process.exit(1);
  }

  console.log('\n✅ Google Search population completed');

  const googleListings = await checkGoogleSearchListingCount();
  console.log(`📊 New listings created via Google Search: ${googleListings}`);

  if (googleListings === 0) {
    console.log('  ⚠️  No new listings were created.');
    console.log('  This could mean:');
    console.log('  - All listings already exist in the database');
    console.log('  - Google API quota reached');
    console.log('  - Network issues during search');
    console.log('\n  Continuing with enrichment for existing listings...\n');
  } else {
    console.log(`  ✅ Ready to enrich ${googleListings} new listings with data\n`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('STEP 1.5: FILL MISSING TRIPADVISOR IDS');
  console.log('='.repeat(80));
  console.log('\nFilling missing tripadvisor_id using web_url/raw/Grok...');

  const idFillOk = await runCommand('node', ['scripts/map-tripadvisor-ids-grok.js']);
  if (!idFillOk) {
    console.log('  ⚠️  ID mapping step encountered issues; continuing.');
  } else {
    console.log('  ✅ ID mapping step completed');
  }

  console.log('='.repeat(80));
  console.log('STEP 1.6: ENRICH VIA REAL TRIPADVISOR PAGES');
  console.log('='.repeat(80));
  console.log('\nRunning real TripAdvisor populator (Grok + ScrapingBee) to fetch accurate URLs, IDs and photos...');

  // This will try to find exact TripAdvisor pages and populate tripadvisor_id, web_url, photo_urls
  const realPopOk = await runCommand('npm', ['run', 'populate-nearby-real']);
  if (!realPopOk) {
    console.log('  ⚠️  Real TripAdvisor population encountered issues; continuing.');
  } else {
    console.log('  ✅ Real TripAdvisor population completed');
  }

  console.log('='.repeat(80));
  console.log('STEP 1.7: FILL ANY REMAINING MISSING IDS (GENERATE UNIQUE)');
  console.log('='.repeat(80));
  console.log('\nRunning filler to generate unique tripadvisor IDs for any remaining entries (fallback)');

  const fillUniqueOk = await runCommand('npm', ['run', 'fill-tripadvisor-unique']);
  if (!fillUniqueOk) {
    console.log('  ⚠️  ID filler encountered issues; continuing.');
  } else {
    console.log('  ✅ ID filler completed');
  }

  console.log('='.repeat(80));
  console.log('STEP 2: DATA ENRICHMENT FROM TRIPADVISOR PAGES');
  console.log('='.repeat(80));
  console.log('\nStarting TripAdvisor data enrichment...');
  console.log('(Fetching pages and extracting comprehensive data)\n');

  const enrichSuccess = await runCommand('npm', ['run', 'enrich-nearby-data']);

  if (!enrichSuccess) {
    console.log('\n⚠️  TripAdvisor enrichment encountered issues.');
    console.log('  This is not critical - some listings may have been enriched.');
  }

  console.log('\n✅ Enrichment process completed');

  const finalCount = await checkListingCount();
  const finalStats = await getListingStats();

  console.log('\n' + '='.repeat(80));
  console.log('🎉 BATCH PROCESS COMPLETED');
  console.log('='.repeat(80));

  console.log('\n📊 Final Results:');
  console.log(`  Total listings: ${finalCount}`);
  if (finalStats) {
    console.log(`  With photos: ${finalStats.withPhotos}`);
    console.log(`  With ratings: ${finalStats.withRatings}`);
    console.log(`  With amenities: ${finalStats.withAmenities}`);
    console.log(`  Verified: ${finalStats.verified}`);
  }

  console.log('\n✨ Next Steps:');
  console.log('  1. Visit http://localhost:5173/nearby to see all listings');
  console.log('  2. Check the database in Supabase console for detailed data');
  console.log('  3. To update photos (optional): npm run fill-photos');
  console.log('  4. To continue enrichment: npm run enrich-nearby-data');
  console.log('  5. To re-populate: npm run populate-nearby-batch');

  console.log('\n📚 Related Commands:');
  console.log('  • npm run populate-nearby-google - Just search (no enrichment)');
  console.log('  • npm run enrich-nearby-data - Just enrichment (existing listings)');
  console.log('  • npm run check-tripadvisor - Check current data status');

  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
