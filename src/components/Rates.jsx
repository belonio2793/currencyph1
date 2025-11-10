import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/payments'
import { currencyAPI } from '../lib/currencyAPI'
import { supabase } from '../lib/supabaseClient'

export default function Rates({ globalCurrency }) {
  const [exchangeRates, setExchangeRates] = useState({})
  const [cryptoRates, setCryptoRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [allCurrencies, setAllCurrencies] = useState([])
  const baseCurrency = 'PHP'
  // common fallback currency list in case external currencyAPI is unavailable
  const fallbackFiats = [
    { code: 'PHP', name: 'Philippine Peso' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'HKD', name: 'Hong Kong Dollar' },
    { code: 'KRW', name: 'South Korean Won' },
    { code: 'INR', name: 'Indian Rupee' }
  ]

  const resolveUsdToBase = () => {
    const direct = exchangeRates && exchangeRates[`USD_${baseCurrency}`]
    if (typeof direct === 'number' && direct > 0) return direct
    const rev = exchangeRates && exchangeRates[`${baseCurrency}_USD`]
    if (typeof rev === 'number' && rev > 0) return 1 / rev
    return null
  }

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

  useEffect(() => {
    loadRates()
    // Poll hourly in development to avoid excessive API calls
    const interval = setInterval(loadRates, 60 * 60 * 1000)

    // Realtime subscription to Supabase currency_rates table (v2 realtime)
    const channel = supabase
      .channel('public:currency_rates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => ({
          ...prev,
          [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
        }))
        setLastUpdated(new Date())
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => ({
          ...prev,
          [`${payload.new.from_currency}_${payload.new.to_currency}`]: payload.new.rate
        }))
        setLastUpdated(new Date())
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'currency_rates' }, payload => {
        setExchangeRates(prev => {
          const copy = { ...prev }
          // payload.old should contain the previous record
          const key = `${payload.old.from_currency}_${payload.old.to_currency}`
          delete copy[key]
          return copy
        })
        setLastUpdated(new Date())
      })

    channel.subscribe()

    return () => {
      clearInterval(interval)
      try {
        supabase.removeChannel(channel)
      } catch (e) {
        // ignore
      }
    }
  }, [globalCurrency])

  const loadRates = async () => {
    try {
      setLoading(true)
      await Promise.all([loadExchangeRates(), loadCryptoPrices()])
      setLastUpdated(new Date())
    } catch (err) {
      console.debug('Error loading rates (using fallbacks):', err)
    } finally {
      setLoading(false)
    }
  }

  const loadExchangeRates = async () => {
    try {
      const currencies = currencyAPI.getCurrencies()
      setAllCurrencies(currencies)

      const ratesMap = {}

      // 1) Prefer Supabase currency_rates table (real-time source)
      try {
        // select only expected columns to avoid schema mismatch
        const { data, error } = await supabase.from('currency_rates').select('from_currency,to_currency,rate')
        if (!error && data && data.length) {
          data.forEach(r => {
            if (r && r.from_currency && r.to_currency && r.rate != null) {
              ratesMap[`${r.from_currency}_${r.to_currency}`] = Number(r.rate)
            }
          })
          setExchangeRates(ratesMap)
          return
        }
      } catch (supErr) {
        console.debug('Could not read currency_rates from Supabase:', supErr)
      }

      // 2) Fallback: try cached_rates table (if your SQL populated it)
      try {
        const { data: cached, error: cachedErr } = await supabase.from('cached_rates').select('from_currency,to_currency,rate')
        if (!cachedErr && cached && cached.length) {
          cached.forEach(r => {
            if (r && r.from_currency && r.to_currency && r.rate != null) {
              ratesMap[`${r.from_currency}_${r.to_currency}`] = Number(r.rate)
            }
          })
          setExchangeRates(ratesMap)
          return
        }
      } catch (cachedReadErr) {
        console.debug('Could not read cached_rates from Supabase:', cachedReadErr)
      }

      // 3) Next fallback: legacy wisegcashAPI (DB-backed) if available
      try {
        const rates = await wisegcashAPI.getAllExchangeRates()
        if (rates && rates.length > 0) {
          rates.forEach(r => {
            if (r && r.from_currency && r.to_currency && r.rate != null) {
              ratesMap[`${r.from_currency}_${r.to_currency}`] = Number(r.rate)
            }
          })
          setExchangeRates(ratesMap)
          return
        }
      } catch (legacyErr) {
        console.debug('wisegcashAPI.getAllExchangeRates failed:', legacyErr)
      }

      // 4) Last-resort: external currency API to build pairwise rates
      try {
        const globalRates = await currencyAPI.getGlobalRates()
        if (!globalRates || typeof globalRates !== 'object') {
          console.debug('Invalid rates format from external API, using empty rates')
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
    } catch (err) {
      console.debug('Error loading exchange rates, continuing with fallback:', err)
      setExchangeRates({})
    }
  }

  // Helper: fetch with retries and proper error handling
  const fetchWithRetries = async (url, options = {}, retries = 2, backoff = 500, timeoutMs = 8000) => {
    let lastErr
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const resp = await fetch(url, { ...options, signal: controller.signal })
          clearTimeout(timeoutId)

          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const contentType = resp.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            return await resp.json()
          }
          return await resp.text()
        } finally {
          clearTimeout(timeoutId)
        }
      } catch (err) {
        lastErr = err
        if (i < retries) {
          await new Promise(r => setTimeout(r, backoff * (i + 1)))
        }
      }
    }
    return null
  }

  const loadCryptoPrices = async () => {
    try {
      // Try CoinGecko first (public, CORS-friendly). If that fails, fall back to supabase edge function.
      try {
        const ids = [
          'bitcoin','ethereum','litecoin','dogecoin','ripple','cardano','solana','avalanche-2','matic-network','polkadot','chainlink','uniswap','aave','usd-coin','tether'
        ].join(',')
        const cg = await fetchWithRetries(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {}, 2, 500, 8000)
        const cryptoData = cg || null
        if (cryptoData) {
          const usdToBase = (() => {
            const direct = exchangeRates[`USD_${baseCurrency}`]
            if (typeof direct === 'number' && direct > 0) return direct
            const rev = exchangeRates[`${baseCurrency}_USD`]
            if (typeof rev === 'number' && rev > 0) return 1 / rev
            return 1
          })()

          const cryptoPricesInGlobalCurrency = {
            BTC: Math.round(((cryptoData.bitcoin?.usd) || defaultCryptoPrices.BTC) * usdToBase * 100) / 100,
            ETH: Math.round(((cryptoData.ethereum?.usd) || defaultCryptoPrices.ETH) * usdToBase * 100) / 100,
            LTC: Math.round(((cryptoData.litecoin?.usd) || defaultCryptoPrices.LTC) * usdToBase * 100) / 100,
            DOGE: Math.round(((cryptoData.dogecoin?.usd) || defaultCryptoPrices.DOGE) * usdToBase * 100) / 100,
            XRP: Math.round(((cryptoData.ripple?.usd) || defaultCryptoPrices.XRP) * usdToBase * 100) / 100,
            ADA: Math.round(((cryptoData.cardano?.usd) || defaultCryptoPrices.ADA) * usdToBase * 100) / 100,
            SOL: Math.round(((cryptoData.solana?.usd) || defaultCryptoPrices.SOL) * usdToBase * 100) / 100,
            AVAX: Math.round(((cryptoData['avalanche-2']?.usd) || defaultCryptoPrices.AVAX) * usdToBase * 100) / 100,
            MATIC: Math.round(((cryptoData['matic-network']?.usd) || defaultCryptoPrices.MATIC) * usdToBase * 100) / 100,
            DOT: Math.round(((cryptoData.polkadot?.usd) || defaultCryptoPrices.DOT) * usdToBase * 100) / 100,
            LINK: Math.round(((cryptoData.chainlink?.usd) || defaultCryptoPrices.LINK) * usdToBase * 100) / 100,
            UNI: Math.round(((cryptoData.uniswap?.usd) || defaultCryptoPrices.UNI) * usdToBase * 100) / 100,
            AAVE: Math.round(((cryptoData.aave?.usd) || defaultCryptoPrices.AAVE) * usdToBase * 100) / 100,
            USDC: Math.round(((cryptoData['usd-coin']?.usd) || defaultCryptoPrices.USDC) * usdToBase * 100) / 100,
            USDT: Math.round(((cryptoData.tether?.usd) || defaultCryptoPrices.USDT) * usdToBase * 100) / 100
          }
          setCryptoRates(cryptoPricesInGlobalCurrency)
          return
        }
      } catch (cgErr) {
        // Silently fail and try next method
      }

      // Use edge function to proxy API calls (avoids other issues)
      const supabaseUrl = import.meta.env.VITE_PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

      const data = await fetchWithRetries(
        `${supabaseUrl}/functions/v1/fetch-rates`,
        {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
          }
        },
        1,
        1000,
        10000
      )

      if (!data || !data.cryptoPrices) {
        const usdToBase = (() => {
          const direct = exchangeRates[`USD_${baseCurrency}`]
          if (typeof direct === 'number' && direct > 0) return direct
          const rev = exchangeRates[`${baseCurrency}_USD`]
          if (typeof rev === 'number' && rev > 0) return 1 / rev
          return 1
        })()
        const defaults = {}
        Object.entries(defaultCryptoPrices).forEach(([key, value]) => {
          defaults[key] = Math.round(value * usdToBase * 100) / 100
        })
        setCryptoRates(defaults)
        return
      }

      const usdToBase = (() => {
        const direct = exchangeRates[`USD_${baseCurrency}`]
        if (typeof direct === 'number' && direct > 0) return direct
        const rev = exchangeRates[`${baseCurrency}_USD`]
        if (typeof rev === 'number' && rev > 0) return 1 / rev
        return 1
      })()
      const cryptoData = data.cryptoPrices

      const cryptoPricesInGlobalCurrency = {
        BTC: Math.round((cryptoData.bitcoin?.usd || defaultCryptoPrices.BTC) * usdToBase * 100) / 100,
        ETH: Math.round((cryptoData.ethereum?.usd || defaultCryptoPrices.ETH) * usdToBase * 100) / 100,
        LTC: Math.round((cryptoData.litecoin?.usd || defaultCryptoPrices.LTC) * usdToBase * 100) / 100,
        DOGE: Math.round((cryptoData.dogecoin?.usd || defaultCryptoPrices.DOGE) * usdToBase * 100) / 100,
        XRP: Math.round((cryptoData.ripple?.usd || defaultCryptoPrices.XRP) * usdToBase * 100) / 100,
        ADA: Math.round((cryptoData.cardano?.usd || defaultCryptoPrices.ADA) * usdToBase * 100) / 100,
        SOL: Math.round((cryptoData.solana?.usd || defaultCryptoPrices.SOL) * usdToBase * 100) / 100,
        AVAX: Math.round((cryptoData['avalanche-2']?.usd || defaultCryptoPrices.AVAX) * usdToBase * 100) / 100,
        MATIC: Math.round((cryptoData['matic-network']?.usd || defaultCryptoPrices.MATIC) * usdToBase * 100) / 100,
        DOT: Math.round((cryptoData.polkadot?.usd || defaultCryptoPrices.DOT) * usdToBase * 100) / 100,
        LINK: Math.round((cryptoData.chainlink?.usd || defaultCryptoPrices.LINK) * usdToBase * 100) / 100,
        UNI: Math.round((cryptoData.uniswap?.usd || defaultCryptoPrices.UNI) * usdToBase * 100) / 100,
        AAVE: Math.round((cryptoData.aave?.usd || defaultCryptoPrices.AAVE) * usdToBase * 100) / 100,
        USDC: Math.round((cryptoData['usd-coin']?.usd || defaultCryptoPrices.USDC) * usdToBase * 100) / 100,
        USDT: Math.round((cryptoData.tether?.usd || defaultCryptoPrices.USDT) * usdToBase * 100) / 100
      }
      setCryptoRates(cryptoPricesInGlobalCurrency)
    } catch (err) {
      console.debug('Crypto prices API error, using default prices:', err?.message || err)
      const usdToBase = (() => {
        const direct = exchangeRates[`USD_${baseCurrency}`]
        if (typeof direct === 'number' && direct > 0) return direct
        const rev = exchangeRates[`${baseCurrency}_USD`]
        if (typeof rev === 'number' && rev > 0) return 1 / rev
        return 1
      })()
      const defaults = {}
      Object.entries(defaultCryptoPrices).forEach(([key, value]) => {
        defaults[key] = Math.round(value * usdToBase * 100) / 100
      })
      setCryptoRates(defaults)
    }
  }

  const getRate = (from, to) => {
    if (from === to) return 1
    const key = `${from}_${to}`
    const direct = exchangeRates[key]
    if (typeof direct === 'number') return direct

    // Try compute via USD if possible: rate from->to = (USD->to) / (USD->from)
    const usdToFrom = exchangeRates[`USD_${from}`]
    const usdToTo = exchangeRates[`USD_${to}`]
    if (typeof usdToFrom === 'number' && typeof usdToTo === 'number' && usdToFrom > 0) {
      return usdToTo / usdToFrom
    }

    // Try reverse pair if stored
    const reverse = exchangeRates[`${to}_${from}`]
    if (typeof reverse === 'number' && reverse > 0) return 1 / reverse

    // Not available
    return null
  }

  // UI state for stacked fiat + crypto view
  const [viewMode, setViewMode] = useState('fiat') // controls the right-side list
  const [search, setSearch] = useState('')
  const [selectedFiat, setSelectedFiat] = useState(null)
  const [selectedCrypto, setSelectedCrypto] = useState(null)

  useEffect(() => {
    // ensure allCurrencies has sensible entries and PHP is first
    const apiCurrencies = (currencyAPI && typeof currencyAPI.getCurrencies === 'function') ? currencyAPI.getCurrencies() : []
    let merged = []
    try {
      merged = Array.isArray(apiCurrencies) && apiCurrencies.length ? apiCurrencies.slice() : []
    } catch (e) { merged = [] }

    // ensure fallback entries present
    fallbackFiats.forEach(f => {
      if (!merged.find(m => m.code === f.code)) merged.push(f)
    })

    // move PHP to the front
    merged = merged.sort((a, b) => (a.code === baseCurrency ? -1 : b.code === baseCurrency ? 1 : 0))
    setAllCurrencies(merged)

    // sensible defaults after rates load
    if (!loading) {
      if (!selectedFiat) {
        // prefer PHP as default fiat
        const php = merged.find(c => c.code === baseCurrency) || merged[0]
        if (php) setSelectedFiat({ code: php.code, name: php.name })
      }
      if (!selectedCrypto) {
        setSelectedCrypto({ code: 'BTC', name: 'Bitcoin' })
      }
    }
  }, [loading, /* intentionally not depending on allCurrencies */ selectedFiat, selectedCrypto, globalCurrency])

  const listItems = () => {
    if (viewMode === 'fiat') {
      return (allCurrencies || []).map(c => ({ type: 'fiat', code: c.code, name: c.name }))
    }
    return cryptos.map(c => ({ type: 'crypto', code: c, name: c }))
  }

  const filtered = listItems().filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return item.code.toLowerCase().includes(s) || item.name.toLowerCase().includes(s)
  })

  const onSelect = (item) => {
    if (item.type === 'fiat') setSelectedFiat({ code: item.code, name: item.name })
    else setSelectedCrypto({ code: item.code, name: item.name })
  }

  const next = (type) => {
    const items = type === 'fiat'
      ? allCurrencies.filter(c => c.code !== globalCurrency).map(c => ({ code: c.code, name: c.name }))
      : cryptos.map(c => ({ code: c, name: c }))

    if (type === 'fiat') {
      if (!selectedFiat || items.length === 0) return
      const idx = items.findIndex(i => i.code === selectedFiat.code)
      const nextIdx = (idx + 1) % items.length
      setSelectedFiat({ code: items[nextIdx].code, name: items[nextIdx].name })
    } else {
      if (!selectedCrypto || items.length === 0) return
      const idx = items.findIndex(i => i.code === selectedCrypto.code)
      const nextIdx = (idx + 1) % items.length
      setSelectedCrypto({ code: items[nextIdx].code, name: items[nextIdx].name })
    }
  }

  const prev = (type) => {
    const items = type === 'fiat'
      ? allCurrencies.filter(c => c.code !== globalCurrency).map(c => ({ code: c.code, name: c.name }))
      : cryptos.map(c => ({ code: c, name: c }))

    if (type === 'fiat') {
      if (!selectedFiat || items.length === 0) return
      const idx = items.findIndex(i => i.code === selectedFiat.code)
      const prevIdx = (idx - 1 + items.length) % items.length
      setSelectedFiat({ code: items[prevIdx].code, name: items[prevIdx].name })
    } else {
      if (!selectedCrypto || items.length === 0) return
      const idx = items.findIndex(i => i.code === selectedCrypto.code)
      const prevIdx = (idx - 1 + items.length) % items.length
      setSelectedCrypto({ code: items[prevIdx].code, name: items[prevIdx].name })
    }
  }

  const renderFiatCard = (isPrimary) => {
    if (!selectedFiat) return null
    const rate = getRate(baseCurrency, selectedFiat.code)
    return (
      <div className={`rounded-lg p-6 border w-full ${isPrimary ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedFiat.code}</h3>
            <p className="text-xs text-slate-500">{selectedFiat.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-slate-900">{rate != null ? rate.toFixed(4) : '—'}</div>
            <div className="text-xs text-slate-500">1 {baseCurrency}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => prev('fiat')} className="px-3 py-2 bg-white border rounded">Prev</button>
          <button onClick={() => next('fiat')} className="px-3 py-2 bg-white border rounded">Next</button>
        </div>
      </div>
    )
  }

  const [fiatInput, setFiatInput] = useState('')
  const [cryptoInput, setCryptoInput] = useState('')

  const formatNumber = (v, decimals = 2) => {
    if (v == null || Number.isNaN(Number(v))) return '—'
    try {
      return Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    } catch (e) {
      return Number(v).toFixed(decimals)
    }
  }

  const onChangeFiat = (val) => {
    // accept empty input
    if (val === '' || val === null) {
      setFiatInput('')
      setCryptoInput('')
      return
    }

    // keep raw input as user types
    setFiatInput(val)
    const num = parseFloat(val)
    if (isNaN(num) || !selectedFiat || !selectedCrypto) {
      setCryptoInput('')
      return
    }
    const rate = getRate(baseCurrency, selectedFiat.code) // 1 global = rate selected
    const cryptoPrice = cryptoRates[selectedCrypto.code] || (defaultCryptoPrices[selectedCrypto.code] * (resolveUsdToBase() || 1))
    if (!rate || !cryptoPrice) {
      setCryptoInput('')
      return
    }
    // selected -> global: global = selected / rate
    const globalAmount = num / rate
    const cryptoAmount = globalAmount / cryptoPrice
    // set formatted value with sensible precision for crypto
    setCryptoInput(isFinite(cryptoAmount) ? Number(cryptoAmount).toFixed(8) : '')
  }

  const onChangeCrypto = (val) => {
    if (val === '' || val === null) {
      setCryptoInput('')
      setFiatInput('')
      return
    }

    setCryptoInput(val)
    const num = parseFloat(val)
    if (isNaN(num) || !selectedFiat || !selectedCrypto) {
      setFiatInput('')
      return
    }
    const rate = getRate(baseCurrency, selectedFiat.code)
    const cryptoPrice = cryptoRates[selectedCrypto.code] || (defaultCryptoPrices[selectedCrypto.code] * (resolveUsdToBase() || 1))
    if (!rate || !cryptoPrice) {
      setFiatInput('')
      return
    }
    // crypto -> global
    const globalAmount = num * cryptoPrice
    // global -> selected: selected = global * rate
    const selectedAmount = globalAmount * rate
    setFiatInput(isFinite(selectedAmount) ? Number(selectedAmount).toFixed(2) : '')
  }

  const renderCryptoCard = (isPrimary) => {
    if (!selectedCrypto) return null
    const basePrice = cryptoRates[selectedCrypto.code] || (defaultCryptoPrices[selectedCrypto.code] * (resolveUsdToBase() || 1))
    const fiatMultiplier = selectedFiat ? (getRate(baseCurrency, selectedFiat.code) || null) : null
    const price = (basePrice != null && fiatMultiplier != null) ? (basePrice * fiatMultiplier) : (fiatMultiplier == null ? basePrice : null)
    return (
      <div className={`rounded-lg p-6 border w-full ${isPrimary ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedCrypto.code}</h3>
            <p className="text-xs text-slate-500">{selectedCrypto.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-orange-700">{price ? (typeof price === 'number' ? price.toFixed(2) : '—') : '—'}</div>
            <div className="text-xs text-slate-500">{selectedFiat ? selectedFiat.code : baseCurrency} per {selectedCrypto.code}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => prev('crypto')} className="px-3 py-2 bg-white border rounded">Prev</button>
          <button onClick={() => next('crypto')} className="px-3 py-2 bg-white border rounded">Next</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-light text-slate-900">Exchange Rates</h2>
        <div className="text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</div>
      </div>

      <div className="flex gap-6">
        {/* Left: stacked selected cards */}
        <div className="flex-1">
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Always show fiat on top, crypto below */}
              {renderFiatCard(true)}
              {renderCryptoCard(false)}

              {/* Calculator: convert between selected fiat and selected crypto */}
              <div className="bg-white rounded-lg p-4 border border-slate-100 w-full mt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Quick Converter</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">{selectedFiat ? selectedFiat.code : 'Fiat'} amount</label>
                    <input
                      type="number"
                      step="any"
                      value={fiatInput}
                      onChange={(e) => onChangeFiat(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded"
                      placeholder="0.00"
                      disabled={!selectedFiat || !selectedCrypto || getRate(baseCurrency, selectedFiat ? selectedFiat.code : '') == null}
                    />
                    <p className="text-xs text-slate-400 mt-1">Convert {selectedFiat ? selectedFiat.code : '—'} → {selectedCrypto ? selectedCrypto.code : '—'}</p>
                    {cryptoInput !== '' && (
                      <p className="text-xs text-slate-400 mt-1">= {formatNumber(cryptoInput, 8)} {selectedCrypto.code}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">{selectedCrypto ? selectedCrypto.code : 'Crypto'} amount</label>
                    <input
                      type="number"
                      step="any"
                      value={cryptoInput}
                      onChange={(e) => onChangeCrypto(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded"
                      placeholder="0.00"
                      disabled={!selectedFiat || !selectedCrypto || cryptoRates[selectedCrypto ? selectedCrypto.code : ''] == null}
                    />
                    <p className="text-xs text-slate-400 mt-1">Convert {selectedCrypto ? selectedCrypto.code : '—'} → {selectedFiat ? selectedFiat.code : '—'}</p>
                    {fiatInput !== '' && (
                      <p className="text-xs text-slate-400 mt-1">= {formatNumber(fiatInput, 2)} {selectedFiat.code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Dropdown search list */}
        <div className="w-full sm:w-80 border border-slate-100 rounded-lg p-3">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setViewMode('fiat')} className={`flex-1 py-2 rounded ${viewMode === 'fiat' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Fiat</button>
            <button onClick={() => setViewMode('crypto')} className={`flex-1 py-2 rounded ${viewMode === 'crypto' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Crypto</button>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code or name"
            className="w-full px-3 py-2 border rounded mb-3 text-sm"
          />

          <div className="h-72 overflow-auto">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-500">No results</div>
            ) : (
              filtered.map(item => (
                <div key={`${item.type}-${item.code}`} onClick={() => onSelect(item)} className={`p-2 rounded cursor-pointer hover:bg-slate-50 flex items-center justify-between ${item.type === 'fiat' ? (selectedFiat && selectedFiat.code === item.code ? 'bg-slate-100' : '') : (selectedCrypto && selectedCrypto.code === item.code ? 'bg-slate-100' : '')}`}>
                  <div>
                    <div className="font-medium">{item.code}</div>
                    <div className="text-xs text-slate-500">{item.name}</div>
                  </div>
                  <div className="text-sm text-slate-600">
                    {item.type === 'fiat' ? (
                      (() => {
                        // Prefer USD -> CODE if present in currency_rates
                        const usdPair = exchangeRates[`USD_${item.code}`]
                        if (typeof usdPair === 'number') return usdPair.toFixed(6)
                        // Try direct pair baseCurrency -> code
                        const direct = getRate(baseCurrency, item.code)
                        if (typeof direct === 'number') return direct.toFixed(6)
                        // Try reverse (code -> baseCurrency)
                        const reverse = exchangeRates[`${item.code}_${baseCurrency}`]
                        if (typeof reverse === 'number' && reverse > 0) return (1 / reverse).toFixed(6)
                        return '—'
                      })()
                    ) : (
                      (() => {
                        // For crypto, show USD price if available (cryptoRates uses USD->price converted to baseCurrency earlier)
                        const p = cryptoRates[item.code]
                        if (typeof p === 'number') return p.toFixed(2)
                        // fallback: show USD per unit if present in currency_rates as USD_BASE then compute
                        const usdToBase = exchangeRates[`USD_${baseCurrency}`] || 1
                        const defaultPrice = defaultCryptoPrices[item.code]
                        return defaultPrice ? (defaultPrice * (usdToBase || 1)).toFixed(2) : '—'
                      })()
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
