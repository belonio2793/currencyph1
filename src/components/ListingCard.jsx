import React, { useState, useEffect } from 'react'
import { imageManager } from '../lib/imageManager'
import StarRating from './StarRating'

export default function ListingCard({
  listing,
  onSave,
  onView,
  onVote,
  isSaved = false,
  isAuthenticated = false,
  voteCounts = { thumbsUp: 0, thumbsDown: 0 },
  userVote = null,
}) {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    loadImage()
  }, [listing?.tripadvisor_id])

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

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group">
      {/* Image */}
      <div className="relative w-full bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden" style={{ height: '200px' }}>
        {imageLoading && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse" />
        )}
        <img
          src={imageUrl}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Category Badge */}
        {listing.category && (
          <span className="absolute top-3 left-3 inline-block px-3 py-1 bg-white/95 text-slate-900 rounded-full text-xs font-semibold shadow-sm">
            {listing.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name */}
        <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {listing.name}
        </h4>

        {/* Address */}
        {listing.address && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-1">{listing.address}</p>
        )}

        {/* Rating */}
        <div className="flex items-center gap-3 mb-4">
          {listing.rating && (
            <>
              <StarRating value={Number(listing.rating)} size="sm" />
              <span className="text-sm font-semibold text-slate-900">
                {Number(listing.rating).toFixed(1)}
              </span>
              <span className="text-xs text-slate-500">
                ({listing.review_count || listing.reviewCount || '0'})
              </span>
            </>
          )}
        </div>

        {/* Vote Buttons */}
        {onVote && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => onVote(listing.tripadvisor_id, 'up')}
              className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors font-medium ${
                userVote === 'up'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-green-100'
              }`}
              title={isAuthenticated ? 'Like this listing' : 'Log in to vote'}
            >
              👍 {voteCounts.thumbsUp || 0}
            </button>
            <button
              onClick={() => onVote(listing.tripadvisor_id, 'down')}
              className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors font-medium ${
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
        <div className="flex gap-2">
          {onSave && (
            <button
              onClick={() => onSave(listing)}
              disabled={isSaved}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaved ? '✓ Saved' : 'Save'}
            </button>
          )}
          {onView && (
            <button
              onClick={() => onView(listing)}
              className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              View
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
