import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function check() {
  try {
    // Get all unique crypto FROM currencies
    const { data: cryptos, error: err1 } = await supabase
      .from('pairs')
      .select('from_currency')
      .eq('source_table', 'cryptocurrency_rates');

    if (err1) {
      console.error('Error:', err1);
      return;
    }

    const uniqueCryptos = [...new Set(cryptos.map(p => p.from_currency))].sort();
    console.log('All unique cryptocurrencies in database:');
    console.log(uniqueCryptos.join("', '"));
    console.log(`\nTotal: ${uniqueCryptos.length} cryptocurrencies\n`);

    // Check for existing PHP-to-crypto pairs
    const { data: existing } = await supabase
      .from('pairs')
      .select('to_currency')
      .eq('from_currency', 'PHP')
      .eq('source_table', 'cryptocurrency_rates');

    if (existing && existing.length > 0) {
      console.log('Already existing PHP-to-crypto pairs:');
      console.log(existing.map(p => p.to_currency).join(', '));
    }

  } catch (err) {
    console.error('Failed:', err);
  }
}

check().catch(console.error);
