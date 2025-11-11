import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function getAll() {
  try {
    // Get ALL crypto rates (no limit)
    const { data: allCryptos, error } = await supabase
      .from('pairs')
      .select('from_currency, rate')
      .eq('source_table', 'cryptocurrency_rates');

    if (error) {
      console.error('Error:', error);
      return;
    }

    // Get unique from_currency values
    const uniqueMap = new Map();
    allCryptos.forEach(p => {
      if (!uniqueMap.has(p.from_currency)) {
        uniqueMap.set(p.from_currency, p.rate);
      }
    });

    const uniqueCryptos = Array.from(uniqueMap.keys()).sort();
    console.log('All cryptocurrencies:');
    console.log(uniqueCryptos.join("', '"));
    console.log(`\nTotal: ${uniqueCryptos.length} cryptocurrencies`);

    // Output for SQL IN clause
    console.log("\nFor SQL IN clause:");
    console.log(`('${uniqueCryptos.join("', '")}')`);

  } catch (err) {
    console.error('Failed:', err);
  }
}

getAll().catch(console.error);
