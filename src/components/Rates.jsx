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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-light text-slate-900 tracking-tight">Exchange Rates</h2>
        <div className="text-xs text-slate-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-slate-500">Loading rates...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Fiat Currency Rates */}
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Fiat Currency Rates</h3>
            <p className="text-sm text-slate-600 mb-4">1 {globalCurrency} =</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCurrencies.map(curr => {
                if (curr.code === globalCurrency) return null
                const rate = getRate(globalCurrency, curr.code)
                return (
                  <div key={curr.code} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{curr.code}</span>
                      <span className="text-slate-600 font-light">{rate?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{curr.name}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cryptocurrency Rates */}
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Cryptocurrency Rates</h3>
            <p className="text-sm text-slate-600 mb-4">Current prices in {globalCurrency}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cryptos.map(crypto => {
                const price = cryptoRates[crypto] || defaultCryptoPrices[crypto] * (exchangeRates[`USD_${globalCurrency}`] || 1)
                return (
                  <div key={crypto} className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{crypto}</span>
                      <span className="text-orange-600 font-light">{price?.toFixed(2) || '0.00'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{globalCurrency} per {crypto}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
