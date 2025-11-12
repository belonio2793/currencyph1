#!/usr/bin/env node

/**
 * Test didit-sync Edge Function
 * This is the ONLY edge function in the simplified DIDIT integration
 */

const args = process.argv.slice(2);
const command = args[0] || 'test-sync';

async function testSync() {
  console.log('🔄 Testing didit-sync Edge Function\n');

  const projectUrl = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
  
  if (!projectUrl) {
    console.log('❌ PROJECT_URL not set\n');
    process.exit(1);
  }

  const syncUrl = `${projectUrl}/functions/v1/didit-sync`;
  console.log(`📍 Calling: ${syncUrl}\n`);

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ didit-sync responded successfully\n');
      console.log('Response:');
      console.log(JSON.stringify(data, null, 2));
      console.log();
    } else {
      console.log(`❌ didit-sync returned ${response.status}\n`);
      console.log('Error:');
      console.log(JSON.stringify(data, null, 2));
      console.log();
      process.exit(1);
    }
  } catch (err) {
    console.log(`❌ Failed to call didit-sync: ${err.message}\n`);
    process.exit(1);
  }
}

async function listPendingVerifications() {
  console.log('📋 Listing Pending Verifications\n');

  const supabaseUrl = process.env.PROJECT_URL || process.env.VITE_PROJECT_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing SUPABASE_SERVICE_ROLE_KEY or PROJECT_URL\n');
    process.exit(1);
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('user_verifications')
      .select('id, user_id, status, didit_session_id, submitted_at, updated_at')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.log(`❌ Failed to fetch: ${error.message}\n`);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('No pending verifications\n');
      return;
    }

    console.log(`Found ${data.length} pending verifications:\n`);
    for (const record of data) {
      const submitted = new Date(record.submitted_at).toLocaleString();
      const updated = new Date(record.updated_at).toLocaleString();
      console.log(`ID: ${record.user_id}`);
      console.log(`  Status: ${record.status}`);
      console.log(`  Session: ${record.didit_session_id}`);
      console.log(`  Submitted: ${submitted}`);
      console.log(`  Updated: ${updated}\n`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

async function checkEnv() {
  console.log('📋 Checking Environment Variables\n');

  const required = {
    'DIDIT_API_KEY': process.env.DIDIT_API_KEY,
    'PROJECT_URL': process.env.PROJECT_URL || process.env.VITE_PROJECT_URL,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  };

  let allSet = true;
  for (const [name, value] of Object.entries(required)) {
    if (value) {
      const masked = typeof value === 'string' ? value.substring(0, 8) + '...' : value;
      console.log(`✅ ${name}: ${masked}`);
    } else {
      console.log(`❌ ${name}: NOT SET`);
      allSet = false;
    }
  }
  console.log();

  if (!allSet) {
    console.log('⚠️  Some variables are missing\n');
    process.exit(1);
  }

  console.log('✨ All required variables are set!\n');
}

async function help() {
  console.log(`
🧪 DIDIT Sync Test Utility

Usage: node scripts/test-didit-sync.js [command]

Commands:
  test-sync          - Call didit-sync edge function (default)
  list-pending       - List pending verifications from database
  check-env          - Verify environment variables are set
  help               - Show this help message

Examples:
  node scripts/test-didit-sync.js test-sync
  node scripts/test-didit-sync.js list-pending
  node scripts/test-didit-sync.js check-env

Note: This is for the simplified DIDIT integration that uses ONLY didit-sync.
`);
}

(async () => {
  try {
    switch (command) {
      case 'test-sync':
        await testSync();
        break;
      case 'list-pending':
        await listPendingVerifications();
        break;
      case 'check-env':
        await checkEnv();
        break;
      case 'help':
        await help();
        break;
      default:
        console.log(`Unknown command: ${command}\n`);
        await help();
        process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
