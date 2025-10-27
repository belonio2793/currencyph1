import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { populateManilaListings } from '../lib/populateManillaListings'
import { populateTripadvisorListings } from '../lib/populateTripadvisorListings'

export default function AdminPopulate() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('manila')
  const [progress, setProgress] = useState(null)

  async function handlePopulateManila() {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const result = await populateManilaListings()
      if (result.success) {
        setResult(result)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handlePopulate() {
    setLoading(true)
    setError('')
    setResult(null)
    setProgress({ current: 0, total: 100, message: 'Starting...' })

    try {
      const result = await populateTripadvisorListings((progressData) => {
        setProgress(progressData)
      })

      if (result.success) {
        setResult(result)
        setProgress(null)
      } else {
        setError(result.message)
        setProgress(null)
      }
    } catch (err) {
      setError(`Error: ${err.message}`)
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleFetchPhilippines() {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const cities = tripadvisorPhilippinesFetcher.getPhilippineCities()

      // Get current count
      const { count: beforeCount } = await supabase
        .from('nearby_listings')
        .select('*', { count: 'exact', head: true })

      setProgress({ current: 0, total: cities.length, message: 'Starting fetch...' })

      const result = await tripadvisorPhilippinesFetcher.fetchAndSaveListings(cities, (progress) => {
        setProgress({
          current: progress.current,
          total: progress.total,
          message: progress.error ? `❌ ${progress.city}` : `✓ ${progress.city} (${progress.found || 0} found)`,
          city: progress.city,
          totalCollected: progress.totalCollected || 0
        })
      })

      const { count: afterCount } = await supabase
        .from('nearby_listings')
        .select('*', { count: 'exact', head: true })

      setResult({
        success: true,
        message: 'Philippines listings fetched and saved',
        ...result,
        beforeCount: beforeCount || 0,
        afterCount: afterCount || 0,
        newListings: (afterCount || 0) - (beforeCount || 0)
      })

      setProgress(null)
    } catch (err) {
      setError(`Error: ${err.message}`)
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Admin: Populate TripAdvisor Listings</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 flex-wrap">
          <button
            onClick={() => setActiveTab('manila')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'manila'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Manila Attractions
          </button>
          <button
            onClick={() => setActiveTab('philippines')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'philippines'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Fetch Philippines
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'full'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Full TripAdvisor API
          </button>
        </div>

        {/* Manila Tab */}
        {activeTab === 'manila' && (
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900 font-semibold mb-2">✓ Pre-curated Manila Attractions</p>
              <ul className="text-sm text-green-900 space-y-1 list-disc list-inside">
                <li>12 top-rated attractions with complete details</li>
                <li>SEO-optimized descriptions and images</li>
                <li>Includes: Intramuros, San Agustin Church, Manila Cathedral, and more</li>
                <li>Instant population with no API calls needed</li>
              </ul>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              This will populate your database with the most popular Manila attractions, each with detailed information, ratings, reviews, and SEO metadata.
            </p>

            <button
              onClick={handlePopulateManila}
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? 'Populating...' : 'Populate Manila Attractions'}
            </button>
          </div>
        )}

        {/* Philippines Fetcher Tab */}
        {activeTab === 'philippines' && (
          <div>
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900 font-semibold mb-2">🇵🇭 Fetch All Philippines Cities</p>
              <ul className="text-sm text-green-900 space-y-1 list-disc list-inside">
                <li>Fetches listings from 50+ Philippine cities</li>
                <li>Uses TripAdvisor API for real data</li>
                <li>Includes ratings, reviews, categories, and coordinates</li>
                <li>Smart deduplication to avoid duplicates</li>
                <li>Rate-limited to avoid API throttling</li>
              </ul>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-semibold mb-3">📝 How to Fetch Philippines Listings</p>
              <p className="text-sm text-blue-900 mb-3">Use the command line to fetch listings from TripAdvisor Philippines:</p>
              <div className="bg-slate-900 text-slate-100 p-3 rounded font-mono text-xs mb-3 overflow-x-auto">
                npm run fetch-philippines
              </div>
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> This command will fetch from all 50+ Philippine cities and populate your database with 2,000-4,000 listings. The process takes 5-10 minutes.
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900 font-semibold mb-2">�� Quick Steps</p>
              <ol className="text-sm text-amber-900 space-y-2 list-decimal list-inside">
                <li>Open your terminal/command prompt</li>
                <li>Navigate to your project directory</li>
                <li>Run: <code className="bg-amber-100 px-2 py-1 rounded">npm run fetch-philippines</code></li>
                <li>Watch the progress in real-time</li>
                <li>Check /nearby for new listings when complete</li>
              </ol>
            </div>
          </div>
        )}

        {/* Full API Tab */}
        {activeTab === 'full' && (
          <div>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-semibold mb-2">✓ Full Philippines Listing Population</p>
              <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside">
                <li>Populates listings from all major Philippine cities</li>
                <li>Includes attractions, parks, museums, and historical sites</li>
                <li>Automatic ratings and review counts included</li>
                <li>Direct database insertion with no external API calls</li>
              </ul>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              This will populate listings for all major Philippine cities and save them to the database. This may take a few seconds depending on database performance.
            </p>

            <button
              onClick={handlePopulate}
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Populating...' : 'Start Full Population'}
            </button>

            {progress && loading && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-900 mb-2">
                  {progress.message}
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Progress: {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            <p className="font-semibold mb-3">✓ Success!</p>
            <div className="space-y-1">
              {result.totalFetched !== undefined && <p>📊 Total fetched: {result.totalFetched}</p>}
              {result.uniqueSaved !== undefined && <p>📝 Unique saved: {result.uniqueSaved}</p>}
              {result.inserted !== undefined && <p>✅ Inserted: {result.inserted}</p>}
              {result.total !== undefined && <p>📝 Total collected: {result.total}</p>}
              {result.successCount !== undefined && <p>✓ Cities succeeded: {result.successCount}</p>}
              {result.errorCount !== undefined && <p>⚠️ Cities failed: {result.errorCount}</p>}
              {result.beforeCount !== undefined && <p>📈 Before: {result.beforeCount} listings</p>}
              {result.afterCount !== undefined && <p>📈 After: {result.afterCount} listings</p>}
              {result.newListings !== undefined && <p className="font-semibold text-green-900">🎉 Added: {result.newListings} new listings</p>}
            </div>
            <p className="mt-3">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
