import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://corcofbmafdxehvlbesx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  try {
    console.log('=== INVESTIGATING CRYPTOCURRENCY RATES ===\n');

    const { data: cryptoRates, error: cryptoError } = await supabase
      .from('pairs')
      .select('*')
      .eq('source_table', 'cryptocurrency_rates')
      .limit(10);

    if (cryptoError) {
      console.error('Error fetching crypto rates:', cryptoError);
      return;
    }

    console.log('Sample Cryptocurrency Rates:');
    cryptoRates.forEach(r => {
      console.log(`  ${r.from_currency} -> ${r.to_currency}: ${r.rate}`);
    });

    console.log('\n=== COMPARING WITH FIAT RATES ===\n');
    const { data: fiatRates, error: fiatError } = await supabase
      .from('pairs')
      .select('*')
      .eq('source_table', 'currency_rates')
      .eq('from_currency', 'PHP')
      .limit(5);

    if (fiatError) {
      console.error('Error fetching fiat rates:', fiatError);
      return;
    }

    console.log('Sample Fiat Rates (FROM PHP):');
    fiatRates.forEach(r => {
      console.log(`  ${r.from_currency} -> ${r.to_currency}: ${r.rate}`);
    });

  } catch (err) {
    console.error('Investigation failed:', err);
  }
}

investigate();
