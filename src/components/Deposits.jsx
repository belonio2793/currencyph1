import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { currencyAPI as paymentsAPI } from '../lib/payments'
import { currencyAPI } from '../lib/currencyAPI'
import { apiCache } from '../lib/apiCache'
import { supabase } from '../lib/supabaseClient'

// Currency symbol mapping
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'Fr',
  SEK: 'kr',
  NZD: 'NZ$',
  SGD: 'S$',
  HKD: 'HK$',
  PHP: '₱',
  IDR: 'Rp',
  MYR: 'RM',
  THB: '฿',
  VND: '₫',
  KRW: '₩',
  ZAR: 'R',
  BRL: 'R$',
  MXN: '$',
  NOK: 'kr',
  DKK: 'kr',
  AED: 'د.إ'
}

// Helper function to format currency with symbol
const formatCurrency = (amount, currencyCode, showSymbol = true) => {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode
  const numAmount = parseFloat(amount) || 0
  const formatted = numAmount.toFixed(2)

  if (showSymbol) {
    if (['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'HKD', 'NZD'].includes(currencyCode)) {
      return `${symbol}${formatted}`
    }
    return `${formatted} ${symbol}`
  }
  return formatted
}

// Payment Methods Configuration
const SOLANA_ADDRESS = 'CbcWb97K3TEFJZJYLZRqdsMSdVXTFaMaUcF6yPQgY9yS'

const PAYMENT_METHODS = {
  solana: {
    name: 'Solana',
    icon: '◎',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    address: SOLANA_ADDRESS,
    instructions: [
      'Scan the QR code with your Solana wallet app',
      'Verify the recipient address and amount',
      'Confirm the transaction',
      'Your balance will be updated within 1-2 minutes'
    ]
  }
}

// Main Deposits Component
function DepositsComponent({ userId, globalCurrency = 'PHP' }) {
  const [exchangeRates, setExchangeRates] = useState({})
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)
  const [syncStatus, setSyncStatus] = useState('synced')

  const fetchWithRetries = async (url, options = {}, retries = 1, backoff = 500) => {
    if (!url) return null
    try {
      new URL(url)
    } catch (e) {
      if (typeof url !== 'string' || !url.startsWith('/')) return null
    }

    let lastErr = null
    for (let i = 0; i <= retries; i++) {
      let controller = null
      let timeoutId = null
      try {
        controller = new AbortController()
        const timeoutDuration = 15000 + (i * 5000)
        timeoutId = setTimeout(() => {
          try {
            controller.abort()
          } catch (e) {}
        }, timeoutDuration)

        try {
          const resp = await fetch(url, { ...options, signal: controller.signal })
          if (timeoutId) clearTimeout(timeoutId)

          if (!resp.ok) {
            let bodyText = null
            try { bodyText = await resp.text() } catch (e) { bodyText = null }
            throw new Error(`HTTP ${resp.status}${bodyText ? ` - ${bodyText}` : ''}`)
          }

          const text = await resp.text()
          try {
            return text ? JSON.parse(text) : null
          } catch (parseErr) {
            return text
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId)
        }
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId)
        lastErr = err
        if (i < retries && !err.message?.includes('HTTP')) {
          await new Promise(r => setTimeout(r, backoff * (i + 1)))
        }
      }
    }
    return null
  }

  useEffect(() => {
    loadInitialData()
    const channel = supabase
      .channel('public:currency_rates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'currency_rates' }, payload => {
        try {
          setExchangeRates(prev => ({
            ...prev,
            [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
          }))
        } catch (e) {
          console.warn('currency_rates INSERT handler error:', e)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'currency_rates' }, payload => {
        try {
          setExchangeRates(prev => ({
            ...prev,
            [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
          }))
        } catch (e) {
          console.warn('currency_rates UPDATE handler error:', e)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'currency_rates' }, payload => {
        try {
          setExchangeRates(prev => {
            const copy = { ...prev }
            const key = `${payload.old.from_currency}_${payload.old.to_currency}`
            delete copy[key]
            return copy
          })
        } catch (e) {
          console.warn('currency_rates DELETE handler error:', e)
        }
      })

    try {
      const sub = channel.subscribe()
      if (sub && typeof sub.then === 'function') {
        sub.catch(err => console.warn('supabase channel subscribe rejected:', err))
      }
    } catch (e) {
      console.warn('Failed to subscribe to supabase channel:', e)
    }

    const unhandledRejectionHandler = (evt) => {
      try {
        const reason = evt && (evt.reason || evt.detail || null)
        const msg = (reason && (reason.message || reason.toString && reason.toString())) || ''
        if (typeof msg === 'string' && /abort|aborted|AbortError/i.test(msg)) {
          evt.preventDefault && evt.preventDefault()
          console.debug('Ignored aborted promise:', msg)
        }
      } catch (e) {
        // ignore
      }
    }
    try { window.addEventListener('unhandledrejection', unhandledRejectionHandler) } catch (e) {}

    return () => {
      try {
        channel.unsubscribe()
      } catch (e) {}
      try { window.removeEventListener('unhandledrejection', unhandledRejectionHandler) } catch (e) {}
    }
  }, [userId])

  const loadInitialData = async () => {
    try {
      if (userId && !userId.includes('guest-local') && userId !== 'null' && userId !== 'undefined') {
        paymentsAPI.ensureUserWallets(userId).catch(err => {
          console.debug('Failed to ensure user wallets, continuing:', err)
        })
      }

      await Promise.all([
        loadWallets().catch(err => {
          console.debug('Wallet loading failed, continuing with defaults:', err)
        }),
        loadExchangeRates().catch(err => {
          console.debug('Exchange rates loading failed, continuing with defaults:', err)
        })
      ])
      setLoading(false)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
      setLoading(false)
    }
  }

  const loadWallets = async () => {
    try {
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        return
      }
      setSyncStatus('syncing')
      const data = await paymentsAPI.getWallets(userId)
      setWallets(data)
      setSyncStatus('synced')
    } catch (err) {
      setWallets([])
      setSyncStatus('error')
    }
  }

  const loadExchangeRates = async () => {
    try {
      const rates = await paymentsAPI.getAllExchangeRates()
      const ratesMap = {}
      if (rates && rates.length > 0) {
        rates.forEach(r => {
          ratesMap[`${r.from_currency}_${r.to_currency}`] = r.rate
        })
        setExchangeRates(ratesMap)
      } else {
        try {
          const globalRates = await currencyAPI.getGlobalRates()
          if (!globalRates || typeof globalRates !== 'object') {
            console.debug('Invalid rates format, using empty rates')
            setExchangeRates(ratesMap)
            return
          }
          const codes = Object.keys(globalRates)
          codes.forEach(code => {
            const rateObj = globalRates[code]
            const rate = rateObj?.rate || 0
            if (rate > 0) {
              ratesMap[`USD_${code}`] = rate
            }
          })
          codes.forEach(from => {
            codes.forEach(to => {
              if (from === to) return
              const rateFrom = globalRates[from]?.rate || 0
              const rateTo = globalRates[to]?.rate || 0
              if (rateFrom > 0 && rateTo > 0) {
                ratesMap[`${from}_${to}`] = rateTo / rateFrom
              }
            })
          })
          setExchangeRates(ratesMap)
        } catch (apiErr) {
          console.debug('External currency API unavailable, using empty rates:', apiErr)
          setExchangeRates(ratesMap)
        }
      }
    } catch (err) {
      console.debug('Error loading exchange rates, continuing with fallback:', err?.message || String(err))
      setExchangeRates({})
    }
  }

  const refreshWallets = async () => {
    setSyncStatus('syncing')
    await loadWallets()
    setLastUpdate(new Date())
  }


  const getTotalBalance = useMemo(() => {
    let total = 0
    wallets.forEach(wallet => {
      const rate = exchangeRates[`${wallet.currency_code}_${globalCurrency}`] || 1
      total += parseFloat(wallet.balance || 0) * rate
    })
    return total.toFixed(2)
  }, [wallets, exchangeRates, globalCurrency])


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl font-light text-slate-900 mb-2">currency.ph</div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Deposit Solana */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-8 overflow-hidden">
          <div className="p-8">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-slate-900">Deposit Solana</h2>

              <p className="text-slate-600">
                Send Solana directly to the address below to add funds to your wallet. Transactions are processed automatically once confirmed on the blockchain.
              </p>

              {/* Consolidated Balance Display */}
              {wallets && wallets.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-8 border border-slate-700 text-white">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Your Total Balances</h4>
                    <button
                      onClick={refreshWallets}
                      disabled={syncStatus === 'syncing'}
                      className={`text-xs font-medium transition-colors ${
                        syncStatus === 'syncing'
                          ? 'text-slate-500 cursor-not-allowed'
                          : 'text-blue-300 hover:text-blue-200'
                      }`}
                    >
                      {syncStatus === 'syncing' ? '↻ Syncing...' : '↻ Refresh'}
                    </button>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                    <p className="text-sm text-slate-300 mb-2">Total Balance</p>
                    <p className="text-4xl font-light text-white">
                      {formatCurrency(getTotalBalance, globalCurrency)}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="text-center p-6 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex justify-center mb-4">
                    <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                      <svg width="150" height="150" viewBox="0 0 150 150">
                        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fill="#1e1b4b">
                          [QR Code: solana:{SOLANA_ADDRESS}]
                        </text>
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Solana Wallet Address:</p>
                  <p className="font-mono text-xs text-gray-900 break-all select-all">{SOLANA_ADDRESS}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SOLANA_ADDRESS)
                      setSuccess('Address copied to clipboard')
                      setTimeout(() => setSuccess(''), 2000)
                    }}
                    className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Copy Address
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-2">💡 How to Deposit:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Scan the QR code with your Solana wallet or copy the address above</li>
                    <li>Send any amount of Solana to this address</li>
                    <li>Verify the recipient address and amount in your wallet</li>
                    <li>Confirm the transaction</li>
                    <li>Your balance will be updated within 1-2 minutes</li>
                  </ol>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                  <p className="font-semibold mb-2">⚠️ Important:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Make sure to send only Solana (SOL) to this address</li>
                    <li>Do not send other tokens or NFTs to this address</li>
                    <li>Transactions on the Solana blockchain cannot be reversed</li>
                    <li>Keep the transaction hash for your records</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(DepositsComponent)
