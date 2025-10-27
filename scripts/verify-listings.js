#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { count } = await supabase
    .from('nearby_listings')
    .select('*', { count: 'exact', head: true });

  console.log('\n✅ Total listings in database:', count);

  const { data: sample } = await supabase
    .from('nearby_listings')
    .select('name, city, category, rating')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📋 Sample listings (5 most recent):');
  sample?.forEach((s, i) => {
    console.log(`  ${i+1}. ${s.name}`);
    console.log(`     City: ${s.city} | Category: ${s.category} | Rating: ⭐ ${s.rating}`);
  });

  const { data: byCategory } = await supabase
    .from('nearby_listings')
    .select('category')
    .then(res => res);

  const categories = {};
  byCategory?.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });

  console.log('\n📊 Listings by category:');
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\n✨ Database is ready! Visit /nearby to see all listings.\n');
}

main();
