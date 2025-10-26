import React from 'react'
import { Listing } from '../data/manila-listings'

interface ListingCardProps {
  listing: Listing
  onViewDetails?: (slug: string) => void
  compact?: boolean
}

export default function ListingCard({ listing, onViewDetails, compact = false }: ListingCardProps) {
  const handleClick = () => {
    if (onViewDetails) {
      onViewDetails(listing.slug)
    }
  }

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
          <img
            src={listing.image}
            alt={listing.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-slate-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">
            {listing.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-xs font-semibold text-slate-900">{listing.rating.toFixed(1)}</span>
            <span className="text-xs text-slate-500">({listing.reviewCount})</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
    >
      {/* Image */}
      <div className="relative w-full h-48 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
        <img
          src={listing.image}
          alt={listing.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
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
        <button className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm">
          Learn More →
        </button>
      </div>
    </div>
  )
}
