import { supabase } from './supabaseClient'

export async function populateAllTripAdvisorListings(onProgress) {
  try {
    if (onProgress) onProgress('Starting TripAdvisor population...')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('Supabase URL not configured')

    if (onProgress) onProgress('Sending request to server...')

    const res = await fetch(`${supabaseUrl}/functions/v1/populate-tripadvisor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
      }
    })

    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || `Server error: ${res.status}`)
    }

    const result = await res.json()

    if (onProgress) {
      onProgress(`✓ Complete! Fetched ${result.totalFetched} total, saved ${result.uniqueSaved} unique listings`)
    }

    return {
      success: true,
      totalFetched: result.totalFetched,
      uniqueSaved: result.uniqueSaved,
      message: result.message
    }
  } catch (err) {
    console.error('Populate failed:', err)
    if (onProgress) onProgress(`✗ Error: ${err.message}`)
    throw err
  }
}
