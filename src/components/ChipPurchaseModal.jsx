import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertUSDToLocalCurrency, formatPriceWithCurrency, getCurrencySymbol } from '../lib/currencyManager'

export default function ChipPurchaseModal({ open, onClose, userId, onPurchaseComplete }) {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const [userWallet, setUserWallet] = useState(null)
  const DEFAULT_CURRENCY = 'PHP'
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
        if (storedChips) {
          setUserChips(BigInt(storedChips))
        } else {
          setUserChips(0n)
        }
        setUserWallet(null)
      } else {
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

        const { data: chipData, error: chipErr } = await supabase
          .from('player_poker_chips')
          .select('total_chips')
          .eq('user_id', userId)
          .single()

        if (!chipErr && chipData) {
          setUserChips(BigInt(chipData.total_chips || 0))
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }

  async function handlePurchase(packageId) {
    console.log('Purchase clicked:', { packageId, userId, isGuestLocal, packages: packages.length })

    if (!packageId || !userId) {
      setError('Missing purchase information')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const pkg = packages.find(p => p.id === packageId)
      console.log('Found package:', pkg)
      if (!pkg) throw new Error('Package not found')

      const chipAmount = BigInt(pkg.chip_amount || 0)
      const bonusChips = BigInt(pkg.bonus_chips || 0)
      const totalChipsToAdd = chipAmount + bonusChips
      const newChipBalance = userChips + totalChipsToAdd

      if (isGuestLocal) {
        localStorage.setItem(`poker_chips_${userId}`, newChipBalance.toString())
        setUserChips(newChipBalance)

        if (onPurchaseComplete) {
          onPurchaseComplete({
            chipsPurchased: Number(chipAmount),
            bonusChips: Number(bonusChips),
            totalChips: totalChipsToAdd.toString(),
            newBalance: newChipBalance.toString(),
            costDeducted: 'Free (guest account)'
          })
        }
      } else {
        if (userWallet) {
          const localPrice = convertUSDToLocalCurrency(Number(pkg.usd_price), userWallet.currency_code)
          const walletBalance = Number(userWallet.balance)

          if (walletBalance < localPrice) {
            setError(`Insufficient balance. You have ${formatPriceWithCurrency(walletBalance, userWallet.currency_code)} but need ${formatPriceWithCurrency(localPrice, userWallet.currency_code)}`)
            setProcessing(false)
            return
          }

          const newWalletBalance = walletBalance - localPrice
          const { error: walletUpdateErr } = await supabase
            .from('wallets')
            .update({ balance: newWalletBalance, updated_at: new Date() })
            .eq('id', userWallet.id)

          if (walletUpdateErr) throw walletUpdateErr
        }

        const { error: chipUpsertErr } = await supabase
          .from('player_poker_chips')
          .upsert({
            user_id: userId,
            total_chips: newChipBalance.toString(),
            updated_at: new Date()
          }, { onConflict: 'user_id' })

        if (chipUpsertErr) throw chipUpsertErr

        const paymentMethod = userWallet ? 'wallet_deduction' : 'free'
        const { data: purchase, error: purchaseErr } = await supabase
          .from('chip_purchases')
          .insert([{
            user_id: userId,
            package_id: packageId,
            chips_purchased: Number(chipAmount),
            bonus_chips_awarded: Number(bonusChips),
            total_chips_received: Number(totalChipsToAdd),
            usd_price_paid: pkg.usd_price,
            payment_status: 'completed',
            payment_method: paymentMethod,
            created_at: new Date()
          }])
          .select()
          .single()

        if (purchaseErr) throw purchaseErr

        console.log('Purchase recorded successfully')
        await loadUserData()

        if (onPurchaseComplete) {
          console.log('Calling onPurchaseComplete')
          const costDeducted = userWallet
            ? formatPriceWithCurrency(
                convertUSDToLocalCurrency(Number(pkg.usd_price), userWallet.currency_code),
                userWallet.currency_code
              )
            : 'Free (no wallet)'

          onPurchaseComplete({
            chipsPurchased: Number(chipAmount),
            bonusChips: Number(bonusChips),
            totalChips: totalChipsToAdd.toString(),
            newBalance: newChipBalance.toString(),
            costDeducted: costDeducted
          })
        }
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

  const currency = userWallet?.currency_code || DEFAULT_CURRENCY
  const walletBalance = userWallet ? Number(userWallet.balance) : Infinity

  const formatChips = (chips) => {
    if (chips === undefined || chips === null) {
      return '0'
    }
    if (typeof chips === 'bigint') {
      chips = Number(chips)
    }
    return chips.toLocaleString()
  }

  const getPackageLabel = (pkg) => {
    if (!pkg) return null
    if (pkg.is_first_purchase_special === true) return 'FIRST PURCHASE SPECIAL'
    if (pkg.is_most_popular === true) return 'MOST POPULAR'
    if (pkg.is_flash_sale === true) return '24 HOUR FLASH SALE'
    return null
  }

  const getPackageLabelColor = (pkg) => {
    if (!pkg) return null
    if (pkg.is_first_purchase_special === true) return 'bg-cyan-500'
    if (pkg.is_most_popular === true) return 'bg-slate-600'
    if (pkg.is_flash_sale === true) return 'bg-red-600'
    return null
  }

  const getPackageCardBg = (pkg) => {
    if (!pkg) return 'border-slate-600 border'
    if (pkg.is_flash_sale === true) return 'border-red-500 border-2'
    return 'border-slate-600 border'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-6xl w-full border border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-cyan-600 p-8 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">Buy Poker Chips 🎰</h2>
              <p className="text-sm text-cyan-100 mt-2">
                {userWallet ? (
                  <>
                    Your Balance: <span className="font-bold text-lg">{formatPriceWithCurrency(walletBalance, currency)}</span>
                  </>
                ) : (
                  <>
                    Wallet: <span className="font-bold text-lg text-cyan-300">Not set up</span>
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-cyan-100">Your Chips</div>
              <div className="text-3xl font-bold text-white">{formatChips(userChips)}</div>
            </div>
          </div>
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
          ) : packages.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="text-slate-400 text-lg">No chip packages available</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
              {packages.map((pkg) => {
                if (!pkg || !pkg.id) return null

                const usdPrice = Number(pkg.usd_price) || 0
                const chipAmount = Number(pkg.chip_amount) || 0
                const bonusChips = Number(pkg.bonus_chips) || 0

                const localPrice = convertUSDToLocalCurrency(usdPrice, currency)
                const affordable = !userWallet || (walletBalance >= localPrice)
                const totalChips = chipAmount + bonusChips
                const label = getPackageLabel(pkg)
                const labelColor = getPackageLabelColor(pkg)

                return (
                  <div
                    key={pkg.id}
                    className={`relative rounded-xl overflow-hidden transition transform hover:scale-105 ${getPackageCardBg(pkg)} ${
                      pkg.is_flash_sale === true ? 'shadow-2xl shadow-red-500/30' : 'shadow-lg'
                    }`}
                  >
                    {/* Flash Sale Highlight */}
                    {pkg.is_flash_sale && (
                      <div className="absolute inset-0 border-2 border-red-500 rounded-xl pointer-events-none"></div>
                    )}

                    {/* Label Badge */}
                    {label && labelColor && (
                      <div className={`absolute top-0 left-0 right-0 ${labelColor} text-white text-center py-2 text-xs font-bold tracking-wider`}>
                        {label}
                      </div>
                    )}

                    {/* Card Content */}
                    <div className={`bg-slate-800 p-6 ${label ? 'pt-14' : ''} flex flex-col items-center`}>

                      {/* Chip Amount */}
                      <div className="text-center mb-3">
                        <div className="text-2xl font-bold text-white">
                          {totalChips.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">CHIPS</div>
                      </div>

                      {/* Bonus Badge */}
                      {bonusChips > 0 && (
                        <div className="mb-3 px-3 py-1 bg-amber-900/50 border border-amber-600 rounded-full">
                          <div className="text-xs text-amber-300 font-semibold">
                            +{bonusChips.toLocaleString()} BONUS
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="w-full h-px bg-slate-600 my-4"></div>

                      {/* Price */}
                      <div className="text-center mb-6">
                        <div className={`text-3xl font-bold ${!affordable && userWallet ? 'text-red-400' : 'text-white'}`}>
                          {formatPriceWithCurrency(localPrice, currency)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{currency} PRICE</div>
                      </div>

                      {/* Affordability Warning */}
                      {!affordable && userWallet && (
                        <div className="w-full mb-4 p-2 bg-red-900/30 border border-red-600 rounded text-center">
                          <div className="text-xs text-red-300 font-semibold">Not enough balance</div>
                        </div>
                      )}

                      {/* Buy Button */}
                      <button
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={processing || !affordable}
                        className={`w-full py-3 font-bold rounded-lg transition transform active:scale-95 ${
                          affordable
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl'
                            : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            PROCESSING
                          </span>
                        ) : (
                          '🛒 BUY NOW'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="border-t border-slate-700 bg-slate-900/50 p-6 sticky bottom-0">
          <button
            onClick={onClose}
            disabled={processing}
            className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
