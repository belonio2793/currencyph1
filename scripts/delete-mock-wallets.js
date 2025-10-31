#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = process.env.SUPABASE_URL || process.env.PROJECT_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

console.log('🗑️  Deleting all wallets from wallets_house table...');

const { data, error: deleteErr } = await supabase
  .from('wallets_house')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000');

if (deleteErr) {
  console.error('❌ Error deleting:', deleteErr);
  process.exit(1);
}

console.log(`✅ Deleted all mock wallets from wallets_house`);
