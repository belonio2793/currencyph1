import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function check() {
  try {
    console.log('Checking inverted crypto rates...\n');

    // Get PHP-to-crypto rates
    const { data: phpCryptoRates } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate')
      .eq('from_currency', 'PHP')
      .eq('source_table', 'cryptocurrency_rates')
      .in('to_currency', ['BTC', 'ETH', 'SOLANA', 'BNB', 'DOGECOIN']);

    console.log('PHP-to-crypto rates (from database):');
    phpCryptoRates.forEach(r => {
      const inverted = 1 / r.rate;
      console.log(`  ${r.to_currency}: ${r.rate} (when inverted: ${inverted})`);
    });

    console.log('\n✓ Rates should be inverted in the Rates.jsx component');
    console.log('  Original: 1 PHP = 1804.51 BTC (wrong)');
    console.log('  Inverted: 1 BTC = 0.000554 PHP (better, but still seems off)');
    console.log('\nNote: The issue is that the base cryptocurrency rates are inverted in the database.');

  } catch (err) {
    console.error('Failed:', err);
  }
}

check().catch(console.error);
