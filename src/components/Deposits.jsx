import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { currencyAPI as paymentsAPI } from '../lib/payments'
import { currencyAPI } from '../lib/currencyAPI'
import { apiCache } from '../lib/apiCache'
import { supabase } from '../lib/supabaseClient'

// Payment Methods Configuration
const PAYMENT_METHODS = {
  solana: {
    name: 'Solana',
    icon: '◎',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    address: 'CbcWb97K3TEFJZIYTZQ5bMdVXTfaMaUcF6yPQgy9yS',
    instructions: [
      'Scan the QR code with your Solana wallet app',
      'Verify the recipient address and amount',
      'Confirm the transaction',
      'Your balance will be updated within 1-2 minutes'
    ]
  },
  gcash: {
    name: 'GCash',
    icon: '₱',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    phone: '639308510351',
    instructions: [
      'Open your GCash app',
      'Select "Send Money" and enter the phone number',
      'Enter the amount to send',
      'Add the reference code in the notes',
      'Your balance will be updated upon confirmation'
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
          <span>{selectedOption ? `${selectedOption.code} - ${selectedOption.name}` : placeholder}</span>
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
              {filtered.map(opt => (
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
                  {opt.code} - {opt.name}
                </button>
              ))}
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
function SearchableCryptoSelect({ value, onChange, options, prices, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <span>{value} - {prices[value]?.toFixed(2) || '0.00'}</span>
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
                  {crypto} - {prices[crypto]?.toFixed(2) || '0.00'}
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

// Solana Payment Display Component
const SolanaPaymentDisplay = React.memo(function SolanaPaymentDisplay({ address }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  return (
    <div className="space-y-4">
      <div className="text-center p-6 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
            <svg width="150" height="150" viewBox="0 0 150 150">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fill="#1e1b4b">
                [QR Code: solana:{address}]
              </text>
            </svg>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-2">Solana Wallet Address:</p>
        <p className="font-mono text-xs text-gray-900 break-all select-all">{address}</p>
        <button
          onClick={handleCopy}
          className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          {copied ? '✓ Copied' : 'Copy Address'}
        </button>
      </div>
    </div>
  )
})

// GCash Payment Display Component
function GCashPaymentDisplay({ phone, referenceCode }) {
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  const handleCopyCode = () => {
    if (referenceCode) {
      navigator.clipboard.writeText(referenceCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

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
}

// Instructions Component
function InstructionsDisplay({ method }) {
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
}

export default function Deposits({ userId, globalCurrency = 'PHP' }) {
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('PHP')
  const [exchangeRates, setExchangeRates] = useState({})
  const [wallets, setWallets] = useState([])
  const [convertedAmounts, setConvertedAmounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [allCurrencies, setAllCurrencies] = useState([])

  // Payment method selection
  const [depositTab, setDepositTab] = useState('direct')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('solana')
  const [referenceCode, setReferenceCode] = useState(null)
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false)

  const [cryptoAmount, setCryptoAmount] = useState('')
  const [selectedCrypto, setSelectedCrypto] = useState('BTC')
  const [cryptoRates, setCryptoRates] = useState({})
  const [cryptoConvertedAmounts, setCryptoConvertedAmounts] = useState({})
  const [addingCrypto, setAddingCrypto] = useState(false)

  const cryptos = ['BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'MATIC', 'DOT', 'LINK', 'UNI', 'AAVE', 'USDC', 'USDT']

  const defaultCryptoPrices = {
    BTC: 4200000,
    ETH: 180000,
    LTC: 12000,
    DOGE: 8,
    XRP: 25,
    ADA: 35,
    SOL: 18000,
    AVAX: 40000,
    MATIC: 50,
    DOT: 8000,
    LINK: 2500,
    UNI: 8000,
    AAVE: 280000,
    USDC: 56,
    USDT: 56
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
      const supabaseUrl = import.meta.env.VITE_PROJECT_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      let data = null

      if (supabaseUrl && anonKey) {
        try {
          data = await fetchWithRetries(
            `${supabaseUrl}/functions/v1/fetch-rates`,
            {
              headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
              }
            },
            1,
            500
          )
        } catch (err) {
          console.debug('Supabase fetch-rates failed, using fallback:', err?.message || 'Unknown error')
        }
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
      await Promise.all([
        loadWallets().catch(err => {
          console.debug('Wallet loading failed, continuing with defaults:', err)
        }),
        loadExchangeRates().catch(err => {
          console.debug('Exchange rates loading failed, continuing with defaults:', err)
        })
      ])
      setLoading(false)
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
      const data = await paymentsAPI.getWallets(userId)
      setWallets(data)
    } catch (err) {
      setWallets([])
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

  useEffect(() => {
    if (amount && selectedCurrency) {
      calculateMultiCurrencyConversion()
    } else {
      setConvertedAmounts({})
    }
  }, [amount, selectedCurrency, exchangeRates, globalCurrency])

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

  const calculateMultiCurrencyConversion = () => {
    const numAmount = parseFloat(amount) || 0
    if (numAmount <= 0) {
      setConvertedAmounts({})
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

    setConvertedAmounts(conversions)
  }

  const calculateCryptoMultiConversion = () => {
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
  }

  const handleAddAmount = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAdding(true)

    try {
      const numAmount = parseFloat(amount)
      if (!numAmount || numAmount <= 0) {
        throw new Error('Please enter a valid amount')
      }

      if (!selectedCurrency) {
        throw new Error('Please select a currency')
      }

      const convertedAmt = convertedAmounts[globalCurrency] || (numAmount * (exchangeRates[`${selectedCurrency}_${globalCurrency}`] || 1)).toFixed(2)

      await paymentsAPI.addFunds(userId, globalCurrency, parseFloat(convertedAmt))
      setSuccess(`Successfully added ${amount} ${selectedCurrency}`)
      setAmount('')
      setConvertedAmounts({})

      setTimeout(() => {
        setSuccess('')
        loadWallets()
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
      setSuccess(`Successfully added ${cryptoAmount} ${selectedCrypto}`)
      setCryptoAmount('')
      setCryptoConvertedAmounts({})

      setTimeout(() => {
        setSuccess('')
        loadWallets()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to add crypto')
    } finally {
      setAddingCrypto(false)
    }
  }

  const getTotalBalance = () => {
    return wallets.reduce((sum, w) => sum + (w.balance || 0), 0).toFixed(2)
  }

  const getRate = (from, to) => {
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
  }

  const getCryptoPrice = (crypto) => {
    return (cryptoRates[crypto] || defaultCryptoPrices[crypto] || 0).toFixed(2)
  }

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

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-slate-200">
          <div className="mb-8 text-center">
            <p className="text-slate-600 text-sm uppercase tracking-wider mb-2">Total Balance</p>
            <h2 className="text-5xl font-light text-slate-900">
              {getTotalBalance()} {globalCurrency}
            </h2>
          </div>

          {/* Deposit Method Tabs */}
          <div className="mb-8 border-b border-slate-200">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setDepositTab('direct')
                  setShowPaymentInstructions(false)
                }}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  depositTab === 'direct'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Direct Payment
              </button>
              <button
                onClick={() => {
                  setDepositTab('crypto')
                  setShowPaymentInstructions(false)
                }}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  depositTab === 'crypto'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Add Cryptocurrency
              </button>
            </div>
          </div>

          {/* Direct Payment Methods */}
          {depositTab === 'direct' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Payment Method</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {Object.entries(PAYMENT_METHODS).map(([key, method]) => (
                    <PaymentMethodSelector
                      key={key}
                      method={method}
                      selected={selectedPaymentMethod === key}
                      onClick={() => {
                        setSelectedPaymentMethod(key)
                        setReferenceCode(key === 'gcash' ? `REF-${Date.now().toString().slice(-8)}` : null)
                        setShowPaymentInstructions(false)
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Deposit Amount ({globalCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-6 py-4 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-0 text-lg font-light"
                />
              </div>

              {amount && (
                <div className="space-y-6">
                  {selectedPaymentMethod === 'solana' && (
                    <>
                      <SolanaPaymentDisplay address={PAYMENT_METHODS.solana.address} />
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                        <p className="font-semibold mb-2">💡 Important:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Deposit amount: <span className="font-bold">{amount} {globalCurrency}</span></li>
                          <li>Your balance will be updated once confirmed on the blockchain</li>
                          <li>Keep your SOL address for transaction tracking</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowPaymentInstructions(!showPaymentInstructions)}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      >
                        {showPaymentInstructions ? 'Hide Instructions' : 'View Instructions'}
                      </button>
                      {showPaymentInstructions && (
                        <InstructionsDisplay method={PAYMENT_METHODS.solana} />
                      )}
                    </>
                  )}

                  {selectedPaymentMethod === 'gcash' && (
                    <>
                      <GCashPaymentDisplay 
                        phone={PAYMENT_METHODS.gcash.phone}
                        referenceCode={referenceCode}
                      />
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                        <p className="font-semibold mb-2">💡 Important:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Deposit amount: <span className="font-bold">{amount} {globalCurrency}</span></li>
                          <li>Use the reference code to track your deposit</li>
                          <li>Deposits are confirmed within 1-3 minutes</li>
                          <li>Make sure to include the reference code in the GCash notes</li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowPaymentInstructions(!showPaymentInstructions)}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        {showPaymentInstructions ? 'Hide Instructions' : 'View Instructions'}
                      </button>
                      {showPaymentInstructions && (
                        <InstructionsDisplay method={PAYMENT_METHODS.gcash} />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fiat Currency & Cryptocurrency Forms */}
          {depositTab === 'crypto' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <form onSubmit={handleAddAmount} className="space-y-6">
                <h3 className="text-xl font-light text-slate-900 tracking-tight">Add Fiat Currency</h3>

                <SearchableSelect
                  value={selectedCurrency}
                  onChange={setSelectedCurrency}
                  options={allCurrencies}
                  placeholder="Select currency"
                  label="Select Currency"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Amount ({selectedCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-6 py-4 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-0 text-lg font-light"
                  />
                </div>

                {amount && convertedAmounts[globalCurrency] && (
                  <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg p-6 border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-slate-600 text-sm mb-1">You send</p>
                        <p className="text-2xl font-light text-slate-900">
                          {amount} {selectedCurrency}
                        </p>
                      </div>
                      <div className="text-2xl text-slate-400">→</div>
                      <div className="text-right">
                        <p className="text-slate-600 text-sm mb-1">You get</p>
                        <p className="text-2xl font-light text-blue-600">
                          {convertedAmounts[globalCurrency]} {globalCurrency}
                        </p>
                      </div>
                    </div>
                    {getRate(selectedCurrency, globalCurrency) && (
                      <p className="text-xs text-slate-500 border-t border-blue-200 pt-3">
                        Rate: 1 {selectedCurrency} = {getRate(selectedCurrency, globalCurrency)} {globalCurrency}
                      </p>
                    )}

                    {Object.keys(convertedAmounts).filter(c => c !== globalCurrency).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-xs font-medium text-slate-600 mb-2">Also worth approximately:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(convertedAmounts)
                            .filter(([code]) => code !== globalCurrency && code !== selectedCurrency)
                            .slice(0, 4)
                            .map(([code, value]) => (
                              <div key={code} className="text-xs text-slate-600">
                                <span className="font-medium">{code}</span>: {value}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={adding || !amount}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? 'Processing...' : 'Add'}
                </button>
              </form>

              <form onSubmit={handleAddCrypto} className="space-y-6">
                <h3 className="text-xl font-light text-slate-900 tracking-tight">Add Cryptocurrency</h3>

                <SearchableCryptoSelect
                  value={selectedCrypto}
                  onChange={setSelectedCrypto}
                  options={cryptos}
                  prices={cryptoRates.length === 0 ? defaultCryptoPrices : cryptoRates}
                  label="Select Cryptocurrency"
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Amount ({selectedCrypto})
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={cryptoAmount}
                    onChange={e => setCryptoAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-6 py-4 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-orange-600 focus:ring-0 text-lg font-light"
                  />
                </div>

                {cryptoAmount && cryptoConvertedAmounts[globalCurrency] && (
                  <div className="bg-gradient-to-br from-orange-50 to-slate-50 rounded-lg p-6 border border-orange-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-slate-600 text-sm mb-1">You send</p>
                        <p className="text-2xl font-light text-slate-900">
                          {cryptoAmount} {selectedCrypto}
                        </p>
                      </div>
                      <div className="text-2xl text-slate-400">→</div>
                      <div className="text-right">
                        <p className="text-slate-600 text-sm mb-1">You get</p>
                        <p className="text-2xl font-light text-orange-600">
                          {cryptoConvertedAmounts[globalCurrency]} {globalCurrency}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 border-t border-orange-200 pt-3">
                      Rate: 1 {selectedCrypto} = {getCryptoPrice(selectedCrypto)} {globalCurrency}
                    </p>

                    {Object.keys(cryptoConvertedAmounts).filter(c => c !== globalCurrency).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-orange-200">
                        <p className="text-xs font-medium text-slate-600 mb-2">Also worth approximately:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(cryptoConvertedAmounts)
                            .filter(([code]) => code !== globalCurrency)
                            .slice(0, 4)
                            .map(([code, value]) => (
                              <div key={code} className="text-xs text-slate-600">
                                <span className="font-medium">{code}</span>: {value}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={addingCrypto || !cryptoAmount}
                  className="w-full bg-orange-600 text-white py-4 rounded-lg hover:bg-orange-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingCrypto ? 'Processing...' : 'Add'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
