import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function check() {
  try {
    console.log('Checking for PHP-based cryptocurrency rates...\n');

    const { data: phpCryptoRates, error: err1 } = await supabase
      .from('pairs')
      .select('*')
      .eq('from_currency', 'PHP')
      .eq('source_table', 'cryptocurrency_rates')
      .limit(10);

    if (err1) {
      console.error('Error:', err1);
      return;
    }

    if (phpCryptoRates && phpCryptoRates.length > 0) {
      console.log('✓ PHP-to-Crypto rates found:');
      phpCryptoRates.forEach(r => {
        console.log(`  PHP -> ${r.to_currency}: ${r.rate}`);
      });
    } else {
      console.log('✗ NO PHP-to-Crypto rates found');
      console.log('\nLet me check all crypto pairs to understand the structure...\n');

      const { data: allCrypto, error: allErr } = await supabase
        .from('pairs')
        .select('from_currency, to_currency')
        .eq('source_table', 'cryptocurrency_rates');

      if (!allCrypto) {
        console.log('No crypto data returned');
        return;
      }

      const uniqueFroms = new Set(allCrypto.map(p => p.from_currency));
      const uniqueTos = new Set(allCrypto.map(p => p.to_currency));

      console.log('Unique FROM currencies:', Array.from(uniqueFroms).join(', '));
      console.log('Unique TO currencies:', Array.from(uniqueTos).slice(0, 10).join(', ') + '...');
    }

    console.log('\n\nChecking for any BTC rates...');
    const { data: btcRates } = await supabase
      .from('pairs')
      .select('from_currency, to_currency, rate')
      .or('from_currency.eq.BTC,to_currency.eq.BTC')
      .eq('source_table', 'cryptocurrency_rates')
      .limit(15);

    console.log('\nBTC-related rates:');
    btcRates.forEach(r => {
      console.log(`  ${r.from_currency} -> ${r.to_currency}: ${r.rate}`);
    });

  } catch (err) {
    console.error('Failed:', err);
  }
}

check().catch(console.error);
