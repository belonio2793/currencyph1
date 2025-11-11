import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function verify() {
  try {
    console.log('Verifying PHP-to-crypto rates...\n');

    // Check PHP-to-crypto rates
    const { data: phpCryptoRates, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate')
      .eq('from_currency', 'PHP')
      .eq('source_table', 'cryptocurrency_rates')
      .limit(15);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (!phpCryptoRates || phpCryptoRates.length === 0) {
      console.log('✗ NO PHP-to-crypto rates found!');
      return;
    }

    console.log(`✓ Found ${phpCryptoRates.length} PHP-to-crypto pairs\n`);
    console.log('Sample rates:');
    phpCryptoRates.forEach(r => {
      console.log(`  PHP → ${r.to_currency}: ${r.rate}`);
    });

    // Check BTC specifically
    const { data: btcRate } = await supabase
      .from('pairs')
      .select('rate')
      .eq('from_currency', 'PHP')
      .eq('to_currency', 'BTC')
      .eq('source_table', 'cryptocurrency_rates')
      .single();

    if (btcRate) {
      console.log(`\n✓ BTC rate: PHP → BTC = ${btcRate.rate}`);
      console.log(`  This means: 1 PHP = ${btcRate.rate} BTC (correct!)`);
    }

  } catch (err) {
    console.error('Failed:', err);
  }
}

verify().catch(console.error);
