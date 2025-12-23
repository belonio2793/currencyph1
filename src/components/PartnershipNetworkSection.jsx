import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDevice } from '../context/DeviceContext'

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

export default function PartnershipNetworkSection({ isAuthenticated, userId }) {
  const { isMobile } = useDevice()
  const [partnerships, setPartnerships] = useState([])
  const [filteredPartnerships, setFilteredPartnerships] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBusinessType, setSelectedBusinessType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [totalCommitmentValue, setTotalCommitmentValue] = useState(0)
  const [partnerCount, setPartnerCount] = useState(0)

  useEffect(() => {
    loadPartnerships()
  }, [])

  useEffect(() => {
    filterPartnerships()
  }, [partnerships, selectedBusinessType, searchQuery])

  const loadPartnerships = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('commitment_profiles')
        .select(`
          id,
          user_id,
          public_name,
          business_name,
          business_type,
          contact_person,
          email,
          city,
          province,
          bio,
          display_publicly,
          created_at,
          commitments (
            id,
            status,
            quantity,
            unit_price,
            currency,
            grand_total
          )
        `)
        .eq('display_publicly', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading partnerships:', error?.message || JSON.stringify(error))
        setPartnerships([])
        return
      }

      if (data) {
        setPartnerships(data)
        setPartnerCount(data.length)

        // Calculate total commitment value
        const total = data.reduce((sum, profile) => {
          const profileTotal = profile.commitments?.reduce((pSum, commitment) => {
            return pSum + (commitment.grand_total || 0)
          }, 0) || 0
          return sum + profileTotal
        }, 0)
        setTotalCommitmentValue(total)
      }
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

  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden ${isMobile ? 'w-full' : 'w-full'}`}>
      {/* Header Section */}
      <div className={`bg-slate-700 border-b border-slate-600 ${isMobile ? 'px-3 py-3' : 'px-6 py-4'}`}>
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} mb-4`}>
          <div className="flex items-center gap-2">
            <h2 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-xl'}`}>
              🤝 Partnership Network
            </h2>
          </div>
          <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'items-center gap-4'}`}>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="font-semibold">{partnerCount}</span>
              <span className="text-xs">Partners</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="font-semibold">₱{totalCommitmentValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span className="text-xs">Total Value</span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className={`flex flex-col gap-3 ${isMobile ? '' : ''}`}>
          <input
            type="text"
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 ${isMobile ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-sm'}`}
          />

          <div className={`flex ${isMobile ? 'flex-wrap gap-1' : 'items-center gap-1 overflow-x-auto pb-1'}`}>
            <button
              onClick={() => setSelectedBusinessType('')}
              className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                selectedBusinessType === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
              }`}
            >
              All
            </button>
            {BUSINESS_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setSelectedBusinessType(type)}
                className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedBusinessType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                }`}
                title={type}
              >
                {BUSINESS_TYPE_EMOJIS[type]} {type}
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
