#!/usr/bin/env node
/*
test-photo-extraction.js

Quick test to verify Grok + ScrapingBee photo extraction setup.
Processes just 1-3 listings to verify everything works.

Usage:
  node scripts/test-photo-extraction.js
*/

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const X_API_KEY = process.env.X_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY

const SCRAPINGBEE_KEY = 'DHOMQK5VZOIUQN9JJZHFR3WX07XFGTFFYFVCRM6AOLZFGI5S9Z60R23AQM2LUL84M2SNK4HH9NGMVDCG'

console.log('\n=== Photo Extraction Setup Test ===\n')

// Check prerequisites
console.log('Checking prerequisites...')
if (!PROJECT_URL) {
  console.error('❌ Missing VITE_PROJECT_URL')
  process.exit(1)
}
console.log('✓ Supabase URL found')

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
console.log('✓ Supabase service role key found')

if (!X_API_KEY) {
  console.error('❌ Missing X_API_KEY (Grok)')
  process.exit(1)
}
console.log('✓ X_API_KEY (Grok) found')

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

async function testScrapingBee(url) {
  console.log('\n--- Testing ScrapingBee ---')
  console.log(`URL: ${url.substring(0, 80)}...`)
  
  try {
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_KEY,
      url: url,
      render_js: 'false',
      timeout: '15000'
    })

    const response = await fetch(`https://api.scrapingbee.com/api/v1/?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 20000
    })

    if (!response.ok) {
      console.error(`✗ ScrapingBee returned ${response.status}`)
      return null
    }

    const html = await response.text()
    console.log(`✓ ScrapingBee returned ${(html.length / 1024).toFixed(1)} KB of HTML`)
    
    // Count found URLs
    const dynamicUrls = (html.match(/https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo/g) || []).length
    const mediaUrls = (html.match(/https:\/\/media\.tacdn\.com\/media\/photo/g) || []).length
    
    console.log(`✓ Found ${dynamicUrls} dynamic-media-cdn URLs`)
    console.log(`✓ Found ${mediaUrls} media.tacdn URLs`)
    
    return html
  } catch (err) {
    console.error(`✗ ScrapingBee error: ${err.message}`)
    return null
  }
}

async function testGrok(html, listingName) {
  console.log('\n--- Testing Grok AI ---')
  
  try {
    const prompt = `Analyze this TripAdvisor listing for "${listingName}".
Extract all photo URLs matching these patterns:
1. https://dynamic-media-cdn.tripadvisor.com/media/photo...
2. https://media.tacdn.com/media/photo...

Return ONLY a JSON array, no other text. Example:
["https://dynamic-media-cdn.tripadvisor.com/media/photo-s/...", ...]

Exclude placeholders and logos.

HTML (first 20000 chars):
${html.substring(0, 20000)}

Return only JSON array.`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${X_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2048
      }),
      timeout: 30000
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`✗ Grok returned ${response.status}`)
      console.error(`  Error: ${error.substring(0, 100)}`)
      return []
    }

    const data = await response.json()
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('✗ Unexpected Grok response structure')
      return []
    }

    const content = data.choices[0].message.content.trim()
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    
    if (!jsonMatch) {
      console.error('✗ No JSON array found in Grok response')
      console.error(`  Response: ${content.substring(0, 200)}`)
      return []
    }

    try {
      const urls = JSON.parse(jsonMatch[0])
      if (Array.isArray(urls) && urls.length > 0) {
        console.log(`✓ Grok extracted ${urls.length} photo URLs`)
        console.log(`�� First URL: ${urls[0].substring(0, 80)}...`)
        return urls.slice(0, 5)
      } else {
        console.error('✗ Grok returned empty array')
        return []
      }
    } catch (parseErr) {
      console.error(`✗ JSON parse error: ${parseErr.message}`)
      return []
    }
  } catch (err) {
    console.error(`✗ Grok request error: ${err.message}`)
    return []
  }
}

async function main() {
  try {
    console.log('\n--- Fetching test listings from database ---')
    
    const { data: listings, error } = await supabase
      .from('nearby_listings')
      .select('id, name, city, web_url')
      .not('web_url', 'is', null)
      .neq('web_url', 'https://www.tripadvisor.com/')
      .limit(3)
    
    if (error) {
      console.error('✗ Database error:', error.message)
      process.exit(1)
    }

    if (!listings || listings.length === 0) {
      console.error('✗ No listings found in database')
      process.exit(1)
    }

    console.log(`✓ Found ${listings.length} test listings\n`)

    for (const listing of listings) {
      console.log(`\n════════════════════════════════════════`)
      console.log(`[${listing.id}] ${listing.name}`)
      console.log(`City: ${listing.city}`)
      console.log(`═══════════��════════════════════════════`)

      // Test ScrapingBee
      const html = await testScrapingBee(listing.web_url)
      
      if (!html) {
        console.log('\n⚠️  Skipping Grok test (no HTML)')
        continue
      }

      // Test Grok
      const photoUrls = await testGrok(html, listing.name)

      if (photoUrls.length > 0) {
        console.log('\n✓ SUCCESS: Both ScrapingBee and Grok working!')
      } else {
        console.log('\n⚠️  Grok returned no URLs, but ScrapingBee works')
      }

      // Small delay between listings
      await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`\n\n=== Test Complete ===`)
    console.log(`\nIf you saw ✓ marks above, everything is working!`)
    console.log(`\nNext step: Run the full extraction with:`)
    console.log(`  node scripts/grok-photo-urls-extractor.js --batch=10`)
    console.log(`\nOr use npm:`)
    console.log(`  yarn extract-photo-urls\n`)

  } catch (err) {
    console.error('\n✗ Fatal error:', err.message)
    process.exit(1)
  }
}

main()
