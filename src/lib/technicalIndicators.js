/**
 * Technical Indicators Module
 * Calculates all trading indicators for analysis and signals
 */

// ==================== MOVING AVERAGES ====================

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(prices, period) {
  if (prices.length < period) return null
  
  const slice = prices.slice(-period)
  const sum = slice.reduce((a, b) => a + b, 0)
  return sum / period
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(prices, period, previousEMA = null) {
  if (prices.length < period) return null
  
  const multiplier = 2 / (period + 1)
  
  if (previousEMA === null) {
    // First EMA is SMA
    const slice = prices.slice(-period)
    const sum = slice.reduce((a, b) => a + b, 0)
    return sum / period
  }
  
  const currentPrice = prices[prices.length - 1]
  return (currentPrice - previousEMA) * multiplier + previousEMA
}

/**
 * Calculate all SMAs and EMAs for a price series
 */
export function calculateMovingAverages(closePrices) {
  return {
    sma20: calculateSMA(closePrices, 20),
    sma50: calculateSMA(closePrices, 50),
    sma200: calculateSMA(closePrices, 200),
    ema12: calculateEMA(closePrices, 12),
    ema26: calculateEMA(closePrices, 26)
  }
}

// ==================== MOMENTUM INDICATORS ====================

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(closePrices, period = 14) {
  if (closePrices.length < period + 1) return null
  
  const changes = []
  for (let i = 1; i < closePrices.length; i++) {
    changes.push(closePrices[i] - closePrices[i - 1])
  }
  
  let gains = 0
  let losses = 0
  
  // First average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i]
    } else {
      losses += Math.abs(changes[i])
    }
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  // Wilder's smoothing for subsequent values
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period
      avgLoss = (avgLoss * (period - 1)) / period
    } else {
      avgGain = (avgGain * (period - 1)) / period
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period
    }
  }
  
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))
  
  return Math.round(rsi * 100) / 100
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(closePrices) {
  if (closePrices.length < 26) return null
  
  const ema12 = calculateEMA(closePrices, 12)
  const ema26 = calculateEMA(closePrices, 26)
  
  if (!ema12 || !ema26) return null
  
  const macdLine = ema12 - ema26
  
  // Signal line is 9-period EMA of MACD line
  // For simplicity, use last 9 MACD values if available
  const macdSignal = calculateEMA([macdLine], 9) || macdLine
  const histogram = macdLine - macdSignal
  
  return {
    macdLine: Math.round(macdLine * 100000) / 100000,
    signal: Math.round(macdSignal * 100000) / 100000,
    histogram: Math.round(histogram * 100000) / 100000
  }
}

// ==================== VOLATILITY INDICATORS ====================

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(closePrices, period = 20, stdDev = 2) {
  if (closePrices.length < period) return null
  
  const sma = calculateSMA(closePrices, period)
  if (sma === null) return null
  
  const slice = closePrices.slice(-period)
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period
  const sd = Math.sqrt(variance)
  
  return {
    upper: Math.round((sma + stdDev * sd) * 100000) / 100000,
    middle: Math.round(sma * 100000) / 100000,
    lower: Math.round((sma - stdDev * sd) * 100000) / 100000
  }
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(high, low, close, period = 14) {
  if (high.length < period || low.length < period || close.length < period) return null
  
  const trueRanges = []
  
  for (let i = 1; i < close.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    )
    trueRanges.push(tr)
  }
  
  if (trueRanges.length < period) return null
  
  const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period
  return Math.round(atr * 100000) / 100000
}

// ==================== VOLUME INDICATORS ====================

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(closePrices, volumes) {
  if (closePrices.length !== volumes.length) return null
  if (closePrices.length < 2) return null
  
  let obv = 0
  
  for (let i = 0; i < closePrices.length; i++) {
    if (i === 0) {
      obv = volumes[i]
    } else if (closePrices[i] > closePrices[i - 1]) {
      obv += volumes[i]
    } else if (closePrices[i] < closePrices[i - 1]) {
      obv -= volumes[i]
    }
  }
  
  return obv
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(high, low, close, volume) {
  if (high.length !== low.length || low.length !== close.length || close.length !== volume.length) {
    return null
  }
  
  if (high.length < 1) return null
  
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < close.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3
    numerator += typicalPrice * volume[i]
    denominator += volume[i]
  }
  
  if (denominator === 0) return null
  
  return Math.round((numerator / denominator) * 100000) / 100000
}

// ==================== SUPPORT/RESISTANCE ====================

/**
 * Fibonacci Retracement Levels
 * @param high - Highest price in trend
 * @param low - Lowest price in trend
 */
export function calculateFibonacciLevels(high, low) {
  const difference = high - low
  
  return {
    level_0: Math.round(high * 100000) / 100000,
    level_236: Math.round((high - difference * 0.236) * 100000) / 100000,
    level_382: Math.round((high - difference * 0.382) * 100000) / 100000,
    level_500: Math.round((high - difference * 0.5) * 100000) / 100000,
    level_618: Math.round((high - difference * 0.618) * 100000) / 100000,
    level_786: Math.round((high - difference * 0.786) * 100000) / 100000,
    level_1000: Math.round(low * 100000) / 100000
  }
}

/**
 * Find support and resistance levels from price history
 */
