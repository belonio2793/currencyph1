import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { searchPlaces } from '../lib/tripadvisorAPI'
import { nearbyUtils } from '../lib/nearbyUtils'
import { checkAndPopulateManilaListings } from '../lib/populateManillaListings'
import tripadvisorSync from '../lib/tripadvisorSync'
import { tripadvisorPhilippinesFetcher } from '../lib/tripadvisorPhilippinesFetcher'
import StarRating from './StarRating'
import FeaturedListings from './FeaturedListings'

const TOP_10_CITIES = [
  'Manila',
  'Cebu',
  'Davao',
  'Quezon City',
  'Makati',
  'Baguio',
  'Boracay',
  'Puerto Princesa',
  'Iloilo',
  'Pasig'
]

const POPULAR_CITIES = [
  'Alaminos',
  'Angeles',
  'Antipolo',
  'Bacolod',
  'Bacoor',
  'Bago',
  'Baguio',
  'Bais',
  'Balanga',
  'Baliwag',
  'Batac',
  'Batangas City',
  'Bayawan',
  'Baybay',
  'Bayugan',
  'Biñan',
  'Bislig',
  'Bogo',
  'Borongan',
  'Butuan',
  'Cabadbaran',
  'Cabanatuan',
  'Cabuyao',
  'Cadiz',
  'Cagayan de Oro',
  'Calaca',
  'Calamba',
  'Calapan',
  'Calbayog',
  'Caloocan',
  'Candon',
  'Canlaon',
  'Carcar',
  'Carmona',
  'Catbalogan',
  'Cauayan',
  'Cavite City',
  'Cebu City',
  'Cotabato City',
  'Dagupan',
  'Danao',
  'Dapitan',
  'Dasmariñas',
  'Davao City',
  'Digos',
  'Dipolog',
  'Dumaguete',
  'El Salvador',
  'Escalante',
  'Gapan',
  'General Santos',
  'General Trias',
  'Gingoog',
  'Guihulngan',
  'Himamaylan',
  'Ilagan',
  'Iligan',
  'Iloilo City',
  'Imus',
  'Iriga',
  'Isabela',
  'Kabankalan',
  'Kidapawan',
  'Koronadal',
  'La Carlota',
  'Lamitan',
  'Laoag',
  'Lapu-Lapu',
  'Las Piñas',
  'Legazpi',
  'Ligao',
  'Lipa',
  'Lucena',
  'Maasin',
  'Mabalacat',
  'Makati',
  'Malabon',
  'Malaybalay',
  'Malolos',
  'Mandaluyong',
  'Mandaue',
  'Manila',
  'Marawi',
  'Marikina',
  'Masbate City',
  'Mati',
  'Meycauayan',
  'Muñoz',
  'Muntinlupa',
  'Naga (Camarines Sur)',
  'Naga (Cebu)',
  'Navotas',
  'Olongapo',
  'Ormoc',
  'Oroquieta',
  'Ozamiz',
  'Pagadian',
  'Palayan',
  'Panabo',
  'Parañaque',
  'Pasay',
  'Pasig',
  'Passi',
  'Puerto Princesa',
  'Quezon City',
  'Roxas',
  'Sagay',
  'Samal',
  'San Carlos (Negros Occidental)',
  'San Carlos (Pangasinan)',
  'San Fernando (La Union)',
  'San Fernando (Pampanga)',
  'San Jose',
  'San Jose del Monte',
  'San Juan',
  'San Pablo',
  'San Pedro',
  'Santa Rosa',
  'Santiago',
  'Santo Tomas',
  'Silay',
  'Sipalay',
  'Sorsogon City',
  'Surigao City',
  'Tabaco',
  'Tabuk',
  'Tacloban',
  'Tacurong',
  'Tagaytay',
  'Tagbilaran',
  'Taguig',
  'Tagum',
  'Talisay (Cebu)',
  'Talisay (Negros Occidental)',
  'Tanauan',
  'Tandag',
  'Tangub',
  'Tanjay',
  'Tarlac City',
  'Tayabas',
  'Toledo',
  'Trece Martires',
  'Tuguegarao',
  'Urdaneta',
  'Valencia',
  'Valenzuela',
  'Victorias',
  'Vigan',
  'Zamboanga City',
  'Camiguin (tourist)',
  'General Luna (tourist)',
  'Moalboal (tourist)',
  'Pagudpud (tourist)',
  'San Juan La Union (tourist)',
  'Siargao (tourist)',
  'Siquijor (tourist)',
  'Batangas (tourist)',
  'Caticlan (tourist)',
  'Coron (tourist)',
  'Port Barton (tourist)'
]

