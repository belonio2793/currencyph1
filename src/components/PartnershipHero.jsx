import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import PartnershipForm from './PartnershipForm'

export default function PartnershipHero({ userId, userEmail, isAuthenticated, onAuthRequired = null }) {
  const [partnerships, setPartnerships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPartnerships()
  }, [])

  const loadPartnerships = async () => {
    try {
      setLoading(true)
      setError('')

      // Fetch all public partnership profiles with their commitments
      const { data: profiles, error: profileError } = await supabase
        .from('commitment_profiles')
        .select(`
          id,
          public_name,
          business_name,
          business_type,
          city,
          province,
          metadata,
          created_at,
          commitments(
            id,
            item_type,
            item_description,
            quantity,
            quantity_unit,
            unit_price,
            currency,
            notes,
            metadata
          )
        `)
        .eq('display_publicly', true)
        .order('created_at', { ascending: false })

      if (profileError) throw profileError

      // Transform data to include commitment info
      const enrichedPartnerships = profiles.map(profile => ({
        ...profile,
        commitmentCount: profile.commitments?.length || 0,
        primaryCommitment: profile.commitments?.[0] || null,
        contributions: profile.metadata?.contributions || []
      }))

      setPartnerships(enrichedPartnerships)
    } catch (err) {
      console.error('Error loading partnerships:', err)
      setError('Failed to load partnership directory')
    } finally {
      setLoading(false)
    }
  }

  const getTypeEmoji = (businessType) => {
    const emojiMap = {
      farmer: '🚜',
      processor: '⚙️',
      trader: '🏪',
      retailer: '🏬',
      exporter: '✈️',
      logistics: '🚚',
      corporation: '🏢',
      investor: '💰',
      equipment: '🔧',
      warehouse: '🏭',
      service: '💼'
    }
    return emojiMap[businessType] || '🤝'
  }

  const getContributionEmoji = (contribution) => {
    const emojiMap = {
      coconuts: '🥥',
      equipment: '⚙️',
      processing: '🏭',
      transportation: '🚚',
      distribution: '🏪',
      warehouse: '📍',
      consulting: '💼',
      financial: '💰'
    }
    return emojiMap[contribution] || '✓'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Partnership Form Section */}
        <div className="max-w-2xl mx-auto">
          <PartnershipForm
            userId={userId}
            userEmail={userEmail}
            isAuthenticated={isAuthenticated}
            onSubmitSuccess={loadPartnerships}
          />
        </div>

        {/* Divider */}
        <div className="h-1 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent rounded-full" />

        {/* Partnership Directory Section */}
        <div>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-2 mb-2">
              🌐 Partnership Community
            </h2>
            <p className="text-slate-400">Connect with {partnerships.length} active partners building the coconut supply chain</p>
          </div>

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-100 text-sm text-center">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2 text-slate-400">
                <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-amber-600 animate-spin" />
                <span>Loading partnerships...</span>
              </div>
            </div>
          ) : partnerships.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-800/30 border border-slate-700 rounded-lg">
              <p className="text-slate-400 text-sm">Be the first to join our partnership community! Fill out the form above to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partnerships.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-slate-800 border border-slate-700 hover:border-amber-600/50 rounded-lg p-4 transition-all hover:shadow-lg hover:shadow-amber-600/20"
                >
                  {/* Header with Type and Name */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg break-words">
                          {getTypeEmoji(partner.business_type)} {partner.public_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{partner.business_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {(partner.city || partner.province) && (
                    <p className="text-sm text-slate-300 mb-3">
                      📍 {[partner.city, partner.province].filter(Boolean).join(', ')}
                    </p>
                  )}

                  {/* Contributions */}
                  {partner.contributions.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 mb-2">Contributes:</p>
                      <div className="flex flex-wrap gap-2">
                        {partner.contributions.slice(0, 3).map((contribution) => (
                          <span
                            key={contribution}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600/20 border border-amber-600/50 rounded text-xs text-amber-200"
                          >
                            {getContributionEmoji(contribution)}
                            <span className="capitalize">{contribution.replace('_', ' ')}</span>
                          </span>
                        ))}
                        {partner.contributions.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400">
                            +{partner.contributions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Primary Commitment Info */}
                  {partner.primaryCommitment && (
                    <div className="bg-slate-900/50 border border-slate-700 rounded p-3 text-xs space-y-1">
                      <p className="text-slate-300">
                        <span className="text-slate-400">Capacity:</span> {partner.primaryCommitment.quantity} {partner.primaryCommitment.quantity_unit}
                      </p>
                      {partner.primaryCommitment.unit_price && (
                        <p className="text-slate-300">
                          <span className="text-slate-400">Price:</span> {partner.primaryCommitment.currency.toUpperCase()} {partner.primaryCommitment.unit_price}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Join Button */}
                  <button
                    className="w-full mt-4 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded transition-colors"
                    onClick={() => {
                      // This could open a connection/messaging dialog in the future
                      alert(`Connect with ${partner.public_name} - messaging feature coming soon!`)
                    }}
                  >
                    💬 Connect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-amber-600 mb-2">{partnerships.length}</div>
            <div className="text-slate-400 text-sm">Active Partners</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-amber-600 mb-2">
              {partnerships.reduce((sum, p) => sum + p.commitmentCount, 0)}
            </div>
            <div className="text-slate-400 text-sm">Total Commitments</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-amber-600 mb-2">
              {new Set(partnerships.map(p => p.business_type)).size}
            </div>
            <div className="text-slate-400 text-sm">Partnership Types</div>
          </div>
        </div>
      </div>
    </div>
  )
}
