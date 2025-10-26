import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminPopulate() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

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
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">Admin: Populate TripAdvisor Listings</h2>

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
          {loading ? 'Populating...' : 'Start Population'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            <p className="font-semibold mb-2">✓ Success!</p>
            <p>Total fetched: {result.totalFetched}</p>
            <p>Unique saved: {result.uniqueSaved}</p>
            <p className="mt-2">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
