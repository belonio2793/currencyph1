export async function searchPlaces(query, lat = null, lng = null, limit = 20) {
  const key = import.meta.env.VITE_TRIPADVISOR || import.meta.env.VITE_TRIPADVISOR_API_KEY || import.meta.env.TRIPADVISOR
  if (!key) return null

  const params = new URLSearchParams()
  if (query) params.append('query', query)
  params.append('limit', String(limit || 20))
  if (lat && lng) {
    params.append('lat', String(lat))
    params.append('lon', String(lng))
  }

  // TripAdvisor Content API locations search endpoint
  params.append('lang', 'en_US')
  params.append('currency', 'USD')
  const url = `https://api.tripadvisor.com/api/partner/2.0/locations/search?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        'X-TripAdvisor-API-Key': key,
        'Accept': 'application/json'
      }
    })

    if (!res.ok) {
      // non-2xx (likely 403 or 404) - treat as failure and return null so callers can fallback
      return null
    }

    const json = await res.json()

    // Normalize a few possible response shapes
    const items = json.data || json.results || json || []

    return (items || []).map(it => {
      const addr = it.address_obj ? [it.address_obj.street1, it.address_obj.city, it.address_obj.country].filter(Boolean).join(', ') : (it.address || it.address_string || '')
      return {
        id: (it.location_id || it.id || it.place_id || it.location_id)?.toString?.() || String(Math.random()).slice(2, 12),
        name: it.name || it.title || it.poi_name || '',
        address: addr,
        latitude: it.latitude || it.lat || (it.address_obj && it.address_obj.latitude) || null,
        longitude: it.longitude || it.lon || (it.address_obj && it.address_obj.longitude) || null,
        rating: it.rating || it.meg_rating || null,
        category: it.subcategory || (it.category && it.category.name) || (it.tag && it.tag.name) || null,
        raw: it
      }
    })
  } catch (err) {
    // Network failure / CORS / blocked request - return null so callers can fallback to local DB
    console.warn('TripAdvisor fetch failed:', err)
    return null
  }
}
