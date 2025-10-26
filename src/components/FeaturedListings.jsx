import React from 'react'
import { MANILA_LISTINGS } from '../data/manila-listings'

export default function FeaturedListings() {
  const handleViewListing = (slug) => {
    window.location.hash = `#/listing/${slug}`
  }

  return (
    <div className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Featured Manila Attractions</h2>
        <p className="text-sm text-slate-600">Explore the most popular attractions in Manila on TripAdvisor</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MANILA_LISTINGS.map((listing) => (
          <div 
            key={listing.id}
            onClick={() => handleViewListing(listing.slug)}
            className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
          >
            {/* Image */}
            <div className="relative h-48 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
              <img 
                src={listing.image}
                alt={listing.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className="absolute top-3 right-3 inline-block px-2 py-1 bg-white/90 text-slate-900 rounded text-xs font-semibold">
                {listing.category}
              </span>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                {listing.name}
              </h3>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-sm">
                      {i < Math.floor(listing.rating) ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-semibold text-slate-900">{listing.rating.toFixed(1)}</span>
                <span className="text-xs text-slate-500">({listing.reviewCount.toLocaleString()})</span>
              </div>

              {/* Description snippet */}
              <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                {listing.description}
              </p>

              {/* Highlights preview */}
              <div className="mb-4 flex flex-wrap gap-2">
                {listing.highlights.slice(0, 2).map((highlight, idx) => (
                  <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    {highlight}
                  </span>
                ))}
                {listing.highlights.length > 2 && (
                  <span className="text-xs text-slate-500">+{listing.highlights.length - 2} more</span>
                )}
              </div>

              {/* CTA Button */}
              <button 
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
              >
                Learn More →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* View All Button */}
      <div className="mt-8 text-center">
        <button 
          onClick={() => window.location.hash = '#/listing/intramuros-manila'}
          className="inline-block px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
        >
          View All Featured Attractions
        </button>
      </div>
    </div>
  )
}
