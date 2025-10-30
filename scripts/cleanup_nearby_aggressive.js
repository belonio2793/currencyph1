#!/usr/bin/env node
/*
  Aggressive cleanup script for nearby_listings:
  - For listings missing coordinates (latitude or longitude) OR missing BOTH phone_number AND website,
    attempt to source missing data from candidate URLs or geocode the address.
  - If after attempts the listing still lacks coordinates AND lacks both phone and website, it will be deleted.

  Requirements: environment variables set in the environment where this runs:
  - VITE_PROJECT_URL (supabase URL)
  - SUPABASE_SERVICE_ROLE_KEY (service role key)

  Usage: node scripts/cleanup_nearby_aggressive.js
*/

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or service role key. Set VITE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const delay = (ms) => new Promise(r => setTimeout(r, ms))

function extractPhoneFromHtml(html) {
  // Look for tel: links
  try {
    const telRegex = /tel:\/?\/?\+?[0-9\-()\s]{6,}/gi
    const match = html.match(telRegex)
    if (match && match.length > 0) return match[0].replace(/tel:\/?\/?/i, '').trim()

    // common phone patterns
    const phoneRegex = /(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g
    const m2 = html.match(phoneRegex)
    if (m2 && m2.length > 0) return m2[0].trim()
  } catch (e) {
    // ignore
  }
  return null
}

function extractCoordsFromHtml(html) {
  // try a few common patterns
  try {
    // geo.position meta (lat;lon)
    const geoMeta = html.match(/<meta[^>]+name=["']geo.position["'][^>]+content=["']([^"']+)["']/i)
    if (geoMeta && geoMeta[1]) {
      const [lat, lon] = geoMeta[1].split(/[;,\s]+/)
      if (lat && lon) return { latitude: parseFloat(lat), longitude: parseFloat(lon) }
    }

    // meta place:location:latitude and longitude
    const latMeta = html.match(/<meta[^>]+property=["']place:location:latitude["'][^>]+content=["']([^"']+)["']/i)
    const lonMeta = html.match(/<meta[^>]+property=["']place:location:longitude["'][^>]+content=["']([^"']+)["']/i)
    if (latMeta && lonMeta) return { latitude: parseFloat(latMeta[1]), longitude: parseFloat(lonMeta[1]) }

    // look for coordinates in JS: "latitude": 10.6646, "longitude": 122.9412
    const jsonCoords = html.match(/["']?latitude["']?\s*[:=]\s*([0-9]{1,3}\.?[0-9]+)[,\s\n\r]+["']?longitude["']?\s*[:=]\s*([0-9]{1,3}\.?[0-9]+)/i)
    if (jsonCoords) return { latitude: parseFloat(jsonCoords[1]), longitude: parseFloat(jsonCoords[2]) }

    // maps.google.com/?q=lat,lon
    const mapsMatch = html.match(/maps\.google\.com\/[?][^\s"']*q=([0-9\.-]+),\s*([0-9\.-]+)/i)
    if (mapsMatch) return { latitude: parseFloat(mapsMatch[1]), longitude: parseFloat(mapsMatch[2]) }

    // data-lat and data-lon attributes
    const dataLat = html.match(/data-lat=["']?([0-9\.-]+)["']?/i)
    const dataLon = html.match(/data-lon=["']?([0-9\.-]+)["']?/i)
    if (dataLat && dataLon) return { latitude: parseFloat(dataLat[1]), longitude: parseFloat(dataLon[1]) }
  } catch (e) {
    // ignore
  }
  return null
}

async function geocodeAddress(address) {
  if (!address) return null
  try {
    const q = encodeURIComponent(address)
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'currency.ph cleanup script - email: nairobi@kenyan.com' } })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0]
      return { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) }
    }
  } catch (e) {
    // ignore
  }
  return null
}

async function tryFetchUrl(url) {
  if (!url) return null
  try {
    // some URLs might be protocol-relative; ensure http(s)
    if (url.startsWith('//')) url = 'https:' + url
    if (!url.startsWith('http')) url = 'https://' + url
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'currency.ph cleanup script' }, timeout: 15000 })
    if (!res.ok) return null
    const text = await res.text()
    return text
  } catch (e) {
    return null
  }
}

async function main() {
  console.log('Starting aggressive cleanup run...')

  // Fetch rows that either lack coords or lack both phone and website
  // We'll process in pages to avoid too-large queries
  const pageSize = 200
  let page = 0
  let totalProcessed = 0
  let totalUpdated = 0
  let totalDeleted = 0
  const toDeleteIds = []

  while (true) {
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .from('nearby_listings')
      .select('*')
      .or('latitude.is.null,longitude.is.null,phone_number.is.null,website.is.null')
      .range(from, to)

    if (error) {
      console.error('Error querying listings:', error)
      break
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      totalProcessed++
      const needsCoords = !(row.latitude && row.longitude)
      const needsContact = !(row.phone_number || row.website)

      // If neither missing, skip
      if (!needsCoords && !needsContact) continue

      let updatedFields = {}

      // Try candidate URLs to extract phone/coords
      const candidateUrls = []
      if (row.website) candidateUrls.push(row.website)
      // check raw urls (raw field may be JSON string or object)
      const raw = row.raw
      try {
        let rawObj
        if (raw && typeof raw === 'string') rawObj = JSON.parse(raw)
        else rawObj = raw || {}
        if (rawObj && typeof rawObj === 'object') {
          if (rawObj.url) candidateUrls.push(rawObj.url)
          if (rawObj.source_url) candidateUrls.push(rawObj.source_url)
          if (rawObj.tripadvisor_url) candidateUrls.push(rawObj.tripadvisor_url)
        }
      } catch (e) {
        // ignore
      }
      // tripadvisor_id may be useful but we won't construct URLs for now

      // Attempt to fetch candidate urls
      let pageHtml = null
      for (const u of candidateUrls) {
        if (!u) continue
        pageHtml = await tryFetchUrl(u)
        await delay(500) // be polite
        if (pageHtml) break
      }

      if (pageHtml) {
        if (needsContact) {
          const phone = extractPhoneFromHtml(pageHtml)
          if (phone) updatedFields.phone_number = phone
        }
        if (needsCoords) {
          const coords = extractCoordsFromHtml(pageHtml)
          if (coords) {
            updatedFields.latitude = coords.latitude
            updatedFields.longitude = coords.longitude
          }
        }
      }

      // If still missing coords, try geocoding from address
      if (needsCoords && (!updatedFields.latitude || !updatedFields.longitude)) {
        const fromAddress = row.address || `${row.name || ''} ${row.city || ''} ${row.country || ''}`.trim()
        if (fromAddress) {
          const geo = await geocodeAddress(fromAddress)
          await delay(1000) // respect Nominatim rate limits
          if (geo) {
            updatedFields.latitude = geo.latitude
            updatedFields.longitude = geo.longitude
          }
        }
      }

      // If updatedFields has data, update record
      if (Object.keys(updatedFields).length > 0) {
        const { error: upErr } = await supabase
          .from('nearby_listings')
          .update(updatedFields)
          .eq('id', row.id)
        if (upErr) console.error('Failed to update row', row.id, upErr)
        else {
          totalUpdated++
          console.log('Updated', row.id, updatedFields)
        }
      }

      // Re-evaluate whether to delete: require that after attempts both coords exist OR at least one contact exists
      const finalHasCoords = (updatedFields.latitude || row.latitude) && (updatedFields.longitude || row.longitude)
      const finalHasContact = (updatedFields.phone_number || row.phone_number || row.website)

      if (!finalHasCoords && !finalHasContact) {
        // delete
        const { error: delErr } = await supabase
          .from('nearby_listings')
          .delete()
          .eq('id', row.id)
        if (delErr) console.error('Failed to delete row', row.id, delErr)
        else {
          totalDeleted++
          toDeleteIds.push(row.id)
          console.log('Deleted listing', row.id, row.name)
        }
      }

      await delay(200) // small throttle
    }

    if (data.length < pageSize) break
    page++
  }

  console.log('Aggressive cleanup completed:')
  console.log('Processed:', totalProcessed)
  console.log('Updated:', totalUpdated)
  console.log('Deleted:', totalDeleted)
  console.log('Deleted IDs sample:', toDeleteIds.slice(0, 20))
}

main().catch(err => { console.error('Script error', err); process.exit(1) })
