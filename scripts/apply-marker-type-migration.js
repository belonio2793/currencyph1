#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables required');
  console.log('\nYou can manually execute the following SQL in Supabase dashboard:');
  const migrationPath = path.join(__dirname, '../supabase/migrations/add_marker_type_to_planning_markers.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('----------------------------------------');
  console.log(migrationSQL);
  console.log('----------------------------------------');
  process.exit(0);
}

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(supabaseUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify({ sql })),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            console.log('Note: Direct RPC execution not available, trying alternate approach...');
            resolve(null);
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ sql }));
    req.end();
  });
}

async function applyMigration() {
  try {
    console.log('🔄 Applying marker_type migration to planning_markers table...\n');
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/add_marker_type_to_planning_markers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Migration SQL:');
    console.log('----------------------------------------');
    console.log(migrationSQL);
    console.log('----------------------------------------\n');
    
    const result = await executeSql(migrationSQL);
    
    if (result) {
      console.log('✅ Migration applied successfully!');
      console.log('The marker_type column has been added to planning_markers table.');
      console.log('Default value: "Seller"');
    } else {
      console.log('⚠️  Direct SQL execution not available through this method.');
      console.log('\nTo apply the migration manually:');
      console.log('1. Go to https://app.supabase.com');
      console.log('2. Select your project');
      console.log('3. Go to SQL Editor');
      console.log('4. Create new query');
      console.log('5. Copy and paste the SQL shown above');
      console.log('6. Run the query');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Please execute the following SQL manually in Supabase SQL Editor:');
    console.log('----------------------------------------');
    const migrationPath = path.join(__dirname, '../supabase/migrations/add_marker_type_to_planning_markers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
    console.log('----------------------------------------');
  }
}

applyMigration();
