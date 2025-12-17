import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ChipPurchaseModal({ open, onClose, userId, onPurchaseComplete }) {
  const [packages, setPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0)

  const FUNCTIONS_BASE = (import.meta.env.VITE_PROJECT_URL || '').replace(/\/+$/, '') + '/functions/v1/poker-engine'

  useEffect(() => {
    if (open && userId) {
      loadPackages()
      loadUserChips()
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
      if (data && data.length > 0) {
        setSelectedPackage(data[0].id)
      }
    } catch (err) {
      console.error('Error loading packages:', err)
      setError('Failed to load chip packages')
    } finally {
      setLoading(false)
    }
  }

  async function loadUserChips() {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${FUNCTIONS_BASE}/get_player_chips`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ userId })
      })
      
      if (res.ok) {
        const data = await res.json()
        setUserChips(BigInt(data.chips))
      }
    } catch (err) {
      console.error('Error loading user chips:', err)
    }
  }

  async function handlePurchase() {
    if (!selectedPackage || !userId) {
      setError('Invalid selection')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${FUNCTIONS_BASE}/purchase_chips`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          userId,
          packageId: selectedPackage
        })
      })

      if (!res.ok) {
        let errorMsg = 'Purchase failed'
        try {
          const json = await res.json()
          errorMsg = json.error || errorMsg
        } catch (e) {
          // Could not parse JSON error response
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()
      await loadUserChips()
      
      if (onPurchaseComplete) {
        onPurchaseComplete(data)
      }

      onClose()
    } catch (err) {
      console.error('Purchase error:', err)
      setError(err.message || 'An error occurred during purchase')
    } finally {
      setProcessing(false)
    }
  }

  if (!open) return null

  const selectedPkg = packages.find(p => p.id === selectedPackage)

  const formatChips = (chips) => {
    if (typeof chips === 'bigint') {
      chips = Number(chips)
    }
    return chips.toLocaleString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl max-w-2xl w-full border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-yellow-600 p-6 text-white">
          <h2 className="text-2xl font-bold">Buy Poker Chips 💰</h2>
          <p className="text-sm text-amber-100 mt-1">Current Balance: <span className="font-bold">{formatChips(userChips)}</span> chips</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-amber-300 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chip Packages Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={`relative p-4 rounded-lg transition transform ${
                      selectedPackage === pkg.id
                        ? 'bg-gradient-to-b from-amber-500 to-yellow-600 border-2 border-amber-300 shadow-xl scale-105'
                        : 'bg-slate-700 border-2 border-slate-600 hover:border-amber-500'
                    }`}
                  >
                    {pkg.is_first_purchase_special && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
                        SPECIAL
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-sm font-bold text-white mb-2">
                        {(Number(pkg.chip_amount) / 1000000).toFixed(1)}M
                      </div>
                      <div className="text-lg font-bold text-white">
                        ${pkg.usd_price}
                      </div>
                      {pkg.bonus_chips > 0 && (
                        <div className="text-xs text-amber-200 mt-1">
                          +{(Number(pkg.bonus_chips) / 1000000).toFixed(1)}M bonus
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Package Details */}
              {selectedPkg && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-amber-600/30">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Base Chips:</span>
                      <span className="text-white font-bold">{formatChips(selectedPkg.chip_amount)} chips</span>
                    </div>
                    {selectedPkg.bonus_chips > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Bonus Chips:</span>
                        <span className="text-amber-400 font-bold">+{formatChips(selectedPkg.bonus_chips)} chips</span>
                      </div>
                    )}
                    <div className="border-t border-slate-600 pt-2 mt-2 flex items-center justify-between">
                      <span className="text-slate-300 font-semibold">Total Chips:</span>
                      <span className="text-amber-300 font-bold text-lg">{formatChips(BigInt(selectedPkg.chip_amount) + BigInt(selectedPkg.bonus_chips || 0))} chips</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Price:</span>
                      <span className="text-white font-bold">${selectedPkg.usd_price}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-600">
            <button
              onClick={onClose}
              disabled={processing}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={processing || !selectedPackage}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-amber-200 rounded-full animate-spin"></span>
                  Processing...
                </>
              ) : (
                <>
                  🛒 Buy Chips
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
