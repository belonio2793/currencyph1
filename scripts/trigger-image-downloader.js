#!/usr/bin/env node

import fetch from 'node-fetch';

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or ANON_KEY');
  process.exit(1);
}

const limit = parseInt(process.env.LIMIT || '20', 10);
const city = process.env.CITY || null;

async function triggerDownloader() {
  console.log('\n' + '='.repeat(80));
  console.log('🖼️  TRIGGER: Download TripAdvisor Images to Supabase Storage');
  console.log('='.repeat(80) + '\n');

  const functionUrl = `${SUPABASE_URL}/functions/v1/download-tripadvisor-images`;
  
  console.log(`📍 Function: ${functionUrl}`);
  console.log(`📊 Limit: ${limit} listings`);
  if (city) console.log(`🏙️  City: ${city}`);
  console.log('');

  try {
    const payload = { limit };
    if (city) payload.city = city;

    console.log('🚀 Sending request to Edge Function...\n');

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify(payload),
      timeout: 600000 // 10 minutes
    });

    const data = await response.json();

    console.log('='.repeat(80));
    console.log('📊 RESULTS\n');
    
    if (data.success) {
      console.log(`  ✅ Success!`);
      console.log(`\n  📦 Listings processed: ${data.processed}`);
      console.log(`  ✅ Images downloaded: ${data.downloaded}`);
      console.log(`  ❌ Images failed: ${data.failed}`);
      
      const successRate = data.downloaded + data.failed > 0 
        ? ((data.downloaded / (data.downloaded + data.failed)) * 100).toFixed(1)
        : 0;
      console.log(`  📈 Success rate: ${successRate}%`);

      if (data.results && data.results.length > 0) {
        console.log(`\n  📍 Sample results (first ${Math.min(5, data.results.length)}):\n`);
        data.results.slice(0, 5).forEach((result, i) => {
          console.log(`    ${i + 1}. ${result.listingName} (${result.city})`);
          console.log(`       ✅ ${result.downloaded} | ❌ ${result.failed}`);
        });
      }
    } else {
      console.log(`  ❌ Error: ${data.error || data.message}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error triggering function:', error.message);
    console.error('\nMake sure:');
    console.error('  1. Supabase project is configured');
    console.error('  2. Edge Function has been deployed');
    console.error('  3. nearby_listings storage bucket exists');
    process.exit(1);
  }
}

triggerDownloader();
