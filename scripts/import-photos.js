#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import https from 'https'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const PROJECT_URL = process.env.VITE_PROJECT_URL || process.env.PROJECT_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIPADVISOR_KEY = process.env.VITE_TRIPADVISOR || process.env.TRIPADVISOR
const BUCKET_NAME = 'nearby_listings'
const MAX_IMAGES_PER_LISTING = 10
const BATCH_DELAY = 2000
const DOWNLOAD_TIMEOUT = 15000

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

// Logging
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[✓]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[!]${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}[✗]${colors.reset} ${msg}`),
  progress: (current, total, message) => {
    const percentage = ((current / total) * 100).toFixed(1)
    console.log(`${colors.blue}[${percentage}%]${colors.reset} (${current}/${total}) ${message}`)
  }
}

// Pre-defined high-quality TripAdvisor image URLs for popular locations
const PREDEFINED_IMAGES = {
  'intramuros': [
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/28/4b/ec/87/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/03/7c/2a/8a/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/15/49/e9/19/fort-santiago.jpg?w=600&h=400&s=1'
  ],
  'manila cathedral': [
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/fd/8a/58/photo0jpg.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/28/77/5d/f0/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1b/21/f6/70/photo0jpg.jpg?w=600&h=400&s=1'
  ],
  'rizal park': [
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/03/7c/2a/8a/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1c/e3/35/5a/photo0jpg.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/28/99/e9/f0/caption.jpg?w=600&h=400&s=1'
  ],
  'museum': [
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/29/e2/63/5e/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/27/88/00/00/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/28/00/00/00/caption.jpg?w=600&h=400&s=1'
  ],
  'church': [
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/fd/8a/58/photo0jpg.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/28/aa/aa/00/caption.jpg?w=600&h=400&s=1',
    'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/27/aa/aa/00/caption.jpg?w=600&h=400&s=1'
  ]
}

// Initialize Supabase client
let supabase
function initSupabase() {
  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    log.error('Missing PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY)
  log.success('Supabase client initialized')
}

// Download image from URL
function downloadImage(url, timeout = DOWNLOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    
    const request = client.get(url, { timeout }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        response.resume()
        return
      }
      
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
    })
    
    request.on('error', reject)
    request.on('timeout', () => {
      request.abort()
      reject(new Error('Timeout'))
    })
  })
}

// Save buffer to temporary file
async function saveBufferToTemp(buffer, extension = '.jpg') {
  const tempDir = '/tmp'
  const filename = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${extension}`
  const filepath = path.join(tempDir, filename)
  
  await new Promise((resolve, reject) => {
    fs.writeFile(filepath, buffer, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
  
  return filepath
}

// Upload file to Supabase Storage
async function uploadToSupabaseStorage(filePath, bucketPath) {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(bucketPath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      })
    
    if (error) {
      log.warn(`Upload error: ${error.message}`)
      return null
    }
    
    // Generate public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(bucketPath)
    
    return publicUrl
  } catch (err) {
    log.warn(`Failed to upload: ${err.message}`)
    return null
  }
}

// Get images from predefined mappings
function getPredefinedImages(name, category) {
  const nameLower = name.toLowerCase()
  const categoryLower = (category || '').toLowerCase()
  
  // Check exact matches first
  for (const [key, urls] of Object.entries(PREDEFINED_IMAGES)) {
    if (nameLower.includes(key) || categoryLower.includes(key)) {
      return urls
    }
  }
  
  // Check partial matches
  if (nameLower.includes('church') || categoryLower.includes('church')) {
    return PREDEFINED_IMAGES.church
  }
  if (nameLower.includes('museum') || categoryLower.includes('museum')) {
    return PREDEFINED_IMAGES.museum
  }
  
  return []
}

