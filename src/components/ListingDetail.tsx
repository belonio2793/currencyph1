import React, { useEffect, useState } from 'react'
import { getListingBySlug, getRelatedListings, Listing } from '../data/manila-listings'
import ListingCard from './ListingCard'
import StarRating from './StarRating'

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

      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute(
          'content',
          `Discover ${listingData.name} in Manila. Rating: ${listingData.rating}/5 (${listingData.reviewCount} reviews). ${listingData.description.slice(0, 120)}...`
        )
      }

      // Add open graph tags for social sharing
      const metaOG = document.querySelector('meta[property="og:title"]') || document.createElement('meta')
      metaOG.setAttribute('property', 'og:title')
      metaOG.setAttribute('content', `${listingData.name} - Manila Tourism Guide`)
      if (!document.querySelector('meta[property="og:title"]')) {
        document.head.appendChild(metaOG)
      }

      const metaOGDesc = document.querySelector('meta[property="og:description"]') || document.createElement('meta')
      metaOGDesc.setAttribute('property', 'og:description')
      metaOGDesc.setAttribute('content', listingData.description.slice(0, 160))
      if (!document.querySelector('meta[property="og:description"]')) {
        document.head.appendChild(metaOGDesc)
      }

      const metaOGImage = document.querySelector('meta[property="og:image"]') || document.createElement('meta')
      metaOGImage.setAttribute('property', 'og:image')
      metaOGImage.setAttribute('content', listingData.image)
      if (!document.querySelector('meta[property="og:image"]')) {
        document.head.appendChild(metaOGImage)
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            aria-label="Back to Nearby"
          >
            Back to Nearby
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Manila Tourism Guide</span>
          </div>
        </div>
      </div>


      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 theme-container">
        {/* Photo Gallery Section */}
        {listing.images && listing.images.length > 0 && (
          <section className="section">
            <h2 className="section-title">Photo Gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listing.images.map((imageUrl, idx) => (
                <div key={idx} className="gallery-tile aspect-[4/3] group">
                  <img
                    src={imageUrl}
                    alt={`${listing.name} - Photo ${idx + 1}`}
                    className="gallery-img group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="pill pill-blue">{listing.category}</span>
            <span className="text-sm text-slate-500">Manila, Philippines</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 leading-tight">{listing.name}</h1>

          {/* Rating Section */}
          <div className="flex items-center gap-6 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              {/* SVG-based rating, no emojis */}
              <StarRating value={listing.rating} size="lg" />
              <div>
                <span className="font-bold text-xl md:text-2xl text-slate-900">{listing.rating.toFixed(1)}</span>
                <span className="text-slate-600 ml-2">({listing.reviewCount.toLocaleString()} reviews)</span>
              </div>
            </div>
          </div>

          <p className="lead mb-8 max-w-3xl">
            {listing.description}
          </p>

          {/* Key Info Cards - Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {listing.address && (
              <div className="theme-card">
                <h3 className="theme-card-title">Address</h3>
                <p className="theme-card-text">{listing.address}</p>
              </div>
            )}

            {listing.hours && (
              <div className="theme-card">
                <h3 className="theme-card-title">Hours</h3>
                <p className="theme-card-text">{listing.hours}</p>
              </div>
            )}

            {listing.admission && (
              <div className="theme-card">
                <h3 className="theme-card-title">Admission</h3>
                <p className="theme-card-text">{listing.admission}</p>
              </div>
            )}

            {(listing.phone || listing.website) && (
              <div className="theme-card">
                <h3 className="theme-card-title">Contact</h3>
                <div className="text-sm text-slate-700 space-y-1">
                  {listing.phone && <p>{listing.phone}</p>}
                  {listing.website && (
                    <a
                      href={listing.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-medium block"
                    >
                      Visit Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Highlights Section */}
        <section className="section">
          <h2 className="section-title">Highlights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listing.highlights.map((highlight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" aria-hidden="true"></span>
                <p className="text-slate-700 font-medium">{highlight}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Best For Section */}
        <section className="section">
          <h2 className="section-title">Best For</h2>
          <div className="flex flex-wrap gap-3">
            {listing.bestFor.map((tag, idx) => (
              <span
                key={idx}
                className="inline-block px-5 py-3 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-sm font-semibold border border-blue-200 hover:shadow-sm transition-shadow"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Reviews Section */}
        <section className="section">
          <h2 className="section-title">Visitor Reviews</h2>
          <div className="space-y-5">
            {listing.reviews.map((review, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{review.author}</h4>
                    <p className="text-sm text-slate-500">{new Date(review.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="flex">
                    <StarRating value={review.rating} size="md" />
                  </div>
                </div>
                <p className="text-slate-700 text-base leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Listings Section */}
        {relatedListings.length > 0 && (
          <section className="section">
            <h2 className="section-title">More to Explore in Manila</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedListings.map((related) => (
                <ListingCard
                  key={related.id}
                  listing={related}
                  onViewDetails={(slug) => {
                    window.location.hash = `#/listing/${slug}`
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 md:p-10 text-center text-white mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Plan Your Visit</h2>
          <p className="mb-8 text-blue-100 text-base md:text-lg">
            Save your favorite Manila attractions and create your personalized travel itinerary
          </p>
          <button
            onClick={onBack}
            className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors text-lg"
          >
            Explore More Attractions
          </button>
        </section>
      </div>

      {/* Schema.org JSON-LD for SEO */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org/',
          '@type': 'TouristAttraction',
          name: listing.name,
          description: listing.description,
          image: listing.image,
          address: {
            '@type': 'PostalAddress',
            streetAddress: listing.address,
            addressLocality: 'Manila',
            addressRegion: 'Metro Manila',
            postalCode: '1000',
            addressCountry: 'PH',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: listing.rating,
            reviewCount: listing.reviewCount,
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: listing.latitude,
            longitude: listing.longitude,
          },
          telephone: listing.phone || undefined,
          url: listing.website || undefined,
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            description: listing.hours,
          },
          priceRange: listing.admission ? listing.admission.split(':')[0] : undefined,
        })}
      </script>
    </div>
  )
}
