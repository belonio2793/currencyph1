import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ListingCard from './ListingCard'
import FeaturedListings from './FeaturedListings'
import StarRating from './StarRating'

const CATEGORIES = ['attractions', 'hotels', 'restaurants', 'beaches', 'things to do']

export default function Nearby({ userId, setActiveTab, setCurrentListingSlug }) {
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [listings, setListings] = useState([])
  const [allCities, setAllCities] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [listingStats, setListingStats] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const [page, setPage] = useState(1)
  const itemsPerPage = 12

  useEffect(() => {
    loadStats()
    loadCities()
    loadCategories()
  }, [])

  async function loadStats() {
    try {
      const { data: countData } = await supabase
        .from('nearby_listings')
        .select('*', { count: 'exact' })
        .limit(0)

      const { data: categoryData } = await supabase
        .from('nearby_listings')
        .select('category')
      const uniqueCategories = new Set(categoryData?.map(d => d.category).filter(c => c))

      const { data: ratingData } = await supabase
        .from('nearby_listings')
        .select('rating')
        .not('rating', 'is', null)

      const avgRating = ratingData && ratingData.length > 0
        ? (ratingData.reduce((sum, d) => sum + (d.rating || 0), 0) / ratingData.length).toFixed(1)
        : 0

      setListingStats({
        total: countData?.count || 0,
        cities: 10,
        categories: uniqueCategories.size || 0,
        avgRating: avgRating,
        withRatings: ratingData?.length || 0
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  async function loadCities() {
    try {
      const { data } = await supabase
        .from('nearby_listings')
        .select('address')
      
      if (data) {
        const cities = new Set()
        data.forEach(d => {
          if (d.address) {
            const parts = d.address.split(',')
            if (parts.length > 0) {
              const city = parts[parts.length - 2]?.trim() || parts[parts.length - 1]?.trim()
              if (city) cities.add(city)
            }
          }
        })
        setAllCities(Array.from(cities).sort())
      }
    } catch (err) {
      console.error('Error loading cities:', err)
    }
  }

  async function loadCategories() {
    try {
      const { data } = await supabase
        .from('nearby_listings')
        .select('category')
      
      if (data) {
        const categories = new Set(data.map(d => d.category).filter(c => c))
        setAllCategories(Array.from(categories).sort())
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  async function loadListings() {
    setLoading(true)
    setError('')
    try {
      let query = supabase.from('nearby_listings').select('*')

      if (selectedCategory) {
        query = query.eq('category', selectedCategory)
      }

      if (selectedCity) {
        query = query.ilike('address', `%${selectedCity}%`)
      }

      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const { data, error: fetchError } = await query
        .order('rating', { ascending: false })
        .range(from, to)

      if (fetchError) throw fetchError

      setListings(data || [])
    } catch (err) {
      console.error('Error loading listings:', err)
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const { data, error: searchError } = await supabase
        .from('nearby_listings')
        .select('*')
        .or(
          `name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
        )
        .limit(50)

      if (searchError) throw searchError

      setSearchResults(data || [])
    } catch (err) {
      console.error('Error searching:', err)
      setError('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  async function handleFetchAdvancedListings() {
    if (!confirm('Fetch fresh listings from TripAdvisor via advanced scraper?\n\nThis may take a few minutes.')) {
      return
    }

    setIsFetching(true)
    try {
      const supabaseUrl = import.meta.env.VITE_PROJECT_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase credentials not configured')
      }

      const functionUrl = `${supabaseUrl}/functions/v1/scrape-nearby-listings-advanced`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Edge function error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      alert(`✅ Fetch Complete!\n\nTotal Scraped: ${result.totalScraped}\nUnique Listings: ${result.uniqueListings}\nUpserted: ${result.upserted}\nSuccess: ${result.successCount}, Errors: ${result.errorCount}`)

      // Refresh stats and listings
      await loadStats()
      await loadCities()
      await loadCategories()
      await loadListings()
      setPage(1)
    } catch (err) {
      console.error('Error fetching listings:', err)
      setError(`Failed to fetch: ${err.message}`)
    } finally {
      setIsFetching(false)
    }
  }

  function handleNavigateToListing(slug) {
    if (setCurrentListingSlug) {
      setCurrentListingSlug(slug)
    }
    setActiveTab('listing')
    window.history.pushState(null, '', `/nearby/${slug}`)
  }

  useEffect(() => {
    if (selectedCategory || selectedCity || page > 1) {
      loadListings()
    }
  }, [selectedCategory, selectedCity, page])

  const displayListings = searchResults.length > 0 ? searchResults : listings

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Stats Section */}
      {listingStats && (
        <div className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-900">{listingStats.total}</div>
            <div className="text-sm text-blue-700">Total Listings</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-900">{listingStats.cities}</div>
            <div className="text-sm text-green-700">Cities</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-900">{listingStats.categories}</div>
            <div className="text-sm text-purple-700">Categories</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <div className="text-2xl font-bold text-amber-900">{listingStats.avgRating}</div>
            <div className="text-sm text-amber-700">Avg Rating</div>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-4 border border-pink-200">
            <div className="text-2xl font-bold text-pink-900">{listingStats.withRatings}</div>
            <div className="text-sm text-pink-700">Rated</div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search listings by name, address, or category..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Search Results ({searchResults.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {searchResults.map(item => (
                <ListingCard
                  key={item.tripadvisor_id}
                  listing={item}
                  onNavigateToDetail={handleNavigateToListing}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Browse by City Section */}
      {allCities.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Browse by City</h3>
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => {
                setSelectedCity(null)
                setPage(1)
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCity === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Cities
            </button>
            {allCities.map(city => (
              <button
                key={city}
                onClick={() => {
                  setSelectedCity(city)
                  setPage(1)
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCity === city
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse by Category Section */}
      {allCategories.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Browse by Category</h3>
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => {
                setSelectedCategory(null)
                setPage(1)
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>
            {allCategories.map(category => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                  setPage(1)
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {searchResults.length > 0 ? 'Search Results' : selectedCategory ? `${selectedCategory} Listings` : 'All Listings'}
          </h2>
          <p className="text-sm text-slate-500">Listings from nearby_listings table, powered by TripAdvisor scraper.</p>
        </div>
        <button
          onClick={handleFetchAdvancedListings}
          disabled={isFetching}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFetching ? 'Fetching...' : '🔄 Fetch Latest'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Listings Grid */}
      {displayListings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {displayListings.map(listing => (
            <ListingCard
              key={listing.tripadvisor_id}
              listing={listing}
              onNavigateToDetail={handleNavigateToListing}
            />
          ))}
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-500">Loading listings...</div>
      ) : (
        <div className="text-center py-12 text-slate-500">No listings found</div>
      )}

      {/* Pagination */}
      {searchResults.length === 0 && listings.length > 0 && (
        <div className="flex gap-2 justify-center mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-slate-700">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={displayListings.length < itemsPerPage}
            className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
