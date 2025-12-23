import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDevice } from '../context/DeviceContext'
import CommitmentForm from './CommitmentForm'

const BUSINESS_TYPES = [
  'farmer',
  'vendor',
  'wholesaler',
  'retailer',
  'processor',
  'exporter',
  'service_provider',
  'equipment_supplier',
  'logistics',
  'other'
]

const BUSINESS_TYPE_EMOJIS = {
  'farmer': '🌾',
  'vendor': '🛒',
  'wholesaler': '📦',
  'retailer': '🏪',
  'processor': '⚗️',
  'exporter': '✈️',
  'service_provider': '🤝',
  'equipment_supplier': '🔧',
  'logistics': '🚚',
  'other': '💼'
}

// Achievement badges based on contribution
const ACHIEVEMENT_LEVELS = [
  { level: 'bronze', minValue: 0, label: '🥉 Bronze', color: 'bg-amber-900', textColor: 'text-amber-300' },
  { level: 'silver', minValue: 50000, label: '🥈 Silver', color: 'bg-slate-600', textColor: 'text-slate-200' },
  { level: 'gold', minValue: 250000, label: '🥇 Gold', color: 'bg-yellow-700', textColor: 'text-yellow-200' },
  { level: 'platinum', minValue: 1000000, label: '💎 Platinum', color: 'bg-cyan-700', textColor: 'text-cyan-200' },
  { level: 'diamond', minValue: 5000000, label: '✨ Diamond Elite', color: 'bg-purple-700', textColor: 'text-purple-200' }
]

const getAchievementLevel = (totalValue) => {
  for (let i = ACHIEVEMENT_LEVELS.length - 1; i >= 0; i--) {
    if (totalValue >= ACHIEVEMENT_LEVELS[i].minValue) {
      return ACHIEVEMENT_LEVELS[i]
    }
  }
  return ACHIEVEMENT_LEVELS[0]
}

