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
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-400 text-sm">Loading partnerships...</div>
          </div>
        ) : filteredPartnerships.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-400 text-sm text-center">
              {partnerships.length === 0 ? 'No partners yet' : 'No partners match your filters'}
            </div>
          </div>
        ) : (
          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {filteredPartnerships.map(partner => {
              const commitmentCount = partner.commitments?.length || 0
              const partnerValue = partner.commitments?.reduce((sum, c) => sum + (c.grand_total || 0), 0) || 0

              return (
                <div
                  key={partner.id}
                  className="bg-slate-750 rounded-lg p-3 border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer"
                >
                  {/* Partner Header */}
                  <div className="mb-2">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">
                          {partner.public_name || partner.business_name}
                        </h3>
                        {partner.business_type && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>{BUSINESS_TYPE_EMOJIS[partner.business_type]}</span>
                            <span>{partner.business_type}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {(partner.city || partner.province) && (
                    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                      <span>📍</span>
                      <span>{partner.city}{partner.province ? `, ${partner.province}` : ''}</span>
                    </p>
                  )}

                  {/* Bio/Description */}
                  {partner.bio && (
                    <p className="text-xs text-slate-300 mb-2 line-clamp-2">{partner.bio}</p>
                  )}

                  {/* Contact */}
                  {partner.email && (
                    <p className="text-xs text-slate-400 mb-2 truncate flex items-center gap-1">
                      <span>✉️</span>
                      <span>{partner.email}</span>
                    </p>
                  )}

                  {/* Stats */}
                  <div className="bg-slate-700 rounded px-2 py-1.5 mt-3 pt-2 border-t border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <p className="text-slate-400">Commitments</p>
                        <p className="text-white font-semibold">{commitmentCount}</p>
                      </div>
                      <div className="text-xs text-right">
                        <p className="text-slate-400">Value</p>
                        <p className="text-white font-semibold">₱{partnerValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  {isAuthenticated && userId !== partner.user_id && (
                    <button
                      className="w-full mt-2 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                      title="View partnership details"
                    >
                      View Details
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
