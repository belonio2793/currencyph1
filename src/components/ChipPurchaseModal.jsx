import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'
import { convertUSDToLocalCurrency, formatPriceWithCurrency, getCurrencySymbol } from '../lib/currencyManager'
import { formatNumber } from '../lib/currency'
import { walletService } from '../lib/walletService'
import { payments } from '../lib/payments'

export default function ChipPurchaseModal({ open, onClose, userId, onPurchaseComplete }) {
  const { isMobile } = useDevice()
  const [packages, setPackages] = useState([])
  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const [exchangeRate, setExchangeRate] = useState(null)
  const DEFAULT_CURRENCY = 'PHP'
  const isGuestLocal = userId && userId.includes('guest-local')

  useEffect(() => {
    if (open && userId) {
      loadPackages()
      loadUserData()
      loadWallets()
      loadExchangeRate()
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

  async function loadWallets() {
    try {
      if (isGuestLocal) return
      
      const allWallets = await walletService.getUserWalletsWithDetails(userId)
      if (allWallets && allWallets.length > 0) {
        setWallets(allWallets)
        // Select first PHP wallet or first wallet if no PHP
        const phpWallet = allWallets.find(w => w.currency_code === 'PHP')
        setSelectedWallet(phpWallet || allWallets[0])
      }
    } catch (err) {
      console.error('Error loading wallets:', err)
    }
  }

  async function loadExchangeRate() {
    try {
      const rate = await payments.getExchangeRate('USD', DEFAULT_CURRENCY)
      setExchangeRate(rate || 1)
    } catch (err) {
      console.error('Error loading exchange rate:', err)
      setExchangeRate(1)
    }
  }

  async function handlePurchase(packageId) {
    if (!packageId || !userId) {
      setError('Missing purchase information')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const pkg = packages.find(p => p.id === packageId)
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
        const { error: chipUpsertErr } = await supabase
          .from('player_poker_chips')
          .upsert({
            user_id: userId,
            total_chips: newChipBalance.toString(),
            updated_at: new Date()
          }, { onConflict: 'user_id' })

        if (chipUpsertErr) throw chipUpsertErr

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
            payment_method: 'free',
            created_at: new Date()
          }])
          .select()
          .single()

        if (purchaseErr) throw purchaseErr

        await loadUserData()

        if (onPurchaseComplete) {
          onPurchaseComplete({
            chipsPurchased: Number(chipAmount),
            bonusChips: Number(bonusChips),
            totalChips: totalChipsToAdd.toString(),
            newBalance: newChipBalance.toString(),
            costDeducted: 'Free'
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

  const currency = DEFAULT_CURRENCY

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

  const formatAccountNumber = (num) => {
    if (!num) return 'Not assigned'
    const str = num.toString()
    if (str.length <= 8) return str
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`
  }

  const footer = (
    <button
      onClick={onClose}
      disabled={processing}
      className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition disabled:opacity-50"
    >
      Close
    </button>
  )

  return (
    <ExpandableModal
      isOpen={open}
      onClose={onClose}
      title="Buy Poker Chips"
      size={isMobile ? 'fullscreen' : 'xl'}
      footer={footer}
      badgeContent={`${formatChips(userChips)} chips`}
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
            <p className="text-slate-600">Loading chip packages...</p>
          </div>
        </div>
      ) : packages.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <p className="text-slate-600">No chip packages available at the moment</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Wallet Selection */}
          {!isGuestLocal && wallets.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-all">
              <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">
                Select Payment Wallet
              </label>
              <select
                value={selectedWallet?.id || ''}
                onChange={(e) => {
                  const selected = wallets.find(w => w.id === e.target.value)
                  setSelectedWallet(selected)
                }}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900 font-medium"
              >
                <option value="">Choose a wallet...</option>
                {wallets.map(wallet => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.currency_code} - Balance: {formatNumber(Number(wallet.balance || 0))}
                  </option>
                ))}
              </select>

              {selectedWallet && (
                <div className="mt-4 space-y-3">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-xs text-slate-600 font-semibold mb-2 uppercase tracking-wider">Current Balance</p>
                    <p className="text-xl font-light text-slate-900 font-mono">
                      {formatNumber(Number(selectedWallet.balance || 0))} {selectedWallet.currency_code}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium mb-2 uppercase tracking-wider">Wallet ID</p>
                    <p className="font-mono text-xs text-slate-900 break-all">{selectedWallet.id}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-blue-700 font-medium mb-2 uppercase tracking-wider">Account Number</p>
                    <p className="font-mono text-xs text-slate-900">{formatAccountNumber(selectedWallet.account_number)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chip Packages Grid */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-4`}>
            {packages.map((pkg) => {
              if (!pkg || !pkg.id) return null

              const chipAmount = Number(pkg.chip_amount) || 0
              const bonusChips = Number(pkg.bonus_chips) || 0
              const totalChips = chipAmount + bonusChips
              const label = getPackageLabel(pkg)
              const labelColor = getPackageLabelColor(pkg)
              const isFlashSale = pkg.is_flash_sale === true

              return (
                <div
                  key={pkg.id}
                  className={`relative rounded-lg overflow-hidden border-2 transition transform hover:scale-105 ${
                    isFlashSale 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-slate-200 bg-slate-50 hover:border-blue-400'
                  }`}
                >
                  {/* Label Badge */}
                  {label && labelColor && (
                    <div className={`${labelColor} text-white text-center py-1 text-xs font-bold tracking-wider`}>
                      {label}
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-4 space-y-3">
                    {/* Chip Amount */}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900">
                        {totalChips.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">CHIPS</div>
                    </div>

                    {/* Price Display - PHP Primary with USD */}
                    <div className="space-y-2">
                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Price (PHP)</p>
                        <div className="text-xl font-bold text-emerald-600">
                          {'\u20B1'}{formatNumber(Number(pkg.php_price || (pkg.usd_price * (exchangeRate || 1))))}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">USD Price</p>
                        <div className="text-sm text-slate-600">
                          ${formatNumber(Number(pkg.usd_price || 0))}
                        </div>
                      </div>
                    </div>

                    {/* Bonus Badge */}
                    {bonusChips > 0 && (
                      <div className="px-2 py-1 bg-amber-100 border border-amber-300 rounded text-center">
                        <div className="text-xs text-amber-900 font-semibold">
                          +{bonusChips.toLocaleString()} BONUS
                        </div>
                      </div>
                    )}

                    {/* Buy Button */}
                    <button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={processing}
                      className="w-full py-2 font-semibold rounded-lg transition active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {processing ? (
                        <span className="flex items-center justify-center gap-1">
                          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Processing
                        </span>
                      ) : (
                        'BUY NOW'
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </ExpandableModal>
  )
}
