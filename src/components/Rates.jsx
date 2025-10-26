import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'
import { currencyAPI } from '../lib/currencyAPI'

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
    return () => clearInterval(interval)
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
      rates.forEach(r => {
        ratesMap[`${r.from_currency}_${r.to_currency}`] = r.rate
      })
      setExchangeRates(ratesMap)
    } catch (err) {
      console.error('Error loading exchange rates:', err)
    }
  }

  const loadCryptoPrices = async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,dogecoin,ripple,cardano,solana,avalanche-2,matic-network,polkadot,chainlink,uniswap,aave,usd-coin,tether&vs_currencies=usd'
      )
      if (!response.ok) throw new Error('Failed to fetch crypto prices')

      const data = await response.json()
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
    const key = `${from}_${to}`
    return exchangeRates[key] || 1
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
