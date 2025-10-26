import { supabase } from '../lib/supabaseClient'
import { searchPlaces } from '../lib/tripadvisorAPI'

export default function Nearby({ userId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedIds, setSavedIds] = useState(new Set())
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadSaved()
  }, [])

  async function loadSaved() {
    try {
      const { data, error } = await supabase.from('nearby_listings').select('tripadvisor_id')
      if (error) return
      setSavedIds(new Set((data || []).map(d => d.tripadvisor_id)))
    } catch (err) {
      console.error('Failed to load saved listings', err)
    }
  }

  async function handleSearch(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const lat = null
      const lng = null
      const res = await searchPlaces(query, lat, lng, 20 * page)
      if (!res) {
        setError('TripAdvisor API key not configured or API call failed.')
        setResults([])
        return
      }
      setResults(res)
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
        tripadvisor_id: item.id?.toString() || null,
        name: item.name || null,
        address: item.address || null,
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        rating: item.rating || null,
        category: item.category || null,
        raw: item.raw ? JSON.stringify(item.raw) : JSON.stringify(item)
      }
      if (!payload.tripadvisor_id) {
        setError('Item missing id - cannot save')
        return
      }
      const { error } = await supabase.from('nearby_listings').upsert(payload, { onConflict: 'tripadvisor_id' })
      if (error) throw error
      setSavedIds(prev => new Set(prev).add(payload.tripadvisor_id))
    } catch (err) {
      console.error('Failed to save item', err)
      setError('Failed to save listing')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">Nearby Listings</h2>
      <p className="text-sm text-slate-500 mb-6">Search TripAdvisor for places in the Philippines. Results can be saved to your directory for later use.</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          className="flex-1 px-4 py-2 border rounded-lg"
          placeholder="Search for a place or town (eg. Manila, Boracay, Cebu)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg" type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {results.map(item => (
          <div key={item.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-slate-900">{item.name}</h3>
                {item.address && <p className="text-sm text-slate-500">{item.address}</p>}
                <div className="mt-2 flex items-center gap-3">
                  {item.rating && <span className="text-sm text-yellow-500">★ {item.rating}</span>}
                  {item.category && <span className="text-sm text-slate-600">{item.category}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => saveItem(item)}
                  className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                  disabled={savedIds.has(item.id?.toString())}
                >
                  {savedIds.has(item.id?.toString()) ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && <p className="text-sm text-slate-500 mt-6">No results yet. Try searching for a city or landmark.</p>}
    </div>
  )
}
