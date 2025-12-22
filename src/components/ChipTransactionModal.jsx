import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function ChipTransactionModal({ open, onClose, userId, onTransactionComplete }) {
  const { isMobile } = useDevice()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const isGuestLocal = userId && userId.includes('guest-local')

  useEffect(() => {
    if (open && userId) {
      loadPackages()
      loadUserData()
    }
  }, [open, userId])

  async function loadPackages() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('poker_chip_packages')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setPackages(data || [])
    } catch (err) {
      console.error('Error loading packages:', err)
      setError('Failed to load chip packages')
    } finally {
      setLoading(false)
    }
  }

  async function loadUserData() {
    try {
      if (isGuestLocal) {
        const storedChips = localStorage.getItem(`poker_chips_${userId}`)
        setUserChips(BigInt(storedChips || 0))
      } else {
        const { data: chipData, error: chipErr } = await supabase
          .from('player_poker_chips')
          .select('total_chips')
          .eq('user_id', userId)
          .single()

        if (!chipErr && chipData) {
          setUserChips(BigInt(chipData.total_chips || 0))
        } else {
          setUserChips(0n)
        }
      }
    } catch (err) {
      console.error('Error loading user chips:', err)
      setUserChips(0n)
    }
  }

  const formatChips = (chips) => {
    if (chips === undefined || chips === null) {
      return '0'
    }
    if (typeof chips === 'bigint') {
      chips = Number(chips)
    }
    return chips.toLocaleString()
  }

  const footer = (
    <button
      onClick={onClose}
      className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition"
    >
      Close
    </button>
  )

  return (
    <ExpandableModal
      isOpen={open}
      onClose={onClose}
      title="Chip Transactions"
      icon="💸"
      size={isMobile ? 'fullscreen' : 'lg'}
      footer={footer}
      badgeContent={`${formatChips(userChips)} balance`}
      showBadge={true}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-white rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-600">Loading transactions...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current Balance */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">Current Chip Balance</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{formatChips(userChips)}</p>
          </div>

          {/* Transaction History */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Transactions</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No transactions yet</p>
              </div>
            </div>
          </div>

          {/* Available Packages */}
          {packages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Available Packages</h3>
              <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                {packages.slice(0, 6).map((pkg) => {
                  if (!pkg || !pkg.id) return null
                  const chipAmount = Number(pkg.chips_amount || 0)
                  const bonusAmount = Number(pkg.bonus_chips || 0)
                  const totalChips = chipAmount + bonusAmount
                  return (
                    <div key={pkg.id} className="border border-slate-200 rounded p-2 text-center text-xs">
                      <div className="font-semibold text-slate-900">
                        {totalChips.toLocaleString()}
                      </div>
                      <div className="text-slate-600">chips</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-600">
              💡 Chips are used to play poker games. Purchase chips to get started or earn them by winning hands.
            </p>
          </div>
        </div>
      )}
    </ExpandableModal>
  )
}
