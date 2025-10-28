import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import StarRating from './StarRating'

export default function ListingDetail({ slug, onBack }) {
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [relatedListings, setRelatedListings] = useState([])
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

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

      console.log('Listing fetched:', {
        name: data?.name,
        slug: data?.slug,
        photo_urls: data?.photo_urls,
        photo_urls_type: Array.isArray(data?.photo_urls) ? 'array' : typeof data?.photo_urls,
        photo_urls_length: Array.isArray(data?.photo_urls) ? data.photo_urls.length : 'N/A'
      })

      setListing(data)

      // Load related listings in same category
      if (data.category) {
        const { data: related } = await supabase
          .from('nearby_listings')
          .select('*')
          .eq('category', data.category)
          .neq('slug', slug)
          .order('rating', { ascending: false })
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

  // Get best image from various sources
  const getImageArray = () => {
    if (listing.photo_urls && Array.isArray(listing.photo_urls) && listing.photo_urls.length > 0) {
      return listing.photo_urls
    }
    if (listing.image_urls && Array.isArray(listing.image_urls) && listing.image_urls.length > 0) {
      return listing.image_urls
    }
    if (listing.featured_image_url) return [listing.featured_image_url]
    if (listing.primary_image_url) return [listing.primary_image_url]
    if (listing.image_url) return [listing.image_url]
    return []
  }

  const imageArray = getImageArray()
  const displayImage = imageArray.length > 0 ? imageArray[selectedPhotoIndex] : null

  // Format hours of operation
  const formatHours = (hours) => {
    if (!hours) return null
    if (typeof hours === 'string') {
      return hours
    }
    if (typeof hours === 'object') {
      const parts = []
      Object.entries(hours).forEach(([day, timeRange]) => {
        if (timeRange && timeRange !== 'Closed' && typeof timeRange === 'object') {
          const open = timeRange.open || 'N/A'
          const close = timeRange.close || 'N/A'
          const isClosed = timeRange.closed ? ' (Closed)' : ''
          parts.push(`${day}: ${open} - ${close}${isClosed}`)
        } else if (timeRange) {
          parts.push(`${day}: ${timeRange}`)
        }
      })
      return parts.join('\n')
    }
    return null
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
        {/* Hero Image Gallery with Photo Gallery Thumbnails */}
        {displayImage ? (
          <div className="mb-8 rounded-lg overflow-hidden bg-slate-200">
            {/* Main Image Display */}
            <div className="relative max-h-96 bg-slate-200 flex items-center justify-center">
              <img
                src={displayImage}
                alt={listing.name}
                className="w-full h-96 object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80'
                }}
              />

              {/* Dark overlay for better navigation visibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Photo Gallery Navigation */}
            {imageArray.length > 1 && (
              <div className="space-y-3 p-4 bg-white border-t border-slate-200">
                {/* Navigation Buttons and Counter */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                    disabled={selectedPhotoIndex === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    ← Previous
                  </button>
                  <span className="text-slate-700 font-semibold">
                    {selectedPhotoIndex + 1} / {imageArray.length} Photos
                  </span>
                  <button
                    onClick={() => setSelectedPhotoIndex(Math.min(imageArray.length - 1, selectedPhotoIndex + 1))}
                    disabled={selectedPhotoIndex === imageArray.length - 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Next →
                  </button>
                </div>

                {/* Thumbnail Gallery */}
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-2 min-w-min">
                    {imageArray.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`flex-shrink-0 h-20 w-20 rounded overflow-hidden border-2 transition-all ${
                          idx === selectedPhotoIndex
                            ? 'border-blue-600 ring-2 ring-blue-400'
                            : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`${listing.name} - Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop&auto=format&q=80'
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : listing.avg_cost ? (
          <div className="mb-8 rounded-lg overflow-hidden max-h-96 bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200 flex items-center justify-center">
            <div className="text-center py-16 px-6">
              <div className="text-sm text-slate-500">Estimated cost per person</div>
              <div className="mt-3 text-4xl font-extrabold text-slate-900">₱{Number(listing.avg_cost).toLocaleString()}</div>
              <div className="text-sm text-slate-600 mt-2">(Approximate)</div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-lg overflow-hidden max-h-96 bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center">
            <div className="text-center py-16 px-6 text-slate-500">
              <p className="text-lg">No image available</p>
            </div>
          </div>
        )}

        {/* Title and Badges */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-slate-900 mb-1">{listing.name}</h1>
            {(listing.city || listing.country || listing.timezone || listing.currency) && (
              <div className="text-sm text-slate-600 mb-3">
                {[listing.city, listing.country].filter(Boolean).join(', ')}
                {(listing.timezone || listing.currency) && (
                  <span className="text-slate-400"> • </span>
                )}
                {listing.timezone && <span>{listing.timezone}</span>}
                {listing.timezone && listing.currency && <span className="text-slate-400"> • </span>}
                {listing.currency && <span>{listing.currency}</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-4">
              {listing.location_type && (
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {listing.location_type}
                </span>
              )}
              {listing.ranking_in_city && (
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  Ranked {listing.ranking_in_city}
                </span>
              )}
              {listing.price_level && (
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {'$'.repeat(listing.price_level)}
                </span>
              )}
              {listing.price_range && (
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {listing.price_range}
                </span>
              )}
              {listing.ranking_string && (
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  {listing.ranking_string}
                </span>
              )}
              {listing.rank_in_category && (
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  Rank: {listing.rank_in_category}
                </span>
              )}
              {listing.verified && (
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  ✓ Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating and Reviews */}
        <div className="flex items-center gap-6 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            {listing.rating && <StarRating value={listing.rating} size="md" />}
            {(listing.rating || (listing.review_count ?? listing.num_reviews)) && (
              <>
                {listing.rating && (
                  <span className="text-lg font-semibold text-slate-900">{Number(listing.rating).toFixed(1)}</span>
                )}
                <span className="text-slate-600">({((listing.review_count ?? listing.num_reviews ?? 0)).toLocaleString()} reviews)</span>
              </>
            )}
          </div>
          {listing.visibility_score !== undefined && (
            <div className="text-slate-600">
              <span className="font-medium">Visibility Score:</span> {listing.visibility_score}/100
            </div>
          )}
        </div>

        {/* Address */}
        {listing.address && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1">📍 Address</div>
            <p className="text-slate-700">{listing.address}</p>
            {(listing.latitude || listing.lat) && (
              <p className="text-sm text-slate-500 mt-2">
                📌 {(listing.latitude || listing.lat).toFixed(4)}, {(listing.longitude || listing.lng).toFixed(4)}
              </p>
            )}
          </div>
        )}

        {/* Meta */}
        {(listing.city || listing.country || listing.region_name || listing.currency || listing.timezone || listing.last_synced) && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listing.city && (
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-slate-500">City</div>
                <div className="font-medium text-slate-900">{listing.city}</div>
              </div>
            )}
            {listing.country && (
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-slate-500">Country</div>
                <div className="font-medium text-slate-900">{listing.country}</div>
              </div>
            )}
            {listing.region_name && (
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-slate-500">Region</div>
                <div className="font-medium text-slate-900">{listing.region_name}</div>
              </div>
            )}
            {listing.currency && (
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-slate-500">Currency</div>
                <div className="font-medium text-slate-900">{listing.currency}</div>
              </div>
            )}
            {listing.timezone && (
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-slate-500">Timezone</div>
                <div className="font-medium text-slate-900">{listing.timezone}</div>
              </div>
            )}
            {listing.last_synced && (
              <div className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-slate-500">Last Synced</div>
                <div className="font-medium text-slate-900">{new Date(listing.last_synced).toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        {/* Key Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {listing.rating && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700 font-medium">Rating</div>
              <div className="text-2xl font-bold text-blue-900">{Number(listing.rating).toFixed(1)}/5</div>
            </div>
          )}
          {listing.review_count && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-700 font-medium">Reviews</div>
              <div className="text-2xl font-bold text-green-900">{(listing.review_count || 0).toLocaleString()}</div>
            </div>
          )}
          {listing.photo_count && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-700 font-medium">Photos</div>
              <div className="text-2xl font-bold text-purple-900">{(listing.photo_count || 0).toLocaleString()}</div>
            </div>
          )}
          {listing.admission_fee && (
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
              <div className="text-sm text-amber-700 font-medium">Admission</div>
              <div className="text-sm font-bold text-amber-900">{listing.admission_fee}</div>
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

        {/* Duration and Traveler Type */}
        {(listing.duration || listing.traveler_type) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {listing.duration && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-slate-900 mb-1">⏱️ Duration</h3>
                <p className="text-slate-700">{listing.duration}</p>
              </div>
            )}
            {listing.traveler_type && (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <h3 className="font-semibold text-slate-900 mb-1">👥 Best For</h3>
                <p className="text-slate-700">{listing.traveler_type}</p>
              </div>
            )}
          </div>
        )}

        {/* Highlights */}
        {listing.highlights && listing.highlights.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Highlights</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {listing.highlights.map((highlight, idx) => (
                <li key={`highlight-${idx}-${highlight}`} className="flex items-start gap-2 text-slate-700">
                  <span className="text-blue-600 font-bold mt-1">✓</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Best For */}
        {listing.best_for && listing.best_for.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {listing.best_for.map((tag, idx) => {
                const tagText = typeof tag === 'string' ? tag : (tag.category || tag.name || 'Category')
                return (
                  <span
                    key={`bestfor-${idx}-${tagText}`}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                  >
                    {tagText}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Hours of Operation */}
        {listing.hours_of_operation && Object.keys(listing.hours_of_operation).length > 0 && (
          <div className="mb-8 bg-slate-50 p-6 rounded-lg border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🕒 Hours of Operation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(listing.hours_of_operation).map(([day, hours], idx) => (
                <div key={`hours-${day}-${idx}`} className="flex justify-between text-slate-700">
                  <span className="font-medium capitalize">{day}:</span>
                  <span className="text-slate-600">
                    {typeof hours === 'object' && hours.closed
                      ? 'Closed'
                      : typeof hours === 'object'
                      ? `${hours.open || 'N/A'} - ${hours.close || 'N/A'}`
                      : hours || 'Closed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amenities */}
        {listing.amenities && listing.amenities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🛎️ Amenities</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {listing.amenities.map((amenity, idx) => {
                const amenityText = typeof amenity === 'string' ? amenity : (amenity.name || JSON.stringify(amenity))
                return (
                <div key={`amenity-${idx}-${amenityText}`} className="flex items-center gap-2 text-slate-700">
                  <span className="text-green-600">✓</span>
                  <span>{typeof amenity === 'string' ? amenity : amenity.name || amenity}</span>
                </div>
              )
              })}
            </div>
          </div>
        )}

        {/* Cuisine / Features */}
        {(listing.cuisine || listing.features) && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🍽️ Cuisine & Features</h2>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(listing.cuisine) ? listing.cuisine : []).map((c, i) => (
                <span key={`c-${i}`} className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-medium">
                  {typeof c === 'string' ? c : c.name || c.category || 'Cuisine'}
                </span>
              ))}
              {(Array.isArray(listing.features) ? listing.features : []).map((f, i) => (
                <span key={`f-${i}`} className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                  {typeof f === 'string' ? f : f.name || f.category || 'Feature'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fetch status */}
        {(listing.fetch_status || listing.fetch_error_message) && (
          <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
            <div className="text-slate-700">
              <span className="font-medium">Fetch status:</span> {listing.fetch_status || 'unknown'}
            </div>
            {listing.fetch_error_message && (
              <div className="text-red-600 mt-1 break-all">{listing.fetch_error_message}</div>
            )}
          </div>
        )}

        {/* Accessibility */}
        {listing.accessibility_info && Object.keys(listing.accessibility_info).length > 0 && (
          <div className="mb-8 bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">♿ Accessibility</h2>
            <div className="space-y-2">
              {listing.accessibility_info.wheelchair_accessible !== undefined && (
                <p className="text-slate-700">
                  <span className="font-medium">Wheelchair Accessible:</span>{' '}
                  {listing.accessibility_info.wheelchair_accessible ? '✓ Yes' : '✗ No'}
                </p>
              )}
              {listing.accessibility_info.pet_friendly !== undefined && (
                <p className="text-slate-700">
                  <span className="font-medium">Pet Friendly:</span>{' '}
                  {listing.accessibility_info.pet_friendly ? '✓ Yes' : '✗ No'}
                </p>
              )}
              {listing.accessibility_info.elevator !== undefined && (
                <p className="text-slate-700">
                  <span className="font-medium">Elevator:</span>{' '}
                  {listing.accessibility_info.elevator ? '✓ Yes' : '✗ No'}
                </p>
              )}
              {listing.accessibility_info.accessible_parking !== undefined && (
                <p className="text-slate-700">
                  <span className="font-medium">Accessible Parking:</span>{' '}
                  {listing.accessibility_info.accessible_parking ? '✓ Yes' : '✗ No'}
                </p>
              )}
              {listing.accessibility_info.accessible_restroom !== undefined && (
                <p className="text-slate-700">
                  <span className="font-medium">Accessible Restroom:</span>{' '}
                  {listing.accessibility_info.accessible_restroom ? '✓ Yes' : '✗ No'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {(listing.phone_number || listing.phone) && (
            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">📞 Phone</h3>
              <a
                href={`tel:${listing.phone_number || listing.phone}`}
                className="text-blue-600 hover:underline"
              >
                {listing.phone_number || listing.phone}
              </a>
            </div>
          )}
          {listing.email && (
            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">✉�� Email</h3>
              <a href={`mailto:${listing.email}`} className="text-blue-600 hover:underline break-all">
                {listing.email}
              </a>
            </div>
          )}
          {listing.website && (
            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">🌐 Website</h3>
              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                Visit Website →
              </a>
            </div>
          )}
          {listing.web_url && (
            <div className="md:col-span-2 border border-slate-200 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">🏆 TripAdvisor</h3>
              <a
                href={listing.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                View Full Profile on TripAdvisor ↗
              </a>
            </div>
          )}
        </div>

        {/* Awards */}
        {listing.awards && listing.awards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">🏆 Awards & Recognition</h2>
            <div className="flex flex-wrap gap-3">
              {listing.awards.map((award, idx) => {
                const awardText = typeof award === 'string' ? award : award.name || award
                return (
                  <span key={idx} className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                    🏆 {awardText}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Nearby Attractions */}
        {listing.nearby_attractions && listing.nearby_attractions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">📍 Nearby Attractions</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {listing.nearby_attractions.slice(0, 10).map((attraction, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700">
                  <span className="text-purple-600 mt-1">●</span>
                  <span>{attraction}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent Reviews */}
        {listing.review_details && listing.review_details.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">⭐ Recent Reviews</h2>
            <div className="space-y-4">
              {listing.review_details.slice(0, 5).map((review, idx) => (
                <div key={idx} className="border border-slate-200 p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">{review.author || 'Reviewer'}</h4>
                      <div className="flex items-center gap-2 text-sm">
                        {review.rating && <StarRating value={review.rating} size="sm" />}
                        {review.rating && <span className="text-slate-500">{review.rating}/5</span>}
                      </div>
                    </div>
                    {review.date && (
                      <span className="text-sm text-slate-500">{new Date(review.date).toLocaleDateString()}</span>
                    )}
                  </div>
                  {review.comment && <p className="text-slate-700 text-sm">{review.comment}</p>}
                  {review.text && <p className="text-slate-700 text-sm">{review.text}</p>}
                  {review.helpful_count > 0 && (
                    <p className="text-xs text-slate-500 mt-2">👍 {review.helpful_count} found this helpful</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        {listing.updated_at && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg text-sm text-slate-500">
            <p>Last updated: {new Date(listing.updated_at).toLocaleDateString()} at {new Date(listing.updated_at).toLocaleTimeString()}</p>
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
                {(related.photo_urls?.[0] || related.image_urls?.[0] || related.image_url) && (
                  <div className="h-40 overflow-hidden bg-slate-200">
                    <img
                      src={related.photo_urls?.[0] || related.image_urls?.[0] || related.image_url}
                      alt={related.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format&q=80'
                      }}
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-2 truncate">
                    {related.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {related.rating && <StarRating value={related.rating} size="sm" />}
                    {related.rating && (
                      <span className="text-sm font-medium text-slate-700">
                        {Number(related.rating).toFixed(1)}
                      </span>
                    )}
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
