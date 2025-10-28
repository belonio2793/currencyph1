#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 NEARBY_LISTINGS POPULATION STATUS');
  console.log('='.repeat(80) + '\n');

  try {
    const { data: listings, error: listError } = await supabase
      .from('nearby_listings')
      .select('id, name, city, tripadvisor_id, photo_urls, photo_count, verified, fetch_status');

    if (listError) throw listError;

    const total = listings?.length || 0;
    const withId = listings?.filter(l => l.tripadvisor_id).length || 0;
    const withPhotos = listings?.filter(l => l.photo_urls?.length > 0).length || 0;
    const verified = listings?.filter(l => l.verified).length || 0;
    const successful = listings?.filter(l => l.fetch_status === 'success').length || 0;

    const totalPhotoUrls = listings?.reduce((sum, l) => sum + (l.photo_urls?.length || 0), 0) || 0;

    console.log('📈 SUMMARY STATISTICS\n');
    console.log(`  Total listings in nearby_listings: ${total}`);
    console.log(`  ✅ With TripAdvisor ID: ${withId} (${((withId/total)*100).toFixed(1)}%)`);
    console.log(`  📸 With photo URLs: ${withPhotos} (${((withPhotos/total)*100).toFixed(1)}%)`);
    console.log(`  ✓ Verified listings: ${verified}`);
    console.log(`  ✓ Successful fetches: ${successful}`);
    console.log(`  📸 Total photo URLs extracted: ${totalPhotoUrls}`);

    console.log('\n' + '-'.repeat(80) + '\n');
    console.log('🔍 DETAILED STATUS BY CITY (Top 15)\n');

    const byCity = listings?.reduce((acc, l) => {
      const city = l.city || 'Unknown';
      if (!acc[city]) {
        acc[city] = { total: 0, withId: 0, withPhotos: 0, photos: 0 };
      }
      acc[city].total++;
      if (l.tripadvisor_id) acc[city].withId++;
      if (l.photo_urls?.length > 0) {
        acc[city].withPhotos++;
        acc[city].photos += l.photo_urls.length;
      }
      return acc;
    }, {});

    Object.entries(byCity || {})
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .forEach(([city, stats]) => {
        const idPct = ((stats.withId / stats.total) * 100).toFixed(0);
        const photoPct = ((stats.withPhotos / stats.total) * 100).toFixed(0);
        console.log(`  ${city}`);
        console.log(`    Total: ${stats.total} | IDs: ${stats.withId}/${stats.total} (${idPct}%) | Photos: ${stats.withPhotos}/${stats.total} (${photoPct}%) | URLs: ${stats.photos}`);
      });

    console.log('\n' + '-'.repeat(80) + '\n');
    console.log('🎯 RECOMMENDATIONS\n');

    if (withId < total * 0.8) {
      console.log(`  ⚠️  Only ${((withId/total)*100).toFixed(0)}% have TripAdvisor IDs`);
      console.log(`      Run: npm run populate-nearby-real LIMIT=50`);
      console.log(`      (Process more listings to improve coverage)\n`);
    } else {
      console.log(`  ✅ Good coverage of TripAdvisor IDs (${((withId/total)*100).toFixed(0)}%)\n`);
    }

    if (withPhotos < total * 0.6) {
      console.log(`  ⚠️  Only ${((withPhotos/total)*100).toFixed(0)}% have photo URLs`);
      console.log(`      Continue running the populator to extract more photo URLs\n`);
    } else {
      console.log(`  ✅ Good photo coverage (${((withPhotos/total)*100).toFixed(0)}%)\n`);
    }

    if (totalPhotoUrls < total * 5) {
      console.log(`  💡 Average ${(totalPhotoUrls / total).toFixed(1)} photos per listing`);
      console.log(`     Target is ~5-10 photos per listing for best UX\n`);
    } else {
      console.log(`  ✅ Great photo extraction! ${(totalPhotoUrls / total).toFixed(1)} photos per listing\n`);
    }

    console.log('='.repeat(80) + '\n');

    const missingIds = listings?.filter(l => !l.tripadvisor_id).slice(0, 5);
    if (missingIds?.length > 0) {
      console.log('📍 Sample listings still needing TripAdvisor IDs:\n');
      missingIds.forEach(l => {
        console.log(`  • ${l.name} (${l.city})`);
      });
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  }
}

verify();
