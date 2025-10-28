import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function EnrichmentMonitor() {
  const [stats, setStats] = useState({
    total: 0,
    enriched: 0,
    rated: 0,
    described: 0,
    phones: 0,
    websites: 0,
    reviews: 0
  })
  const [rateInfo, setRateInfo] = useState({
    rate: 0,
    maxRate: 0,
    estimatedTime: 0,
    lastUpdate: Date.now()
  })
  const [loading, setLoading] = useState(true)
  const [lastEnrichedCount, setLastEnrichedCount] = useState(0)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total count
        const { count: totalCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })

        // Get enriched (have tripadvisor_id)
        const { count: enrichedCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })
          .not('tripadvisor_id', 'is', null)

        // Get other stats
        const { count: ratedCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })
          .not('rating', 'is', null)

        const { count: describedCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })
          .not('description', 'is', null)

        const { count: phonesCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })
          .not('phone_number', 'is', null)

        const { count: websitesCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })
          .not('website', 'is', null)

        const { count: reviewsCount } = await supabase
          .from('nearby_listings')
          .select('*', { count: 'exact', head: true })
          .not('review_count', 'is', null)

        const newEnrichedCount = enrichedCount || 0
        const countDiff = newEnrichedCount - lastEnrichedCount
        const currentTime = Date.now()
        const timeDiff = (currentTime - rateInfo.lastUpdate) / 1000
        const currentRate = timeDiff > 0 ? (countDiff / timeDiff).toFixed(2) : 0
        const newMaxRate = Math.max(rateInfo.maxRate, currentRate)

        const remaining = (totalCount || 0) - newEnrichedCount
        const estimatedSeconds = currentRate > 0 ? remaining / currentRate : 0

        setStats({
          total: totalCount || 0,
          enriched: newEnrichedCount,
          rated: ratedCount || 0,
          described: describedCount || 0,
          phones: phonesCount || 0,
          websites: websitesCount || 0,
          reviews: reviewsCount || 0
        })

        setRateInfo({
          rate: currentRate,
          maxRate: newMaxRate,
          estimatedTime: estimatedSeconds,
          lastUpdate: currentTime
        })

        setLastEnrichedCount(newEnrichedCount)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [lastEnrichedCount, rateInfo.lastUpdate])

  const percent = stats.total > 0 ? ((stats.enriched / stats.total) * 100).toFixed(1) : 0

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">🔄 Enrichment Monitor</h2>
        <div className="text-sm text-gray-600">
          {loading ? 'Loading...' : 'Live Updates'}
        </div>
      </div>

      {/* Main Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-semibold text-gray-700">TripAdvisor ID Enrichment</span>
          <span className="text-2xl font-bold text-blue-600">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          ></div>
        </div>

        <div className="text-center text-sm text-gray-600">
          {stats.enriched} / {stats.total} listings
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-gray-600 text-sm">Enriched</div>
          <div className="text-2xl font-bold text-blue-600">{stats.enriched}</div>
          <div className="text-xs text-gray-500">with TripAdvisor IDs</div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-gray-600 text-sm">Rate</div>
          <div className="text-2xl font-bold text-green-600">{rateInfo.rate}/s</div>
          <div className="text-xs text-gray-500">items per second</div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-gray-600 text-sm">ETA</div>
          <div className="text-2xl font-bold text-purple-600">{formatTime(rateInfo.estimatedTime)}</div>
          <div className="text-xs text-gray-500">estimated remaining</div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-gray-600 text-sm">Max Rate</div>
          <div className="text-2xl font-bold text-orange-600">{rateInfo.maxRate}/s</div>
          <div className="text-xs text-gray-500">peak speed</div>
        </div>
      </div>

      {/* Data Completion */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Data Fields Complete</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">⭐ Ratings</span>
            <span className={`font-semibold ${stats.rated === stats.total ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.rated}/{stats.total}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">📝 Descriptions</span>
            <span className={`font-semibold ${stats.described === stats.total ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.described}/{stats.total}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">📞 Phone Numbers</span>
            <span className={`font-semibold ${stats.phones === stats.total ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.phones}/{stats.total}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">🌐 Websites</span>
            <span className={`font-semibold ${stats.websites === stats.total ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.websites}/{stats.total}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">💬 Review Counts</span>
            <span className={`font-semibold ${stats.reviews === stats.total ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.reviews}/{stats.total}
            </span>
          </div>
        </div>
      </div>

      {/* Status */}
      {stats.enriched >= stats.total ? (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <span className="text-green-700 font-semibold">✨ Enrichment Complete!</span>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <span className="text-blue-700 text-sm">Processing {stats.total - stats.enriched} remaining listings...</span>
        </div>
      )}
    </div>
  )
}
