import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://corcofbmafdxehvlbesx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'
);

async function getAll() {
  try {
    console.log('Fetching all crypto pairs...');
    
    const { data: allCryptos, error } = await supabase
      .from('pairs')
      .select('from_currency, to_currency')
      .eq('source_table', 'cryptocurrency_rates');

    if (error) {
      console.error('Error:', error);
      return;
    }

    // Collect all unique currencies (both from and to)
    const allUnique = new Set();
    allCryptos.forEach(p => {
      allUnique.add(p.from_currency);
      allUnique.add(p.to_currency);
    });

    const sortedCryptos = Array.from(allUnique).sort();
    console.log(`\nTotal unique cryptos: ${sortedCryptos.length}`);
    console.log('\nList:');
    sortedCryptos.forEach(c => console.log(`  ${c}`));

    console.log("\n\nFor SQL IN clause:");
    console.log(`('${sortedCryptos.join("', '")}')`);

  } catch (err) {
    console.error('Failed:', err);
  }
}

getAll().catch(console.error);
