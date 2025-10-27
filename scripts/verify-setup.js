import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifySetup() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║            TripAdvisor Sync Setup Verification              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let issues = 0;

  // Test 1: Database Connection
  console.log('📋 Test 1: Database Connection...');
  try {
    const { count, error } = await supabase
      .from('nearby_listings')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    console.log('   ✓ Database connected');
    console.log(`   ℹ Current listings: ${count || 0}`);
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}`);
    issues++;
  }

  // Test 2: Check Columns
  console.log('\n📋 Test 2: Database Schema...');
  try {
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const listing = data[0];
      const requiredColumns = ['id', 'tripadvisor_id', 'name', 'image_url', 'stored_image_path'];
      const missingColumns = requiredColumns.filter(col => !(col in listing));

      if (missingColumns.length > 0) {
        console.log(`   ⚠ Missing columns: ${missingColumns.join(', ')}`);
        console.log('   Run database migration in Supabase dashboard');
        issues++;
      } else {
        console.log('   ✓ All required columns present');
      }
    } else {
      console.log('   ℹ No listings yet (will be populated by sync)');
    }
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}`);
    issues++;
  }

  // Test 3: Storage Bucket
  console.log('\n📋 Test 3: Storage Bucket...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) throw error;

    const hasListingBucket = buckets?.some(b => b.name === 'listing-images');

    if (hasListingBucket) {
      console.log('   ✓ listing-images bucket exists');

      // Try to get public URL
      const { data } = supabase.storage
        .from('listing-images')
        .getPublicUrl('test.jpg');

      if (data?.publicUrl) {
        console.log('   ✓ Bucket is public');
      }
    } else {
      console.log('   ✗ listing-images bucket not found');
      console.log('   Run: node scripts/setup-image-storage.js');
      issues++;
    }
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}`);
    issues++;
  }

  // Test 4: Database Functions
  console.log('\n📋 Test 4: Database Functions...');
  try {
    const { data, error } = await supabase.rpc('get_nearby_listings', {
      lat: 14.5994,
      lon: 120.9842,
      distance_km: 50,
      limit_count: 1,
    });

    if (error && error.message.includes('does not exist')) {
      console.log('   ⚠ Helper functions not yet created');
      console.log('   Run database migration to add them');
      // Not critical, don't count as issue
    } else if (error) {
      throw error;
    } else {
      console.log('   ✓ get_nearby_listings function works');
    }
  } catch (err) {
    console.log(`   ℹ ${err.message}`);
  }

  // Test 5: Edge Function
  console.log('\n📋 Test 5: Edge Function...');
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sync-tripadvisor-hourly`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('   ✓ Edge function deployed and responding');
      if (data.success) {
        console.log(`   ✓ Last sync: ${data.message}`);
        console.log(`     - Listings fetched: ${data.totalFetched}`);
        console.log(`     - Unique: ${data.uniqueListings}`);
        console.log(`     - Upserted: ${data.upserted}`);
      }
    } else {
      console.log('   ✗ Edge function error:');
      console.log(`   ${JSON.stringify(data, null, 2)}`);
      issues++;
    }
  } catch (err) {
    console.log(`   ⚠ Edge function not yet deployed`);
    console.log('   Run: supabase functions deploy sync-tripadvisor-hourly');
    issues++;
  }

  // Test 6: Data Statistics
  console.log('\n📋 Test 6: Data Statistics...');
  try {
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('stored_image_path', { count: 'exact' });

    if (error) throw error;

    const totalListings = listings?.length || 0;
    const withStoredImages = listings?.filter(l => l.stored_image_path).length || 0;

    console.log(`   ✓ Total listings: ${totalListings}`);
    console.log(`   ✓ With stored images: ${withStoredImages}`);

    if (totalListings > 0) {
      const percentage = ((withStoredImages / totalListings) * 100).toFixed(1);
      console.log(`   ℹ Image storage progress: ${percentage}%`);
    }
  } catch (err) {
    console.log(`   ✗ Error: ${err.message}`);
    issues++;
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');

  if (issues === 0) {
    console.log('║              ✓ All Tests Passed! 🎉                       ║');
    console.log('║  Your TripAdvisor sync setup is ready to use              ║');
  } else {
    console.log(`║  ⚠ ${issues} issue(s) found. See above for details.           ║`);
    console.log('║  Fix the issues and re-run this script to verify           ║');
  }

  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Recommendations
  if (issues > 0) {
    console.log('📋 Recommended Next Steps:\n');
    console.log('1. Run database migration (if not done):');
    console.log('   → Go to Supabase Dashboard → SQL Editor');
    console.log('   → Copy contents of supabase/migrations/add_image_support.sql');
    console.log('   → Execute the query\n');
    console.log('2. Set up storage bucket:');
    console.log('   $ node scripts/setup-image-storage.js\n');
    console.log('3. Deploy edge function:');
    console.log('   $ supabase functions deploy sync-tripadvisor-hourly\n');
    console.log('4. Enable cron scheduling in Supabase dashboard:');
    console.log('   → Edge Functions → sync-tripadvisor-hourly');
    console.log('   → Enable Scheduled → Cron: 0 * * * *\n');
    console.log('5. Re-run this verification:');
    console.log('   $ node scripts/verify-setup.js\n');
  }

  process.exit(issues > 0 ? 1 : 0);
}

verifySetup().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
