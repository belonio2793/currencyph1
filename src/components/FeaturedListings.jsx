import React from 'react'
import { MANILA_LISTINGS } from '../data/manila-listings'
import ListingCard from './ListingCard'

export default function FeaturedListings() {
  const handleNavigateToListing = (slug) => {
    window.history.pushState(null, '', `/nearby/${slug}`)
    window.location.reload()
  }

  // Show only the top 6 featured listings
  const featuredListings = MANILA_LISTINGS.slice(0, 6)

  return (
    <div className="mb-16">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Manila Attractions</h2>
        <p className="text-slate-600 text-lg">Discover the most popular and highly-rated attractions in Manila. Curated from TripAdvisor's top destinations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {featuredListings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onNavigateToDetail={handleNavigateToListing}
          />
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-10 text-center">
        <button
          onClick={() => handleNavigateToListing('intramuros-manila')}
          className="inline-block px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors text-lg"
        >
          Browse All Manila Attractions
        </button>
      </div>
    </div>
  )
}
