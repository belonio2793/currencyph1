import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'
import { currencyAPI } from '../lib/currencyAPI'
import { supabase } from '../lib/supabaseClient'

export default function Rates({ globalCurrency }) {
  const [exchangeRates, setExchangeRates] = useState({})
  const [cryptoRates, setCryptoRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [allCurrencies, setAllCurrencies] = useState([])

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
    const interval = setInterval(loadRates, 60000)

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

      const rates = await wisegcashAPI.getAllExchangeRates()
      const ratesMap = {}

      if (rates && rates.length > 0) {
        rates.forEach(r => {
          ratesMap[`${r.from_currency}_${r.to_currency}`] = r.rate
        })
        setExchangeRates(ratesMap)
      } else {
        // If DB has no rates, fetch from external currency API and build pairs
        try {
          const globalRates = await currencyAPI.getGlobalRates()
          if (!globalRates || typeof globalRates !== 'object') {
            console.debug('Invalid rates format, using empty rates')
            setExchangeRates(ratesMap)
            return
          }
          // globalRates: { CODE: { rate: <number> } } where rate is USD -> CODE
          const codes = Object.keys(globalRates)
          codes.forEach(code => {
            const rateObj = globalRates[code]
            const rate = rateObj?.rate || 0
            if (rate > 0) {
              // USD -> CODE
              ratesMap[`USD_${code}`] = rate
            }
          })
          // Build pairwise rates: from A to B = (USD->B) / (USD->A)
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
        console.debug(`fetchWithRetries attempt ${i + 1} failed for ${url}:`, err?.message || err)
        if (i < retries) {
          await new Promise(r => setTimeout(r, backoff * (i + 1)))
        }
      }
    }
    console.debug(`Fetch failed after ${retries + 1} attempts for ${url}:`, lastErr?.message || lastErr)
    return null
  }

  const loadCryptoPrices = async () => {
    try {
      // Use edge function to proxy API calls (avoids CORS issues)
      const supabaseUrl = import.meta.env.VITE_PROJECT_URL || 'https://corcofbmafdxehvlbesx.supabase.co'
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDI5NjYsImV4cCI6MjA3NzAxODk2Nn0.F0CvLIJjN-eifHDrQGGNIj2R3az1j6MyuyOKRJwehKU'

      const data = await fetchWithRetries(
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

      if (!data || !data.cryptoPrices) {
        console.debug('Fetch rates endpoint unavailable, attempting CoinGecko fallback')
        // Try direct CoinGecko public API as a fallback
        try {
          const ids = [
            'bitcoin','ethereum','litecoin','dogecoin','ripple','cardano','solana','avalanche-2','matic-network','polkadot','chainlink','uniswap','aave','usd-coin','tether'
          ].join(',')
          const cg = await fetchWithRetries(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, { }, 2, 500)
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
        } catch (cgErr) {
          console.debug('CoinGecko fallback failed, using defaults:', cgErr)
          const globalExchangeRate = exchangeRates[`USD_${globalCurrency}`] || 1
          const defaults = {}
          Object.entries(defaultCryptoPrices).forEach(([key, value]) => {
            defaults[key] = Math.round(value * globalExchangeRate * 100) / 100
          })
          setCryptoRates(defaults)
          return
        }
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
      console.debug('Crypto prices API error, using default prices:', err?.message || err)
      const globalExchangeRate = exchangeRates[`USD_${globalCurrency}`] || 1
      const defaults = {}
      Object.entries(defaultCryptoPrices).forEach(([key, value]) => {
        defaults[key] = Math.round(value * globalExchangeRate * 100) / 100
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
    // sensible defaults after rates load
    if (!loading) {
      if (!selectedFiat && allCurrencies && allCurrencies.length) {
        const php = allCurrencies.find(c => c.code === 'PHP')
        const first = php || allCurrencies.find(c => c.code !== globalCurrency) || allCurrencies[0]
        setSelectedFiat({ code: first.code, name: first.name })
      }
      if (!selectedCrypto) {
        setSelectedCrypto({ code: 'BTC', name: 'Bitcoin' })
      }
    }
  }, [loading, allCurrencies, selectedFiat, selectedCrypto, globalCurrency])

  const listItems = () => {
    if (viewMode === 'fiat') {
      return allCurrencies.filter(c => c.code !== globalCurrency).map(c => ({ type: 'fiat', code: c.code, name: c.name }))
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
    const rate = getRate(globalCurrency, selectedFiat.code)
    return (
      <div className={`rounded-lg p-6 border w-full ${isPrimary ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedFiat.code}</h3>
            <p className="text-xs text-slate-500">{selectedFiat.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-slate-900">{rate != null ? rate.toFixed(4) : '—'}</div>
            <div className="text-xs text-slate-500">1 {globalCurrency}</div>
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
    const rate = getRate(globalCurrency, selectedFiat.code) // 1 global = rate selected
    const cryptoPrice = cryptoRates[selectedCrypto.code] || (defaultCryptoPrices[selectedCrypto.code] * (exchangeRates[`USD_${globalCurrency}`] || 1))
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
    const rate = getRate(globalCurrency, selectedFiat.code)
    const cryptoPrice = cryptoRates[selectedCrypto.code] || (defaultCryptoPrices[selectedCrypto.code] * (exchangeRates[`USD_${globalCurrency}`] || 1))
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
    const price = cryptoRates[selectedCrypto.code] || defaultCryptoPrices[selectedCrypto.code] * (exchangeRates[`USD_${globalCurrency}`] || 1)
    return (
      <div className={`rounded-lg p-6 border w-full ${isPrimary ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">{selectedCrypto.code}</h3>
            <p className="text-xs text-slate-500">{selectedCrypto.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-light text-orange-700">{price ? price.toFixed(2) : '—'}</div>
            <div className="text-xs text-slate-500">{globalCurrency} per {selectedCrypto.code}</div>
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
                      disabled={!selectedFiat || !selectedCrypto || getRate(globalCurrency, selectedFiat ? selectedFiat.code : '') == null}
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
                      (() => { const r = getRate(globalCurrency, item.code); return r != null ? r.toFixed(4) : '—' })()
                    ) : (
                      (() => { const p = cryptoRates[item.code] || defaultCryptoPrices[item.code] * (exchangeRates[`USD_${globalCurrency}`] || 1); return p ? p.toFixed(2) : '—' })()
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
