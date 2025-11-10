import React, { useState, useEffect } from 'react'
import { imageManager } from '../lib/imageManager'
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
  hideImage = false,
}) {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  // Helper to normalize photo_urls (handle string or array)
  const getNormalizedPhotoUrls = () => {
    let photos = listing?.photo_urls

    if (!photos) return []
    if (Array.isArray(photos)) return photos

    // Handle if photo_urls is a string
    if (typeof photos === 'string') {
      try {
        return JSON.parse(photos)
      } catch {
        return photos.split(/[,|]/).map(url => url.trim()).filter(Boolean)
      }
    }

    return []
  }

  useEffect(() => {
    loadImage()
  }, [listing?.tripadvisor_id])

  useEffect(() => {
    // Set up carousel rotation for photos
    const photoArray = getNormalizedPhotoUrls()
    const hasMultiplePhotos = photoArray.length > 0

    if (!hasMultiplePhotos) return

    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => {
        const maxIndex = Math.min(5, photoArray.length)
        return (prev + 1) % maxIndex
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [listing?.photo_urls])

  async function loadImage() {
    if (!listing) {
      setImageLoading(false)
      return
    }

    try {
      setImageLoading(true)
      const url = await imageManager.getImageUrl(listing)

      if (url) {
        setImageUrl(url)
        setImageError(false)
      } else {
        setImageUrl(
          `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80`
        )
        setImageError(false)
      }
    } catch (err) {
      console.error('Error loading image:', err)
      setImageUrl(
        `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80`
      )
      setImageError(true)
    } finally {
      setImageLoading(false)
    }
  }

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
      {/* Image or Avg Cost */}
      {!hideImage && (
        listing.avg_cost ? (
          <div className="relative w-full overflow-hidden" style={{ height: '220px' }}>
            {/* Background Image - use photo_urls carousel if available */}
            {getNormalizedPhotoUrls().length > 0 ? (
              <img
                src={getNormalizedPhotoUrls()[currentPhotoIndex]}
                alt={listing.name}
                className="w-full h-full object-cover transition-opacity duration-1000"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80'
                }}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
            )}

            {/* Dark overlay (50% opacity) for better text readability */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Centered cost display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <div className="text-sm text-white/90 dark:text-white/90">Estimated cost per person</div>
              <div className="mt-2 text-4xl font-extrabold text-white dark:text-white drop-shadow-lg">₱{Number(listing.avg_cost).toLocaleString()}</div>
              <div className="text-xs text-white/80 dark:text-white/80 mt-1">Approximate</div>
            </div>

            {/* Category & location_type badges overlay */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
              {listing.category && (
                <span className="inline-block px-3 py-1 bg-white/95 text-slate-900 rounded-full text-xs font-semibold shadow-md">
                  {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                </span>
              )}
              {listing.location_type && (
                <span className="inline-block px-2 py-1 bg-blue-600/90 text-white rounded text-xs font-medium shadow-md">
                  {listing.location_type}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="relative w-full bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden" style={{ height: '220px' }}>
            {imageLoading && (
              <div className="absolute inset-0 bg-slate-200 animate-pulse" />
            )}
            <img
              src={(getNormalizedPhotoUrls().length > 0 ? getNormalizedPhotoUrls()[currentPhotoIndex] : imageUrl) || imageUrl}
              alt={listing.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                if (!imageError) {
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80'
                  setImageError(true)
                }
              }}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

            {/* Small thumbnail strip (shows up to 5) */}
            {getNormalizedPhotoUrls().length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex gap-1">
                  {getNormalizedPhotoUrls().slice(0, 5).map((thumb, idx) => (
                    <button
                      key={`thumb-${idx}`}
                      onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx) }}
                      className={`h-8 w-12 rounded overflow-hidden border ${idx === currentPhotoIndex ? 'border-white' : 'border-white/40'} transition-all`}
                      title={`Photo ${idx + 1}`}
                    >
                      <img
                        src={thumb}
                        alt={`thumb-${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Badge Container */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
              {/* Category Badge */}
              {listing.category && (
                <span className="inline-block px-3 py-1 bg-white/95 text-slate-900 rounded-full text-xs font-semibold shadow-md">
                  {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                </span>
              )}
              {/* Location Type Badge */}
              {listing.location_type && (
                <span className="inline-block px-2 py-1 bg-blue-600/90 text-white rounded text-xs font-medium shadow-md">
                  {listing.location_type}
                </span>
              )}
            </div>

            {/* Rating Badge */}
            {listing.rating && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/95 rounded-lg px-3 py-1 shadow-md">
                <span className="text-yellow-400">★</span>
                <span className="font-bold text-slate-900">{Number(listing.rating).toFixed(1)}</span>
              </div>
            )}

            {/* Photo Count */}
            {listing.photo_count && listing.photo_count > 0 && (
              <div className="absolute bottom-3 right-3 bg-black/60 text-white rounded px-2 py-1 text-xs font-medium flex items-center gap-1">
                <span>📸</span>
                <span>{listing.photo_count}</span>
              </div>
            )}
          </div>
        )
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
              Website
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
