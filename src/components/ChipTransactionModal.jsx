import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertUSDToLocalCurrency, formatPriceWithCurrency } from '../lib/currencyManager'

export default function ChipTransactionModal({ open, onClose, userId, onPurchaseComplete }) {
  const [packages, setPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(null)

  const DEFAULT_CURRENCY = 'PHP'
  const isGuestLocal = userId && userId.includes('guest-local')

  useEffect(() => {
    if (open && userId) {
      loadData()
    }
  }, [open, userId])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      // Load packages
      const { data: pkgData, error: pkgErr } = await supabase
        .from('poker_chip_packages')
        .select('*')
        .order('display_order', { ascending: true })

      if (pkgErr) throw pkgErr
      setPackages(pkgData || [])
      if (pkgData && pkgData.length > 0) {
        setSelectedPackage(pkgData[0])
      }

      // Load chips
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

        // Load wallets
        const { data: walletData, error: walletErr } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (!walletErr && walletData && walletData.length > 0) {
          setWallets(walletData)
          setSelectedWallet(walletData[0])
        }
      }
    } catch (err) {
      console.error('Error loading transaction data:', err)
      setError('Failed to load transaction data')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmPurchase() {
    if (!selectedPackage || !userId) {
      setError('Please select a package')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const chipAmount = BigInt(selectedPackage.chips_amount || 0)
      const bonusChips = BigInt(selectedPackage.bonus_chips || 0)
      const totalChipsToAdd = chipAmount + bonusChips
      const newChipBalance = userChips + totalChipsToAdd

      if (isGuestLocal) {
        localStorage.setItem(`poker_chips_${userId}`, newChipBalance.toString())
        setUserChips(newChipBalance)
      } else {
        const { error: chipUpsertErr } = await supabase
          .from('player_poker_chips')
          .upsert({
            user_id: userId,
            total_chips: newChipBalance.toString(),
            updated_at: new Date()
          }, { onConflict: 'user_id' })

        if (chipUpsertErr) throw chipUpsertErr

        const { error: purchaseErr } = await supabase
          .from('chip_purchases')
          .insert([{
            user_id: userId,
            package_id: selectedPackage.id,
            chips_purchased: Number(chipAmount),
            bonus_chips_awarded: Number(bonusChips),
            total_chips_received: Number(totalChipsToAdd),
            usd_price_paid: selectedPackage.usd_price,
            payment_status: 'completed',
            payment_method: 'free',
            created_at: new Date()
          }])

        if (purchaseErr) throw purchaseErr
        await loadData()
      }

      if (onPurchaseComplete) {
        onPurchaseComplete({
          chipsPurchased: Number(chipAmount),
          bonusChips: Number(bonusChips),
          totalChips: totalChipsToAdd.toString(),
          newBalance: newChipBalance.toString()
        })
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

  const formatChips = (chips) => {
    if (chips === undefined || chips === null) return '0'
    if (typeof chips === 'bigint') chips = Number(chips)
    return chips.toLocaleString()
  }

  const selectedChipAmount = selectedPackage ? Number(selectedPackage.chips_amount || 0) : 0
  const selectedBonusChips = selectedPackage ? Number(selectedPackage.bonus_chips || 0) : 0
  const selectedTotalChips = selectedChipAmount + selectedBonusChips

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-cyan-600 p-8 text-white sticky top-0 z-10">
          <h2 className="text-3xl font-bold">Purchase Poker Chips</h2>
          <p className="text-sm text-cyan-100 mt-2">Select a package and confirm your purchase</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="w-12 h-12 border-4 border-cyan-400 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left: Packages List */}
              <div className="lg:col-span-2">
                <h3 className="text-xl font-semibold text-white mb-4">Select Package</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {packages.map((pkg) => {
                    const chipAmount = Number(pkg.chips_amount || 0)
                    const bonusChips = Number(pkg.bonus_chips || 0)
                    const total = chipAmount + bonusChips
                    const isSelected = selectedPackage?.id === pkg.id

                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackage(pkg)}
                        className={`w-full p-4 rounded-lg border-2 transition text-left ${
                          isSelected
                            ? 'border-cyan-400 bg-slate-700'
                            : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-white">{total.toLocaleString()} Chips</div>
                            <div className="text-xs text-slate-400 mt-1">
                              {chipAmount.toLocaleString()} base + {bonusChips.toLocaleString()} bonus
                            </div>
                            {(pkg.is_first_purchase_special || pkg.is_most_popular || pkg.is_flash_sale) && (
                              <div className="text-xs text-amber-400 font-semibold mt-2">
                                {pkg.is_first_purchase_special && '⭐ First Purchase Special'}
                                {pkg.is_most_popular && '⭐ Most Popular'}
                                {pkg.is_flash_sale && '🔥 Flash Sale'}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center">
                                <svg className="w-4 h-4 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right: Summary */}
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>

                  {/* Current Balance */}
                  <div className="mb-6 pb-6 border-b border-slate-700">
                    <div className="text-xs text-slate-400 mb-2">Current Chips</div>
                    <div className="text-2xl font-bold text-white">{formatChips(userChips)}</div>
                  </div>

                  {/* Selected Package Details */}
                  {selectedPackage && (
                    <>
                      <div className="mb-4 pb-4 border-b border-slate-700">
                        <div className="text-xs text-slate-400 mb-2">Base Chips</div>
                        <div className="text-lg font-semibold text-white">{selectedChipAmount.toLocaleString()}</div>
                      </div>

                      {selectedBonusChips > 0 && (
                        <div className="mb-4 pb-4 border-b border-slate-700">
                          <div className="text-xs text-slate-400 mb-2">Bonus Chips</div>
                          <div className="text-lg font-semibold text-amber-400">+{selectedBonusChips.toLocaleString()}</div>
                        </div>
                      )}

                      <div className="mb-6 pb-6 border-b border-slate-700">
                        <div className="text-xs text-slate-400 mb-2">Total to Receive</div>
                        <div className="text-2xl font-bold text-emerald-400">{selectedTotalChips.toLocaleString()}</div>
                      </div>

                      {/* New Balance */}
                      <div className="mb-6 pb-6 border-b border-slate-700">
                        <div className="text-xs text-slate-400 mb-2">New Balance</div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {formatChips(userChips + BigInt(selectedTotalChips))}
                        </div>
                      </div>

                      {/* Wallet Info */}
                      {!isGuestLocal && wallets.length > 0 && selectedWallet && (
                        <div className="bg-slate-700 rounded-lg p-4 mb-6">
                          <div className="text-xs text-slate-400 mb-2">Wallet Balance</div>
                          <div className="text-lg font-semibold text-white">
                            {formatPriceWithCurrency(Number(selectedWallet.balance), selectedWallet.currency_code)}
                          </div>
                          <div className="text-xs text-slate-400 mt-2">{selectedWallet.currency_code}</div>
                        </div>
                      )}

                      {/* Confirm Button */}
                      <button
                        onClick={handleConfirmPurchase}
                        disabled={processing}
                        className="w-full py-3 font-bold rounded-lg transition transform active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            PROCESSING
                          </span>
                        ) : (
                          'Confirm Purchase'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 bg-slate-900/50 p-6 sticky bottom-0">
          <button
            onClick={onClose}
            disabled={processing}
            className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