export function findSupportResistance(closePrices, lookback = 20) {
  if (closePrices.length < lookback) return null
  
  const slice = closePrices.slice(-lookback)
  const high = Math.max(...slice)
  const low = Math.min(...slice)
  const recent = closePrices[closePrices.length - 1]
  
  return {
    resistance: high,
    support: low,
    currentPrice: recent,
    range: high - low,
    percentFromHigh: Math.round(((high - recent) / high) * 100 * 100) / 100,
    percentFromLow: Math.round(((recent - low) / low) * 100 * 100) / 100
  }
}

// ==================== CALCULATE ALL INDICATORS ====================

/**
 * Calculate all indicators for a candle/price point
 */
export function calculateAllIndicators(candles) {
  if (!candles || candles.length === 0) return null
  
  const closePrices = candles.map(c => parseFloat(c.close))
  const highPrices = candles.map(c => parseFloat(c.high))
  const lowPrices = candles.map(c => parseFloat(c.low))
  const volumes = candles.map(c => parseFloat(c.volume))
  
  const currentPrice = closePrices[closePrices.length - 1]
  const high = Math.max(...highPrices)
  const low = Math.min(...lowPrices)
  
  return {
    // Moving Averages
    ...calculateMovingAverages(closePrices),
    
    // Momentum
    rsi: calculateRSI(closePrices, 14),
    macd: calculateMACD(closePrices),
    
    // Volatility
    bollingerBands: calculateBollingerBands(closePrices, 20),
    atr: calculateATR(highPrices, lowPrices, closePrices, 14),
    
    // Volume
    obv: calculateOBV(closePrices, volumes),
    vwap: calculateVWAP(highPrices, lowPrices, closePrices, volumes),
    
    // Support/Resistance
    supportResistance: findSupportResistance(closePrices),
    fibonacci: calculateFibonacciLevels(high, low)
  }
}

// ==================== MARKET ANALYSIS HELPERS ====================

/**
 * Analyze current market conditions
 */
export function analyzeMarket(candles) {
  if (!candles || candles.length < 2) return null
  
  const indicators = calculateAllIndicators(candles)
  const closePrices = candles.map(c => parseFloat(c.close))
  const currentPrice = closePrices[closePrices.length - 1]
  const previousPrice = closePrices[closePrices.length - 2]
  
  const direction = currentPrice > previousPrice ? 'UP' : currentPrice < previousPrice ? 'DOWN' : 'FLAT'
  const percentChange = ((currentPrice - previousPrice) / previousPrice) * 100
  
  // Determine trend strength
  let trendStrength = 'WEAK'
  if (indicators.sma20 && indicators.sma50 && indicators.sma200) {
    if (indicators.sma20 > indicators.sma50 && indicators.sma50 > indicators.sma200) {
      trendStrength = 'STRONG_UP'
    } else if (indicators.sma20 < indicators.sma50 && indicators.sma50 < indicators.sma200) {
      trendStrength = 'STRONG_DOWN'
    } else {
      trendStrength = 'NEUTRAL'
    }
  }
  
  // RSI interpretation
  let rsiCondition = 'NEUTRAL'
  if (indicators.rsi) {
    if (indicators.rsi > 70) rsiCondition = 'OVERBOUGHT'
    else if (indicators.rsi < 30) rsiCondition = 'OVERSOLD'
  }
  
  return {
    currentPrice,
    direction,
    percentChange: Math.round(percentChange * 10000) / 10000,
    trendStrength,
    rsiCondition,
    indicators
  }
}

/**
 * Detect potential reversals
 */
export function detectReversal(candles) {
  if (candles.length < 3) return null
  
  const analysis = analyzeMarket(candles)
  const closePrices = candles.map(c => parseFloat(c.close))
  
  const reversalSignals = {
    count: 0,
    signals: []
  }
  
  // RSI reversal
  if (analysis.indicators.rsi) {
    if (analysis.rsiCondition === 'OVERBOUGHT') {
      reversalSignals.signals.push('RSI_OVERBOUGHT')
      reversalSignals.count++
    }
    if (analysis.rsiCondition === 'OVERSOLD') {
      reversalSignals.signals.push('RSI_OVERSOLD')
      reversalSignals.count++
    }
  }
  
  // MACD divergence
  if (analysis.indicators.macd) {
    const macdLine = analysis.indicators.macd.macdLine
    const histogram = analysis.indicators.macd.histogram
    
    if (histogram < 0 && analysis.direction === 'UP') {
      reversalSignals.signals.push('MACD_BEARISH_DIVERGENCE')
      reversalSignals.count++
    }
    if (histogram > 0 && analysis.direction === 'DOWN') {
      reversalSignals.signals.push('MACD_BULLISH_DIVERGENCE')
      reversalSignals.count++
    }
  }
  
  // Price at resistance/support
  const sr = analysis.indicators.supportResistance
  if (sr) {
    if (Math.abs(analysis.currentPrice - sr.resistance) < sr.range * 0.02) {
      reversalSignals.signals.push('NEAR_RESISTANCE')
      reversalSignals.count++
    }
    if (Math.abs(analysis.currentPrice - sr.support) < sr.range * 0.02) {
      reversalSignals.signals.push('NEAR_SUPPORT')
      reversalSignals.count++
    }
  }
  
  return reversalSignals
}

export default {
  calculateSMA,
  calculateEMA,
  calculateMovingAverages,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateOBV,
  calculateVWAP,
  calculateFibonacciLevels,
  findSupportResistance,
  calculateAllIndicators,
  analyzeMarket,
  detectReversal
}
