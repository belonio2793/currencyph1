import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
  console.log('\n🔍 TripAdvisor Data Verification\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Get total count
    const { count: total } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true });

    // Get count with tripadvisor_id
    const { count: withId } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .not('tripadvisor_id', 'is', null);

    // Get count with photos
    const { count: withPhotos } = await supabase
      .from('nearby_listings')
      .select('id', { count: 'exact', head: true })
      .not('photo_urls', 'is', null)
      .gt('photo_count', 0);

    // Get sample listings with data
    const { data: samples } = await supabase
      .from('nearby_listings')
      .select('id, name, city, tripadvisor_id, photo_count, photo_urls')
      .not('tripadvisor_id', 'is', null)
      .not('photo_urls', 'is', null)
      .limit(5);

    console.log('📊 DATABASE STATUS:\n');
    console.log(`  Total listings: ${total}`);
    console.log(`  With TripAdvisor ID: ${withId} (${((withId/total)*100).toFixed(1)}%)`);
    console.log(`  With photo URLs: ${withPhotos} (${((withPhotos/total)*100).toFixed(1)}%)`);
    console.log(`  Both ID + photos: ${Math.min(withId, withPhotos)} (${((Math.min(withId, withPhotos)/total)*100).toFixed(1)}%)`);

    console.log('\n📋 SAMPLE LISTINGS:\n');
    
    if (samples?.length > 0) {
      samples.forEach((listing, i) => {
        console.log(`${i + 1}. ${listing.name}`);
        console.log(`   City: ${listing.city}`);
        console.log(`   TripAdvisor ID: ${listing.tripadvisor_id}`);
        console.log(`   Photos: ${listing.photo_count}`);
        if (listing.photo_urls?.[0]) {
          console.log(`   First photo: ${listing.photo_urls[0].substring(0, 80)}...`);
        }
        console.log();
      });
    }

    console.log('='.repeat(80) + '\n');
    
    if (withId === total && withPhotos === total) {
      console.log('✅ ALL DATA COMPLETE!\n');
    } else if (withId < total) {
      console.log(`⚠️  ${total - withId} listings still need TripAdvisor IDs\n`);
      console.log('Run: npm run fill-tripadvisor-unique\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verify();
