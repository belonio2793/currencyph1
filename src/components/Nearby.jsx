import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ListingCard from './ListingCard'

const PHILIPPINE_CITIES = [
  'Abuyog', 'Alaminos', 'Alcala', 'Angeles', 'Antipolo', 'Aroroy', 'Bacolod', 'Bacoor', 'Bago', 'Bais',
  'Balanga', 'Baliuag', 'Bangued', 'Bansalan', 'Bantayan', 'Bataan', 'Batac', 'Batangas City', 'Bayambang', 'Bayawan',
  'Baybay', 'Bayugan', 'Biñan', 'Bislig', 'Bocaue', 'Bogo', 'Borongan', 'Borong', 'Butuan', 'Cabadbaran',
  'Cabanatuan', 'Cabuyao', 'Cadiz', 'Cagayan de Oro', 'Calamba', 'Calapan', 'Calbayog', 'Caloocan', 'Camiling', 'Canlaon',
  'Caoayan', 'Capiz', 'Caraga', 'Carmona', 'Catbalogan', 'Cauayan', 'Cavite City', 'Cebu City', 'Cotabato City', 'Dagupan',
  'Danao', 'Dapitan', 'Daraga', 'Dasmariñas', 'Davao City', 'Davao del Norte', 'Davao del Sur', 'Davao Oriental', 'Dipolog', 'Dumaguete',
  'General Santos', 'General Trias', 'Gingoog', 'Guihulngan', 'Himamaylan', 'Ilagan', 'Iligan', 'Iloilo City', 'Imus', 'Isabela',
  'Isulan', 'Kabankalan', 'Kidapawan', 'Koronadal', 'La Carlota', 'Laoag', 'Lapu-Lapu', 'Las Piñas', 'Laoang', 'Legazpi',
  'Ligao', 'Limay', 'Lucena', 'Maasin', 'Mabalacat', 'Malabon', 'Malaybalay', 'Malolos', 'Mandaluyong', 'Mandaue',
  'Manila', 'Marawi', 'Marilao', 'Masbate City', 'Mati', 'Meycauayan', 'Muntinlupa', 'Naga (Camarines Sur)', 'Navotas', 'Olongapo',
  'Ormoc', 'Oroquieta', 'Ozamiz', 'Pagadian', 'Palo', 'Parañaque', 'Pasay', 'Pasig', 'Passi', 'Puerto Princesa',
  'Quezon City', 'Roxas', 'Sagay', 'Samal', 'San Carlos (Negros Occidental)', 'San Carlos (Pangasinan)', 'San Fernando (La Union)', 'San Fernando (Pampanga)', 'San Jose (Antique)', 'San Jose del Monte',
  'San Juan', 'San Pablo', 'San Pedro', 'Santiago', 'Silay', 'Sipalay', 'Sorsogon City', 'Surigao City', 'Tabaco', 'Tabuk',
  'Tacurong', 'Tagaytay', 'Tagbilaran', 'Taguig', 'Tacloban', 'Talisay (Cebu)', 'Talisay (Negros Occidental)', 'Tanjay', 'Tarlac City', 'Tayabas',
  'Toledo', 'Trece Martires', 'Tuguegarao', 'Urdaneta', 'Valenzuela', 'Victorias', 'Vigan', 'Virac', 'Zamboanga City'
]

function groupCitiesByLetter(cities) {
  const grouped = {}
  cities.forEach(city => {
    const letter = city.charAt(0).toUpperCase()
    if (!grouped[letter]) {
      grouped[letter] = []
    }
    grouped[letter].push(city)
  })
  return Object.keys(grouped).sort().reduce((acc, letter) => {
    acc[letter] = grouped[letter]
    return acc
  }, {})
}

