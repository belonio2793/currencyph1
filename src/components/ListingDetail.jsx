import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import StarRating from './StarRating'

export default function ListingDetail({ slug, onBack }) {
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [relatedListings, setRelatedListings] = useState([])

  useEffect(() => {
    loadListing()
  }, [slug])

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      window.history.back()
    }
  }

  async function loadListing() {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('nearby_listings')
        .select('*')
        .eq('slug', slug)
        .single()

      if (fetchError) {
        setError('Listing not found')
        return
      }

      setListing(data)

      // Load related listings in same category
      if (data.category) {
        const { data: related } = await supabase
          .from('nearby_listings')
          .select('*')
          .eq('category', data.category)
          .neq('slug', slug)
          .limit(6)

        setRelatedListings(related || [])
      }
    } catch (err) {
      console.error('Error loading listing:', err)
      setError('Failed to load listing details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center py-20">
          <div className="text-slate-500">Loading listing details...</div>
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center py-20">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Nearby
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <button
        onClick={handleBack}
        className="mb-6 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
      >
        ← Back to Nearby
      </button>

      <div className="mb-8">
        {/* Hero Image */}
        {listing.image_url && (
          <div className="mb-8 rounded-lg overflow-hidden max-h-96">
            <img
              src={listing.image_url}
              alt={listing.name}
              className="w-full h-96 object-cover"
            />
          </div>
        )}

        {/* Title and Badge */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">{listing.name}</h1>
            {listing.location_type && (
              <span className="inline-block px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-sm font-medium mb-4">
                {listing.location_type}
              </span>
            )}
          </div>
        </div>

        {/* Rating and Reviews */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <StarRating rating={listing.rating} size="md" />
            <span className="text-lg font-semibold text-slate-900">{listing.rating}</span>
            <span className="text-slate-600">({listing.review_count?.toLocaleString()} reviews)</span>
          </div>
          {listing.rank_in_category && (
            <span className="text-sm text-slate-600 border-l pl-4">
              {listing.rank_in_category}
            </span>
          )}
        </div>

        {/* Address */}
        {listing.address && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <div className="font-semibold text-slate-900 mb-1">Address</div>
            <p className="text-slate-700">{listing.address}</p>
          </div>
        )}

        {/* Key Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {listing.rating && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700 font-medium">Rating</div>
              <div className="text-2xl font-bold text-blue-900">{listing.rating}/5</div>
            </div>
          )}
          {listing.review_count && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-700 font-medium">Reviews</div>
              <div className="text-2xl font-bold text-green-900">{listing.review_count.toLocaleString()}</div>
            </div>
          )}
          {listing.photo_count && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-700 font-medium">Photos</div>
              <div className="text-2xl font-bold text-purple-900">{listing.photo_count.toLocaleString()}</div>
            </div>
          )}
          {listing.duration && (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
              <div className="text-sm text-amber-700 font-medium">Duration</div>
              <div className="text-2xl font-bold text-amber-900">{listing.duration}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">About</h2>
            <p className="text-slate-700 leading-relaxed">{listing.description}</p>
          </div>
        )}

        {/* Hours of Operation */}
        {listing.hours_of_operation && Object.keys(listing.hours_of_operation).length > 0 && (
          <div className="mb-8 bg-slate-50 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Hours of Operation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(listing.hours_of_operation).map(([day, hours]) => (
                <div key={day} className="flex justify-between">
                  <span className="font-medium text-slate-700 capitalize">{day}:</span>
                  <span className="text-slate-600">{hours || 'Closed'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {listing.phone_number && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Phone</h3>
              <a
                href={`tel:${listing.phone_number}`}
                className="text-blue-600 hover:underline"
              >
                {listing.phone_number}
              </a>
            </div>
          )}
          {listing.website && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Website</h3>
              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                Visit Website →
              </a>
            </div>
          )}
          {listing.web_url && (
            <div className="md:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-2">TripAdvisor</h3>
              <a
                href={listing.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                View on TripAdvisor ↗
              </a>
            </div>
          )}
        </div>

        {/* Awards */}
        {listing.awards && listing.awards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Awards & Recognition</h2>
            <div className="flex flex-wrap gap-3">
              {listing.awards.map((award, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                >
                  🏆 {award}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Related Listings */}
      {relatedListings.length > 0 && (
        <div className="mt-12 pt-8 border-t">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            More {listing.category} Listings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {relatedListings.map((related) => (
              <a
                key={related.tripadvisor_id}
                href={`/nearby/${related.slug}`}
                className="bg-white border rounded-lg overflow-hidden hover:shadow-lg cursor-pointer transition-all block"
              >
                {related.image_url && (
                  <div className="h-40 overflow-hidden bg-slate-200">
                    <img
                      src={related.image_url}
                      alt={related.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-2 truncate">
                    {related.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <StarRating rating={related.rating} size="sm" />
                    <span className="text-sm font-medium text-slate-700">
                      {related.rating}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
