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
  const cryptos = ['BTC', 'ETH', 'LTC', 'DOGE', 'XRP', 'ADA', 'SOL', 'AVAX', 'MATIC', 'DOT', 'LINK', 'UNI', 'AAVE', 'USDC', 'USDT']

  // Helper to get currency name from code
  const getCurrencyName = (code) => {
    const currencies = allCurrencies || []
    const found = currencies.find(c => c.code === code)
    return found ? found.name : code
  }

  // Helper: Get crypto-fiat rate directly from currency_rates table, or compute if needed
  const getCryptoFiatRate = (cryptoCode, fiatCode) => {
    if (!cryptoCode || !fiatCode) return null

    // Try direct pair first (e.g., BTC_PHP)
    const direct = exchangeRates[`${cryptoCode}_${fiatCode}`]
    if (typeof direct === 'number' && isFinite(direct)) return direct

    // Try reverse pair (e.g., PHP_BTC) and invert
    const reverse = exchangeRates[`${fiatCode}_${cryptoCode}`]
    if (typeof reverse === 'number' && reverse > 0) return 1 / reverse

    // Fallback: compute via base currency or USD
    const cryptoPriceInBase = cryptoRates[cryptoCode]
    if (typeof cryptoPriceInBase === 'number' && cryptoPriceInBase > 0) {
      if (fiatCode === baseCurrency) return cryptoPriceInBase
      const baseToFiat = getPairRate(baseCurrency, fiatCode)
      if (typeof baseToFiat === 'number') return cryptoPriceInBase * baseToFiat
    }

    return null
  }

  const resolveUsdToBase = () => {
    const direct = exchangeRates && exchangeRates[`USD_${baseCurrency}`]
    if (typeof direct === 'number' && direct > 0) return direct
    const rev = exchangeRates && exchangeRates[`${baseCurrency}_USD`]
    if (typeof rev === 'number' && rev > 0) return 1 / rev
    return null
  }

  // Fetch all fiat currencies from currency_rates table
  const fetchFiatsFromDatabase = async () => {
    const { data: rates, error } = await supabase
      .from('currency_rates')
      .select('from_currency,to_currency')

    if (error || !Array.isArray(rates) || rates.length === 0) {
      return []
    }

    // Extract unique currency codes
    const currencySet = new Set()
    rates.forEach(r => {
      if (r.from_currency && !cryptos.includes(r.from_currency)) {
        currencySet.add(r.from_currency)
      }
      if (r.to_currency && !cryptos.includes(r.to_currency)) {
        currencySet.add(r.to_currency)
      }
    })

    // Convert to array of currency objects
    return Array.from(currencySet)
      .map(code => ({ code, name: code }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }

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
      // Fetch currencies from the database
      const dbCurrencies = await fetchFiatsFromDatabase()
      setAllCurrencies(dbCurrencies)

      const ratesMap = {}

      // 0) Prefer Supabase currency_rates first (fast and authoritative). If not available, fall back to edge function and external APIs.
      try {
        const { data: dbRates, error: dbErr } = await supabase.from('currency_rates').select('from_currency,to_currency,rate')
        if (!dbErr && Array.isArray(dbRates) && dbRates.length) {
          dbRates.forEach(r => {
            if (r && r.from_currency && r.to_currency && r.rate != null) {
              ratesMap[`${r.from_currency}_${r.to_currency}`] = Number(r.rate)
            }
          })
          setExchangeRates(ratesMap)
          return
        }
      } catch (dbReadErr) {
        console.debug('Could not read currency_rates from Supabase (initial attempt):', dbReadErr)
      }

      // If DB had no data, fall back to fetch-rates edge function (proxy to trusted sources)
      try {
        const supabaseUrl = import.meta.env.VITE_PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        const resp = await fetchWithRetries(
          `${supabaseUrl}/functions/v1/fetch-rates`,
          { headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' } },
          1,
          300,
          4000
        )
        if (resp && (resp.rates || resp.exchangeRates || resp.currencyRates)) {
          const list = resp.rates || resp.exchangeRates || resp.currencyRates
          // accept array or object
          if (Array.isArray(list)) {
            list.forEach(r => {
              if (r && (r.from_currency || r.from) && (r.to_currency || r.to) && r.rate != null) {
                const from = r.from_currency || r.from
                const to = r.to_currency || r.to
                ratesMap[`${from}_${to}`] = Number(r.rate)
              }
            })
          } else if (typeof list === 'object') {
            Object.keys(list).forEach(k => { ratesMap[k] = Number(list[k]) })
          }
          if (Object.keys(ratesMap).length) {
            setExchangeRates(ratesMap)
            return
          }
        }
      } catch (edgeErr) {
        // ignore and continue to other fallbacks
        console.debug('fetch-rates edge function call failed or returned no rates:', edgeErr)
      }

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

      // No external fallback: rely only on DB tables (currency_rates, cached_rates, legacy) populated by backend jobs.
      // If we've reached here and ratesMap is still empty, set empty rates so UI shows missing values rather than calling external services.
      if (Object.keys(ratesMap).length === 0) {
        console.debug('No fiat pairs found in DB tables; exchangeRates will be empty. Ensure currency_rates table is populated.')
        setExchangeRates(ratesMap)
        return
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
      // First: try reading cached cryptocurrency_rates from Supabase to avoid external calls
      try {
        const { data: dbCrypto, error: dbCryptoErr } = await supabase.from('cryptocurrency_rates').select('currency_code,rate')
        if (!dbCryptoErr && Array.isArray(dbCrypto) && dbCrypto.length) {
          const map = {}
          dbCrypto.forEach(r => { if (r && r.currency_code && r.rate != null) map[r.currency_code.toUpperCase()] = Number(r.rate) })
          if (Object.keys(map).length) {
            setCryptoRates(map)
            return
          }
        }
      } catch (dbErr) {
        console.debug('Could not read cryptocurrency_rates from Supabase (initial):', dbErr)
      }

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
  const [selectedFiat, setSelectedFiat] = useState(() => {
    return { code: baseCurrency, name: baseCurrency }
  })
  const [selectedCrypto, setSelectedCrypto] = useState(() => ({ code: 'BTC', name: 'Bitcoin' }))

  useEffect(() => {
    // Ensure PHP is first in the list
    if (allCurrencies && allCurrencies.length > 0) {
      let sorted = [...allCurrencies]
      const phpIndex = sorted.findIndex(c => c.code === baseCurrency)
      if (phpIndex > 0) {
        const php = sorted.splice(phpIndex, 1)[0]
        sorted.unshift(php)
        setAllCurrencies(sorted)
      }
    }

    // Set sensible defaults after rates load
    if (!loading) {
      if (!selectedFiat && allCurrencies && allCurrencies.length > 0) {
        const php = allCurrencies.find(c => c.code === baseCurrency) || allCurrencies[0]
        if (php) setSelectedFiat({ code: php.code, name: php.name })
      }
      if (!selectedCrypto) {
        setSelectedCrypto({ code: 'BTC', name: 'Bitcoin' })
      }
    }
  }, [loading, allCurrencies, selectedFiat, selectedCrypto, globalCurrency])

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
    const isBase = selectedFiat.code === baseCurrency
    const displayPrice = isBase ? 1 : getPairRate(selectedFiat.code, baseCurrency)
    const pairKey = isBase ? `${baseCurrency}_${baseCurrency}` : `${selectedFiat.code}_${baseCurrency}`

    return (
      <div
        className={`rounded-lg p-6 border w-full relative group ${isPrimary ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}
        title={`Pair: ${pairKey}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedFiat.code}</h3>
            <p className="text-xs text-slate-500">{selectedFiat.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-slate-900">{typeof displayPrice === 'number' ? (displayPrice === 1 && isBase ? '1' : displayPrice.toFixed(2)) : '—'}</div>
            <div className="text-xs text-slate-500">{isBase ? `1 ${baseCurrency}` : `1 ${selectedFiat.code} = ${displayPrice ? displayPrice.toFixed(2) : '—'} ${baseCurrency}`}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => prev('fiat')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Prev</button>
          <button onClick={() => next('fiat')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Next</button>
        </div>

        {/* Hover tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
          Pair: {pairKey}
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

  // Helper: compute rate from 'from' currency to 'to' currency using exchangeRates map
  const getPairRate = (from, to) => {
    if (!from || !to) return null
    if (from === to) return null
    // direct
    const direct = exchangeRates[`${from}_${to}`]
    if (typeof direct === 'number' && isFinite(direct)) return direct
    // try via USD
    const usdToFrom = exchangeRates[`USD_${from}`]
    const usdToTo = exchangeRates[`USD_${to}`]
    if (typeof usdToFrom === 'number' && typeof usdToTo === 'number' && usdToFrom > 0) {
      const computed = usdToTo / usdToFrom
      if (isFinite(computed)) return computed
    }
    // try via baseCurrency
    const baseToFrom = exchangeRates[`${baseCurrency}_${from}`]
    const baseToTo = exchangeRates[`${baseCurrency}_${to}`]
    if (typeof baseToFrom === 'number' && typeof baseToTo === 'number' && baseToFrom > 0) {
      const computed = baseToTo / baseToFrom
      if (isFinite(computed)) return computed
    }
    // try reverse
    const rev = exchangeRates[`${to}_${from}`]
    if (typeof rev === 'number' && rev > 0) return 1 / rev
    return null
  }

  // helper: fallback crypto USD price from default map
  const cryptoUsdFallback = (code) => {
    const mapping = {
      BTC: defaultCryptoPrices.BTC,
      ETH: defaultCryptoPrices.ETH,
      LTC: defaultCryptoPrices.LTC,
      DOGE: defaultCryptoPrices.DOGE,
      XRP: defaultCryptoPrices.XRP,
      ADA: defaultCryptoPrices.ADA,
      SOL: defaultCryptoPrices.SOL,
      AVAX: defaultCryptoPrices.AVAX,
      MATIC: defaultCryptoPrices.MATIC,
      DOT: defaultCryptoPrices.DOT,
      LINK: defaultCryptoPrices.LINK,
      UNI: defaultCryptoPrices.UNI,
      AAVE: defaultCryptoPrices.AAVE,
      USDC: defaultCryptoPrices.USDC,
      USDT: defaultCryptoPrices.USDT
    }
    return mapping[code] || null
  }

  // Helper: get pair key for list items
  const getListItemPair = (item) => {
    if (item.type === 'fiat') {
      if (!selectedFiat) return null
      const from = selectedFiat.code
      if (from === item.code) {
        return from === baseCurrency ? `${baseCurrency}_${baseCurrency}` : `${from}_${baseCurrency}`
      }
      return `${from}_${item.code}`
    } else {
      // crypto item
      if (viewMode === 'crypto') {
        if (!selectedCrypto) return null
        if (selectedCrypto.code === item.code) return null
        return `${selectedCrypto.code}_${item.code}`
      }
      // fiat mode
      const selectedFiatCode = selectedFiat ? selectedFiat.code : baseCurrency
      return `${item.code}_${selectedFiatCode}`
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

    // Get direct rate from database or compute
    const cryptoToFiat = getCryptoFiatRate(selectedCrypto.code, selectedFiat.code)
    if (!cryptoToFiat) {
      setCryptoInput('')
      return
    }

    // fiat amount / crypto price per fiat = crypto amount
    const cryptoAmount = num / cryptoToFiat
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
    const selectedFiatCode = selectedFiat ? selectedFiat.code : baseCurrency
    const price = getCryptoFiatRate(selectedCrypto.code, selectedFiatCode)
    const pairKey = `${selectedCrypto.code}_${selectedFiatCode}`

    return (
      <div
        className={`rounded-lg p-6 border w-full relative group ${isPrimary ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}
        title={`Pair: ${pairKey}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedCrypto.code}</h3>
            <p className="text-xs text-slate-500">{selectedCrypto.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-orange-700">{price ? (typeof price === 'number' ? formatNumber(price, 2) : '—') : '—'}</div>
            <div className="text-xs text-slate-500">{selectedFiatCode} per {selectedCrypto.code}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => prev('crypto')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Prev</button>
          <button onClick={() => next('crypto')} className="px-3 py-2 bg-white border rounded hover:bg-slate-100">Next</button>
        </div>

        {/* Hover tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
          Pair: {pairKey}
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
              filtered.map(item => {
                const pairKey = getListItemPair(item)
                return (
                  <div
                    key={`${item.type}-${item.code}`}
                    onClick={() => onSelect(item)}
                    className={`p-2 rounded cursor-pointer hover:bg-slate-50 flex items-center justify-between relative group ${item.type === 'fiat' ? (selectedFiat && selectedFiat.code === item.code ? 'bg-slate-100' : '') : (selectedCrypto && selectedCrypto.code === item.code ? 'bg-slate-100' : '')}`}
                    title={pairKey ? `Pair: ${pairKey}` : undefined}
                  >
                    <div>
                      <div className="font-medium">{item.code}</div>
                      <div className="text-xs text-slate-500">{item.name}</div>
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.type === 'fiat' ? (
                        (() => {
                          // If selectedFiat is set, compute selectedFiat -> item (show how many item per 1 selectedFiat)
                          if (!selectedFiat) return '—'
                          const from = selectedFiat.code
                          let pair = null
                          if (from === item.code) {
                            // for self, show selected -> baseCurrency (e.g. 1 USD = 58.97 PHP), unless base is the selected (1)
                            if (from === baseCurrency) return (1).toFixed(2)
                            pair = getPairRate(from, baseCurrency)
                          } else {
                            pair = getPairRate(from, item.code)
                          }
                          return (typeof pair === 'number' ? pair.toFixed(2) : '—')
                        })()
                      ) : (
                        (() => {
                          // Crypto rows: behavior depends on viewMode
                          if (viewMode === 'crypto') {
                            // show pair rate between selectedCrypto and this crypto
                            if (!selectedCrypto) return '—'
                            if (selectedCrypto.code === item.code) return '—'
                            const a = cryptoRates[selectedCrypto.code]
                            const b = cryptoRates[item.code]
                            if (typeof a === 'number' && typeof b === 'number' && a > 0) {
                              const rate = b / a // item per selectedCrypto
                              return isFinite(rate) ? rate.toFixed(6) : '—'
                            }
                            return '—'
                          }

                          // viewMode === 'fiat' -> show crypto price in selected fiat
                          if (!selectedFiat) return '—'

                          const cryptoPriceInBase = cryptoRates[item.code]
                          if (typeof cryptoPriceInBase === 'number') {
                            const baseToSelected = getPairRate(baseCurrency, selectedFiat.code) || getRate(baseCurrency, selectedFiat.code)
                            if (typeof baseToSelected === 'number') return (cryptoPriceInBase * baseToSelected).toFixed(2)
                          }

                          // fallback: attempt to compute via USD
                          const usdToSelected = getPairRate('USD', selectedFiat.code)
                          const cgUsd = cryptoUsdFallback(item.code)
                          if (typeof cgUsd === 'number' && typeof usdToSelected === 'number') return (cgUsd * usdToSelected).toFixed(2)

                          return '—'
                        })()
                      )}
                    </div>

                    {pairKey && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                        Pair: {pairKey}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>


    </div>
  )
}
