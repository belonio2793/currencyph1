import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function ChipTransactionModal({ open, onClose, userId, onPurchaseComplete }) {
  const { isMobile } = useDevice()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const [userWallets, setUserWallets] = useState([])
  const [selectedWalletId, setSelectedWalletId] = useState(null)
  const [processingPackageId, setProcessingPackageId] = useState(null)
  const isGuestLocal = userId && userId.includes('guest-local')

  useEffect(() => {
    if (open && userId) {
      loadPackages()
      loadUserData()
      loadUserWallets()
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

  async function loadUserWallets() {
    if (isGuestLocal) return

    try {
      const { data: walletsData, error: walletsErr } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (walletsErr) {
        console.error('Error loading wallets:', walletsErr)
        return
      }

      setUserWallets(walletsData || [])
      if (walletsData && walletsData.length > 0 && !selectedWalletId) {
        setSelectedWalletId(walletsData[0].id)
      }
    } catch (err) {
      console.error('Error loading user wallets:', err)
    }
  }

  async function handlePurchase(packageId) {
    if (!packageId || !userId) {
      setError('Missing purchase information')
      return
    }

    if (!isGuestLocal && !selectedWalletId) {
      setError('Please select a wallet to pay with')
      return
    }

    setProcessingPackageId(packageId)
    setError(null)

    try {
      const pkg = packages.find(p => p.id === packageId)
      if (!pkg) throw new Error('Package not found')

      const chipAmount = BigInt(pkg.chip_amount || 0)
      const bonusChips = BigInt(pkg.bonus_chips || 0)
      const totalChipsToAdd = chipAmount + bonusChips
      const newChipBalance = userChips + totalChipsToAdd

      if (isGuestLocal) {
        // For guest users, just add chips locally
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

        onClose()
      } else {
        // For authenticated users, process payment and record transaction
        const selectedWallet = userWallets.find(w => w.id === selectedWalletId)
        if (!selectedWallet) {
          throw new Error('Selected wallet not found')
        }

        const walletBalance = Number(selectedWallet.balance || 0)
        const usdPrice = Number(pkg.usd_price || 0)

        if (walletBalance < usdPrice) {
          setError(`Insufficient balance. You need $${usdPrice.toFixed(2)} but have $${walletBalance.toFixed(2)}`)
          setProcessingPackageId(null)
          return
        }

        // Record the wallet transaction (debit)
        const { data: txData, error: txErr } = await supabase.rpc('record_wallet_transaction', {
          p_user_id: userId,
          p_wallet_id: selectedWalletId,
          p_transaction_type: 'purchase',
          p_amount: usdPrice,
          p_currency_code: selectedWallet.currency_code,
          p_description: `Poker chip purchase: ${pkg.name}`,
          p_reference_id: packageId
        })

        if (txErr) {
          throw new Error(`Failed to process payment: ${txErr.message}`)
        }

        // Update player chips
        const { data: chipData, error: chipErr } = await supabase
          .from('player_poker_chips')
          .upsert({
            user_id: userId,
            total_chips: newChipBalance.toString(),
            updated_at: new Date()
          }, { onConflict: 'user_id' })

        if (chipErr) throw chipErr

        // Record purchase in chip_purchases table
        const { error: purchaseErr } = await supabase
          .from('chip_purchases')
          .insert([{
            user_id: userId,
            package_id: packageId,
            wallet_id: selectedWalletId,
            chips_purchased: Number(chipAmount),
            bonus_chips_awarded: Number(bonusChips),
            total_chips_received: Number(totalChipsToAdd),
            usd_price_paid: usdPrice,
            payment_status: 'completed',
            payment_method: 'wallet',
            transaction_id: txData,
            created_at: new Date()
          }])

        if (purchaseErr) throw purchaseErr

        // Refresh data
        await loadUserData()
        await loadUserWallets()

        if (onPurchaseComplete) {
          onPurchaseComplete({
            chipsPurchased: Number(chipAmount),
            bonusChips: Number(bonusChips),
            totalChips: totalChipsToAdd.toString(),
            newBalance: newChipBalance.toString(),
            costDeducted: `$${usdPrice.toFixed(2)} from wallet`
          })
        }

        onClose()
      }
    } catch (err) {
      console.error('Purchase error:', err)
      setError(err.message || 'An error occurred during purchase')
    } finally {
      setProcessingPackageId(null)
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
      icon="🎰"
      size={isMobile ? 'fullscreen' : 'xl'}
      footer={footer}
      badgeContent={`${formatChips(userChips)} chips`}
      showBadge={true}
      defaultExpanded={!isMobile}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-white rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-600">Loading chip packages...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current Balance Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium">Current Chip Balance</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{formatChips(userChips)}</p>
          </div>

          {/* Wallet Selection for Authenticated Users */}
          {!isGuestLocal && userWallets.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Select Payment Wallet</h3>
              <div className="space-y-2">
                {userWallets.map((wallet) => (
                  <label key={wallet.id} className="flex items-center p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-blue-50 transition">
                    <input
                      type="radio"
                      name="wallet"
                      value={wallet.id}
                      checked={selectedWalletId === wallet.id}
                      onChange={() => setSelectedWalletId(wallet.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{wallet.currency_code}</div>
                      <div className="text-sm text-slate-600">Balance: ${Number(wallet.balance || 0).toFixed(2)}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Chip Packages Grid */}
          {packages.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <p className="text-slate-600">No chip packages available at the moment</p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Available Packages</h3>
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-4`}>
                {packages.map((pkg) => {
                  if (!pkg || !pkg.id) return null

                  const chipAmount = Number(pkg.chip_amount || 0)
                  const bonusChips = Number(pkg.bonus_chips || 0)
                  const totalChips = chipAmount + bonusChips
                  const label = getPackageLabel(pkg)
                  const labelColor = getPackageLabelColor(pkg)
                  const isFlashSale = pkg.is_flash_sale === true
                  const isProcessing = processingPackageId === pkg.id

                  return (
                    <div
                      key={pkg.id}
                      className={`relative rounded-lg overflow-hidden border-2 transition transform ${
                        isProcessing
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:scale-105 cursor-pointer'
                      } ${
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

                        {/* Price */}
                        <div className="text-center">
                          <div className="text-lg font-semibold text-emerald-600">
                            ${Number(pkg.usd_price || 0).toFixed(2)}
                          </div>
                        </div>

                        {/* Bonus Badge */}
                        {bonusChips > 0 && (
                          <div className="px-2 py-1 bg-amber-100 border border-amber-300 rounded text-center">
                            <div className="text-xs text-amber-900 font-semibold">
                              ✨ +{bonusChips.toLocaleString()} BONUS
                            </div>
                          </div>
                        )}

                        {/* Buy Button */}
                        <button
                          onClick={() => handlePurchase(pkg.id)}
                          disabled={isProcessing || processing || isGuestLocal === false && !selectedWalletId}
                          className="w-full py-2 font-semibold rounded-lg transition active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {isProcessing ? (
                            <span className="flex items-center justify-center gap-1">
                              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Processing
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
