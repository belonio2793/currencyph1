import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { pokerPaymentService } from '../lib/pokerPaymentService'
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'
import { formatNumber } from '../lib/currency'

export default function ChipTransactionModal({ open, onClose, userId, onPurchaseComplete }) {
  const { isMobile } = useDevice()
  const [products, setProducts] = useState([])
  const [productPrices, setProductPrices] = useState({})
  const [chipPackages, setChipPackages] = useState({})
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [userChips, setUserChips] = useState(0n)
  const [userWallets, setUserWallets] = useState([])
  const [selectedWalletId, setSelectedWalletId] = useState(null)
  const [processingProductId, setProcessingProductId] = useState(null)
  const [showPaymentMethods, setShowPaymentMethods] = useState({})
  const [exchangeRate, setExchangeRate] = useState(1)
  const isGuestLocal = userId && userId.includes('guest-local')

  useEffect(() => {
    if (open && userId) {
      loadPokerProducts()
      loadUserData()
      loadExchangeRate()
      if (!isGuestLocal) {
        loadUserWallets()
      }
    }
  }, [open, userId])

  async function loadPokerProducts() {
    try {
      setLoading(true)
      
      // Get payment products for poker chips
      const products = await pokerPaymentService.getPokerChipProducts()
      setProducts(products || [])

      // Load prices for each product
      const pricesMap = {}
      const packagesMap = {}
      
      for (const product of products) {
        try {
          const price = await pokerPaymentService.getProductPrices(product.id)
          if (price) {
            pricesMap[product.id] = price
          }
          
          // Extract chip package data from product metadata
          if (product.metadata) {
            packagesMap[product.id] = product.metadata
          }
        } catch (err) {
          console.warn(`Error loading price for product ${product.id}:`, err)
        }
      }
      
      setProductPrices(pricesMap)
      setChipPackages(packagesMap)

      // If no payment products exist, fall back to poker_chip_packages
      if (products.length === 0) {
        console.log('No payment products found, loading fallback chip packages...')
        await loadFallbackChipPackages()
      }
    } catch (err) {
      console.error('Error loading poker products:', err)
      // Fall back to regular chip packages
      await loadFallbackChipPackages()
    } finally {
      setLoading(false)
    }
  }

  async function loadFallbackChipPackages() {
    try {
      const { data, error } = await supabase
        .from('poker_chip_packages')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      // Convert to product format
      const fallbackProducts = (data || []).map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        description: `${pkg.chip_amount.toLocaleString()} chips${pkg.bonus_chips > 0 ? ` + ${pkg.bonus_chips.toLocaleString()} bonus` : ''}`,
        metadata: {
          chip_amount: pkg.chip_amount,
          bonus_chips: pkg.bonus_chips,
          total_chips: pkg.chip_amount + pkg.bonus_chips,
          is_first_purchase_special: pkg.is_first_purchase_special,
          is_most_popular: pkg.is_most_popular,
          is_flash_sale: pkg.is_flash_sale
        }
      }))
      
      setProducts(fallbackProducts)
      
      // Create price map from chip packages
      const pricesMap = {}
      data.forEach(pkg => {
        pricesMap[pkg.id] = { amount: pkg.usd_price, currency: 'USD' }
      })
      setProductPrices(pricesMap)
    } catch (err) {
      console.error('Error loading fallback chip packages:', err)
      setError('Failed to load chip packages')
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

  async function loadExchangeRate() {
    try {
      const { data } = await supabase
        .from('currency_rates')
        .select('rate')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'PHP')
        .single()

      if (data) {
        setExchangeRate(Number(data.rate) || 1)
      }
    } catch (err) {
      console.error('Error loading exchange rate:', err)
      setExchangeRate(1)
    }
  }

  async function loadUserWallets() {
    if (isGuestLocal) return

    try {
      const { data: walletsData, error: walletsErr } = await supabase
        .from('wallets')
        .select('id, user_id, currency_code, balance, is_active, account_number')
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

  async function handlePurchase(productId, paymentMethod = 'wallet_balance') {
    if (!productId || !userId) {
      setError('Missing purchase information')
      return
    }

    if (!isGuestLocal && paymentMethod === 'wallet_balance' && !selectedWalletId) {
      setError('Please select a wallet to pay with')
      return
    }

    setProcessingProductId(productId)
    setError(null)

    try {
      const product = products.find(p => p.id === productId)
      if (!product) throw new Error('Product not found')

      const chipData = chipPackages[productId] || product.metadata
      if (!chipData) throw new Error('Chip package data not found')

      const price = productPrices[productId]
      if (!price) throw new Error('Price not found for product')

      const chipAmount = BigInt(chipData.chip_amount || 0)
      const bonusChips = BigInt(chipData.bonus_chips || 0)
      const totalChipsToAdd = chipAmount + bonusChips
      const newChipBalance = userChips + totalChipsToAdd
      const usdPrice = Number(price.amount || 0)

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
      } else if (paymentMethod === 'wallet_balance') {
        // Process wallet payment
        const selectedWallet = userWallets.find(w => w.id === selectedWalletId)
        if (!selectedWallet) {
          throw new Error('Selected wallet not found')
        }

        const walletBalance = Number(selectedWallet.balance || 0)

        if (walletBalance < usdPrice) {
          setError(`Insufficient balance. You need $${usdPrice.toFixed(2)} but have $${walletBalance.toFixed(2)}`)
          setProcessingProductId(null)
          return
        }

        // Process wallet payment through payment system
        const result = await pokerPaymentService.processWalletPayment(
          userId,
          productId,
          chipData,
          selectedWalletId,
          usdPrice
        )

        if (!result) {
          throw new Error('Failed to process payment')
        }

        // Update player chips
        const { error: chipErr } = await supabase
          .from('player_poker_chips')
          .upsert({
            user_id: userId,
            total_chips: newChipBalance.toString(),
            updated_at: new Date()
          }, { onConflict: 'user_id' })

        if (chipErr) throw chipErr

        // Record chip purchase
        const { error: purchaseErr } = await supabase
          .from('chip_purchases')
          .insert([{
            user_id: userId,
            package_id: productId,
            product_id: productId,
            wallet_id: selectedWalletId,
            chips_purchased: Number(chipAmount),
            bonus_chips_awarded: Number(bonusChips),
            total_chips_received: Number(totalChipsToAdd),
            usd_price_paid: usdPrice,
            payment_status: 'completed',
            payment_method: 'wallet',
            payment_id: result.payment?.id,
            transaction_id: result.transaction,
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
            costDeducted: `$${usdPrice.toFixed(2)} from wallet`,
            paymentId: result.payment?.id
          })
        }

        onClose()
      } else {
        // Non-wallet payment methods - show payment link or checkout
        try {
          const paymentLink = await pokerPaymentService.getOrCreatePaymentLink(productId)
          
          // Open payment link in new window
          const paymentUrl = `${window.location.origin}/payment/${paymentLink.slug}`
          window.open(paymentUrl, '_blank')
          
          if (onPurchaseComplete) {
            onPurchaseComplete({
              chipsPurchased: Number(chipAmount),
              bonusChips: Number(bonusChips),
              totalChips: totalChipsToAdd.toString(),
              newBalance: newChipBalance.toString(),
              costDeducted: `$${usdPrice.toFixed(2)} (payment pending)`,
              status: 'pending'
            })
          }

          onClose()
        } catch (err) {
          throw new Error(`Failed to initiate payment: ${err.message}`)
        }
      }
    } catch (err) {
      console.error('Purchase error:', err)
      setError(err.message || 'An error occurred during purchase')
    } finally {
      setProcessingProductId(null)
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

  const formatAccountNumber = (num) => {
    if (!num) return 'Not assigned'
    const str = num.toString()
    if (str.length <= 8) return str
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`
  }

  const fiatWallets = userWallets.filter(w => {
    const isCrypto = ['BTC', 'ETH', 'SOLANA', 'BNB', 'USDC', 'USDT', 'DOGECOIN', 'XRP', 'ADA', 'MATIC'].includes(w.currency_code)
    return !isCrypto
  })

  const cryptoWallets = userWallets.filter(w => {
    const isCrypto = ['BTC', 'ETH', 'SOLANA', 'BNB', 'USDC', 'USDT', 'DOGECOIN', 'XRP', 'ADA', 'MATIC'].includes(w.currency_code)
    return isCrypto
  })

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
      ) : (
        <div className="space-y-6">
          {/* Current Balance Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium">Current Chip Balance</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{formatChips(userChips)}</p>
          </div>

          {/* Wallet Selection for Authenticated Users */}
          {!isGuestLocal && userWallets.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-all">
              <label className="block text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">
                Select Payment Wallet
              </label>
              <select
                value={selectedWalletId || ''}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900 font-medium"
              >
                <option value="">Choose a wallet...</option>
                {fiatWallets.length > 0 && (
                  <optgroup label="💳 Fiat Wallets">
                    {fiatWallets.map(wallet => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.currency_code} - Balance: {formatNumber(Number(wallet.balance || 0))}
                      </option>
                    ))}
                  </optgroup>
                )}
                {cryptoWallets.length > 0 && (
                  <optgroup label="₿ Cryptocurrency">
                    {cryptoWallets.map(wallet => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.currency_code} - Balance: {formatNumber(Number(wallet.balance || 0))}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {selectedWalletId && (
                <div className="mt-4 space-y-3">
                  {(() => {
                    const selectedWallet = userWallets.find(w => w.id === selectedWalletId)
                    return selectedWallet ? (
                      <>
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
                      </>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Chip Packages Grid */}
          {products.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <p className="text-slate-600">No chip packages available at the moment</p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Available Packages</h3>
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-4`}>
                {products.map((product) => {
                  if (!product || !product.id) return null

                  const chipData = chipPackages[product.id] || product.metadata
                  const chipAmount = Number(chipData?.chip_amount || 0)
                  const bonusChips = Number(chipData?.bonus_chips || 0)
                  const totalChips = chipAmount + bonusChips
                  const price = productPrices[product.id]
                  const usdPrice = Number(price?.amount || 0)
                  
                  const label = getPackageLabel(chipData)
                  const labelColor = getPackageLabelColor(chipData)
                  const isFlashSale = chipData?.is_flash_sale === true
                  const isProcessing = processingProductId === product.id

                  return (
                    <div
                      key={product.id}
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
                        {usdPrice > 0 && (
                          <div className="text-center">
                            <div className="text-lg font-semibold text-emerald-600">
                              ${usdPrice.toFixed(2)}
                            </div>
                          </div>
                        )}

                        {/* Bonus Badge */}
                        {bonusChips > 0 && (
                          <div className="px-2 py-1 bg-amber-100 border border-amber-300 rounded text-center">
                            <div className="text-xs text-amber-900 font-semibold">
                              +{bonusChips.toLocaleString()} BONUS
                            </div>
                          </div>
                        )}

                        {/* Buy Button */}
                        {!isGuestLocal && userWallets.length > 0 ? (
                          <button
                            onClick={() => handlePurchase(product.id, 'wallet_balance')}
                            disabled={isProcessing || processing || !selectedWalletId}
                            className="w-full py-2 font-semibold rounded-lg transition active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            {isProcessing ? (
                              <span className="flex items-center justify-center gap-1">
                                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Processing
                              </span>
                            ) : (
                              'BUY NOW'
                            )}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            {!isGuestLocal && (
                              <button
                                onClick={() => handlePurchase(product.id, 'bank_transfer')}
                                disabled={isProcessing || processing}
                                className="w-full py-2 font-semibold rounded-lg transition active:scale-95 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                title="Pay via bank transfer, credit card, e-wallet, or crypto"
                              >
                                {isProcessing ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Processing
                                  </span>
                                ) : (
                                  'OTHER PAYMENT'
                                )}
                              </button>
                            )}
                            {isGuestLocal && (
                              <button
                                onClick={() => handlePurchase(product.id, 'guest')}
                                disabled={isProcessing || processing}
                                className="w-full py-2 font-semibold rounded-lg transition active:scale-95 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                              >
                                {isProcessing ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Adding
                                  </span>
                                ) : (
                                  'ADD CHIPS'
                                )}
                              </button>
                            )}
                          </div>
                        )}
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
              Chips are used to play poker games. Purchase chips to get started or earn them by winning hands.
            </p>
          </div>
        </div>
      )}
    </ExpandableModal>
  )
}
