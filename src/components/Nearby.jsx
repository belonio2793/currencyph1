import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ListingCard from './ListingCard'
import { imageManager } from '../lib/imageManager'
import { nearbyUtils } from '../lib/nearbyUtils'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

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

// Extra destinations to ensure coverage in the A–Z browser
const EXTRA_CITIES = [
  'Boracay', 'Baguio', 'Bohol', 'Coron', 'El Nido', 'Makati', 'Palawan', 'Siargao', 'Valencia'
]

const ALL_CITIES = Array.from(new Set([...PHILIPPINE_CITIES, ...EXTRA_CITIES]))

function groupCitiesByLetter(cities) {
  const grouped = {}
  cities.forEach(city => {
    const letter = city.charAt(0).toUpperCase()
    if (!grouped[letter]) grouped[letter] = []
    grouped[letter].push(city)
  })
  // Ensure all letters A-Z exist as keys (possibly empty arrays)
  for (const l of ALPHABET) {
    if (!grouped[l]) grouped[l] = []
  }
  return Object.keys(grouped).sort().reduce((acc, letter) => {
    acc[letter] = grouped[letter]
    return acc
  }, {})
}

function unionCities(fetched, predefined) {
  const set = new Set()
  for (const c of predefined) if (c && typeof c === 'string') set.add(c.trim())
  for (const c of fetched) if (c && typeof c === 'string') set.add(c.trim())
  return Array.from(set).sort((a, b) => a.localeCompare(b))
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
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)

  // Per-category pagination and data for selected city
  const [categoryPages, setCategoryPages] = useState({ restaurants: 1, attractions: 1, hotels: 1 })
  const [categoryListings, setCategoryListings] = useState({ restaurants: [], attractions: [], hotels: [] })
  const [categoryLoading, setCategoryLoading] = useState({ restaurants: false, attractions: false, hotels: false })
  const [categoryError, setCategoryError] = useState({ restaurants: '', attractions: '', hotels: '' })

  // Letter-level categorized state when filtering by alphabet letter
  const [letterCategoryPages, setLetterCategoryPages] = useState({ restaurants: 1, attractions: 1, hotels: 1 })
  const [letterCategoryListings, setLetterCategoryListings] = useState({ restaurants: [], attractions: [], hotels: [] })
  const [letterCategoryLoading, setLetterCategoryLoading] = useState({ restaurants: false, attractions: false, hotels: false })
  const [letterCategoryError, setLetterCategoryError] = useState({ restaurants: '', attractions: '', hotels: '' })

  // Community management section
  const [viewMode, setViewMode] = useState('listings') // 'listings' or 'community'
  const [pendingListings, setPendingListings] = useState([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState('')
  const [voteCounts, setVoteCounts] = useState({})
  const [userVotes, setUserVotes] = useState({})

  const itemsPerPage = 12

  useEffect(() => {
    // Check if view parameter is in URL
    const params = new URLSearchParams(window.location.search)
    const viewParam = params.get('view')
    if (viewParam === 'community') {
      setViewMode('community')
    }
  }, [])

  useEffect(() => {
    loadCities()
    loadStats()
    loadFeaturedListings()
    loadListings()
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
      const fetchedCities = Array.from(unique.keys())
      const allCities = unionCities(fetchedCities, ALL_CITIES)
      setCities(allCities)
      setCitiesByLetter(groupCitiesByLetter(allCities))
      setListingStats((prev) => (prev ? { ...prev, cities: allCities.length } : prev))
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
        .order('photo_count', { ascending: false, nullsLast: true })
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
        // When a city is selected we handle loading via categorized loaders
        setLoading(false)
        return
      } else if (expandedLetter) {
        // When a letter is selected, we handle via letter-categorized loaders
        setLoading(false)
        return
      }

      const from = (page - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const { data, error: fetchError } = await query
        .order('photo_count', { ascending: false, nullsLast: true })
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

  // Load categorized listings for selected city
  async function loadCategoryListingsForCity(city, nextPages = categoryPages) {
    if (!city) return
    try {
      setCategoryLoading({ restaurants: true, attractions: true, hotels: true })
      setCategoryError({ restaurants: '', attractions: '', hotels: '' })

      const fromFor = (p) => (p - 1) * itemsPerPage
      const toFor = (p) => fromFor(p) + itemsPerPage - 1

      const base = supabase.from('nearby_listings').select('*').eq('city', city)

      const qRestaurants = base
        .ilike('category', '%restaurant%')
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
        .range(fromFor(nextPages.restaurants), toFor(nextPages.restaurants))

      const qHotels = supabase
        .from('nearby_listings')
        .select('*')
        .eq('city', city)
        .or('category.ilike.%hotel%,category.ilike.%resort%')
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
        .range(fromFor(nextPages.hotels), toFor(nextPages.hotels))

      const qAttractions = supabase
        .from('nearby_listings')
        .select('*')
        .eq('city', city)
        .not('category', 'ilike', '%restaurant%')
        .not('category', 'ilike', '%hotel%')
        .not('category', 'ilike', '%resort%')
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
        .range(fromFor(nextPages.attractions), toFor(nextPages.attractions))

      const [restRes, hotelRes, attrRes] = await Promise.all([
        qRestaurants, qHotels, qAttractions
      ])

      if (restRes.error) throw restRes.error
      if (hotelRes.error) throw hotelRes.error
      if (attrRes.error) throw attrRes.error

      setCategoryListings({
        restaurants: restRes.data || [],
        hotels: hotelRes.data || [],
        attractions: attrRes.data || []
      })
    } catch (err) {
      console.error('Error loading categorized listings:', err)
      const msg = 'Failed to load listings'
      setCategoryError({ restaurants: msg, attractions: msg, hotels: msg })
    } finally {
      setCategoryLoading({ restaurants: false, attractions: false, hotels: false })
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
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
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

  // Download and store photos for all listings
  async function handleDownloadAllImages() {
    if (!confirm('Download and store photos for all listings now? This may take a long time and use bandwidth. Continue?')) return
    setIsFetching(true)
    try {
      const pageSize = 200
      let offset = 0
      let all = []
      while (true) {
        const { data, error } = await supabase
          .from('nearby_listings')
          .select('*')
          .range(offset, offset + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all = all.concat(data)
        offset += pageSize
        await new Promise(r => setTimeout(r, 200))
      }

      await imageManager.batchDownloadImages(all)
      alert(`Queued photos for ${all.length} listings`)
    } catch (err) {
      console.error('Error downloading images:', err)
      setError(`Failed to download images: ${err.message}`)
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

  // Load categorized listings for selected letter
  async function loadCategoryListingsForLetter(letter, nextPages = letterCategoryPages) {
    if (!letter) return
    try {
      setLetterCategoryLoading({ restaurants: true, attractions: true, hotels: true })
      setLetterCategoryError({ restaurants: '', attractions: '', hotels: '' })

      const fromFor = (p) => (p - 1) * itemsPerPage
      const toFor = (p) => fromFor(p) + itemsPerPage - 1

      const qRestaurants = supabase
        .from('nearby_listings')
        .select('*')
        .ilike('city', `${letter}%`)
        .ilike('category', '%restaurant%')
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
        .range(fromFor(nextPages.restaurants), toFor(nextPages.restaurants))

      const qHotels = supabase
        .from('nearby_listings')
        .select('*')
        .ilike('city', `${letter}%`)
        .or('category.ilike.%hotel%,category.ilike.%resort%')
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
        .range(fromFor(nextPages.hotels), toFor(nextPages.hotels))

      const qAttractions = supabase
        .from('nearby_listings')
        .select('*')
        .ilike('city', `${letter}%`)
        .not('category', 'ilike', '%restaurant%')
        .not('category', 'ilike', '%hotel%')
        .not('category', 'ilike', '%resort%')
        .order('photo_count', { ascending: false, nullsLast: true })
        .order('rating', { ascending: false })
        .range(fromFor(nextPages.attractions), toFor(nextPages.attractions))

      const [restRes, hotelRes, attrRes] = await Promise.all([
        qRestaurants, qHotels, qAttractions
      ])

      if (restRes.error) throw restRes.error
      if (hotelRes.error) throw hotelRes.error
      if (attrRes.error) throw attrRes.error

      setLetterCategoryListings({
        restaurants: restRes.data || [],
        hotels: hotelRes.data || [],
        attractions: attrRes.data || []
      })
    } catch (err) {
      console.error('Error loading letter categorized listings:', err)
      const msg = 'Failed to load listings'
      setLetterCategoryError({ restaurants: msg, attractions: msg, hotels: msg })
    } finally {
      setLetterCategoryLoading({ restaurants: false, attractions: false, hotels: false })
    }
  }

  async function loadPendingListings() {
    try {
      setCommunityLoading(true)
      setCommunityError('')
      const listings = await nearbyUtils.getPendingListings('pending', 100)
      setPendingListings(listings)

      const counts = {}
      const votes = {}
      for (const listing of listings) {
        const voteData = await nearbyUtils.getApprovalVotes(listing.id)
        counts[listing.id] = voteData

        if (userId) {
          const userVote = await nearbyUtils.getUserApprovalVote(listing.id, userId)
          votes[listing.id] = userVote
        }
      }
      setVoteCounts(counts)
      setUserVotes(votes)
    } catch (err) {
      console.error('Error loading pending listings:', err)
      setCommunityError('Failed to load pending listings')
    } finally {
      setCommunityLoading(false)
    }
  }

  async function handleApprovalVote(listingId, voteType) {
    if (!userId) {
      setCommunityError('Please log in to vote')
      return
    }

    try {
      await nearbyUtils.submitApprovalVote(listingId, userId, voteType)

      setUserVotes(prev => ({
        ...prev,
        [listingId]: userVotes[listingId] === voteType ? null : voteType
      }))

      const voteData = await nearbyUtils.getApprovalVotes(listingId)
      setVoteCounts(prev => ({
        ...prev,
        [listingId]: voteData
      }))
    } catch (err) {
      console.error('Error submitting vote:', err)
      setCommunityError('Failed to submit vote')
    }
  }

  async function handleApprove(listingId) {
    if (!userId) {
      setCommunityError('Please log in to approve listings')
      return
    }

    try {
      await nearbyUtils.approvePendingListing(listingId)
      setPendingListings(prev => prev.filter(l => l.id !== listingId))
    } catch (err) {
      console.error('Error approving listing:', err)
      setCommunityError('Failed to approve listing')
    }
  }

  async function handleReject(listingId) {
    if (!userId) {
      setCommunityError('Please log in to reject listings')
      return
    }

    if (!confirm('Reject this listing? This cannot be undone.')) return

    try {
      await nearbyUtils.rejectPendingListing(listingId)
      setPendingListings(prev => prev.filter(l => l.id !== listingId))
    } catch (err) {
      console.error('Error rejecting listing:', err)
      setCommunityError('Failed to reject listing')
    }
  }

  useEffect(() => {
    if (viewMode === 'community') {
      loadPendingListings()
    }
  }, [viewMode])

  useEffect(() => {
    if (selectedCity) {
      // Reset category pages when switching city
      setCategoryPages({ restaurants: 1, attractions: 1, hotels: 1 })
      loadCategoryListingsForCity(selectedCity, { restaurants: 1, attractions: 1, hotels: 1 })
    } else if (expandedLetter) {
      // Reset letter category pages on new letter
      setLetterCategoryPages({ restaurants: 1, attractions: 1, hotels: 1 })
      loadCategoryListingsForLetter(expandedLetter, { restaurants: 1, attractions: 1, hotels: 1 })
    } else {
      loadListings()
    }
  }, [selectedCity, expandedLetter])

  useEffect(() => {
    if (!selectedCity && !expandedLetter) {
      loadListings()
    }
  }, [page])

  useEffect(() => {
    if (selectedCity) {
      loadCategoryListingsForCity(selectedCity, categoryPages)
    }
  }, [categoryPages])

  useEffect(() => {
    if (!selectedCity && expandedLetter) {
      loadCategoryListingsForLetter(expandedLetter, letterCategoryPages)
    }
  }, [letterCategoryPages])

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
      {/* Tab Selector */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('listings')}
              className={`px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'listings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Nearby
            </button>
            <button
              onClick={() => setViewMode('community')}
              className={`px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'community'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Community
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'listings' && (
      <>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Explore Philippines</h1>
          <p className="text-blue-100 text-lg mb-6">Discover the best attractions, restaurants & hotels across all Philippine cities</p>

          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">📍 Browse by City</h3>
            <p className="text-blue-100 mb-4">Select a letter to see all cities starting with that letter</p>

            {/* Prominent A-Z Alphabet Selector */}
            <div className="bg-transparent rounded-xl p-2 max-w-4xl mx-auto">
              <div className="flex flex-wrap gap-2 justify-center">
                {/* All Button */}
                <button
                  onClick={() => {
                    setSelectedCity(null)
                    setExpandedLetter(null)
                    setPage(1)
                  }}
                  className={`px-3 py-2 rounded-md font-bold text-sm transition-all duration-200 ${
                    expandedLetter === null && selectedCity === null
                      ? 'bg-white/20 text-white shadow-lg scale-105'
                      : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  All
                </button>

                {/* A-Z Letters */}
                {ALPHABET.map(letter => {
                  const hasCities = (citiesByLetter[letter] || []).length > 0
                  return (
                    <button
                      key={letter}
                      onClick={() => {
                        const next = expandedLetter === letter ? null : letter
                        setExpandedLetter(next)
                        setSelectedCity(null)
                        setPage(1)
                        setLetterCategoryPages({ restaurants: 1, attractions: 1, hotels: 1 })
                      }}
                      className={`w-9 h-9 rounded-md font-bold text-sm transition-all duration-200 flex items-center justify-center ${
                        expandedLetter === letter
                          ? 'bg-white/25 text-white shadow-lg scale-110'
                          : 'bg-white/5 text-white hover:bg-white/10 hover:scale-105'
                      } ${!hasCities ? 'opacity-60' : ''}`}
                      title={`Cities starting with ${letter}`}
                    >
                      {letter}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* City List for Selected Letter (buttons) */}
            {expandedLetter && citiesByLetter[expandedLetter] && (
              <div className="mt-4 animate-fadeIn">
                <div className="mb-2 flex items-center gap-3">
                  <h4 className="text-lg font-bold text-white">
                    Cities Starting with <span className="bg-white/20 text-white px-2 py-1 rounded-md">{expandedLetter}</span>
                  </h4>
                  <span className="bg-white/10 text-white px-2 py-1 rounded-full text-sm font-semibold">
                    {citiesByLetter[expandedLetter].length} cities
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {citiesByLetter[expandedLetter].map(city => (
                    <button
                      key={city}
                      onClick={() => {
                        setSelectedCity(city)
                        setPage(1)
                        setCategoryPages({ restaurants: 1, attractions: 1, hotels: 1 })
                      }}
                      className={`px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200 text-left border-2 ${
                        selectedCity === city
                          ? 'bg-white/20 text-white border-white/20 shadow'
                          : 'bg-transparent text-white border-white/20 hover:border-white/40 hover:bg-white/5'
                      }`}
                    >
                      <span className="block">{city}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-10">

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
                  key={item.slug || item.tripadvisor_id || item.id || `listing-${Math.random()}`}
                  listing={item}
                  onNavigateToDetail={handleNavigateToListing}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Browse by City Section - Enhanced Alphabet Selector */}

      {/* Header */}
      {(searchResults.length > 0 || selectedCity || expandedLetter) && (
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">
            {searchResults.length > 0
              ? 'Search Results'
              : selectedCity
              ? `Listings in ${selectedCity}`
              : expandedLetter
              ? `Cities starting with ${expandedLetter}`
              : ''}
          </h2>
          {selectedCity && (
            <span className="text-sm text-slate-600">Page {page}</span>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Listings - Show categorized sections for letter selection or city selection; otherwise general grid */}
      {selectedCity === null && expandedLetter !== null ? (
        <div className="space-y-10">
          {['restaurants', 'attractions', 'hotels'].map((key) => {
            const titleMap = { restaurants: 'Restaurants', attractions: 'Attractions', hotels: 'Hotels' }
            const items = letterCategoryListings[key]
            const isLoading = letterCategoryLoading[key]
            const err = letterCategoryError[key]
            const currentPage = letterCategoryPages[key]
            return (
              <section key={key}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">{titleMap[key]}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLetterCategoryPages(prev => ({ ...prev, [key]: Math.max(1, currentPage - 1) }))}
                      disabled={currentPage === 1 || isLoading}
                      className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200 text-sm"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {currentPage}</span>
                    <button
                      onClick={() => setLetterCategoryPages(prev => ({ ...prev, [key]: currentPage + 1 }))}
                      disabled={isLoading || (items && items.length < itemsPerPage)}
                      className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200 text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>
                )}

                {isLoading ? (
                  <div className="text-slate-500">Loading {titleMap[key]}...</div>
                ) : items && items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map(listing => (
                      <ListingCard
                        key={listing.slug || listing.tripadvisor_id || listing.id || `listing-${Math.random()}`}
                        listing={listing}
                        onNavigateToDetail={handleNavigateToListing}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">No {titleMap[key].toLowerCase()} found for cities starting with {expandedLetter}</div>
                )}
              </section>
            )
          })}
        </div>
      ) : selectedCity !== null ? (
        // Categorized sections when a city is selected
        <div className="space-y-10">
          {['restaurants', 'attractions', 'hotels'].map((key) => {
            const titleMap = { restaurants: 'Restaurants', attractions: 'Attractions', hotels: 'Hotels' }
            const items = categoryListings[key]
            const isLoading = categoryLoading[key]
            const err = categoryError[key]
            const currentPage = categoryPages[key]
            return (
              <section key={key}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">{titleMap[key]}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCategoryPages(prev => ({ ...prev, [key]: Math.max(1, currentPage - 1) }))}
                      disabled={currentPage === 1 || isLoading}
                      className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200 text-sm"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">Page {currentPage}</span>
                    <button
                      onClick={() => setCategoryPages(prev => ({ ...prev, [key]: currentPage + 1 }))}
                      disabled={isLoading || (items && items.length < itemsPerPage)}
                      className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50 hover:bg-slate-200 text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{err}</div>
                )}

                {isLoading ? (
                  <div className="text-slate-500">Loading {titleMap[key]}...</div>
                ) : items && items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map(listing => (
                      <ListingCard
                        key={listing.slug || listing.tripadvisor_id || listing.id || `listing-${Math.random()}`}
                        listing={listing}
                        onNavigateToDetail={handleNavigateToListing}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">No {titleMap[key].toLowerCase()} found in {selectedCity}</div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        // General grid
        <>
          {displayListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {displayListings.map(listing => (
                <ListingCard
                  key={listing.slug || listing.tripadvisor_id || listing.id || `listing-${Math.random()}`}
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

          {/* Pagination for general listings */}
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
        </>
      )}
      </div>
      </>
      )}

      {viewMode === 'community' && (
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Community Management</h2>
            <p className="text-sm text-slate-500 mt-2">Review and approve new business listings submitted by community members</p>
          </div>

          {communityError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {communityError}
            </div>
          )}

          {communityLoading && (
            <div className="text-center py-8">
              <p className="text-slate-500">Loading pending listings...</p>
            </div>
          )}

          {!communityLoading && pendingListings.length === 0 && (
            <div className="bg-white border rounded-lg p-8 text-center">
              <p className="text-slate-500 mb-2">No pending listings to review</p>
              <p className="text-sm text-slate-400">All submitted businesses have been processed</p>
            </div>
          )}

          <div className="space-y-4">
            {pendingListings.map(listing => {
              const counts = voteCounts[listing.id] || { approvals: 0, rejections: 0 }
              const userVote = userVotes[listing.id]

              return (
                <div key={listing.id} className="bg-white border rounded-lg p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">{listing.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">{listing.address}</p>

                      <div className="mt-3 flex items-center gap-4">
                        {listing.category && (
                          <span className="text-sm px-2 py-1 bg-slate-100 rounded text-slate-700">
                            {listing.category}
                          </span>
                        )}
                        {listing.rating && (
                          <span className="text-sm text-yellow-600">★ {listing.rating}</span>
                        )}
                        {listing.description && (
                          <p className="text-sm text-slate-600 mt-2">{listing.description}</p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">Community Votes:</span>
                          <span className="text-sm text-green-600 font-semibold">{counts.approvals} approve</span>
                          <span className="text-sm text-red-600 font-semibold">{counts.rejections} reject</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="border-t pt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovalVote(listing.id, 'approve')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          userVote === 'approve'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        👍 Approve
                      </button>
                      <button
                        onClick={() => handleApprovalVote(listing.id, 'reject')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          userVote === 'reject'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        👎 Reject
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(listing.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        ✓ Mark Approved
                      </button>
                      <button
                        onClick={() => handleReject(listing.id)}
                        className="px-4 py-2 bg-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-400"
                      >
                        ✗ Mark Rejected
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
  )
}
