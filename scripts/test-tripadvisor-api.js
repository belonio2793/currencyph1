#!/usr/bin/env node

const apiKey = process.env.TRIPADVISOR || process.env.VITE_TRIPADVISOR;

console.log('\n🔍 TripAdvisor API Diagnostic Test');
console.log('==================================\n');
console.log('API Key Status:', apiKey ? '✓ Set (' + apiKey.substring(0, 10) + '...)' : '✗ NOT SET');
console.log('');

async function testEndpoints() {
  // Test 1: Private API - Search
  console.log('1️⃣ Testing Private API Search Endpoint:');
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/search?query=Manila&key=${apiKey}`;
    const response = await fetch(url);
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    if (response.ok) {
      console.log(`   ✓ Success! Found ${data.data?.length || 0} results`);
    } else {
      console.log(`   ✗ Error: ${data.error || response.statusText}`);
    }
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  console.log('');

  // Test 2: Private API - Location Details
  console.log('2️⃣ Testing Private API Location Details:');
  try {
    const url = `https://api.tripadvisor.com/api/private/2.1/locations/298573?key=${apiKey}`;
    const response = await fetch(url);
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    if (response.ok) {
      console.log(`   ✓ Success! Got location: ${data.name}`);
    } else {
      console.log(`   ✗ Error: ${data.error || response.statusText}`);
    }
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  console.log('');

  // Test 3: Public API
  console.log('3️⃣ Testing Public API (Partner API):');
  try {
    const url = `https://api.tripadvisor.com/api/partner/2.0/locations/search?query=Manila&limit=5`;
    const response = await fetch(url, {
      headers: {
        'X-TripAdvisor-API-Key': apiKey
      }
    });
    console.log(`   Status: ${response.status}`);
    const data = await response.json();
    if (response.ok) {
      console.log(`   ✓ Success! Found ${data.data?.length || 0} results`);
      if (data.data && data.data.length > 0) {
        console.log(`   First result: ${data.data[0].name}`);
      }
    } else {
      console.log(`   ✗ Error: ${data.error || response.statusText}`);
    }
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  console.log('');

  // Test 4: Basic connectivity
  console.log('4️⃣ Testing Basic Connectivity:');
  try {
    const response = await fetch('https://api.tripadvisor.com/');
    console.log(`   Status: ${response.status}`);
    console.log(`   ✓ TripAdvisor API is reachable`);
  } catch (e) {
    console.log(`   ✗ Cannot reach TripAdvisor API: ${e.message}`);
  }

  console.log('\n📋 Diagnosis Summary:');
  console.log('====================');
  console.log('If all tests failed:');
  console.log('  1. Check that TRIPADVISOR env var is set correctly');
  console.log('  2. Verify API key is valid (not expired)');
  console.log('  3. Check API key permissions');
  console.log('  4. Verify network connectivity');
  console.log('');
  console.log('Current environment variables:');
  console.log('  TRIPADVISOR:', process.env.TRIPADVISOR ? '✓ Set' : '✗ Not set');
  console.log('  VITE_TRIPADVISOR:', process.env.VITE_TRIPADVISOR ? '✓ Set' : '✗ Not set');
  console.log('');
}

testEndpoints().catch(console.error);
