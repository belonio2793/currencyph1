import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ListingCard from './ListingCard'

export default function FeaturedListings({ onNavigateToListing }) {
  const [featuredListings, setFeaturedListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeaturedListings()
  }, [])

  async function loadFeaturedListings() {
    try {
      setLoading(true)
      // Load top-rated listings with good reviews
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')
        .not('rating', 'is', null)
        .gt('review_count', 10)
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(6)

      if (error) throw error

      setFeaturedListings(data || [])
    } catch (err) {
      console.error('Error loading featured listings:', err)
      setFeaturedListings([])
    } finally {
      setLoading(false)
    }
  }

  const handleNavigateToListing = (slug) => {
    if (onNavigateToListing) {
      onNavigateToListing(slug)
    } else {
      window.history.pushState(null, '', `/nearby/${slug}`)
    }
  }

  if (loading) {
    return (
      <div className="mb-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Listings</h2>
          <p className="text-slate-600 text-lg">Discover the most popular and highly-rated destinations in the Philippines.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-200 rounded-lg h-64 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (featuredListings.length === 0) {
    return (
      <div className="mb-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Listings</h2>
          <p className="text-slate-600 text-lg">No featured listings available yet. Fetch listings using the "Fetch Latest" button below.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-16">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Listings</h2>
        <p className="text-slate-600 text-lg">Discover the most popular and highly-rated destinations in the Philippines. Curated from our TripAdvisor listings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {featuredListings.map((listing) => (
          <ListingCard
            key={listing.tripadvisor_id}
            listing={listing}
            onNavigateToDetail={handleNavigateToListing}
          />
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-10 text-center">
        <button
          onClick={() => handleNavigateToListing('view-all')}
          className="inline-block px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors text-lg"
        >
          Browse All Listings
        </button>
      </div>
    </div>
  )
}
