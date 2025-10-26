import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { searchPlaces } from '../lib/tripadvisorAPI'
import { nearbyUtils } from '../lib/nearbyUtils'
import { populateAllTripAdvisorListings } from '../lib/tripAdvisorPopulate'

export default function Nearby({ userId, setActiveTab, setCurrentBusinessId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedIds, setSavedIds] = useState(new Set())
  const [page, setPage] = useState(1)
  const [savedListings, setSavedListings] = useState([])
  const [listingPage, setListingPage] = useState(1)
  const [addMode, setAddMode] = useState(false)
  const [newListing, setNewListing] = useState({ name: '', address: '', latitude: '', longitude: '', rating: '', category: '', description: '' })
  const [voteCounts, setVoteCounts] = useState({})
  const [userVotes, setUserVotes] = useState({})
  const [isAuthenticatedUser, setIsAuthenticatedUser] = useState(false)
  const [populatingTripadvisor, setPopulatingTripadvisor] = useState(false)
  const [populateProgress, setPopulateProgress] = useState('')

  useEffect(() => {
    checkAuthStatus()
    loadSavedIds()
    loadSavedListings()
  }, [])

  async function checkAuthStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticatedUser(!!user)
    } catch (err) {
      setIsAuthenticatedUser(false)
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

  async function loadVotesForResults() {
    if (results.length === 0) return

    const votes = {}
    const counts = {}
    for (const item of results) {
      const id = item.tripadvisor_id || item.id
      const voteData = await nearbyUtils.getListingVoteCounts(id, 'search')
      counts[id] = voteData

      if (userId) {
        const userVote = await nearbyUtils.getListingVote(id, 'search', userId)
        votes[id] = userVote
      }
    }
    setVoteCounts(prev => ({ ...prev, ...counts }))
    setUserVotes(prev => ({ ...prev, ...votes }))
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

  async function handlePopulateTripAdvisor() {
    if (!confirm('This will fetch all TripAdvisor listings for major Philippine cities. This may take 1-2 minutes. Continue?')) {
      return
    }

    setPopulatingTripadvisor(true)
    setPopulateProgress('Starting...')
    setError('')

    try {
      const result = await populateAllTripAdvisorListings((msg) => {
        setPopulateProgress(msg)
      })
      setPopulateProgress(result.message)
      loadSavedListings(1)
    } catch (err) {
      console.error('Error populating TripAdvisor:', err)
      setError(`Failed to populate: ${err.message}`)
    } finally {
      setPopulatingTripadvisor(false)
    }
  }

  async function handleSearch(e) {
    if (e) e.preventDefault()
    if (!query) return setError('Enter a search term')
    setLoading(true)
    setError('')
    try {
      const lat = null
      const lng = null
      const res = await searchPlaces(query + ' Philippines', lat, lng, 25)
      if (!res) {
        // TripAdvisor request failed (likely CORS or network). Fallback to local DB search.
        const { data, error } = await supabase
          .from('nearby_listings')
          .select('*')
          .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
          .limit(50)
        if (error) {
          console.warn('Local DB fallback failed', error)
          setError('Search failed. Check console for details.')
          setResults([])
          return
        }
        setError('Using local directory fallback (TripAdvisor unavailable)')
        setResults((data || []).map(d => ({
          id: d.tripadvisor_id,
          tripadvisor_id: d.tripadvisor_id,
          name: d.name,
          address: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          rating: d.rating,
          category: d.category,
          raw: d.raw
        })))
        return
      }
      setResults(res)
      // Load votes for results
      setTimeout(loadVotesForResults, 100)
    } catch (err) {
      console.error(err)
      setError('Search failed. Check console for details.')
      setResults([])
    } finally {
      setLoading(false)
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Nearby Listings</h2>
          <p className="text-sm text-slate-500">Search TripAdvisor and save businesses to your directory for the Philippines.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setAddMode(!addMode) }} className="px-3 py-2 bg-indigo-600 text-white rounded-md">{addMode ? 'Cancel' : 'Add Business'}</button>
          <button onClick={() => loadSavedListings(1)} className="px-3 py-2 bg-slate-100 rounded-md">Refresh Saved</button>
          <button onClick={handlePopulateTripAdvisor} disabled={populatingTripadvisor} className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">
            {populatingTripadvisor ? 'Populating...' : 'Load TripAdvisor'}
          </button>
        </div>
      </div>

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

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          className="flex-1 px-4 py-2 border rounded-lg"
          placeholder="Search TripAdvisor (e.g. Manila hotels, Boracay restaurants)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {results.map(item => {
            const id = item.tripadvisor_id || item.id
            const counts = voteCounts[id] || { thumbsUp: 0, thumbsDown: 0 }
            const userVote = userVotes[id]

            return (
              <div key={id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-slate-900">{item.name}</h3>
                    {item.address && <p className="text-sm text-slate-500">{item.address}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      {item.rating && <span className="text-sm text-yellow-500">★ {item.rating}</span>}
                      {item.category && <span className="text-sm text-slate-600">{item.category}</span>}
                    </div>

                    {/* Vote buttons */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleVote(id, 'search', 'up')}
                        className={`px-2 py-1 text-sm rounded transition-colors ${
                          userVote === 'up'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                        }`}
                        title={isAuthenticatedUser ? 'Like this listing' : 'Log in to vote'}
                      >
                        👍 {counts.thumbsUp}
                      </button>
                      <button
                        onClick={() => handleVote(id, 'search', 'down')}
                        className={`px-2 py-1 text-sm rounded transition-colors ${
                          userVote === 'down'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                        }`}
                        title={isAuthenticatedUser ? 'Dislike this listing' : 'Log in to vote'}
                      >
                        👎 {counts.thumbsDown}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => saveItem(item)}
                        className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                        disabled={savedIds.has(id?.toString())}
                      >
                        {savedIds.has(id?.toString()) ? 'Saved' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setCurrentBusinessId(id?.toString())
                          setActiveTab('business')
                        }}
                        className="px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h3 className="text-lg font-medium mt-4 mb-3">Saved Directory</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {savedListings.map(item => {
          const counts = voteCounts[item.tripadvisor_id] || { thumbsUp: 0, thumbsDown: 0 }
          const userVote = userVotes[item.tripadvisor_id]

          return (
            <div key={item.tripadvisor_id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold cursor-pointer hover:text-blue-600" onClick={() => {
                    setCurrentBusinessId(item.tripadvisor_id)
                    setActiveTab('business')
                  }}>
                    {item.name}
                  </h4>
                  {item.address && <p className="text-sm text-slate-500">{item.address}</p>}
                  <div className="mt-2 text-sm text-slate-600">{item.category}{item.rating ? ` • ★ ${item.rating}` : ''}</div>
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
                  👍 {counts.thumbsUp}
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
                  👎 {counts.thumbsDown}
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
