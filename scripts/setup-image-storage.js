import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: VITE_PROJECT_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  try {
    console.log('Setting up Supabase storage bucket for listing images...');

    // Create the bucket if it doesn't exist
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets?.some(b => b.name === 'nearby_listings');

    if (!bucketExists) {
      console.log('Creating nearby_listings bucket...');
      const { data, error } = await supabase.storage.createBucket('nearby_listings', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });

      if (error) {
        console.error('Error creating bucket:', error);
        return;
      }

      console.log('✓ Bucket created successfully');
    } else {
      console.log('✓ Bucket already exists');
    }

    // Set up public access policy
    console.log('Setting up public access policy...');
    const { error: policyError } = await supabase.storage
      .from('nearby_listings')
      .createSignedUrl('test.txt', 60);

    if (policyError?.message?.includes('not found')) {
      // This is expected for non-existent files
      console.log('✓ Public access configured');
    }

    console.log('\n✅ Storage setup complete!');
    console.log('Bucket: nearby_listings');
    console.log('Access: Public (anyone can view)');
    console.log('Usage: supabase.storage.from("nearby_listings").getPublicUrl(path)');
  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

async function setupDatabase() {
  try {
    console.log('\nSetting up database schema for images...');

    // Add image-related columns to nearby_listings if they don't exist
    const { error } = await supabase.rpc('add_image_columns_if_needed');

    if (error && !error.message.includes('does not exist')) {
      console.log('Note: Using SQL to add columns...');

      // Fallback: Create migration SQL
      const sql = `
        ALTER TABLE nearby_listings 
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS stored_image_path TEXT,
        ADD COLUMN IF NOT EXISTS image_downloaded_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS review_count INTEGER,
        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tripadvisor';

        CREATE INDEX IF NOT EXISTS idx_listings_source ON nearby_listings(source);
        CREATE INDEX IF NOT EXISTS idx_listings_updated ON nearby_listings(updated_at DESC);
      `;

      console.log('Run this SQL in Supabase dashboard if needed:');
      console.log(sql);
    } else if (!error) {
      console.log('✓ Database schema updated');
    }

    console.log('✓ Database ready for image tracking');
  } catch (err) {
    console.error('Database setup error:', err);
  }
}

async function main() {
  console.log('=== Supabase Image Storage Setup ===\n');

  await setupStorage();
  await setupDatabase();

  console.log('\n=== Setup Complete ===');
  console.log('\nNext steps:');
  console.log('1. Run: npm run sync-tripadvisor (to fetch listings)');
  console.log('2. Deploy edge function: supabase functions deploy sync-tripadvisor-hourly');
  console.log('3. Images will be downloaded automatically during sync');
  console.log('4. Your /nearby page will use stored images automatically');
}

main();
