import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertUSDToLocalCurrency, formatPriceWithCurrency, getCurrencySymbol } from '../lib/currencyManager'

export default function ChipPurchaseModal({ open, onClose, userId, onPurchaseComplete }) {
  const [packages, setPackages] = useState([])
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const [userWallet, setUserWallet] = useState(null)
  const DEFAULT_CURRENCY = 'PHP'

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

  async function loadUserData() {
    try {
      // Get user's primary wallet
      const { data: wallets, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)

      if (walletErr) throw walletErr
      if (wallets && wallets.length > 0) {
        setUserWallet(wallets[0])
      }

      // Get user's chip balance
      const { data: chipData, error: chipErr } = await supabase
        .from('player_poker_chips')
        .select('total_chips')
        .eq('user_id', userId)
        .single()

      if (!chipErr && chipData) {
        setUserChips(BigInt(chipData.total_chips || 0))
      }
    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }

  async function handlePurchase() {
    if (!selectedPackage || !userId) {
      setError('Missing purchase information')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Get package details
      const pkg = packages.find(p => p.id === selectedPackage)
      if (!pkg) throw new Error('Package not found')

      // Only check wallet balance if wallet exists
      if (userWallet) {
        const localPrice = convertUSDToLocalCurrency(Number(pkg.usd_price), userWallet.currency_code)
        const walletBalance = Number(userWallet.balance)

        // Check if user has sufficient balance
        if (walletBalance < localPrice) {
          setError(`Insufficient balance. You have ${formatPriceWithCurrency(walletBalance, userWallet.currency_code)} but need ${formatPriceWithCurrency(localPrice, userWallet.currency_code)}`)
          setProcessing(false)
          return
        }

        // Deduct from wallet if it exists
        const newWalletBalance = walletBalance - localPrice
        const { error: walletUpdateErr } = await supabase
          .from('wallets')
          .update({ balance: newWalletBalance, updated_at: new Date() })
          .eq('id', userWallet.id)

        if (walletUpdateErr) throw walletUpdateErr
      }

      // Add chips to player inventory
      const totalChipsToAdd = BigInt(pkg.chip_amount) + BigInt(pkg.bonus_chips || 0)
      const newChipBalance = userChips + totalChipsToAdd

      // Upsert player chips record
      const { error: chipUpsertErr } = await supabase
        .from('player_poker_chips')
        .upsert({
          user_id: userId,
          total_chips: newChipBalance.toString(),
          updated_at: new Date()
        }, { onConflict: 'user_id' })

      if (chipUpsertErr) throw chipUpsertErr

      // Record purchase transaction
      const paymentMethod = userWallet ? 'wallet_deduction' : 'free'
      const { data: purchase, error: purchaseErr } = await supabase
        .from('chip_purchases')
        .insert([{
          user_id: userId,
          package_id: selectedPackage,
          chips_purchased: pkg.chip_amount,
          bonus_chips_awarded: pkg.bonus_chips || 0,
          total_chips_received: pkg.chip_amount + (pkg.bonus_chips || 0),
          usd_price_paid: pkg.usd_price,
          payment_status: 'completed',
          payment_method: paymentMethod,
          created_at: new Date()
        }])
        .select()
        .single()

      if (purchaseErr) throw purchaseErr

      // Reload user data
      await loadUserData()
      
      if (onPurchaseComplete) {
        const costDeducted = userWallet 
          ? formatPriceWithCurrency(
              convertUSDToLocalCurrency(Number(pkg.usd_price), userWallet.currency_code),
              userWallet.currency_code
            )
          : 'Free (no wallet)'
        
        onPurchaseComplete({
          chipsPurchased: pkg.chip_amount,
          bonusChips: pkg.bonus_chips || 0,
          totalChips: totalChipsToAdd.toString(),
          newBalance: newChipBalance.toString(),
          costDeducted: costDeducted
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

  const selectedPkg = packages.find(p => p.id === selectedPackage)
  const currency = userWallet?.currency_code || DEFAULT_CURRENCY
  const localPrice = selectedPkg ? convertUSDToLocalCurrency(Number(selectedPkg.usd_price), currency) : 0
  const walletBalance = userWallet ? Number(userWallet.balance) : Infinity
  const canAfford = walletBalance >= localPrice

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
          <p className="text-sm text-amber-100 mt-1">
            {userWallet ? (
              <>
                Your Balance: <span className="font-bold">{formatPriceWithCurrency(walletBalance, currency)}</span> • 
              </>
            ) : (
              <>
                Wallet: <span className="font-bold text-amber-300">Not set up</span> • 
              </>
            )}
            Your Chips: <span className="font-bold">{formatChips(userChips)}</span>
          </p>
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
                {packages.map((pkg) => {
                  const localPkgPrice = convertUSDToLocalCurrency(Number(pkg.usd_price), currency)
                  const affordable = !userWallet || (walletBalance >= localPkgPrice)
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      disabled={!affordable}
                      className={`relative p-4 rounded-lg transition transform ${
                        selectedPackage === pkg.id
                          ? 'bg-gradient-to-b from-amber-500 to-yellow-600 border-2 border-amber-300 shadow-xl scale-105'
                          : affordable
                          ? 'bg-slate-700 border-2 border-slate-600 hover:border-amber-500'
                          : 'bg-slate-700/50 border-2 border-slate-600 opacity-50 cursor-not-allowed'
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
                          {formatPriceWithCurrency(localPkgPrice, currency)}
                        </div>
                        {pkg.bonus_chips > 0 && (
                          <div className="text-xs text-amber-200 mt-1">
                            +{(Number(pkg.bonus_chips) / 1000000).toFixed(1)}M bonus
                          </div>
                        )}
                        {!affordable && (
                          <div className="text-xs text-red-300 mt-1">
                            Not enough
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Selected Package Details */}
              {selectedPkg && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-amber-600/30">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Base Chips:</span>
                      <span className="text-white font-bold">{formatChips(selectedPkg.chip_amount)}</span>
                    </div>
                    {selectedPkg.bonus_chips > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Bonus Chips:</span>
                        <span className="text-amber-400 font-bold">+{formatChips(selectedPkg.bonus_chips)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-600 pt-2 mt-2 flex items-center justify-between">
                      <span className="text-slate-300 font-semibold">Total Chips:</span>
                      <span className="text-amber-300 font-bold text-lg">{formatChips(BigInt(selectedPkg.chip_amount) + BigInt(selectedPkg.bonus_chips || 0))}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-600">
                      <span className="text-slate-400 text-sm">Price ({currency}):</span>
                      <span className={userWallet && !canAfford ? 'font-bold text-red-400' : 'font-bold text-white'}>
                        {userWallet ? formatPriceWithCurrency(localPrice, currency) : 'Free (no wallet)'}
                      </span>
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
              disabled={processing || !selectedPackage || (userWallet && !canAfford)}
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
