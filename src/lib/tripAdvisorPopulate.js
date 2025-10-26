import { supabase } from './supabaseClient'

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/'

export async function populateAllTripAdvisorListings(onProgress) {
  try {
    if (onProgress) onProgress('Starting TripAdvisor population via CORS proxy...')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const tripKey = import.meta.env.VITE_TRIPADVISOR

    if (!supabaseUrl || !anonKey || !tripKey) {
      throw new Error('Missing Supabase URL, Anon Key, or TripAdvisor API Key')
    }

    // Try Edge Function first
    if (onProgress) onProgress('Attempting to use Supabase Edge Function...')
    try {
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/populate-tripadvisor`
      const edgeRes = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`
        }
      })

      if (edgeRes.ok) {
        const result = await edgeRes.json()
        if (onProgress) {
          onProgress(`✓ Complete! Fetched ${result.totalFetched} total, saved ${result.uniqueSaved} unique listings`)
        }
        return result
      }
    } catch (edgeErr) {
      console.warn('Edge Function not available, trying fallback...', edgeErr)
    }

    // Fallback: Manual population with sample data
    if (onProgress) onProgress('Using fallback: Adding sample Philippine listings...')

    const sampleListings = [
      { tripadvisor_id: 'sample-001', name: 'Intramuros, Manila', address: 'Intramuros, Manila', category: 'Historical Site', rating: 4.5, latitude: 14.5994, longitude: 120.9842 },
      { tripadvisor_id: 'sample-002', name: 'Boracay Island', address: 'Boracay, Aklan', category: 'Beach', rating: 4.6, latitude: 11.9673, longitude: 121.9248 },
      { tripadvisor_id: 'sample-003', name: 'Chocolate Hills', address: 'Bohol', category: 'Natural Wonder', rating: 4.7, latitude: 9.7674, longitude: 124.3833 },
      { tripadvisor_id: 'sample-004', name: 'Mayon Volcano', address: 'Albay', category: 'Mountain', rating: 4.4, latitude: 13.2544, longitude: 123.7385 },
      { tripadvisor_id: 'sample-005', name: 'Puerto Princesa Underground River', address: 'Puerto Princesa, Palawan', category: 'Natural Wonder', rating: 4.8, latitude: 10.1910, longitude: 118.8961 },
      { tripadvisor_id: 'sample-006', name: 'Palawan Beach', address: 'El Nido, Palawan', category: 'Beach', rating: 4.9, latitude: 10.5899, longitude: 119.3976 },
      { tripadvisor_id: 'sample-007', name: 'Cebu City', address: 'Cebu', category: 'City', rating: 4.3, latitude: 10.3157, longitude: 123.8854 },
      { tripadvisor_id: 'sample-008', name: 'Davao City', address: 'Davao', category: 'City', rating: 4.2, latitude: 7.0731, longitude: 125.6121 },
      { tripadvisor_id: 'sample-009', name: 'Baguio City', address: 'Baguio, Benguet', category: 'City', rating: 4.1, latitude: 16.4023, longitude: 120.5960 },
      { tripadvisor_id: 'sample-010', name: 'Iloilo City', address: 'Iloilo', category: 'City', rating: 4.0, latitude: 10.6952, longitude: 122.5625 }
    ]

    // Add source field
    const listingsWithSource = sampleListings.map(l => ({ ...l, source: 'sample' }))

    const { error } = await supabase.from('nearby_listings').upsert(listingsWithSource, { onConflict: 'tripadvisor_id' })

    if (error) throw error

    if (onProgress) {
      onProgress(`✓ Added ${listingsWithSource.length} sample Philippine listings. Deploy Supabase Edge Function for full TripAdvisor data.`)
    }

    return {
      success: true,
      totalFetched: listingsWithSource.length,
      uniqueSaved: listingsWithSource.length,
      message: `Added ${listingsWithSource.length} sample listings (fallback mode)`
    }
  } catch (err) {
    console.error('Populate failed:', err)
    if (onProgress) onProgress(`✗ Error: ${err.message}`)
    throw err
  }
}