export default function Nearby({ userId, setActiveTab, setCurrentBusinessId }) {
  const [selectedCity, setSelectedCity] = useState(null)
  const [cityListings, setCityListings] = useState([])
  const [cityPage, setCityPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedIds, setSavedIds] = useState(new Set())
  const [savedListings, setSavedListings] = useState([])
  const [listingPage, setListingPage] = useState(1)
  const [addMode, setAddMode] = useState(false)
  const [newListing, setNewListing] = useState({ name: '', address: '', latitude: '', longitude: '', rating: '', category: '', description: '' })
  const [voteCounts, setVoteCounts] = useState({})
  const [userVotes, setUserVotes] = useState({})
  const [isAuthenticatedUser, setIsAuthenticatedUser] = useState(false)
  const [alphabetFilter, setAlphabetFilter] = useState('Featured')
  const [allCities, setAllCities] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [listingStats, setListingStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState(null)

  useEffect(() => {
    checkAuthStatus()
    loadSavedIds()
    loadSavedListings()
    loadAllCities()
    loadAllCategories()
    loadStats()

    // Auto-populate Manila listings if not already populated
    checkAndPopulateManilaListings().catch((err) => {
      console.warn('Failed to auto-populate Manila listings:', err)
    })

    // Check if sync is needed and perform it
    tripadvisorSync.shouldSync().then(shouldSync => {
      if (shouldSync) {
        console.log('Syncing with TripAdvisor...')
        tripadvisorSync.syncWithTripAdvisor().then(() => {
          console.log('Sync complete')
          loadAllCities()
          loadStats()
        })
      }
    })
  }, [])

  async function checkAuthStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticatedUser(!!user)
    } catch (err) {
      setIsAuthenticatedUser(false)
    }
  }

  async function loadAllCities() {
    try {
      const cities = await tripadvisorSync.getAllCities()
      setAllCities(cities)
    } catch (err) {
      console.error('Error loading cities:', err)
    }
  }

  async function loadAllCategories() {
    try {
      const categories = await tripadvisorSync.getAllCategories()
      setAllCategories(categories)
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  async function loadStats() {
    try {
      const stats = await tripadvisorSync.getListingStats()
      setListingStats(stats)
    } catch (err) {
      console.error('Error loading stats:', err)
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
      const results = await tripadvisorSync.searchListings(searchQuery)
      setSearchResults(results)
    } catch (err) {
      console.error('Error searching:', err)
    } finally {
      setIsSearching(false)
    }
  }

  async function handleFetchPhilippinesListings() {
    if (!confirm('Fetch fresh listings from TripAdvisor Philippines?\n\nThis may take 5-10 minutes.')) {
      return
    }

    setIsFetching(true)
    setFetchProgress({ message: 'Starting fetch...', current: 0, total: 50 })

    try {
      const cities = tripadvisorPhilippinesFetcher.getPhilippineCities()

      const result = await tripadvisorPhilippinesFetcher.fetchAndSaveListings(
        cities,
        (progress) => {
          setFetchProgress({
            message: progress.error ? `❌ ${progress.city}` : `✓ ${progress.city}`,
            current: progress.current,
            total: progress.total,
            totalCollected: progress.totalCollected || 0
          })
        }
      )

      setError('')
      alert(`✅ Fetch complete!\n\n✓ Cities processed: ${result.successCount}\n⚠️ Cities failed: ${result.errorCount}\n📝 Total listings: ${result.total}`)

      // Refresh stats
      await loadAllCities()
      await loadAllCategories()
      await loadStats()
      await loadSavedListings(1)
    } catch (err) {
      console.error('Error fetching:', err)
      setError(`Failed to fetch: ${err.message}`)
    } finally {
      setIsFetching(false)
      setFetchProgress(null)
    }
  }

  async function loadCategoryListings(category, pageNum = 1) {
    if (!category) return

    setLoading(true)
    setError('')
    try {
      const perPage = 12
      const offset = (pageNum - 1) * perPage
      const data = await tripadvisorSync.getListingsByCategory(category, perPage, offset)
      setCityListings(data || [])

      // Load vote counts
      const counts = {}
      const votes = {}
      for (const listing of (data || [])) {
        const voteData = await nearbyUtils.getListingVoteCounts(listing.tripadvisor_id, 'nearby')
        counts[listing.tripadvisor_id] = voteData

        if (userId) {
          const userVote = await nearbyUtils.getListingVote(listing.tripadvisor_id, 'nearby', userId)
          votes[listing.tripadvisor_id] = userVote
        }
      }
      setVoteCounts(counts)
      setUserVotes(votes)
    } catch (err) {
      console.error('Failed to load category listings:', err)
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }

  async function loadSavedIds() {
    try {
      const { data, error } = await supabase.from('nearby_listings').select('tripadvisor_id')
      if (error) return console.warn('loadSavedIds:', error.message)
      setSavedIds(new Set((data || []).map(d => d.tripadvisor_id)))
    } catch (err) {
      console.error('Failed to load saved ids', err)
    }
  }

  async function loadSavedListings(page = 1, per = 20) {
    try {
      const from = (page - 1) * per
      const to = from + per - 1
      const { data, error } = await supabase.from('nearby_listings').select('*').order('updated_at', { ascending: false }).range(from, to)
      if (error) return console.warn('loadSavedListings:', error.message)
      setSavedListings(data || [])

      // Load vote counts for saved listings
      const votes = {}
      const counts = {}
      for (const listing of (data || [])) {
        const voteData = await nearbyUtils.getListingVoteCounts(listing.tripadvisor_id, 'nearby')
        counts[listing.tripadvisor_id] = voteData

        if (userId) {
          const userVote = await nearbyUtils.getListingVote(listing.tripadvisor_id, 'nearby', userId)
          votes[listing.tripadvisor_id] = userVote
        }
      }
      setVoteCounts(counts)
      setUserVotes(votes)
    } catch (err) {
      console.error('Failed to load saved listings', err)
    }
  }


  async function handleVote(listingId, listingType, voteType) {
    if (!userId) {
      setError('Please log in to vote')
      return
    }

    try {
      const currentVote = userVotes[listingId]
      if (currentVote === voteType) {
        // Remove vote if clicking same button
        await nearbyUtils.removeListingVote(listingId, listingType, userId)
        setUserVotes(prev => ({ ...prev, [listingId]: null }))
      } else {
        // Submit or update vote
        await nearbyUtils.submitListingVote(listingId, listingType, userId, voteType)
        setUserVotes(prev => ({ ...prev, [listingId]: voteType }))
      }

      // Reload vote counts
      const voteData = await nearbyUtils.getListingVoteCounts(listingId, listingType)
      setVoteCounts(prev => ({ ...prev, [listingId]: voteData }))
    } catch (err) {
      console.error('Error voting:', err)
      setError('Failed to submit vote')
    }
  }


  async function loadCityListings(city, pageNum = 1) {
    if (!city) return

    setLoading(true)
    setError('')
    try {
      const perPage = 12
      const from = (pageNum - 1) * perPage
      const to = from + perPage - 1

      const { data, error } = await supabase
        .from('nearby_listings')
        .select('*')
        .ilike('address', `%${city}%`)
        .order('rating', { ascending: false })
        .range(from, to)

      if (error) {
        console.warn('Failed to load city listings:', error.message)
        setCityListings([])
        return
      }

      setCityListings(data || [])

      // Load vote counts
      const counts = {}
      const votes = {}
      for (const listing of (data || [])) {
        const voteData = await nearbyUtils.getListingVoteCounts(listing.tripadvisor_id, 'nearby')
        counts[listing.tripadvisor_id] = voteData

        if (userId) {
          const userVote = await nearbyUtils.getListingVote(listing.tripadvisor_id, 'nearby', userId)
          votes[listing.tripadvisor_id] = userVote
        }
      }
      setVoteCounts(counts)
      setUserVotes(votes)
    } catch (err) {
      console.error('Failed to load city listings:', err)
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }

  function getFilteredCities() {
    if (alphabetFilter === 'Featured') return TOP_10_CITIES
    if (alphabetFilter === 'All') return allCities.length > 0 ? allCities : POPULAR_CITIES
    return (allCities.length > 0 ? allCities : POPULAR_CITIES).filter(city => city.charAt(0).toUpperCase() === alphabetFilter)
  }

  async function saveItem(item) {
    try {
      const payload = {
        tripadvisor_id: item.tripadvisor_id || item.id?.toString() || null,
        name: item.name || null,
        address: item.address || null,
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        rating: item.rating || null,
        category: item.category || null,
        raw: item.raw ? item.raw : item
      }
      if (!payload.tripadvisor_id) {
        payload.tripadvisor_id = `manual-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
      }
      const { error } = await supabase.from('nearby_listings').upsert(payload, { onConflict: 'tripadvisor_id' })
      if (error) throw error
      setSavedIds(prev => new Set(prev).add(payload.tripadvisor_id))
      loadSavedListings(listingPage)
    } catch (err) {
      console.error('Failed to save item', err)
      setError('Failed to save listing')
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault()

    if (!userId) {
      setError('Please log in to submit a business')
      return
    }

    try {
      await nearbyUtils.submitPendingListing(userId, {
        name: newListing.name,
        address: newListing.address,
        latitude: newListing.latitude,
        longitude: newListing.longitude,
        rating: newListing.rating,
        category: newListing.category,
        description: newListing.description,
        raw: {}
      })

      setNewListing({ name: '', address: '', latitude: '', longitude: '', rating: '', category: '', description: '' })
      setAddMode(false)
      setError('')

      // Show success message
      alert('Business submitted successfully! Community members will review and approve it.')
    } catch (err) {
      console.error('Error submitting business:', err)
      setError('Failed to submit business')
    }
  }

  async function deleteListing(id) {
    if (!confirm('Delete this listing?')) return
    try {
      const { error } = await supabase.from('nearby_listings').delete().eq('tripadvisor_id', id)
      if (error) throw error
      setSavedListings(s => s.filter(r => r.tripadvisor_id !== id))
      setSavedIds(prev => {
        const copy = new Set(prev)
        copy.delete(id)
        return copy
      })
    } catch (err) {
      console.error('Delete failed', err)
      setError('Delete failed')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Featured Manila Attractions Section */}
      <FeaturedListings />

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
        <form onSubmit={handleSearch} className="flex gap-2">
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
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Search Results ({searchResults.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {searchResults.map(item => {
                const counts = voteCounts[item.tripadvisor_id] || { thumbsUp: 0, thumbsDown: 0 }
                const userVote = userVotes[item.tripadvisor_id]

                return (
                  <div key={item.tripadvisor_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group">
                    {(item.raw?.image || item.image) && (
                      <div className="relative w-full bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden" style={{ height: '200px' }}>
                        <img
                          src={item.raw?.image || item.image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = `https://via.placeholder.com/600x400?text=${encodeURIComponent(item.name)}`
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        {item.category && (
                          <span className="absolute top-3 left-3 inline-block px-3 py-1 bg-white/95 text-slate-900 rounded-full text-xs font-semibold shadow-sm">
                            {item.category}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{item.name}</h4>
                      {item.address && <p className="text-sm text-slate-600 mb-3">{item.address}</p>}
                      <div className="flex items-center gap-3 mb-4">
                        {item.rating && (
                          <>
                            <StarRating value={Number(item.rating)} size="sm" />
                            <span className="text-sm font-semibold text-slate-900">{Number(item.rating).toFixed(1)}</span>
                            <span className="text-xs text-slate-500">({item.reviewCount || '0'})</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveItem(item)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          {savedIds.has(item.tripadvisor_id?.toString()) ? '✓ Saved' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setCurrentBusinessId(item.tripadvisor_id?.toString())
                            setActiveTab('business')
                          }}
                          className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Browse by Category Section */}
      {allCategories.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Browse by Category</h3>
          <div className="flex gap-2 mb-6 flex-wrap">
            {allCategories.map(category => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                  setCityPage(1)
                  loadCategoryListings(category, 1)
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

          {selectedCategory && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{selectedCategory} Listings</h3>
                {loading && <span className="text-sm text-slate-500">Loading...</span>}
              </div>

              {cityListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {cityListings.map(item => {
                    const counts = voteCounts[item.tripadvisor_id] || { thumbsUp: 0, thumbsDown: 0 }
                    const userVote = userVotes[item.tripadvisor_id]

                    return (
                      <div key={item.tripadvisor_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group">
                        {(item.raw?.image || item.image) && (
                          <div className="relative w-full bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden" style={{ height: '200px' }}>
                            <img
                              src={item.raw?.image || item.image}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.currentTarget.src = `https://via.placeholder.com/600x400?text=${encodeURIComponent(item.name)}`
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            {item.category && (
                              <span className="absolute top-3 left-3 inline-block px-3 py-1 bg-white/95 text-slate-900 rounded-full text-xs font-semibold shadow-sm">
                                {item.category}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="p-4">
                          <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{item.name}</h4>
                          {item.address && <p className="text-sm text-slate-600 mb-3">{item.address}</p>}
                          <div className="flex items-center gap-3 mb-4">
                            {item.rating && (
                              <>
                                <StarRating value={Number(item.rating)} size="sm" />
                                <span className="text-sm font-semibold text-slate-900">{Number(item.rating).toFixed(1)}</span>
                                <span className="text-xs text-slate-500">({item.reviewCount || '0'})</span>
                              </>
                            )}
                          </div>
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => handleVote(item.tripadvisor_id, 'nearby', 'up')}
                              className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors font-medium ${
                                userVote === 'up'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                              }`}
                            >
                              👍 {counts.thumbsUp}
                            </button>
                            <button
                              onClick={() => handleVote(item.tripadvisor_id, 'nearby', 'down')}
                              className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors font-medium ${
                                userVote === 'down'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                              }`}
                            >
                              👎 {counts.thumbsDown}
                            </button>
                          </div>
                          <button
                            onClick={() => saveItem(item)}
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            {savedIds.has(item.tripadvisor_id?.toString()) ? '✓ Saved' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : loading ? (
                <div className="text-center py-8 text-slate-500">Loading listings...</div>
              ) : (
                <div className="text-center py-8 text-slate-500">No listings found</div>
              )}

              {/* Pagination */}
              <div className="flex gap-2 justify-center mt-6">
                <button
                  onClick={() => {
                    setCityPage(p => Math.max(1, p - 1))
                    loadCategoryListings(selectedCategory, Math.max(1, cityPage - 1))
                  }}
                  disabled={cityPage === 1}
                  className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-slate-700">Page {cityPage}</span>
                <button
                  onClick={() => {
                    setCityPage(p => p + 1)
                    loadCategoryListings(selectedCategory, cityPage + 1)
                  }}
                  disabled={cityListings.length < 12}
                  className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nearby Listings</h2>
          <p className="text-sm text-slate-500">Search TripAdvisor and save businesses to your directory for the Philippines.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleFetchPhilippinesListings}
            disabled={isFetching}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title="Fetch fresh listings from TripAdvisor Philippines"
          >
            {isFetching ? 'Fetching...' : '🔄 Fetch Philippines'}
          </button>
          <button onClick={() => { setAddMode(!addMode) }} className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm">{addMode ? 'Cancel' : '+ Add Business'}</button>
          <button onClick={() => loadSavedListings(1)} className="px-3 py-2 bg-slate-100 rounded-md text-sm">⟲ Refresh Saved</button>
        </div>
      </div>

      {/* Fetch Progress */}
      {isFetching && fetchProgress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-2">{fetchProgress.message}</p>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (fetchProgress.current / fetchProgress.total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-blue-700 mt-2">
            Progress: {fetchProgress.current} / {fetchProgress.total} cities
            {fetchProgress.totalCollected > 0 && ` · Total: ${fetchProgress.totalCollected} listings`}
          </p>
        </div>
      )}

      {addMode && (
        <form onSubmit={handleAddSubmit} className="mb-6 bg-white p-4 rounded-md border">
          <div className="mb-2 text-sm text-slate-600">
            Submit a new business for community review and approval
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input required value={newListing.name} onChange={e => setNewListing(s => ({ ...s, name: e.target.value }))} placeholder="Business name" className="px-3 py-2 border rounded" />
            <input value={newListing.address} onChange={e => setNewListing(s => ({ ...s, address: e.target.value }))} placeholder="Address" className="px-3 py-2 border rounded" />
            <input value={newListing.category} onChange={e => setNewListing(s => ({ ...s, category: e.target.value }))} placeholder="Category (e.g. Restaurant)" className="px-3 py-2 border rounded" />
            <input value={newListing.latitude} onChange={e => setNewListing(s => ({ ...s, latitude: e.target.value }))} placeholder="Latitude" className="px-3 py-2 border rounded" />
            <input value={newListing.longitude} onChange={e => setNewListing(s => ({ ...s, longitude: e.target.value }))} placeholder="Longitude" className="px-3 py-2 border rounded" />
            <input value={newListing.rating} onChange={e => setNewListing(s => ({ ...s, rating: e.target.value }))} placeholder="Rating (1-5)" className="px-3 py-2 border rounded" />
          </div>
          <textarea
            value={newListing.description}
            onChange={e => setNewListing(s => ({ ...s, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border rounded"
            rows="3"
          />
          <div className="mt-3">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Submit for Approval</button>
          </div>
        </form>
      )}

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Filter by City</h3>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setAlphabetFilter('Featured')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              alphabetFilter === 'Featured'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Featured
          </button>
          <button
            onClick={() => setAlphabetFilter('All')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              alphabetFilter === 'All'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map(letter => (
            <button
              key={letter}
              onClick={() => setAlphabetFilter(letter)}
              className={`px-2 py-1 rounded text-sm transition-colors ${
                alphabetFilter === letter
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Popular cities grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {getFilteredCities().map(city => (
            <button
              key={city}
              onClick={() => {
                setSelectedCity(city)
                setCityPage(1)
                loadCityListings(city, 1)
              }}
              className={`p-4 rounded-lg font-medium text-center transition-all ${
                selectedCity === city
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-900 hover:border-blue-300 hover:shadow'
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">{error}</div>}

      {selectedCity && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Listings in {selectedCity}</h3>
            {loading && <span className="text-sm text-slate-500">Loading...</span>}
          </div>

          {cityListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {cityListings.map(item => {
                const counts = voteCounts[item.tripadvisor_id] || { thumbsUp: 0, thumbsDown: 0 }
                const userVote = userVotes[item.tripadvisor_id]

                return (
                  <div key={item.tripadvisor_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group">
                    {(item.raw?.image || item.image) && (
                      <div className="relative w-full bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden" style={{ height: '200px' }}>
                        <img
                          src={item.raw?.image || item.image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = `https://via.placeholder.com/600x400?text=${encodeURIComponent(item.name)}`
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        {item.category && (
                          <span className="absolute top-3 left-3 inline-block px-3 py-1 bg-white/95 text-slate-900 rounded-full text-xs font-semibold shadow-sm">
                            {item.category}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <h4 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{item.name}</h4>
                      {item.address && <p className="text-sm text-slate-600 mb-3">{item.address}</p>}
                      <div className="flex items-center gap-3 mb-4">
                        {item.rating && (
                          <>
                            <StarRating value={Number(item.rating)} size="sm" />
                            <span className="text-sm font-semibold text-slate-900">{Number(item.rating).toFixed(1)}</span>
                            <span className="text-xs text-slate-500">({item.reviewCount || '0'})</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => handleVote(item.tripadvisor_id, 'nearby', 'up')}
                          className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors font-medium ${
                            userVote === 'up'
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                          }`}
                          title={isAuthenticatedUser ? 'Like this listing' : 'Log in to vote'}
                        >
                          👍 {counts.thumbsUp}
                        </button>
                        <button
                          onClick={() => handleVote(item.tripadvisor_id, 'nearby', 'down')}
                          className={`flex-1 px-2 py-2 text-sm rounded-lg transition-colors font-medium ${
                            userVote === 'down'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                          }`}
                          title={isAuthenticatedUser ? 'Dislike this listing' : 'Log in to vote'}
                        >
                          👎 {counts.thumbsDown}
                        </button>
                      </div>
                      <button
                        onClick={() => saveItem(item)}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        disabled={savedIds.has(item.tripadvisor_id?.toString())}
                      >
                        {savedIds.has(item.tripadvisor_id?.toString()) ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-slate-500">Loading listings...</div>
          ) : (
            <div className="text-center py-8 text-slate-500">No listings found for {selectedCity}</div>
          )}

          {/* Pagination */}
          <div className="flex gap-2 justify-center mt-6">
            <button
              onClick={() => {
                setCityPage(p => Math.max(1, p - 1))
                loadCityListings(selectedCity, Math.max(1, cityPage - 1))
              }}
              disabled={cityPage === 1}
              className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-slate-700">Page {cityPage}</span>
            <button
              onClick={() => {
                setCityPage(p => p + 1)
                loadCityListings(selectedCity, cityPage + 1)
              }}
              disabled={cityListings.length < 12}
              className="px-4 py-2 bg-slate-100 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <h3 className="text-lg font-medium mt-4 mb-3">Saved Directory</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {savedListings.map(item => {
          const counts = voteCounts[item.tripadvisor_id] || { thumbsUp: 0, thumbsDown: 0 }
          const userVote = userVotes[item.tripadvisor_id]

          return (
            <div key={item.tripadvisor_id} className="bg-white border rounded-lg p-4 shadow-sm">
              {(item.raw?.image || item.image) && (
                <div className="w-full h-32 rounded-lg overflow-hidden mb-3 bg-slate-200">
                  <img
                    src={item.raw?.image || item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://via.placeholder.com/600x400?text=${encodeURIComponent(item.name)}`
                    }}
                  />
                </div>
              )}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold cursor-pointer hover:text-blue-600" onClick={() => {
                    setCurrentBusinessId(item.tripadvisor_id)
                    setActiveTab('business')
                  }}>
                    {item.name}
                  </h4>
                  {item.address && <p className="text-sm text-slate-500">{item.address}</p>}
                  <div className="mt-2 text-sm text-slate-600">
                    {item.category}
                    {item.rating ? (
                      <span className="inline-flex items-center gap-1 ml-2 align-middle">
                        <StarRating value={Number(item.rating)} size="sm" />
                        <span>{Number(item.rating).toFixed(1)}</span>
                      </span>
                    ) : ''}
                  </div>
                </div>
              </div>

              {/* Vote buttons */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => handleVote(item.tripadvisor_id, 'nearby', 'up')}
                  className={`px-2 py-1 text-sm rounded transition-colors ${
                    userVote === 'up'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                  }`}
                  title={isAuthenticatedUser ? 'Like this listing' : 'Log in to vote'}
>
                  Upvote {counts.thumbsUp}
                </button>
                <button
                  onClick={() => handleVote(item.tripadvisor_id, 'nearby', 'down')}
                  className={`px-2 py-1 text-sm rounded transition-colors ${
                    userVote === 'down'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                  }`}
                  title={isAuthenticatedUser ? 'Dislike this listing' : 'Log in to vote'}
>
                  Downvote {counts.thumbsDown}
                </button>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button onClick={() => deleteListing(item.tripadvisor_id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm w-full">Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {savedListings.length === 0 && <p className="text-sm text-slate-500 mt-6">No saved listings yet.</p>}
    </div>
  )
}
