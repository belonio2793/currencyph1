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

// Searchable Select Component
function SearchableSelect({ value, onChange, options, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = options.filter(opt =>
    (opt.code + ' ' + opt.name).toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedOption = options.find(opt => opt.code === value)
  const selectedSymbol = selectedOption ? CURRENCY_SYMBOLS[selectedOption.code] : ''

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-white text-left flex justify-between items-center"
        >
          <span>
            {selectedOption ? (
              <span>
                <span className="font-semibold">{selectedOption.code}</span>
                <span className="text-slate-600 ml-1">({selectedSymbol})</span>
                <span className="text-slate-500"> — {selectedOption.name}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <span className="text-slate-500">▼</span>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
            <input
              type="text"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-4 py-2 border-b border-slate-200 focus:outline-none text-sm sticky top-0 bg-white"
              autoFocus
              onClick={e => e.stopPropagation()}
            />
            <div className="overflow-y-auto">
              {filtered.map(opt => {
                const symbol = CURRENCY_SYMBOLS[opt.code]
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      onChange(opt.code)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 ${
                      value === opt.code ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-700'
                    }`}
                  >
                    <span className="font-semibold">{opt.code}</span>
                    <span className="text-slate-500 ml-1">({symbol})</span>
                    <span className="text-slate-500"> — {opt.name}</span>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-slate-500 text-sm text-center">No currencies found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Searchable Crypto Select Component
function SearchableCryptoSelect({ value, onChange, options, prices, label, globalCurrency = 'PHP' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const globalCurrencySymbol = CURRENCY_SYMBOLS[globalCurrency] || globalCurrency

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-orange-600 text-sm font-medium bg-white text-left flex justify-between items-center"
        >
          <span>
            <span className="font-semibold">{value}</span>
            <span className="text-slate-600 ml-2">
              {formatCurrency(prices[value] || 0, globalCurrency)}
            </span>
          </span>
          <span className="text-slate-500">▼</span>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
            <input
              type="text"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-4 py-2 border-b border-slate-200 focus:outline-none text-sm sticky top-0 bg-white"
              autoFocus
              onClick={e => e.stopPropagation()}
            />
            <div className="overflow-y-auto">
              {filtered.map(crypto => (
                <button
                  key={crypto}
                  type="button"
                  onClick={() => {
                    onChange(crypto)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 ${
                    value === crypto ? 'bg-orange-50 text-orange-900 font-medium' : 'text-slate-700'
                  }`}
                >
                  <span className="font-semibold">{crypto}</span>
                  <span className="text-slate-600 ml-2">
                    {formatCurrency(prices[crypto] || 0, globalCurrency)}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-slate-500 text-sm text-center">No cryptocurrencies found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Payment Method Selector Component
const PaymentMethodSelector = React.memo(function PaymentMethodSelector({ method, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 transition-all ${
        selected
          ? `${method.bgColor} ${method.borderColor} border-2`
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-2xl ${method.color}`}>{method.icon}</span>
        <span className="font-medium text-gray-900">{method.name}</span>
      </div>
    </button>
  )
})

// GCash Payment Display Component
const GCashPaymentDisplay = React.memo(function GCashPaymentDisplay({ phone, referenceCode }) {
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const handleCopyPhone = useCallback(() => {
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }, [phone])

  const handleCopyCode = useCallback(() => {
    if (referenceCode) {
      navigator.clipboard.writeText(referenceCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }, [referenceCode])

  return (
    <div className="space-y-4">
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-600 mb-2">Send to GCash Number:</p>
        <p className="text-2xl font-bold text-blue-600 mb-4 select-all">{phone}</p>

        {referenceCode && (
          <div className="bg-white p-3 rounded border border-blue-100 mb-4">
            <p className="text-xs text-gray-600 mb-1">Reference Code (Include in notes):</p>
            <p className="font-mono font-bold text-gray-900 select-all">{referenceCode}</p>
            <button
              onClick={handleCopyCode}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {copiedCode ? '✓ Copied' : 'Copy Code'}
            </button>
          </div>
        )}

        <button
          onClick={handleCopyPhone}
          className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium p-2 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
        >
          {copiedPhone ? '✓ Copied Phone Number' : 'Copy GCash Number'}
        </button>
      </div>
    </div>
  )
})

// Instructions Component
const InstructionsDisplay = React.memo(function InstructionsDisplay({ method }) {
  return (
    <div className={`p-4 rounded-lg ${method.bgColor} border ${method.borderColor}`}>
      <h4 className="font-semibold text-gray-900 mb-3">Steps to Complete Your Deposit:</h4>
      <ol className="space-y-2">
        {method.instructions.map((instruction, idx) => (
          <li key={idx} className="flex gap-3 text-sm text-gray-700">
            <span className={`font-bold ${method.color} flex-shrink-0`}>{idx + 1}.</span>
            <span>{instruction}</span>
          </li>
        ))}
      </ol>
    </div>
  )
})

// Wallet Summary Card Component
const WalletSummaryCard = React.memo(function WalletSummaryCard({ wallet, globalCurrency, exchangeRates, onDeposit }) {
  const getConvertedBalance = useCallback(() => {
    if (wallet.currency_code === globalCurrency) {
      return parseFloat(wallet.balance || 0).toFixed(2)
    }
    const rateKey = `${wallet.currency_code}_${globalCurrency}`
    const rate = exchangeRates[rateKey] || 1
    return (parseFloat(wallet.balance || 0) * rate).toFixed(2)
  }, [wallet, globalCurrency, exchangeRates])

  const symbol = CURRENCY_SYMBOLS[wallet.currency_code] || ''
  const globalSymbol = CURRENCY_SYMBOLS[globalCurrency] || ''

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {wallet.currency_code}
          </p>
          <p className="text-sm text-slate-500 mt-1">{symbol}</p>
        </div>
        {wallet.is_active && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Active
          </span>
        )}
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <p className="text-xs text-slate-600 mb-1">Available Balance</p>
          <p className="text-lg font-semibold text-slate-900 font-mono">
            {parseFloat(wallet.balance || 0).toFixed(2)} {symbol}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-600 mb-1">In {globalCurrency}</p>
          <p className="text-sm font-medium text-slate-700 font-mono">
            {getConvertedBalance()} {globalSymbol}
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200 space-y-1 mb-3 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>Total Deposited:</span>
          <span className="font-medium">{parseFloat(wallet.total_deposited || 0).toFixed(2)} {symbol}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Withdrawn:</span>
          <span className="font-medium">{parseFloat(wallet.total_withdrawn || 0).toFixed(2)} {symbol}</span>
        </div>
      </div>

      <button
        onClick={() => onDeposit(wallet.currency_code)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded transition-colors"
      >
        Deposit {wallet.currency_code}
      </button>
    </div>
  )
})

// Main Deposits Component
function DepositsComponent({ userId, globalCurrency = 'PHP' }) {
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [exchangeRates, setExchangeRates] = useState({})
  const [wallets, setWallets] = useState([])
  const [convertedAmounts, setConvertedAmounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [allCurrencies, setAllCurrencies] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [syncStatus, setSyncStatus] = useState('synced')

  // Payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('solana')
  const [referenceCode, setReferenceCode] = useState(null)
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false)


  // Fiat deposit state
  const [fiatAmount, setFiatAmount] = useState('')
  const [fiatConvertedAmounts, setFiatConvertedAmounts] = useState({})

  // Crypto deposit state
  const [cryptoAmount, setCryptoAmount] = useState('')
  const [selectedCrypto, setSelectedCrypto] = useState('BTC')
  const [cryptoRates, setCryptoRates] = useState({})
  const [cryptoConvertedAmounts, setCryptoConvertedAmounts] = useState({})
  const [addingCrypto, setAddingCrypto] = useState(false)

  const [selectedDepositCurrency, setSelectedDepositCurrency] = useState(null)

  const cryptos = ['BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'MATIC', 'DOT', 'LINK', 'UNI', 'AAVE', 'USDC', 'USDT']

  const defaultCryptoPrices = {
    BTC: 5520000,
    ETH: 205000,
    LTC: 26000,
    DOGE: 18,
    XRP: 32,
    ADA: 50,
    SOL: 14200,
    AVAX: 42000,
    MATIC: 75,
    DOT: 9500,
    LINK: 3200,
    UNI: 10500,
    AAVE: 380000,
    USDC: 56.75,
    USDT: 56.75
  }

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

  const loadCryptoPrices = async () => {
    try {
      let data = null

      try {
        const localRes = await fetchWithRetries('/api/crypto-prices', {}, 1, 500)
        if (localRes && localRes.cryptoPrices) {
          data = localRes
        }
      } catch (err) {
        console.debug('Local crypto-prices endpoint failed:', err?.message || 'Unknown error')
      }

      if (!data || !data.cryptoPrices) {
        const ids = [
          'bitcoin','ethereum','litecoin','dogecoin','ripple','cardano','solana','avalanche-2','matic-network','polkadot','chainlink','uniswap','aave','usd-coin','tether'
        ].join(',')
        let cg = null
        try {
          cg = await fetchWithRetries(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {}, 1, 500)
        } catch (err) {
          console.debug('CoinGecko API failed, using default prices:', err?.message || 'Unknown error')
        }

        const cryptoData = cg || {}
        const globalExchangeRate = exchangeRates[`USD_${globalCurrency}`] || 1

        const cryptoPricesInGlobalCurrency = {
          BTC: Math.round(((cryptoData.bitcoin?.usd) || defaultCryptoPrices.BTC) * globalExchangeRate * 100) / 100,
          ETH: Math.round(((cryptoData.ethereum?.usd) || defaultCryptoPrices.ETH) * globalExchangeRate * 100) / 100,
          LTC: Math.round(((cryptoData.litecoin?.usd) || defaultCryptoPrices.LTC) * globalExchangeRate * 100) / 100,
          DOGE: Math.round(((cryptoData.dogecoin?.usd) || defaultCryptoPrices.DOGE) * globalExchangeRate * 100) / 100,
          XRP: Math.round(((cryptoData.ripple?.usd) || defaultCryptoPrices.XRP) * globalExchangeRate * 100) / 100,
          ADA: Math.round(((cryptoData.cardano?.usd) || defaultCryptoPrices.ADA) * globalExchangeRate * 100) / 100,
          SOL: Math.round(((cryptoData.solana?.usd) || defaultCryptoPrices.SOL) * globalExchangeRate * 100) / 100,
          AVAX: Math.round(((cryptoData['avalanche-2']?.usd) || defaultCryptoPrices.AVAX) * globalExchangeRate * 100) / 100,
          MATIC: Math.round(((cryptoData['matic-network']?.usd) || defaultCryptoPrices.MATIC) * globalExchangeRate * 100) / 100,
          DOT: Math.round(((cryptoData.polkadot?.usd) || defaultCryptoPrices.DOT) * globalExchangeRate * 100) / 100,
          LINK: Math.round(((cryptoData.chainlink?.usd) || defaultCryptoPrices.LINK) * globalExchangeRate * 100) / 100,
          UNI: Math.round(((cryptoData.uniswap?.usd) || defaultCryptoPrices.UNI) * globalExchangeRate * 100) / 100,
          AAVE: Math.round(((cryptoData.aave?.usd) || defaultCryptoPrices.AAVE) * globalExchangeRate * 100) / 100,
          USDC: Math.round(((cryptoData['usd-coin']?.usd) || defaultCryptoPrices.USDC) * globalExchangeRate * 100) / 100,
          USDT: Math.round(((cryptoData.tether?.usd) || defaultCryptoPrices.USDT) * globalExchangeRate * 100) / 100
        }
        setCryptoRates(cryptoPricesInGlobalCurrency)
        return
      }

      const globalExchangeRate = exchangeRates[`USD_${globalCurrency}`] || 1
      const cryptoData = data.cryptoPrices

      const cryptoPricesInGlobalCurrency = {
        BTC: Math.round((cryptoData.bitcoin?.usd || defaultCryptoPrices.BTC) * globalExchangeRate * 100) / 100,
        ETH: Math.round((cryptoData.ethereum?.usd || defaultCryptoPrices.ETH) * globalExchangeRate * 100) / 100,
        LTC: Math.round((cryptoData.litecoin?.usd || defaultCryptoPrices.LTC) * globalExchangeRate * 100) / 100,
        DOGE: Math.round((cryptoData.dogecoin?.usd || defaultCryptoPrices.DOGE) * globalExchangeRate * 100) / 100,
        XRP: Math.round((cryptoData.ripple?.usd || defaultCryptoPrices.XRP) * globalExchangeRate * 100) / 100,
        ADA: Math.round((cryptoData.cardano?.usd || defaultCryptoPrices.ADA) * globalExchangeRate * 100) / 100,
        SOL: Math.round((cryptoData.solana?.usd || defaultCryptoPrices.SOL) * globalExchangeRate * 100) / 100,
        AVAX: Math.round((cryptoData['avalanche-2']?.usd || defaultCryptoPrices.AVAX) * globalExchangeRate * 100) / 100,
        MATIC: Math.round((cryptoData['matic-network']?.usd || defaultCryptoPrices.MATIC) * globalExchangeRate * 100) / 100,
        DOT: Math.round((cryptoData.polkadot?.usd || defaultCryptoPrices.DOT) * globalExchangeRate * 100) / 100,
        LINK: Math.round((cryptoData.chainlink?.usd || defaultCryptoPrices.LINK) * globalExchangeRate * 100) / 100,
        UNI: Math.round((cryptoData.uniswap?.usd || defaultCryptoPrices.UNI) * globalExchangeRate * 100) / 100,
        AAVE: Math.round((cryptoData.aave?.usd || defaultCryptoPrices.AAVE) * globalExchangeRate * 100) / 100,
        USDC: Math.round((cryptoData['usd-coin']?.usd || defaultCryptoPrices.USDC) * globalExchangeRate * 100) / 100,
        USDT: Math.round((cryptoData.tether?.usd || defaultCryptoPrices.USDT) * globalExchangeRate * 100) / 100
      }
      setCryptoRates(cryptoPricesInGlobalCurrency)
    } catch (err) {
      setCryptoRates(defaultCryptoPrices)
    }
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
          setTimeout(() => loadCryptoPrices(), 50)
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
          setTimeout(() => loadCryptoPrices(), 50)
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
          setTimeout(() => loadCryptoPrices(), 50)
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

  useEffect(() => {
    setSelectedCurrency(globalCurrency)
  }, [globalCurrency])

  const loadInitialData = async () => {
    try {
      setAllCurrencies(currencyAPI.getCurrencies())

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
      loadCryptoPrices().catch(err => {
        console.debug('Crypto prices loading failed, continuing with defaults:', err)
      })
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

  useEffect(() => {
    if (fiatAmount && selectedCurrency) {
      calculateFiatMultiCurrencyConversion()
    } else {
      setFiatConvertedAmounts({})
    }
  }, [fiatAmount, selectedCurrency, exchangeRates, globalCurrency])

  useEffect(() => {
    if (cryptoAmount && selectedCrypto) {
      calculateCryptoMultiConversion()
    } else {
      setCryptoConvertedAmounts({})
    }
  }, [cryptoAmount, selectedCrypto, cryptoRates, globalCurrency])

  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(exchangeRates).length > 0) {
        loadCryptoPrices()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [exchangeRates, globalCurrency])

  const calculateFiatMultiCurrencyConversion = useCallback(() => {
    const numAmount = parseFloat(fiatAmount) || 0
    if (numAmount <= 0) {
      setFiatConvertedAmounts({})
      return
    }

    const conversions = {}
    const allCurrencyList = allCurrencies

    allCurrencyList.forEach(curr => {
      if (curr.code !== selectedCurrency) {
        const rateKey = `${selectedCurrency}_${curr.code}`
        const rate = exchangeRates[rateKey] || 1
        conversions[curr.code] = (numAmount * rate).toFixed(2)
      }
    })

    setFiatConvertedAmounts(conversions)
  }, [fiatAmount, selectedCurrency, exchangeRates, allCurrencies])

  const calculateCryptoMultiConversion = useCallback(() => {
    const numAmount = parseFloat(cryptoAmount) || 0
    if (numAmount <= 0) {
      setCryptoConvertedAmounts({})
      return
    }

    const conversions = {}
    const allCurrencyList = allCurrencies
    const cryptoPrice = cryptoRates[selectedCrypto] || defaultCryptoPrices[selectedCrypto] || 0

    const valueInGlobalCurrency = numAmount * cryptoPrice

    allCurrencyList.forEach(curr => {
      const rateKey = `${globalCurrency}_${curr.code}`
      const rate = exchangeRates[rateKey] || 1
      conversions[curr.code] = (valueInGlobalCurrency * rate).toFixed(2)
    })

    setCryptoConvertedAmounts(conversions)
  }, [cryptoAmount, selectedCrypto, cryptoRates, globalCurrency, allCurrencies, exchangeRates])

  const handleAddFiat = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAdding(true)

    try {
      const numAmount = parseFloat(fiatAmount)
      if (!numAmount || numAmount <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (!selectedCurrency) {
        throw new Error('Please select a currency')
      }

      const convertedAmt = fiatConvertedAmounts[globalCurrency] || (numAmount * (exchangeRates[`${selectedCurrency}_${globalCurrency}`] || 1)).toFixed(2)

      await paymentsAPI.addFunds(userId, globalCurrency, parseFloat(convertedAmt))
      setSuccess(`Successfully added ${formatCurrency(fiatAmount, selectedCurrency)}`)
      setFiatAmount('')
      setFiatConvertedAmounts({})

      setTimeout(() => {
        setSuccess('')
        refreshWallets()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to add funds')
    } finally {
      setAdding(false)
    }
  }

  const handleAddCrypto = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAddingCrypto(true)

    try {
      const numAmount = parseFloat(cryptoAmount)
      if (!numAmount || numAmount <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (!selectedCrypto) {
        throw new Error('Please select a cryptocurrency')
      }

      const convertedAmt = cryptoConvertedAmounts[globalCurrency] || (numAmount * (cryptoRates[selectedCrypto] || 0)).toFixed(2)

      await paymentsAPI.addFunds(userId, globalCurrency, parseFloat(convertedAmt))
      setSuccess(`Successfully added ${parseFloat(cryptoAmount).toFixed(8)} ${selectedCrypto}`)
      setCryptoAmount('')
      setCryptoConvertedAmounts({})

      setTimeout(() => {
        setSuccess('')
        refreshWallets()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to add crypto')
    } finally {
      setAddingCrypto(false)
    }
  }

  const handleQuickDeposit = (currencyCode) => {
    setSelectedDepositCurrency(currencyCode)
    setSelectedCurrency(currencyCode)
    setDepositTab('fiat')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getTotalBalance = useMemo(() => {
    let total = 0
    wallets.forEach(wallet => {
      const rate = exchangeRates[`${wallet.currency_code}_${globalCurrency}`] || 1
      total += parseFloat(wallet.balance || 0) * rate
    })
    return total.toFixed(2)
  }, [wallets, exchangeRates, globalCurrency])

  const getRate = useCallback((from, to) => {
    if (from === to) return '1.0000'
    const key = `${from}_${to}`
    const direct = exchangeRates[key]
    if (typeof direct === 'number') return direct.toFixed(4)

    const usdToFrom = exchangeRates[`USD_${from}`]
    const usdToTo = exchangeRates[`USD_${to}`]
    if (typeof usdToFrom === 'number' && typeof usdToTo === 'number' && usdToFrom > 0) {
      return (usdToTo / usdToFrom).toFixed(4)
    }

    const reverse = exchangeRates[`${to}_${from}`]
    if (typeof reverse === 'number' && reverse > 0) return (1 / reverse).toFixed(4)

    return '—'
  }, [exchangeRates])

  const getCryptoPrice = useCallback((crypto) => {
    return cryptoRates[crypto] || defaultCryptoPrices[crypto] || 0
  }, [cryptoRates])

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
