import React, { useEffect, useState } from 'react'
import { getListingBySlug, getRelatedListings, Listing } from '../data/manila-listings'

interface ListingDetailProps {
  slug: string
  onBack: () => void
}

export default function ListingDetail({ slug, onBack }: ListingDetailProps) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [relatedListings, setRelatedListings] = useState<Listing[]>([])

  useEffect(() => {
    const listingData = getListingBySlug(slug)
    if (listingData) {
      setListing(listingData)
      setRelatedListings(getRelatedListings(slug, 3))
      
      // Set page title and meta tags for SEO
      document.title = `${listingData.name} - Manila Tourism Guide | Currency.ph`
      
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute('content', `Discover ${listingData.name} in Manila. ${listingData.description.slice(0, 150)}...`)
      }
    }
  }, [slug])

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 text-lg mb-4">Listing not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <span>←</span> Back to Nearby
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Manila Tourism Guide</span>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="w-full h-96 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center overflow-hidden">
        <img 
          src={listing.image} 
          alt={listing.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {listing.category}
            </span>
            <span className="text-sm text-slate-500">Manila, Philippines</span>
          </div>
          
          <h1 className="text-4xl font-bold text-slate-900 mb-4">{listing.name}</h1>
          
          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>{i < Math.floor(listing.rating) ? '★' : '☆'}</span>
                ))}
              </div>
              <span className="font-semibold text-slate-900">{listing.rating.toFixed(1)}</span>
              <span className="text-slate-500">({listing.reviewCount.toLocaleString()} reviews)</span>
            </div>
          </div>

          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            {listing.description}
          </p>

          {/* Key Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">📍 Address</h3>
              <p className="text-slate-700">{listing.address}</p>
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">🕒 Hours</h3>
              <p className="text-slate-700">{listing.hours}</p>
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">🎫 Admission</h3>
              <p className="text-slate-700">{listing.admission}</p>
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">📞 Contact</h3>
              {listing.phone && <p className="text-slate-700">{listing.phone}</p>}
              {listing.website && (
                <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                  Visit Website →
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Highlights */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Highlights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listing.highlights.map((highlight, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white rounded-lg border border-slate-200 p-4">
                <span className="text-xl flex-shrink-0">✨</span>
                <p className="text-slate-700">{highlight}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Best For */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Best For</h2>
          <div className="flex flex-wrap gap-3">
            {listing.bestFor.map((tag, idx) => (
              <span key={idx} className="inline-block px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Reviews */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Visitor Reviews</h2>
          <div className="space-y-4">
            {listing.reviews.map((review, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">{review.author}</h4>
                    <p className="text-sm text-slate-500">{review.date}</p>
                  </div>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                    ))}
                  </div>
                </div>
                <p className="text-slate-700">{review.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Listings */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">More to Explore in Manila</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedListings.map((related) => (
              <div 
                key={related.id}
                onClick={() => window.location.hash = `#/listing/${related.slug}`}
                className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="h-48 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center overflow-hidden">
                  <img 
                    src={related.image}
                    alt={related.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">{related.name}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-400">★</span>
                    <span className="text-sm text-slate-700">{related.rating.toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-slate-600">{related.category}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-center text-white mb-12">
          <h2 className="text-2xl font-bold mb-3">Ready to Explore?</h2>
          <p className="mb-6 text-blue-100">Save your favorite Manila attractions to your personal directory</p>
          <button 
            onClick={onBack}
            className="inline-block px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            Browse More Listings
          </button>
        </section>
      </div>

      {/* Schema.org JSON-LD for SEO */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org/",
          "@type": "TouristAttractionResult",
          "name": listing.name,
          "description": listing.description,
          "image": listing.image,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": listing.address,
            "addressLocality": "Manila",
            "addressCountry": "PH"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": listing.rating,
            "reviewCount": listing.reviewCount
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": listing.latitude,
            "longitude": listing.longitude
          }
        })}
      </script>
    </div>
  )
}
