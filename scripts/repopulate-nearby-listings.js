#!/usr/bin/env node

/**
 * Repopulate Nearby Listings from CSV Data
 * 
 * This script:
 * 1. Reads from nearby-listings.csv (existing data)
 * 2. Connects to Supabase using service role key
 * 3. Backs up existing data
 * 4. Clears the table (optional)
 * 5. Repopulates with accurate listings from CSV
 * 
 * Usage:
 *   node scripts/repopulate-nearby-listings.js [options]
 * 
 * Options:
 *   --clear            Clear table before populating
 *   --dry-run          Preview without inserting
 *   --limit N          Import max N listings (default: all)
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Environment variables
const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate credentials
if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.error('   VITE_PROJECT_URL:', PROJECT_URL ? '✓' : '✗')
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)

// Configuration
const CSV_FILE = path.join(__dirname, '..', 'nearby-listings.csv')
const BACKUP_FILE = path.join(__dirname, '..', 'nearby_listings_backup.json')
const BATCH_SIZE = 100

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    clear: false,
    dryRun: false,
    limit: Infinity,
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--clear') {
      options.clear = true
    } else if (args[i] === '--dry-run') {
      options.dryRun = true
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1])
      i++
    }
  }

  return options
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty')
  }

  const headers = lines[0].split(',').map(h => h.trim())
  const headerMap = {}
  headers.forEach((h, i) => {
    headerMap[h] = i
  })

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      const nextChar = line[j + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)

    const row = {}
    headers.forEach((header, idx) => {
      let value = values[idx] || ''
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      row[header] = value || null
    })

    rows.push(row)
  }

  return rows
}

// Convert CSV row to database object
function csvRowToListing(row) {
  const now = new Date().toISOString()

  const parseJSON = (str) => {
    if (!str || str === '' || str === '{}' || str === '[]') return null
    try {
      return JSON.parse(str)
    } catch (e) {
      return null
    }
  }

  const parseNumber = (str) => {
    if (!str || str === '') return null
    const num = parseFloat(str)
    return isNaN(num) ? null : num
  }

  const parseBoolean = (str) => {
    if (!str) return null
    return str.toLowerCase() === 'true'
  }

  const parseArray = (str) => {
    if (!str || str === '' || str === '[]') return null
    try {
      const arr = JSON.parse(str)
      return Array.isArray(arr) ? arr : null
    } catch (e) {
      return null
    }
  }

  return {
    tripadvisor_id: row.tripadvisor_id || null,
    slug: row.slug || '',
    name: row.name || 'Unknown',
    address: row.address || null,
    city: row.city || null,
    country: row.country || 'Philippines',
    location_type: row.location_type || null,
    category: row.category || null,
    description: row.description || null,
    latitude: parseNumber(row.latitude),
    longitude: parseNumber(row.longitude),
    lat: parseNumber(row.lat),
    lng: parseNumber(row.lng),
    rating: parseNumber(row.rating),
    review_count: parseNumber(row.review_count) || parseNumber(row.num_reviews),
    review_details: parseJSON(row.review_details),
    image_url: row.image_url || row.primary_image_url || null,
    featured_image_url: row.featured_image_url || null,
    primary_image_url: row.primary_image_url || null,
    photo_urls: parseArray(row.photo_urls),
    photo_count: parseNumber(row.photo_count),
    stored_image_path: row.stored_image_path || null,
    image_downloaded_at: row.image_downloaded_at || null,
    website: row.website || null,
    web_url: row.web_url || null,
    phone_number: row.phone_number || row.phone || null,
    highlights: parseArray(row.highlights),
    amenities: parseArray(row.amenities),
    awards: parseArray(row.awards),
    hours_of_operation: parseJSON(row.hours_of_operation),
    accessibility_info: parseJSON(row.accessibility_info),
    nearby_attractions: parseArray(row.nearby_attractions),
    best_for: parseArray(row.best_for),
    price_level: parseNumber(row.price_level),
    price_range: row.price_range || null,
    duration: row.duration || null,
    ranking_in_city: row.ranking_in_city || null,
    ranking_in_category: parseNumber(row.ranking_in_category),
    visibility_score: parseNumber(row.visibility_score),
    verified: parseBoolean(row.verified),
    fetch_status: row.fetch_status || 'success',
    fetch_error_message: row.fetch_error_message || null,
    last_verified_at: row.last_verified_at || null,
    source: row.source || 'tripadvisor_direct',
    created_at: row.created_at || now,
    updated_at: row.updated_at || now,
    raw: parseJSON(row.raw),
    currency: row.currency || 'PHP',
    timezone: row.timezone || 'Asia/Manila',
    region_name: row.region_name || null,
    city_id: row.city_id || null,
  }
}

// Backup existing data
async function backupExistingData() {
  try {
    console.log('📥 Backing up existing data...')
    const { data, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .limit(10000)

    if (error && !error.message.includes('no rows')) throw error
    
    if (data && data.length > 0) {
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2))
      console.log(`  ✅ Backed up ${data.length} listings`)
    } else {
      console.log(`  ℹ️  No existing data to backup`)
    }
  } catch (e) {
    console.error(`  ⚠️  Backup warning: ${e.message}`)
  }
}

// Clear table
async function clearTable() {
  try {
    console.log('🗑️  Clearing nearby_listings table...')
    await supabase
      .from('nearby_listings')
      .delete()
      .gte('id', 0)
    console.log('  ✅ Table cleared')
  } catch (e) {
    console.error(`  ⚠️  Clear skipped: ${e.message}`)
  }
}

// Insert batch
async function insertBatch(listings) {
  if (listings.length === 0) return { success: 0, failed: 0 }

  try {
    const { data, error } = await supabase
      .from('nearby_listings')
      .insert(listings, { returning: 'minimal' })

    if (error) {
      console.error(`  ❌ Insert error: ${error.message}`)
      return { success: 0, failed: listings.length }
    }

    return { success: listings.length, failed: 0 }
  } catch (e) {
    console.error(`  ❌ Insert error: ${e.message}`)
    return { success: 0, failed: listings.length }
  }
}

// Main execution
async function main() {
  const options = parseArgs()

  console.log('\n' + '='.repeat(100))
  console.log('REPOPULATE NEARBY_LISTINGS FROM CSV')
  console.log('='.repeat(100))

  // Check CSV file
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`\n❌ CSV file not found: ${CSV_FILE}`)
    process.exit(1)
  }

  console.log(`\n⚙️  Configuration:`)
  console.log(`  CSV file: ${CSV_FILE}`)
  console.log(`  Dry run: ${options.dryRun}`)
  console.log(`  Clear table: ${options.clear}`)
  console.log(`  Limit: ${options.limit === Infinity ? 'none' : options.limit}`)
  console.log(`  Batch size: ${BATCH_SIZE}\n`)

  // Parse CSV
  console.log('📖 Reading CSV file...')
  let rows
  try {
    rows = parseCSV(CSV_FILE)
    console.log(`  ✅ Parsed ${rows.length} rows from CSV\n`)
  } catch (e) {
    console.error(`  ❌ Error parsing CSV: ${e.message}`)
    process.exit(1)
  }

  if (rows.length === 0) {
    console.error('  ❌ No data in CSV file')
    process.exit(1)
  }

  // Apply limit
  if (options.limit < Infinity) {
    rows = rows.slice(0, options.limit)
  }

  // Backup and clear
  if (!options.dryRun) {
    await backupExistingData()

    if (options.clear) {
      await clearTable()
    }
  }

  // Convert and insert
  console.log(`📤 Processing ${rows.length} listings...\n`)

  let totalInserted = 0
  let totalFailed = 0
  const batch = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Skip if missing required fields
    if (!row.name || !row.name.trim()) {
      console.warn(`  ⚠️  Skipping row ${i + 2}: missing name`)
      continue
    }

    try {
      const listing = csvRowToListing(row)
      batch.push(listing)

      if (batch.length >= BATCH_SIZE) {
        if (!options.dryRun) {
          const result = await insertBatch(batch)
          totalInserted += result.success
          totalFailed += result.failed
          console.log(`  ✅ Inserted batch of ${result.success} listings`)
        } else {
          console.log(`  [DRY RUN] Would insert batch of ${batch.length} listings`)
        }
        batch.length = 0
      }
    } catch (e) {
      console.error(`  ❌ Error processing row ${i + 2}: ${e.message}`)
      totalFailed++
    }

    // Progress indicator
    if ((i + 1) % 500 === 0) {
      console.log(`  Processing... ${i + 1}/${rows.length}`)
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    if (!options.dryRun) {
      const result = await insertBatch(batch)
      totalInserted += result.success
      totalFailed += result.failed
      console.log(`  ✅ Inserted final batch of ${result.success} listings`)
    } else {
      console.log(`  [DRY RUN] Would insert final batch of ${batch.length} listings`)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(100))
  console.log('POPULATION COMPLETE')
  console.log('='.repeat(100))
  console.log(`\n📊 Results:`)
  console.log(`  Total processed: ${rows.length}`)
  console.log(`  Successfully inserted: ${totalInserted}`)
  console.log(`  Failed: ${totalFailed}`)
  if (options.dryRun) {
    console.log(`  📝 Dry run - no data was actually inserted`)
  }
  console.log(`\n📁 Files:`)
  if (fs.existsSync(BACKUP_FILE)) {
    console.log(`  Backup: ${BACKUP_FILE}`)
  }
  console.log(`\n✅ Done!\n`)
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e.message)
  process.exit(1)
})
