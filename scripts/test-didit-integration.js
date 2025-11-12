#!/usr/bin/env node

/**
 * DIDIT Integration Test Utility
 * 
 * Tests the DIDIT verification integration end-to-end
 * Usage: node scripts/test-didit-integration.js [command] [args]
 * 
 * Commands:
 *   - test-env: Verify all required environment variables are set
 *   - test-api: Test DIDIT API connectivity
 *   - test-session: Create a test session and check status
 *   - test-webhook: Verify webhook signature validation
 *   - check-db: Check user_verifications table schema
 *   - list-verifications: List all verification records
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const args = process.argv.slice(2);
const command = args[0] || 'test-env';

// Configuration
const config = {
  supabaseUrl: process.env.PROJECT_URL || process.env.VITE_PROJECT_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  diditApiKey: process.env.DIDIT_API_KEY,
  diditAppId: process.env.DIDIT_APP_ID,
  diditWorkflowId: process.env.DIDIT_WORKFLOW_ID,
  diditWebhookSecret: process.env.DIDIT_WEBHOOK_SECRET,
};

// Initialize Supabase
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

console.log('🧪 DIDIT Integration Test Utility\n');

async function testEnv() {
  console.log('📋 Testing Environment Variables...\n');
  
  const required = {
    'PROJECT_URL or VITE_PROJECT_URL': config.supabaseUrl,
    'SUPABASE_SERVICE_ROLE_KEY': config.supabaseServiceKey,
    'DIDIT_API_KEY': config.diditApiKey,
    'DIDIT_WORKFLOW_ID': config.diditWorkflowId,
    'DIDIT_WEBHOOK_SECRET': config.diditWebhookSecret,
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
  
  if (allSet) {
    console.log('\n✨ All environment variables are set!\n');
  } else {
    console.log('\n⚠️  Some environment variables are missing. Please configure them.\n');
    process.exit(1);
  }
}

async function testApi() {
  console.log('🌐 Testing DIDIT API Connectivity...\n');
  
  if (!config.diditApiKey || !config.diditWorkflowId) {
    console.log('❌ Missing DIDIT_API_KEY or DIDIT_WORKFLOW_ID\n');
    return;
  }
  
  try {
    const response = await fetch('https://verification.didit.me/v2/session/', {
      method: 'POST',
      headers: {
        'x-api-key': config.diditApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: config.diditWorkflowId,
        ...(config.diditAppId && { app_id: config.diditAppId }),
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ DIDIT API is reachable and responsive');
      console.log(`   Session URL: ${data.url}`);
      console.log(`   Session ID: ${data.session_id}\n`);
    } else {
      const error = await response.text();
      console.log(`❌ DIDIT API error: ${response.status}`);
      console.log(`   ${error}\n`);
    }
  } catch (err) {
    console.log(`❌ Failed to connect to DIDIT API: ${err.message}\n`);
  }
}

async function testSession() {
  console.log('🔐 Testing Session Creation and Status Check...\n');
  
  const testUserId = 'test-' + Math.random().toString(36).substr(2, 9);
  
  try {
    // Create session
    console.log(`Creating session for test user: ${testUserId}`);
    const createResponse = await fetch('https://verification.didit.me/v2/session/', {
      method: 'POST',
      headers: {
        'x-api-key': config.diditApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: config.diditWorkflowId,
        ...(config.diditAppId && { app_id: config.diditAppId }),
      }),
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create session: ${createResponse.status}`);
    }
    
    const sessionData = await createResponse.json();
    const sessionId = sessionData.session_id;
    const sessionUrl = sessionData.url;
    
    console.log(`✅ Session created successfully`);
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Session URL: ${sessionUrl}\n`);
    
    // Check status
    console.log('Checking session status...');
    const statusResponse = await fetch(
      `https://verification.didit.me/v2/session/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': config.diditApiKey,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!statusResponse.ok) {
      throw new Error(`Failed to check status: ${statusResponse.status}`);
    }
    
    const statusData = await statusResponse.json();
    console.log(`✅ Status check successful`);
    console.log(`   Status: ${statusData.status || 'Pending'}`);
    console.log(`   Response: ${JSON.stringify(statusData, null, 2)}\n`);
    
  } catch (err) {
    console.log(`❌ Session test failed: ${err.message}\n`);
  }
}

async function testWebhook() {
  console.log('🔔 Testing Webhook Signature Validation...\n');
  
  if (!config.diditWebhookSecret) {
    console.log('❌ DIDIT_WEBHOOK_SECRET not set\n');
    return;
  }
  
  const testPayload = {
    session_id: 'test-session-123',
    status: 'Approved',
    decision: {
      first_name: 'John',
      last_name: 'Doe',
      document_type: 'passport',
      document_number: 'AB123456',
    },
    workflow_id: config.diditWorkflowId,
    timestamp: new Date().toISOString(),
  };
  
  const bodyString = JSON.stringify(testPayload);
  const messageBuffer = Buffer.from(bodyString + config.diditWebhookSecret);
  const hashBuffer = crypto.createHash('sha256').update(messageBuffer).digest();
  const computedSignature = hashBuffer.toString('hex');
  
  console.log(`Test payload:\n${JSON.stringify(testPayload, null, 2)}\n`);
  console.log(`Computed signature: ${computedSignature}\n`);
  
  // Verify signature
  const messageBuffer2 = Buffer.from(bodyString + config.diditWebhookSecret);
  const hashBuffer2 = crypto.createHash('sha256').update(messageBuffer2).digest();
  const computedSignature2 = hashBuffer2.toString('hex');
  
  if (computedSignature === computedSignature2) {
    console.log('✅ Signature validation works correctly\n');
  } else {
    console.log('❌ Signature validation failed\n');
  }
}

async function checkDb() {
  console.log('📊 Checking Database Schema...\n');
  
  try {
    // Check if table exists
    const { data: tables, error: tablesError } = await supabase.rpc(
      'information_schema.tables',
      {}
    ).select().eq('table_name', 'user_verifications');
    
    // Try direct query instead
    const { data, error } = await supabase
      .from('user_verifications')
      .select('*')
      .limit(1);
    
    if (!error) {
      console.log('✅ user_verifications table exists\n');
      
      // Check for DIDIT columns
      const { data: sampleRecord } = await supabase
        .from('user_verifications')
        .select('*')
        .limit(1);
      
      if (sampleRecord && sampleRecord.length > 0) {
        const record = sampleRecord[0];
        const diditColumns = [
          'didit_workflow_id',
          'didit_session_id',
          'didit_session_url',
          'didit_decision',
          'didit_verified_at',
          'document_type',
          'is_public',
          'verification_method',
        ];
        
        console.log('Checking for DIDIT columns:');
        for (const col of diditColumns) {
          if (col in record) {
            console.log(`  ✅ ${col}`);
          } else {
            console.log(`  ⚠️  ${col} (may not exist or is NULL)`);
          }
        }
      }
      console.log();
    } else {
      console.log(`❌ Failed to access user_verifications table: ${error.message}\n`);
    }
    
    // Check for RPC function
    console.log('Checking for RPC functions:');
    try {
      const rpcTest = await supabase.rpc('update_verification_from_didit', {
        p_didit_session_id: 'test-id',
        p_status: 'pending',
        p_decision: {},
      });
      console.log('  ✅ update_verification_from_didit');
    } catch (err) {
      console.log(`  ❌ update_verification_from_didit: ${err.message}`);
    }
    console.log();
    
  } catch (err) {
    console.log(`❌ Database check failed: ${err.message}\n`);
  }
}

async function listVerifications() {
  console.log('📋 Listing All Verifications...\n');
  
  try {
    const { data, error } = await supabase
      .from('user_verifications')
      .select('id, user_id, status, document_type, didit_verified_at, is_public')
      .order('submitted_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log(`❌ Failed to fetch verifications: ${error.message}\n`);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No verifications found.\n');
      return;
    }
    
    console.log('Recent Verifications:');
    console.log('─'.repeat(100));
    for (const record of data) {
      console.log(`
User ID: ${record.user_id}
Status: ${record.status}
Document Type: ${record.document_type || 'N/A'}
Verified: ${record.didit_verified_at ? new Date(record.didit_verified_at).toLocaleString() : 'N/A'}
Public: ${record.is_public ? 'Yes' : 'No'}
─`.repeat(1));
    }
    console.log();
    
  } catch (err) {
    console.log(`❌ Failed to list verifications: ${err.message}\n`);
  }
}

// Run command
(async () => {
  try {
    switch (command) {
      case 'test-env':
        await testEnv();
        break;
      case 'test-api':
        await testEnv();
        await testApi();
        break;
      case 'test-session':
        await testEnv();
        await testSession();
        break;
      case 'test-webhook':
        await testWebhook();
        break;
      case 'check-db':
        await checkDb();
        break;
      case 'list-verifications':
        await listVerifications();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log(`
Available commands:
  test-env              - Verify environment variables
  test-api              - Test DIDIT API connectivity
  test-session          - Create and check a test session
  test-webhook          - Test webhook signature validation
  check-db              - Check database schema
  list-verifications    - List recent verification records
`);
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