export default function PartnershipNetworkSection({ isAuthenticated, userId }) {
  const { isMobile } = useDevice()
  const [partnerships, setPartnerships] = useState([])
  const [filteredPartnerships, setFilteredPartnerships] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBusinessType, setSelectedBusinessType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCommitmentValue, setTotalCommitmentValue] = useState(0)
  const [partnerCount, setPartnerCount] = useState(0)

  // User's own commitments
  const [userProfile, setUserProfile] = useState(null)
  const [userCommitments, setUserCommitments] = useState([])
  const [userTotalValue, setUserTotalValue] = useState(0)
  const [showCommitmentForm, setShowCommitmentForm] = useState(false)

  useEffect(() => {
    loadPartnerships()
    if (isAuthenticated && userId) {
      loadUserProfile()
    }
  }, [isAuthenticated, userId])

  useEffect(() => {
    filterPartnerships()
  }, [partnerships, selectedBusinessType, searchQuery])

  const loadPartnerships = async () => {
    try {
      setLoading(true)
      // Load commitment profiles - basic columns only
      const { data: profilesData, error: profilesError } = await supabase
        .from('commitment_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) {
        console.error('Error loading partnerships:', profilesError?.message || JSON.stringify(profilesError))
        setPartnerships([])
        return
      }

      if (!profilesData || profilesData.length === 0) {
        setPartnerships([])
        setPartnerCount(0)
        setTotalCommitmentValue(0)
        return
      }

      // Filter to only public profiles (default to showing all if column doesn't exist)
      const publicProfiles = profilesData.filter(p =>
        p.display_publicly !== false // Show if not explicitly false
      )

      // Load commitments for each profile
      const profilesWithCommitments = await Promise.all(
        publicProfiles.map(async (profile) => {
          const { data: commitments = [] } = await supabase
            .from('commitments')
            .select('id, status, quantity, unit_price, currency, grand_total')
            .eq('commitment_profile_id', profile.id)

          return {
            ...profile,
            commitments: commitments || []
          }
        })
      )

      setPartnerships(profilesWithCommitments)
      setPartnerCount(profilesWithCommitments.length)

      // Calculate total commitment value
      const total = profilesWithCommitments.reduce((sum, profile) => {
        const profileTotal = profile.commitments?.reduce((pSum, commitment) => {
          return pSum + (commitment.grand_total || 0)
        }, 0) || 0
        return sum + profileTotal
      }, 0)
      setTotalCommitmentValue(total)
    } catch (error) {
      console.error('Unexpected error loading partnerships:', error?.message || String(error))
    } finally {
      setLoading(false)
    }
  }

  const filterPartnerships = () => {
    let filtered = partnerships

    if (selectedBusinessType) {
      filtered = filtered.filter(p => p.business_type === selectedBusinessType)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.business_name?.toLowerCase().includes(query) ||
        p.public_name?.toLowerCase().includes(query) ||
        p.contact_person?.toLowerCase().includes(query) ||
        p.bio?.toLowerCase().includes(query)
      )
    }

    setFilteredPartnerships(filtered)
  }

  const loadUserProfile = async () => {
    if (!userId) return

    try {
      const { data: profileData } = await supabase
        .from('commitment_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (profileData) {
        setUserProfile(profileData)
        loadUserCommitments(profileData.id)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const loadUserCommitments = async (profileId) => {
    try {
      const { data: commitments = [] } = await supabase
        .from('commitments')
        .select('*')
        .eq('commitment_profile_id', profileId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      setUserCommitments(commitments)

      const total = commitments.reduce((sum, c) => sum + (c.grand_total || 0), 0)
      setUserTotalValue(total)
    } catch (error) {
      console.error('Error loading user commitments:', error)
    }
  }

  const handleDeleteCommitment = async (commitmentId) => {
    if (!window.confirm('Are you sure you want to remove this contribution?')) return

    try {
      const { error } = await supabase
        .from('commitments')
        .delete()
        .eq('id', commitmentId)

      if (!error) {
        setUserCommitments(userCommitments.filter(c => c.id !== commitmentId))
        const total = userCommitments
          .filter(c => c.id !== commitmentId)
          .reduce((sum, c) => sum + (c.grand_total || 0), 0)
        setUserTotalValue(total)
      }
    } catch (error) {
      console.error('Error deleting commitment:', error)
    }
  }

  const handleCommitmentSaved = async () => {
    if (userProfile) {
      await loadUserCommitments(userProfile.id)
    }
  }

  return (
    <div className={`rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 flex flex-col overflow-hidden ${isMobile ? 'w-full' : 'w-full'}`}>
      {/* Hero Header Section */}
      <div className={`relative bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 border-b border-blue-500 overflow-hidden ${isMobile ? 'px-3 py-4' : 'px-6 py-6'}`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-cyan-400 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-4 -left-4 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'} mb-4`}>
            <div className="flex items-center gap-3">
              <span className={`${isMobile ? 'text-2xl' : 'text-3xl'}`}>🥥</span>
              <div>
                <h2 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                  Partnership Network
                </h2>
                <p className="text-blue-100 text-xs">Coconuts.com.ph - Building Together</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className={`flex gap-3 ${isMobile ? 'w-full justify-between' : 'items-center'}`}>
              <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg border border-white/20">
                <p className="text-blue-100 text-xs">Active Partners</p>
                <p className="text-white font-bold text-lg">{partnerCount}</p>
              </div>
              <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg border border-white/20">
                <p className="text-blue-100 text-xs">Total Committed</p>
                <p className="text-white font-bold text-lg">₱{(totalCommitmentValue / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-blue-50 text-sm font-light">Transparent supply chain coordination & collaborative commerce with currency.ph integration</p>
        </div>
      </div>

      {/* User Contribution Section */}
      {isAuthenticated && userProfile && (
        <div className={`bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border-b border-emerald-700/50 ${isMobile ? 'px-3 py-3' : 'px-6 py-4'}`}>
          <div className={`flex items-center ${isMobile ? 'flex-col gap-3' : 'justify-between gap-4'}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-full flex items-center justify-center font-bold text-white ${getAchievementLevel(userTotalValue).color} ${isMobile ? 'w-12 h-12 text-lg' : 'w-14 h-14 text-xl'}`}>
                {getAchievementLevel(userTotalValue).level === 'bronze' ? '🥉' :
                 getAchievementLevel(userTotalValue).level === 'silver' ? '🥈' :
                 getAchievementLevel(userTotalValue).level === 'gold' ? '🥇' :
                 getAchievementLevel(userTotalValue).level === 'platinum' ? '💎' : '✨'}
              </div>
              <div className="flex-1">
                <p className="text-slate-300 text-xs">Your Contribution Level</p>
                <p className={`font-bold text-white ${isMobile ? 'text-base' : 'text-lg'}`}>
                  {getAchievementLevel(userTotalValue).label}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  ₱{userTotalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} committed
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
              <button
                onClick={() => setShowCommitmentForm(true)}
                className={`flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2 ${isMobile ? 'text-sm' : 'text-base'}`}
              >
                <span>➕</span>
                <span>{isMobile ? 'Add' : 'Add Contribution'}</span>
              </button>
            </div>
          </div>

          {/* Commitment History */}
          {userCommitments.length > 0 && (
            <div className={`mt-4 pt-4 border-t border-emerald-700/30 ${isMobile ? 'space-y-2' : 'space-y-2'}`}>
              <p className="text-slate-400 text-xs font-semibold">Your Active Contributions</p>
              <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
                {userCommitments.slice(0, 3).map(commitment => (
                  <div key={commitment.id} className="bg-slate-800/50 rounded px-3 py-2 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-xs font-medium truncate">{commitment.item_type}</p>
                      <p className="text-slate-500 text-xs">₱{(commitment.grand_total || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCommitment(commitment.id)}
                      className="text-red-400 hover:text-red-300 ml-2 flex-shrink-0"
                      title="Remove contribution"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {userCommitments.length > 3 && (
                <p className="text-slate-500 text-xs">+{userCommitments.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search and Filter */}
      <div className={`bg-slate-700/50 border-b border-slate-600 ${isMobile ? 'px-3 py-3' : 'px-6 py-4'}`}>
        <div className={`flex flex-col gap-3`}>
          <input
            type="text"
            placeholder="Search partners by name, location, or business type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm'}`}
          />

          <div className={`flex ${isMobile ? 'flex-wrap gap-2' : 'items-center gap-2 overflow-x-auto pb-1'}`}>
            <button
              onClick={() => setSelectedBusinessType('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedBusinessType === ''
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
              }`}
            >
              All Types
            </button>
            {BUSINESS_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setSelectedBusinessType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedBusinessType === type
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                }`}
                title={type}
              >
                {BUSINESS_TYPE_EMOJIS[type]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto px-3 py-4 md:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="animate-spin text-3xl">🔄</div>
            <div className="text-slate-400 text-sm">Loading partnerships...</div>
          </div>
        ) : filteredPartnerships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-slate-400 text-sm">
              {partnerships.length === 0 ? 'Be the first to join the partnership network!' : 'No partners match your search'}
            </div>
            {partnerships.length === 0 && (
              <button
                onClick={() => setShowCommitmentForm(true)}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all"
              >
                Become a Founding Partner
              </button>
            )}
          </div>
        ) : (
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {filteredPartnerships.map((partner, idx) => {
              const commitmentCount = partner.commitments?.length || 0
              const partnerValue = partner.commitments?.reduce((sum, c) => sum + (c.grand_total || 0), 0) || 0
              const partnerAchievement = getAchievementLevel(partnerValue)
              const isTopContributor = idx < 3

              return (
                <div
                  key={partner.id}
                  className="group relative bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-4 border border-slate-600 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-600/20 transition-all duration-300 transform hover:scale-105 cursor-pointer"
                >
                  {/* Top Contributor Badge */}
                  {isTopContributor && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      #{idx + 1}
                    </div>
                  )}

                  {/* Partner Header */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base truncate group-hover:text-blue-200 transition-colors">
                          {partner.public_name || partner.business_name}
                        </h3>
                        {partner.business_type && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg">{BUSINESS_TYPE_EMOJIS[partner.business_type]}</span>
                            <p className="text-xs text-slate-400 capitalize">{partner.business_type.replace(/_/g, ' ')}</p>
                          </div>
                        )}
                      </div>
                      {/* Achievement Badge */}
                      <div className={`rounded-lg px-2 py-1 font-semibold text-xs flex items-center gap-1 ${partnerAchievement.color} ${partnerAchievement.textColor}`}>
                        <span>{partnerAchievement.level === 'diamond' ? '✨' : partnerAchievement.level === 'platinum' ? '💎' : '🏅'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Person */}
                  {partner.contact_person && (
                    <p className="text-slate-300 text-xs font-medium mb-2">👤 {partner.contact_person}</p>
                  )}

                  {/* Location */}
                  {(partner.city || partner.province) && (
                    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                      <span>📍</span>
                      <span className="truncate">{partner.city}{partner.province ? `, ${partner.province}` : ''}</span>
                    </p>
                  )}

                  {/* Bio/Description */}
                  {partner.bio && (
                    <p className="text-xs text-slate-300 mb-3 line-clamp-2 italic">{partner.bio}</p>
                  )}

                  {/* Commitment Stats Cards */}
                  <div className="grid grid-cols-2 gap-2 mb-3 py-3 border-t border-slate-600">
                    <div className="bg-slate-800/80 rounded-lg px-2 py-2">
                      <p className="text-slate-400 text-xs font-medium">Commitments</p>
                      <p className="text-white font-bold text-lg">{commitmentCount}</p>
                    </div>
                    <div className="bg-slate-800/80 rounded-lg px-2 py-2">
                      <p className="text-slate-400 text-xs font-medium">Value</p>
                      <p className="text-emerald-300 font-bold text-lg">₱{(partnerValue / 1000).toFixed(0)}K</p>
                    </div>
                  </div>

                  {/* Contact */}
                  {partner.email && (
                    <p className="text-xs text-slate-500 mb-3 truncate flex items-center gap-1 opacity-75 hover:opacity-100 transition-opacity">
                      <span>✉️</span>
                      <span className="truncate">{partner.email}</span>
                    </p>
                  )}

                  {/* Action Button */}
                  {isAuthenticated && userId !== partner.user_id && (
                    <button
                      className="w-full px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-semibold rounded-lg transition-all transform hover:translate-y-[-2px] shadow-lg shadow-blue-600/30"
                      title="View partnership details"
                    >
                      Connect & Collaborate
                    </button>
                  )}
                  {isAuthenticated && userId === partner.user_id && (
                    <div className="w-full px-3 py-2 bg-emerald-900/30 text-emerald-200 text-xs font-semibold rounded-lg border border-emerald-700/50 text-center">
                      Your Profile ✓
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA Footer */}
      {isAuthenticated && !userProfile && (
        <div className="bg-gradient-to-r from-blue-700/30 to-purple-700/30 border-t border-blue-600/50 px-6 py-4 text-center">
          <p className="text-slate-300 text-sm mb-2">Ready to grow with us?</p>
          <button
            onClick={() => setShowCommitmentForm(true)}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-emerald-600/40"
          >
            Create Your Profile & Contribute
          </button>
        </div>
      )}

      {/* Commitment Form Modal */}
      <CommitmentForm
        isOpen={showCommitmentForm}
        onClose={() => setShowCommitmentForm(false)}
        onCommitmentSaved={handleCommitmentSaved}
        userId={userId}
        profileId={userProfile?.id}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}
