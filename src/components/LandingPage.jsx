import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/payments'
import { currencyAPI } from '../lib/currencyAPI'
import { supabase } from '../lib/supabaseClient'
import Rates from './Rates'

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

export default function LandingPage({ userId, userEmail, globalCurrency = 'PHP' }) {
  const [geo, setGeo] = useState({ lat: null, lon: null, city: null, region: null, country: null, ip: null, source: null })
  const [geoAvailable, setGeoAvailable] = useState(null) // null=not asked yet, true=granted, false=denied/unavailable

  // Attempt to get precise geolocation, do NOT auto-fallback to IP — require explicit user action
  useEffect(() => {
    let didCancel = false

    const setFromIP = async () => {
      try {
        const resp = await fetch('https://ipapi.co/json/')
        if (!resp.ok) return
        const j = await resp.json()
        if (didCancel) return
        setGeo({
          lat: j.latitude || null,
          lon: j.longitude || null,
          city: j.city || null,
          region: j.region || null,
          country: j.country_name || j.country || null,
          ip: j.ip || null,
          source: 'ip'
        })
      } catch (e) {
        // ignore
      }
    }

    if (navigator.geolocation) {
      // Ask for permission; do not fallback automatically
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (didCancel) return
          setGeoAvailable(true)
          const { latitude, longitude } = position.coords
          // try reverse geocode via nominatim
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`)
            if (r.ok) {
              const data = await r.json()
              setGeo({
                lat: latitude,
                lon: longitude,
                city: data.address?.city || data.address?.town || data.address?.village || null,
                region: data.address?.state || null,
                country: data.address?.country || null,
                ip: null,
                source: 'geo'
              })
              return
            }
          } catch (e) {
            // fallback: set coords only
          }
          setGeo({ lat: latitude, lon: longitude, city: null, region: null, country: null, ip: null, source: 'geo' })
        },
        (err) => {
          // permission denied or error -> mark as denied; do NOT auto-use IP
          setGeoAvailable(false)
        },
        { enableHighAccuracy: false, timeout: 7000 }
      )

      return () => { didCancel = true }
    } else {
      // Geolocation API not available
      setGeoAvailable(false)
    }
  }, [])


  const handleUseIP = async () => {
    try {
      const resp = await fetch('https://ipapi.co/json/')
      if (!resp.ok) return
      const j = await resp.json()
      setGeo({
        lat: j.latitude || null,
        lon: j.longitude || null,
        city: j.city || null,
        region: j.region || null,
        country: j.country_name || j.country || null,
        ip: j.ip || null,
        source: 'ip'
      })
      setGeoAvailable('ip')
    } catch (e) {
      // ignore
    }
  }
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('PHP')
  const [exchangeRates, setExchangeRates] = useState({})
  const [wallets, setWallets] = useState([])
  const [convertedAmounts, setConvertedAmounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [recentTransactions, setRecentTransactions] = useState([])
  const [allCurrencies, setAllCurrencies] = useState([])

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

  // Helper: fetch with retries and proper error handling
  const fetchWithRetries = async (url, options = {}, retries = 1, backoff = 500) => {
    if (!url) return null
    try {
      // validate URL - if invalid, bail out early
      // allow relative URLs by catching TypeError
      new URL(url)
    } catch (e) {
      // invalid URL (maybe relative). If it's clearly invalid, don't attempt fetch
      // but still try once if it's a relative URL (starts with /)
      if (typeof url !== 'string' || !url.startsWith('/')) return null
    }

    let lastErr = null
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        try {
          const resp = await fetch(url, { ...options, signal: controller.signal })
          clearTimeout(timeoutId)

          if (!resp.ok) {
            // attempt to read body for debugging
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
          clearTimeout(timeoutId)
        }
      } catch (err) {
        lastErr = err
        // If it's a network error and we have retries left, wait and retry
        if (i < retries) {
          await new Promise(r => setTimeout(r, backoff * (i + 1)))
        }
      }
    }
    // Return null on failure - caller should use defaults
    return null
  }

  const loadCryptoPrices = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_PROJECT_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      let data = null

      // Only attempt edge function if we have proper environment variables
      if (supabaseUrl && anonKey) {
        data = await fetchWithRetries(
          `${supabaseUrl}/functions/v1/fetch-rates`,
          {
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json'
            }
          },
          1,
          1000
        )
      }

      if (!data || !data.cryptoPrices) {
        const ids = [
          'bitcoin','ethereum','litecoin','dogecoin','ripple','cardano','solana','avalanche-2','matic-network','polkadot','chainlink','uniswap','aave','usd-coin','tether'
        ].join(',')
        const cg = await fetchWithRetries(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {}, 1, 500)

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
      // Silently fall back to defaults on any error
      setCryptoRates(defaultCryptoPrices)
    }
  }

  useEffect(() => {
    loadInitialData()

    // Realtime subscription to currency_rates so landing page shows up-to-date rates (v2 realtime)
    const channel = supabase
      .channel('public:currency_rates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => ({
          ...prev,
          [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
        }))
        setTimeout(() => loadCryptoPrices(), 50)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => ({
          ...prev,
          [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
        }))
        setTimeout(() => loadCryptoPrices(), 50)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => {
          const copy = { ...prev }
          const key = `${payload.old.from_currency}_${payload.old.to_currency}`
          delete copy[key]
          return copy
        })
        setTimeout(() => loadCryptoPrices(), 50)
      })

    channel.subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        // ignore
      }
    }
  }, [userId])

  useEffect(() => {
    setSelectedCurrency(globalCurrency)
  }, [globalCurrency])

  const loadInitialData = async () => {
    try {
      setAllCurrencies(currencyAPI.getCurrencies())
      // Load data in sequence with fallbacks instead of Promise.all to prevent cascading failures
      await loadWallets().catch(err => {
        console.debug('Wallet loading failed, continuing with defaults:', err)
      })
      await loadExchangeRates().catch(err => {
        console.debug('Exchange rates loading failed, continuing with defaults:', err)
      })
      await loadRecentTransactions().catch(err => {
        console.debug('Recent transactions loading failed, continuing with defaults:', err)
      })
      await loadCryptoPrices().catch(err => {
        console.debug('Crypto prices loading failed, continuing with defaults:', err)
      })
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadWallets = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setWallets([])
        return
      }
      const data = await wisegcashAPI.getWallets(userId)
      setWallets(data)
    } catch (err) {
      setWallets([])
    }
  }

  const loadExchangeRates = async () => {
    try {
      const rates = await wisegcashAPI.getAllExchangeRates()
      const ratesMap = {}
      if (rates && rates.length > 0) {
        rates.forEach(r => {
          ratesMap[`${r.from_currency}_${r.to_currency}`] = r.rate
        })
        setExchangeRates(ratesMap)
      } else {
        // fallback to external API
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
      setTimeout(() => loadCryptoPrices(), 100)
    } catch (err) {
      console.debug('Error loading exchange rates, continuing with fallback:', err?.message || String(err))
      setExchangeRates({})
    }
  }

  const loadRecentTransactions = async () => {
    try {
      // Skip for guest-local or invalid user IDs
      if (!userId || userId.includes('guest-local') || userId === 'null' || userId === 'undefined') {
        setRecentTransactions([])
        return
      }
      const data = await wisegcashAPI.getTransactions(userId, 5)
      setRecentTransactions(data)
    } catch (err) {
      // Silently fail for transaction loading - it's not critical
      console.debug('Could not load recent transactions:', err?.message || err)
      setRecentTransactions([])
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
    const allCurrencyList = currencyAPI.getCurrencies()

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
    const allCurrencyList = currencyAPI.getCurrencies()
    const cryptoPrice = cryptoRates[selectedCrypto] || defaultCryptoPrices[selectedCrypto] || 0

    // Value in global currency first
    const valueInGlobalCurrency = numAmount * cryptoPrice

    // Then convert to other currencies
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

      await wisegcashAPI.addFunds(userId, globalCurrency, parseFloat(convertedAmt))
      setSuccess(`Successfully added ${amount} ${selectedCurrency}`)
      setAmount('')
      setConvertedAmounts({})

      setTimeout(() => {
        setSuccess('')
        loadWallets()
        loadRecentTransactions()
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

      await wisegcashAPI.addFunds(userId, globalCurrency, parseFloat(convertedAmt))
      setSuccess(`Successfully added ${cryptoAmount} ${selectedCrypto}`)
      setCryptoAmount('')
      setCryptoConvertedAmounts({})

      setTimeout(() => {
        setSuccess('')
        loadWallets()
        loadRecentTransactions()
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
      {/* Main Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">


        {/* Error & Success Messages */}
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

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-slate-200">
          {/* Total Balance */}
          <div className="mb-8 text-center">
            <p className="text-slate-600 text-sm uppercase tracking-wider mb-2">Total Balance</p>
            <h2 className="text-5xl font-light text-slate-900">
              {getTotalBalance()} {globalCurrency}
            </h2>
          </div>

          {/* Side by Side Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Fiat Currency Form */}
            <form onSubmit={handleAddAmount} className="space-y-6">
              <h3 className="text-xl font-light text-slate-900 tracking-tight">Add Fiat Currency</h3>

              {/* Searchable Currency Selection */}
              <SearchableSelect
                value={selectedCurrency}
                onChange={setSelectedCurrency}
                options={allCurrencies}
                placeholder="Select currency"
                label="Select Currency"
              />

              {/* Amount Input */}
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

              {/* Conversion Preview - Show global currency value */}
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

                  {/* Other currency conversions */}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={adding || !amount}
                className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Processing...' : 'Add'}
              </button>
            </form>

            {/* Cryptocurrency Form */}
            <form onSubmit={handleAddCrypto} className="space-y-6">
              <h3 className="text-xl font-light text-slate-900 tracking-tight">Add Cryptocurrency</h3>

              {/* Searchable Crypto Selection */}
              <SearchableCryptoSelect
                value={selectedCrypto}
                onChange={setSelectedCrypto}
                options={cryptos}
                prices={cryptoRates.length === 0 ? defaultCryptoPrices : cryptoRates}
                label="Select Cryptocurrency"
              />

              {/* Amount Input */}
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

              {/* Conversion Preview - Show global currency value */}
              {cryptoAmount && cryptoConvertedAmounts[globalCurrency] && (
                <div className="bg-gradient-to-br from-orange-50 to-slate-50 rounded-lg p-6 border border-orange-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-slate-600 text-sm mb-1">You send</p>
                      <p className="text-2xl font-light text-slate-900">
                        {cryptoAmount} {selectedCrypto}
                      </p>
                    </div>
                    <div className="text-2xl text-slate-400">��</div>
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

                  {/* Other currency conversions */}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={addingCrypto || !cryptoAmount}
                className="w-full bg-orange-600 text-white py-4 rounded-lg hover:bg-orange-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingCrypto ? 'Processing...' : 'Add'}
              </button>
            </form>
          </div>
        </div>

        {/* Rates Section */}
        <Rates globalCurrency={globalCurrency} />

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200 mt-8">
            <h3 className="text-xl font-light text-slate-900 mb-6 tracking-tight">Recent Transactions</h3>
            <div className="space-y-3">
              {recentTransactions.slice(0, 5).map(txn => (
                <div key={txn.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{txn.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(txn.created_at).toLocaleDateString()} {new Date(txn.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-light ${
                      txn.transaction_type.includes('sent') || txn.transaction_type === 'bill_payment'
                        ? 'text-red-600'
                        : 'text-emerald-600'
                    }`}>
                      {txn.transaction_type.includes('sent') || txn.transaction_type === 'bill_payment' ? '-' : '+'}
                      {txn.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">{txn.currency_code}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>

    </div>
  )
}
