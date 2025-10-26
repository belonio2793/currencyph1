import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { nearbyUtils } from '../lib/nearbyUtils'

export default function Business({ businessId, onBack, userId }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [voteCounts, setVoteCounts] = useState({ thumbsUp: 0, thumbsDown: 0 })
  const [userVote, setUserVote] = useState(null)

  useEffect(() => {
    if (!businessId) return
    fetchBusiness(businessId)
    loadVotes(businessId)
  }, [businessId])

  async function fetchBusiness(id) {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.from('nearby_listings').select('*').eq('tripadvisor_id', id).maybeSingle()
      if (error) throw error
      if (!data) {
        setError('Business not found')
        setData(null)
      } else {
        setData(data)
      }
    } catch (err) {
      console.error('fetchBusiness error', err)
      setError('Failed to load business')
    } finally {
      setLoading(false)
    }
  }

  if (!businessId) return null

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Back</button>
          <h1 className="text-2xl font-semibold mt-2">{data?.name || 'Business'}</h1>
          {data?.category && <div className="text-sm text-slate-600">{data.category}</div>}
        </div>
        <div className="text-right text-sm text-slate-500">{data?.rating ? `★ ${data.rating}` : ''}</div>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="bg-white border rounded-lg p-6">
          {data.address && <p className="mb-3 text-sm text-slate-600">{data.address}</p>}

          {data.latitude && data.longitude && (
            <div className="mb-4">
              <iframe
                title="map"
                src={`https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=15&output=embed`}
                className="w-full h-64 border-0 rounded"
              />
            </div>
          )}

          <div className="prose">
            <h3>Details</h3>
            <p><strong>Name:</strong> {data.name}</p>
            <p><strong>Category:</strong> {data.category || '—'}</p>
            <p><strong>Rating:</strong> {data.rating ?? '—'}</p>
            <p><strong>Source:</strong> {data.source || 'directory'}</p>
            <h4 className="mt-4">Raw data</h4>
            <pre className="text-xs bg-slate-100 p-3 rounded overflow-auto">{JSON.stringify(data.raw, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
