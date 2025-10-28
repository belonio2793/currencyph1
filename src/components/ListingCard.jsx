import React from 'react'
import StarRating from './StarRating'

export default function ListingCard({
  listing,
  onSave,
  onView,
  onVote,
  onNavigateToDetail,
  isSaved = false,
  isAuthenticated = false,
  voteCounts = { thumbsUp: 0, thumbsDown: 0 },
  userVote = null,
}) {

  const handleCardClick = () => {
    if (onNavigateToDetail && listing?.slug) {
      onNavigateToDetail(listing.slug)
    }
  }

  return (
    <div
      className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Estimated Cost Section - Always Displayed */}
      <div className="relative w-full bg-gradient-to-br from-blue-50 to-slate-50 border-b border-slate-200 overflow-hidden flex items-center justify-center" style={{ height: '220px' }}>
        <div className="text-center py-8 px-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Estimated Cost</div>
          {listing.avg_cost ? (
            <>
              <div className="text-5xl font-extrabold text-slate-900 mb-1">
                ₱{Number(listing.avg_cost).toLocaleString()}
              </div>
              <div className="text-sm text-slate-600">per person, approximate</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-slate-400 mb-1">—</div>
              <div className="text-sm text-slate-500">Cost not yet estimated</div>
            </>
          )}
        </div>

        {/* Category & Location Type Badges */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3 gap-2">
          {listing.category && (
            <span className="inline-block px-3 py-1 bg-white/90 text-slate-900 rounded-full text-xs font-semibold shadow-md truncate">
              {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
            </span>
          )}
          {listing.location_type && (
            <span className="inline-block px-2 py-1 bg-blue-600/95 text-white rounded text-xs font-medium shadow-md">
              {listing.location_type}
            </span>
          )}
        </div>

        {/* Rating Badge - Bottom Left */}
        {listing.rating && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/95 rounded-lg px-3 py-1 shadow-md">
            <span className="text-yellow-400">★</span>
            <span className="font-bold text-slate-900 text-sm">{Number(listing.rating).toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Photo Gallery Section - Underneath Cost */}
      {listing.photo_urls && listing.photo_urls.length > 0 && (
        <div className="w-full bg-slate-100 border-b border-slate-200 overflow-hidden">
          <div className="relative w-full h-48 bg-slate-200 group/gallery">
            {/* Main photo */}
            <img
              src={listing.photo_urls[0]}
              alt={listing.name}
              className="w-full h-full object-cover group-hover/gallery:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80'
              }}
            />
            {/* Photo count badge */}
            {listing.photo_urls.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white rounded-full px-3 py-1 text-xs font-semibold">
                📸 {listing.photo_urls.length}
              </div>
            )}
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col h-full">
        {/* Name */}
        <h4 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {listing.name}
        </h4>

        {/* Location Info */}
        <div className="mb-3">
          {/* City */}
          {(listing.city || listing.country) && (
            <p className="text-sm font-semibold text-blue-600 mb-1">
              📍 {[listing.city, listing.country].filter(Boolean).join(', ')}
            </p>
          )}
          {/* Address */}
          {listing.address && (
            <p className="text-xs text-slate-600 line-clamp-2">{listing.address}</p>
          )}
        </div>

        {/* Rating Section */}
        {listing.rating && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
            <StarRating value={Number(listing.rating)} size="sm" />
            <span className="text-xs text-slate-600">
              {(listing.review_count ?? listing.reviewCount ?? listing.num_reviews ?? 0)} {(listing.review_count ?? listing.reviewCount ?? listing.num_reviews ?? 0) === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        )}

        {/* Highlights */}
        {listing.highlights && listing.highlights.length > 0 && (
          <div className="mb-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap gap-1">
              {listing.highlights.slice(0, 3).map((highlight, idx) => (
                <span key={idx} className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                  ✓ {highlight}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          {listing.price_range && (
            <div className="bg-slate-50 rounded p-2">
              <span className="text-slate-500">Price</span>
              <p className="font-semibold text-slate-900">{listing.price_range}</p>
            </div>
          )}
          {listing.duration && (
            <div className="bg-slate-50 rounded p-2">
              <span className="text-slate-500">Duration</span>
              <p className="font-semibold text-slate-900">{listing.duration}</p>
            </div>
          )}
        </div>

        {/* Contact Links */}
        <div className="flex gap-2 mb-3 text-xs">
          {listing.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-center font-medium"
              title="Visit website"
            >
              🌐 Website
            </a>
          )}
          {listing.phone_number && (
            <a
              href={`tel:${listing.phone_number}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 text-center font-medium"
              title="Call"
            >
              📞 Call
            </a>
          )}
        </div>

        {/* Vote Buttons */}
        {onVote && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onVote(listing.tripadvisor_id, 'up')
              }}
              className={`flex-1 px-2 py-2 text-xs rounded-lg transition-colors font-bold ${
                userVote === 'up'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-green-100'
              }`}
              title={isAuthenticated ? 'Like this listing' : 'Log in to vote'}
            >
              👍 {voteCounts.thumbsUp || 0}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onVote(listing.tripadvisor_id, 'down')
              }}
              className={`flex-1 px-2 py-2 text-xs rounded-lg transition-colors font-bold ${
                userVote === 'down'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-red-100'
              }`}
              title={isAuthenticated ? 'Dislike this listing' : 'Log in to vote'}
            >
              👎 {voteCounts.thumbsDown || 0}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          {onSave && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSave(listing)
              }}
              disabled={isSaved}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaved ? '✓ Saved' : 'Save'}
            </button>
          )}
          {onView && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onView(listing)
              }}
              className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              View
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