export default function Nearby({ userId, setActiveTab, setCurrentListingSlug }) {
  const [selectedCity, setSelectedCity] = useState(null)
  const [listings, setListings] = useState([])
  const [featuredListings, setFeaturedListings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [listingStats, setListingStats] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const [page, setPage] = useState(1)
  const [expandedLetter, setExpandedLetter] = useState(null)
  const [cities, setCities] = useState([])
  const [citiesByLetter, setCitiesByLetter] = useState({})
  const itemsPerPage = 12

  useEffect(() => {
    loadCities()
    loadStats()
    loadFeaturedListings()
  }, [])

  async function loadStats() {
    try {
      const { data: countData } = await supabase
        .from('nearby_listings')
        .select('*', { count: 'exact' })
        .limit(0)

      const { data: ratingData } = await supabase
        .from('nearby_listings')
        .select('rating')
        .not('rating', 'is', null)

      const avgRating = ratingData && ratingData.length > 0
        ? (ratingData.reduce((sum, d) => sum + (d.rating || 0), 0) / ratingData.length).toFixed(1)
        : 0

      setListingStats({
        total: countData?.count || 0,
        cities: cities.length,
        avgRating: avgRating,
        withRatings: ratingData?.length || 0
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  async function loadCities() {
    try {
      const { data, error } = await supabase
        .from('nearby_listings')
        .select('city, country')
        .not('city', 'is', null)
        .order('city', { ascending: true })
        .limit(10000)

      if (error) throw error

      const unique = new Map()
      ;(data || []).forEach((row) => {
        const city = (row.city || '').trim()
        if (!city) return
        if (!unique.has(city)) unique.set(city, row.country || null)
      })
      const cityList = Array.from(unique.keys())
      setCities(cityList)
      setCitiesByLetter(groupCitiesByLetter(cityList))
      setListingStats((prev) => (prev ? { ...prev, cities: cityList.length } : prev))
    } catch (err) {
      console.error('Error loading cities:', err)
    }
  }

  async function loadFeaturedListings() {
    try {
      const { data, error: fetchError } = await supabase
        .from('nearby_listings')
        .select('*')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .limit(6)

      if (fetchError) throw fetchError

      setFeaturedListings(data || [])
    } catch (err) {
      console.error('Error loading featured listings:', err)
    }
  }

  async function loadListings() {
    setLoading(true)
    setError('')
    try {
      let query = supabase.from('nearby_listings').select('*')

      if (selectedCity) {
        query = query.eq('city', selectedCity)
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
          `name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%`
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
      await loadFeaturedListings()
      await loadListings()
      setPage(1)
    } catch (err) {
      console.error('Error fetching listings:', err)
      setError(`Failed to fetch: ${err.message}`)
    } finally {
      setIsFetching(false)
    }
  }

  async function handleFetchComprehensiveListings() {
    if (!confirm('Fetch ALL listings from TripAdvisor for every Philippine city?\n\nThis will take 10-20 minutes and may use significant API calls.\n\nContinue?')) {
      return
    }

    setIsFetching(true)
    try {
      const supabaseUrl = import.meta.env.VITE_PROJECT_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase credentials not configured')
      }

      const functionUrl = `${supabaseUrl}/functions/v1/scrape-nearby-listings-comprehensive`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ limit: 30 })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Edge function error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      alert(`✅ Comprehensive Fetch Complete!\n\nCities Covered: ${result.totalCities}\nCategories: ${result.totalCategories}\nTotal Combinations: ${result.totalCombinations}\n\nTotal Scraped: ${result.totalScraped}\nUnique Listings: ${result.uniqueListings}\nUpserted: ${result.upserted}\n\nSuccess: ${result.successCount}, Errors: ${result.errorCount}`)

      // Refresh stats and listings
      await loadStats()
      await loadCities()
      await loadFeaturedListings()
      await loadListings()
      setPage(1)
    } catch (err) {
      console.error('Error fetching comprehensive listings:', err)
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
    if (selectedCity || page > 1) {
      loadListings()
    }
  }, [selectedCity, page])

  const displayListings = searchResults.length > 0 ? searchResults : listings

  // CSS for fade-in animation
  const style = document.createElement('style')
  if (!document.querySelector('style[data-fadeIn]')) {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-fadeIn', 'true')
    styleEl.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
      }
    `
    document.head.appendChild(styleEl)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Explore Philippines</h1>
          <p className="text-blue-100 text-lg mb-6">Discover the best attractions, restaurants & hotels across all Philippine cities</p>

          {/* Stats */}
          {listingStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{listingStats.total.toLocaleString()}</div>
                <div className="text-blue-100 text-sm">Total Listings</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold text-white">{listingStats.cities}</div>
                <div className="text-blue-100 text-sm">Philippine Cities</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <div className="text-3xl font-bold text-white">⭐ {listingStats.avgRating}</div>
                <div className="text-blue-100 text-sm">Avg Rating</div>
              </div>
            </div>
          )}

          {/* Fetch Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleFetchAdvancedListings}
              disabled={isFetching}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 backdrop-blur border border-white/20"
            >
              {isFetching ? '⏳ Fetching...' : '🔄 Refresh (5 Cities)'}
            </button>
            <button
              onClick={handleFetchComprehensiveListings}
              disabled={isFetching}
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              {isFetching ? '⏳ Fetching...' : '🌍 Fetch ALL Cities (70+)'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Featured Listings Section */}
        {featuredListings.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-slate-900">⭐ Featured</h2>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">Top Rated</span>
            </div>
            <p className="text-slate-600 mb-6">The highest-rated listings across the Philippines</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.map(listing => (
                <ListingCard
                  key={listing.tripadvisor_id}
                  listing={listing}
                  onNavigateToDetail={handleNavigateToListing}
                  hideImage={false}
                />
              ))}
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

      {/* Browse by City Section - Enhanced Alphabet Selector */}
      <div className="mb-12">
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">📍 Browse by City</h3>
          <p className="text-slate-600 mb-6">Select a letter to see all cities starting with that letter</p>

          {/* Prominent A-Z Alphabet Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-wrap gap-2 justify-center">
              {/* All Button */}
              <button
                onClick={() => {
                  setSelectedCity(null)
                  setExpandedLetter(null)
                  setPage(1)
                }}
                className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                  expandedLetter === null && selectedCity === null
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All
              </button>

              {/* A-Z Letters */}
              {Object.keys(citiesByLetter).sort().map(letter => (
                <button
                  key={letter}
                  onClick={() => {
                    setExpandedLetter(expandedLetter === letter ? null : letter)
                    setSelectedCity(null)
                    setPage(1)
                  }}
                  className={`w-10 h-10 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center ${
                    expandedLetter === letter
                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                      : 'bg-slate-100 text-slate-700 hover:bg-blue-500 hover:text-white hover:scale-105'
                  }`}
                  title={`Cities starting with ${letter}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* City List for Selected Letter */}
        {expandedLetter && citiesByLetter[expandedLetter] && (
          <div className="animate-fadeIn">
            <div className="mb-4 flex items-center gap-3">
              <h4 className="text-xl font-bold text-slate-900">
                Cities Starting with <span className="bg-blue-600 text-white px-3 py-1 rounded-lg">{expandedLetter}</span>
              </h4>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                {citiesByLetter[expandedLetter].length} cities
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {citiesByLetter[expandedLetter].map(city => (
                <button
                  key={city}
                  onClick={() => {
                    setSelectedCity(city)
                    setPage(1)
                  }}
                  className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 text-left border-2 ${
                    selectedCity === city
                      ? 'bg-blue-600 text-white border-blue-700 shadow-lg'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <span className="block">{city}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      {(searchResults.length > 0 || selectedCity) && (
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            {searchResults.length > 0 ? 'Search Results' : selectedCity ? `Listings in ${selectedCity}` : ''}
          </h2>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Listings Grid */}
      {displayListings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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
    </div>
  )
}
