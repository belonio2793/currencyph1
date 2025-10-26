import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { populateManilaListings } from '../lib/populateManillaListings'

export default function AdminPopulate() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('manila')

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

    try {
      const { data, error: fnError } = await supabase.functions.invoke('populate-tripadvisor', {
        method: 'POST'
      })

      if (fnError) {
        setError(`Function error: ${fnError.message}`)
        return
      }

      setResult(data)
    } catch (err) {
      setError(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Admin: Populate TripAdvisor Listings</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('manila')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'manila'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Manila Attractions (Recommended)
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

        {/* Full API Tab */}
        {activeTab === 'full' && (
          <div>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-semibold mb-2">Before starting:</p>
              <ol className="text-sm text-blue-900 space-y-2 list-decimal list-inside">
                <li>Go to your Supabase project: <a href="https://app.supabase.com" className="underline text-blue-600 hover:text-blue-700" target="_blank" rel="noopener noreferrer">supabase.com</a></li>
                <li>Go to "SQL Editor" and run the migration: <span className="bg-white px-2 py-1 rounded font-mono text-xs">supabase/migrations/create_nearby_listings.sql</span></li>
                <li>This creates the necessary tables for listings and votes</li>
                <li>Come back here and click "Start Population"</li>
              </ol>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              This will fetch listings from TripAdvisor API for all 100+ Philippine cities and save them to the database. This may take a few minutes.
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
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            <p className="font-semibold mb-2">✓ Success!</p>
            {result.totalFetched !== undefined && <p>Total fetched: {result.totalFetched}</p>}
            {result.uniqueSaved !== undefined && <p>Unique saved: {result.uniqueSaved}</p>}
            {result.inserted !== undefined && <p>Inserted: {result.inserted}</p>}
            <p className="mt-2">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
