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
      console.error('Error loading rates:', err)
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
      } else {
        // If DB has no rates, fetch from external currency API and build pairs
        const globalRates = await currencyAPI.getGlobalRates()
        // globalRates: { CODE: { rate: <number> } } where rate is USD -> CODE
        const codes = Object.keys(globalRates)
        codes.forEach(code => {
          const usdToCode = globalRates[code].rate || 0
          // USD -> CODE
          ratesMap[`USD_${code}`] = usdToCode
        })
        // Build pairwise rates: from A to B = (USD->B) / (USD->A)
        codes.forEach(from => {
          codes.forEach(to => {
            if (from === to) return
            const usdToFrom = globalRates[from].rate || 0
            const usdToTo = globalRates[to].rate || 0
            if (usdToFrom > 0 && usdToTo > 0) {
              ratesMap[`${from}_${to}`] = usdToTo / usdToFrom
            }
          })
        })
      }

      setExchangeRates(ratesMap)
    } catch (err) {
      console.error('Error loading exchange rates:', err)
    }
  }

  // Helper: fetch with retries
  const fetchWithRetries = async (url, options = {}, retries = 2, backoff = 500) => {
    let lastErr
    for (let i = 0; i <= retries; i++) {
      try {
        const resp = await fetch(url, options)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        return await resp.json()
      } catch (err) {
        lastErr = err
        if (i < retries) {
          await new Promise(r => setTimeout(r, backoff * (i + 1)))
        }
      }
    }
    throw lastErr
  }

  const loadCryptoPrices = async () => {
    try {
      const data = await fetchWithRetries(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,dogecoin,ripple,cardano,solana,avalanche-2,matic-network,polkadot,chainlink,uniswap,aave,usd-coin,tether&vs_currencies=usd',
        {},
        2,
        500
      )

      const globalExchangeRate = exchangeRates[`USD_${globalCurrency}`] || 1

      const cryptoPricesInGlobalCurrency = {
        BTC: Math.round(data.bitcoin.usd * globalExchangeRate * 100) / 100,
        ETH: Math.round(data.ethereum.usd * globalExchangeRate * 100) / 100,
        LTC: Math.round(data.litecoin.usd * globalExchangeRate * 100) / 100,
        DOGE: Math.round(data.dogecoin.usd * globalExchangeRate * 100) / 100,
        XRP: Math.round(data.ripple.usd * globalExchangeRate * 100) / 100,
        ADA: Math.round(data.cardano.usd * globalExchangeRate * 100) / 100,
        SOL: Math.round(data.solana.usd * globalExchangeRate * 100) / 100,
        AVAX: Math.round(data['avalanche-2'].usd * globalExchangeRate * 100) / 100,
        MATIC: Math.round(data['matic-network'].usd * globalExchangeRate * 100) / 100,
        DOT: Math.round(data.polkadot.usd * globalExchangeRate * 100) / 100,
        LINK: Math.round(data.chainlink.usd * globalExchangeRate * 100) / 100,
        UNI: Math.round(data.uniswap.usd * globalExchangeRate * 100) / 100,
        AAVE: Math.round(data.aave.usd * globalExchangeRate * 100) / 100,
        USDC: Math.round(data['usd-coin'].usd * globalExchangeRate * 100) / 100,
        USDT: Math.round(data.tether.usd * globalExchangeRate * 100) / 100
      }
      setCryptoRates(cryptoPricesInGlobalCurrency)
    } catch (err) {
      console.error('Error loading crypto prices:', err)
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
            </div>
          )}
        </div>

        {/* Right: Dropdown search list */}
        <div style={{ width: 320 }} className="border border-slate-100 rounded-lg p-3">
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