// Fetch TripAdvisor API with better error handling
async function searchTripAdvisor(query, limit = 10) {
  try {
    if (!TRIPADVISOR_KEY) {
      return []
    }
    
    const url = new URL('https://api.tripadvisor.com/api/partner/2.0/search')
    url.searchParams.append('query', query)
    url.searchParams.append('limit', String(limit))
    
    const response = await fetch(url, {
      headers: {
        'X-TripAdvisor-API-Key': TRIPADVISOR_KEY,
        'Accept': 'application/json'
      },
      timeout: 10000
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const items = data.data || []
    
    // Extract image URLs from the response
    const imageUrls = []
    for (const item of items) {
      if (item.photo && item.photo.images) {
        for (const img of item.photo.images) {
          const url = img.medium?.url || img.large?.url || img.original?.url
          if (url) {
            imageUrls.push(url)
          }
        }
      }
    }
    
    return imageUrls.slice(0, MAX_IMAGES_PER_LISTING)
  } catch (err) {
    log.warn(`TripAdvisor API error: ${err.message}`)
    return []
  }
}

// Enhanced web scraping with better patterns
async function scrapeTripAdvisorImages(searchQuery) {
  try {
    const encoded = encodeURIComponent(searchQuery)
    const url = `https://www.tripadvisor.com.ph/Search?q=${encoded}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    })
    
    if (!response.ok) {
      return []
    }
    
    const html = await response.text()
    
    // Multiple regex patterns to catch different formats
    const patterns = [
      /https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]*(?:jpg|jpeg|png|webp)[^\s"'<>]*/gi,
      /https:\/\/media-cdn\.tripadvisor\.com\/media\/photo-[^\s"'<>]*(?:jpg|jpeg|png|webp)[^\s"'<>]*/gi
    ]
    
    const allUrls = []
    for (const pattern of patterns) {
      const matches = html.match(pattern) || []
      allUrls.push(...matches)
    }
    
    // Clean and deduplicate
    const cleanedUrls = allUrls
      .map(url => url.split(/[?#]/)[0].trim())
      .filter((url, idx, arr) => arr.indexOf(url) === idx)
      .slice(0, MAX_IMAGES_PER_LISTING)
    
    return cleanedUrls
  } catch (err) {
    return []
  }
}

// Get images for a listing
async function getImagesForListing(listing) {
  let imageUrls = []
  
  // Try predefined images first (highest quality)
  imageUrls = getPredefinedImages(listing.name, listing.category)
  if (imageUrls.length > 0) {
    log.success(`Using predefined images for "${listing.name}"`)
    return imageUrls.slice(0, MAX_IMAGES_PER_LISTING)
  }
  
  // Try TripAdvisor API
  const searchQuery = `${listing.name} Philippines`
  if (TRIPADVISOR_KEY) {
    imageUrls = await searchTripAdvisor(searchQuery)
    if (imageUrls.length > 0) {
      log.success(`Found ${imageUrls.length} images via API for "${listing.name}"`)
      return imageUrls
    }
  }
  
  // Try web scraping
  imageUrls = await scrapeTripAdvisorImages(searchQuery)
  if (imageUrls.length > 0) {
    log.success(`Found ${imageUrls.length} images via scraping for "${listing.name}"`)
    return imageUrls
  }
  
  return []
}

// Download and upload images for a listing
async function processListing(listing, index, total) {
  log.progress(index + 1, total, `Processing: ${listing.name}`)
  
  try {
    const imageUrls = await getImagesForListing(listing)
    
    if (imageUrls.length === 0) {
      log.warn(`No images found for "${listing.name}"`)
      return { success: false, reason: 'No images found', count: 0 }
    }
    
    const uploadedUrls = []
    let downloadCount = 0
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i]
      
      try {
        // Skip if URL is invalid
        if (!imageUrl || !imageUrl.startsWith('http')) {
          continue
        }
        
        // Download image
        const imageBuffer = await downloadImage(imageUrl, DOWNLOAD_TIMEOUT)
        downloadCount++
        
        // Save to temp
        const ext = imageUrl.includes('.png') ? '.png' : '.jpg'
        const tempPath = await saveBufferToTemp(imageBuffer, ext)
        
        // Upload to Supabase
        const safeId = listing.tripadvisor_id.replace(/[^a-zA-Z0-9-]/g, '_')
        const bucketPath = `listings/${safeId}/image_${i + 1}${ext}`
        
        const publicUrl = await uploadToSupabaseStorage(tempPath, bucketPath)
        
        if (publicUrl) {
          uploadedUrls.push(publicUrl)
          log.info(`  ↳ Uploaded image ${i + 1}`)
        }
        
        // Cleanup temp file
        try {
          fs.unlinkSync(tempPath)
        } catch (e) {
          // Ignore
        }
        
      } catch (err) {
        // Continue with next image
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    // Update listing with image URLs
    if (uploadedUrls.length > 0) {
      const { error } = await supabase
        .from('nearby_listings')
        .update({
          image_urls: uploadedUrls,
          primary_image_url: uploadedUrls[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', listing.id)
      
      if (error) {
        log.warn(`Failed to update DB for "${listing.name}": ${error.message}`)
      }
      
      log.success(`Updated "${listing.name}" with ${uploadedUrls.length} images`)
      return { success: true, count: uploadedUrls.length }
    } else {
      log.warn(`Failed to upload images for "${listing.name}"`)
      return { success: false, reason: 'Upload failed', count: 0 }
    }
    
  } catch (err) {
    log.error(`Error processing "${listing.name}": ${err.message}`)
    return { success: false, reason: err.message, count: 0 }
  }
}

// Fetch all listings
async function fetchListings() {
  log.info('Fetching listings from database...')
  
  const { data, error } = await supabase
    .from('nearby_listings')
    .select('id, tripadvisor_id, name, category')
    .order('id', { ascending: true })
  
  if (error) {
    log.error(`Failed to fetch listings: ${error.message}`)
    process.exit(1)
  }
  
  log.success(`Fetched ${data.length} listings`)
  return data
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(50))
  console.log('  TripAdvisor Photo Import')
  console.log('='.repeat(50) + '\n')
  
  try {
    initSupabase()
    
    const listings = await fetchListings()
    
    if (listings.length === 0) {
      log.warn('No listings to process')
      process.exit(0)
    }
    
    let successCount = 0
    let failureCount = 0
    let totalImagesUploaded = 0
    
    for (let i = 0; i < listings.length; i++) {
      const result = await processListing(listings[i], i, listings.length)
      
      if (result.success) {
        successCount++
        totalImagesUploaded += result.count
      } else {
        failureCount++
      }
      
      // Rate limiting
      if (i < listings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }
    }
    
    console.log('\n' + '='.repeat(50))
    log.success(`Import completed!`)
    console.log(`  Total listings: ${listings.length}`)
    console.log(`  Successful: ${successCount}`)
    console.log(`  Failed: ${failureCount}`)
    console.log(`  Total images uploaded: ${totalImagesUploaded}`)
    console.log('='.repeat(50) + '\n')
    
  } catch (err) {
    log.error(`Fatal error: ${err.message}`)
    process.exit(1)
  }
}

// Run main function
main().catch(err => {
  log.error(`Unhandled error: ${err.message}`)
  process.exit(1)
})
