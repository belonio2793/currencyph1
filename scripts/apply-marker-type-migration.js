#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Applying marker_type migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/add_marker_type_to_planning_markers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If the RPC doesn't exist, try direct execution using the query builder
      console.log('RPC approach failed, attempting direct SQL execution...');
      
      // Split by statements and execute
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error: sqlError } = await supabase.rpc('exec_raw_sql', {
            query: statement
          });
          
          if (sqlError && !sqlError.message.includes('function')) {
            console.error('Error executing statement:', sqlError);
          }
        }
      }
      
      console.log('Note: If direct SQL execution failed, you may need to execute the migration manually');
      console.log('Migration SQL content:');
      console.log(migrationSQL);
    } else {
      console.log('Migration applied successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('You can manually execute the following SQL in Supabase console:');
    const migrationPath = path.join(__dirname, '../supabase/migrations/add_marker_type_to_planning_markers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
  }
}

applyMigration();
