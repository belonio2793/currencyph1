import React, { useState, useEffect } from 'react'
import { coinsPhApi } from '../../lib/coinsPhApi'
import { analyzeMarket, calculateAllIndicators } from '../../lib/technicalIndicators'
import { marketAnalysisStrategies } from '../../lib/tradingStrategies'

export default function MarketAnalysis({ userId }) {
  const [symbols, setSymbols] = useState(['BTCPHP', 'ETHPHP', 'SOLPHP'])
  const [analysis, setAnalysis] = useState({})
  const [loading, setLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCPHP')

  useEffect(() => {
    analyzeMarkets()
  }, [])

  const analyzeMarkets = async () => {
    try {
      setLoading(true)
      const results = {}

      for (const symbol of symbols) {
        try {
          const candles = await coinsPhApi.getKlines(symbol, '1h', 200)
          
          if (candles && candles.length > 0) {
            // Convert API format to analysis format
            const formatted = candles.map(c => ({
              open: parseFloat(c[1]),
              high: parseFloat(c[2]),
              low: parseFloat(c[3]),
              close: parseFloat(c[4]),
              volume: parseFloat(c[7])
            }))

            const marketAnalysis = analyzeMarket(formatted)
            const indicators = calculateAllIndicators(formatted)
            const directionAnalysis = marketAnalysisStrategies.analyzeMarketDirection(formatted)
            const volumeAnalysis = marketAnalysisStrategies.detectUnusualVolume(formatted)
            const srAnalysis = marketAnalysisStrategies.analyzeSupportResistance(formatted)

            results[symbol] = {
              analysis: marketAnalysis,
              indicators,
              direction: directionAnalysis,
              volume: volumeAnalysis,
              supportResistance: srAnalysis
            }
          }
        } catch (err) {
          console.error(`Failed to analyze ${symbol}:`, err)
        }
      }

      setAnalysis(results)
      setLoading(false)
    } catch (err) {
      console.error('Market analysis failed:', err)
      setLoading(false)
    }
  }

  const selectedData = analysis[selectedSymbol]

  return (
    <div className="space-y-6">
      {/* Symbol Selector */}
      <div className="flex gap-2 flex-wrap">
        {symbols.map(symbol => (
          <button
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedSymbol === symbol
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {symbol}
          </button>
        ))}
        <button
          onClick={analyzeMarkets}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <p className="text-center text-slate-600">Analyzing markets...</p>}

      {selectedData && (
        <div className="space-y-4">
          {/* Direction Analysis */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Market Direction</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-600">Current Price</p>
                <p className="text-2xl font-bold text-slate-900">
                  ₱{selectedData.direction.currentPrice?.toFixed(2) || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Direction</p>
                <p className={`text-2xl font-bold ${
                  selectedData.direction.direction === 'UP' ? 'text-green-600' :
                  selectedData.direction.direction === 'DOWN' ? 'text-red-600' :
                  'text-slate-600'
                }`}>
                  {selectedData.direction.direction === 'UP' ? '📈' : '📉'} {selectedData.direction.direction}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Change</p>
                <p className={`text-2xl font-bold ${selectedData.direction.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedData.direction.percentChange?.toFixed(3)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Trend</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedData.direction.trendStrength}
                </p>
              </div>
            </div>
          </div>

          {/* Technical Indicators */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Technical Indicators</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Moving Averages */}
              <div className="bg-white p-4 rounded border border-slate-200">
                <p className="font-bold text-slate-900 mb-2">Moving Averages</p>
                <div className="space-y-1 text-sm">
                  <p>SMA20: ₱{selectedData.indicators.sma20?.toFixed(2) || 'N/A'}</p>
                  <p>SMA50: ₱{selectedData.indicators.sma50?.toFixed(2) || 'N/A'}</p>
                  <p>SMA200: ₱{selectedData.indicators.sma200?.toFixed(2) || 'N/A'}</p>
                </div>
              </div>

              {/* RSI */}
              <div className="bg-white p-4 rounded border border-slate-200">
                <p className="font-bold text-slate-900 mb-2">RSI (14)</p>
                <p className="text-3xl font-bold mb-2">
                  {selectedData.indicators.rsi?.toFixed(1) || 'N/A'}
                </p>
                <div className="text-xs text-slate-600">
                  {selectedData.indicators.rsi > 70 && '🔴 OVERBOUGHT'}
                  {selectedData.indicators.rsi < 30 && '🟢 OVERSOLD'}
                  {selectedData.indicators.rsi >= 30 && selectedData.indicators.rsi <= 70 && '🟡 NEUTRAL'}
                </div>
              </div>

              {/* MACD */}
              <div className="bg-white p-4 rounded border border-slate-200">
                <p className="font-bold text-slate-900 mb-2">MACD</p>
                <div className="space-y-1 text-sm">
                  <p>Line: {selectedData.indicators.macd?.macdLine?.toFixed(5) || 'N/A'}</p>
                  <p>Signal: {selectedData.indicators.macd?.signal?.toFixed(5) || 'N/A'}</p>
                  <p className={`font-bold ${selectedData.indicators.macd?.histogram > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Hist: {selectedData.indicators.macd?.histogram?.toFixed(5) || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support & Resistance */}
          {selectedData.supportResistance && (
            <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Support & Resistance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-600">Resistance</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₱{selectedData.supportResistance.resistance?.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {selectedData.supportResistance.distance_to_resistance?.toFixed(0)} away
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600">Current Price</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ₱{selectedData.supportResistance.currentPrice?.toFixed(2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600">Support</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₱{selectedData.supportResistance.support?.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {selectedData.supportResistance.distance_to_support?.toFixed(0)} away
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Volume Analysis */}
          {selectedData.volume && (
            <div className={`p-6 rounded-lg border ${
              selectedData.volume.isUnusual 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Volume Analysis</h3>
              <p className="text-2xl font-bold mb-2">
                {selectedData.volume.volumeSpike?.toFixed(2)}x normal volume
              </p>
              <p className="text-slate-700">
                {selectedData.volume.volumeType} - Confidence: {(selectedData.volume.confidence * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
