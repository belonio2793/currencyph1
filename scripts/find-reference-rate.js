import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function find() {
  try {
    console.log('Looking for reference rates...\n');

    // Check if there's a stablecoin like TETHER with PHP
    const { data: tetherRates } = await supabase
      .from('pairs')
      .select('*')
      .or('to_currency.eq.TETHER,from_currency.eq.TETHER')
      .eq('source_table', 'cryptocurrency_rates')
      .limit(20);

    console.log('TETHER-related rates:');
    tetherRates.forEach(r => {
      console.log(`  ${r.from_currency} -> ${r.to_currency}: ${r.rate}`);
    });

    // Check PHP -> USD
    console.log('\n\nPHP to USD rate:');
    const { data: phpUsd } = await supabase
      .from('pairs')
      .select('*')
      .eq('from_currency', 'PHP')
      .eq('to_currency', 'USD')
      .eq('source_table', 'currency_rates');

    if (phpUsd && phpUsd.length > 0) {
      console.log(`  PHP -> USD: ${phpUsd[0].rate}`);
      console.log('\n✓ We can use PHP->USD to convert crypto!');
      console.log('Solution: crypto-to-TETHER * TETHER-to-USD * USD-to-PHP = PHP-to-crypto');
    }

  } catch (err) {
    console.error('Failed:', err);
  }
}

find().catch(console.error);
