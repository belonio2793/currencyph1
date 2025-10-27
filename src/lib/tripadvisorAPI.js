function generateMockSearchResults(query, limit = 20) {
  const categories = ['hotels', 'restaurants', 'attractions', 'parks', 'museums', 'beaches']
  const results = []

  for (let i = 0; i < Math.min(limit, 10); i++) {
    const category = categories[i % categories.length]
    results.push({
      id: `mock-${query}-${i}-${Date.now()}`,
      name: `${category.charAt(0).toUpperCase() + category.slice(1)} ${i + 1} - ${query}`,
      address: `${100 + i} Main St, ${query}, Philippines`,
      latitude: null,
      longitude: null,
      rating: parseFloat((4.1 + Math.random() * 0.8).toFixed(1)),
      category: category,
      raw: { source: 'mock', query }
    })
  }
  return results
}

export async function searchPlaces(query, lat = null, lng = null, limit = 20) {
  const key = import.meta.env.VITE_TRIPADVISOR || import.meta.env.VITE_TRIPADVISOR_API_KEY || import.meta.env.TRIPADVISOR

  if (!key) {
    console.warn('TripAdvisor API key not available, returning mock results')
    return generateMockSearchResults(query, limit)
  }

  const params = new URLSearchParams()
  if (query) params.append('query', query)
  params.append('limit', String(limit || 20))
  if (lat && lng) {
    params.append('lat', String(lat))
    params.append('lon', String(lng))
  }

  // TripAdvisor Content API locations search endpoint
  const url = `https://api.tripadvisor.com/api/partner/2.0/locations/search?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        'X-TripAdvisor-API-Key': key,
        'Accept': 'application/json'
      }
    })

    if (!res.ok) {
      console.warn(`TripAdvisor API returned ${res.status}, using mock results`)
      return generateMockSearchResults(query, limit)
    }

    const json = await res.json()

    // Check for error in response
    if (json.error) {
      console.warn(`TripAdvisor API error: ${json.error.message}, using mock results`)
      return generateMockSearchResults(query, limit)
    }

    // Normalize a few possible response shapes
    const items = json.data || json.results || json || []

    if (!items || items.length === 0) {
      console.warn(`No results from TripAdvisor for "${query}", using mock results`)
      return generateMockSearchResults(query, limit)
    }

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
    console.warn('TripAdvisor fetch failed:', err.message, '- using mock results')
    return generateMockSearchResults(query, limit)
  }
}
