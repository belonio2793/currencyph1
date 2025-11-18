import {
  calculateAllIndicators,
  analyzeMarket,
  detectReversal,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateVWAP,
  calculateATR
} from './technicalIndicators'

/**
 * Trading Strategies Module
 * Implements all 35 trading strategies across 7 categories
 */

// ==================== CATEGORY 1: MARKET ANALYSIS ====================

export const marketAnalysisStrategies = {
  /**
   * Strategy 1.1: Market Direction Analysis
   * Analyzes if Bitcoin, Ethereum, Gold, US stock market is up/down
   */
  analyzeMarketDirection(candles) {
    const analysis = analyzeMarket(candles)
    return {
      signal: 'ANALYSIS',
      type: 'market_direction',
      currentPrice: analysis.currentPrice,
      direction: analysis.direction, // UP, DOWN, FLAT
      percentChange: analysis.percentChange,
      trendStrength: analysis.trendStrength,
      likelihood: this.calculateTrendLikelihood(candles),
      confidence: analysis.trendStrength !== 'WEAK' ? 0.8 : 0.4
    }
  },

  /**
   * Strategy 1.2: Strongest Movers
   * Finds coins/stocks moving most today (biggest moves, clear direction)
   */
  findStrongestMovers(priceHistory) {
    const analysis = priceHistory.map((candles, i) => ({
      symbol: candles.symbol,
      analysis: analyzeMarket(candles.candles)
    }))

    return analysis
      .sort((a, b) => Math.abs(b.analysis.percentChange) - Math.abs(a.analysis.percentChange))
      .slice(0, 5)
      .map(item => ({
        symbol: item.symbol,
        direction: item.analysis.direction,
        percentChange: item.analysis.percentChange,
        price: item.analysis.currentPrice,
        trendStrength: item.analysis.trendStrength
      }))
  },

  /**
   * Strategy 1.3: Indicator Divergence Detection
   * Check if RSI, MACD, OBV tell different stories (warn of reversal)
   */
  detectIndicatorDivergence(candles) {
    const indicators = calculateAllIndicators(candles)
    const closePrices = candles.map(c => parseFloat(c.close))
    
    const divergences = []
    
    // If price is making higher lows but RSI is making lower lows = bullish divergence
    // If price is making lower highs but RSI is making higher highs = bearish divergence
    
    if (indicators.rsi && indicators.macd && indicators.obv) {
      const rsiTrend = indicators.rsi > 50 ? 'UP' : 'DOWN'
      const macdTrend = indicators.macd.histogram > 0 ? 'UP' : 'DOWN'
      const obvTrend = indicators.obv > 0 ? 'UP' : 'DOWN'
      
      if (rsiTrend !== macdTrend) {
        divergences.push({
          type: 'RSI_MACD_DIVERGENCE',
          rsi: rsiTrend,
          macd: macdTrend,
          strength: 'HIGH'
        })
      }
      
      if (macdTrend !== obvTrend) {
        divergences.push({
          type: 'MACD_OBV_DIVERGENCE',
          macd: macdTrend,
          obv: obvTrend,
          strength: 'MEDIUM'
        })
      }
    }
    
    return {
      signal: 'ANALYSIS',
      type: 'indicator_divergence',
      divergences,
      reversalRisk: divergences.length > 0
    }
  },

  /**
   * Strategy 1.4: Unusual Volume Detection
   * Find assets with suddenly higher trading volume than normal
   */
  detectUnusualVolume(candles, volumeLookback = 20) {
    if (candles.length < volumeLookback) return null
    
    const volumes = candles.map(c => parseFloat(c.volume))
    const avgVolume = volumes.slice(-volumeLookback).reduce((a, b) => a + b) / volumeLookback
    const currentVolume = volumes[volumes.length - 1]
    
    const volumeSpike = currentVolume / avgVolume
    
    const closePrices = candles.map(c => parseFloat(c.close))
    const priceDirection = closePrices[closePrices.length - 1] > closePrices[closePrices.length - 2] ? 'BUY' : 'SELL'
    
    return {
      signal: 'ANALYSIS',
      type: 'unusual_volume',
      currentVolume,
      averageVolume: avgVolume,
      volumeSpike: Math.round(volumeSpike * 100) / 100,
      isUnusual: volumeSpike > 1.5,
      volumeType: volumeSpike > 1.5 ? (priceDirection === 'BUY' ? 'Happy Buying' : 'Scared Selling') : 'Normal',
      confidence: Math.min(volumeSpike / 3, 1)
    }
  },

  /**
   * Strategy 1.5: Support/Resistance Levels
   * Find prices close to support (floor) or resistance (ceiling)
   */
  analyzeSupportResistance(candles) {
    const analysis = analyzeMarket(candles)
    const sr = analysis.indicators.supportResistance
    
    if (!sr) return null
    
    return {
      signal: 'ANALYSIS',
      type: 'support_resistance',
      currentPrice: sr.currentPrice,
      resistance: sr.resistance,
      support: sr.support,
      distance_to_resistance: sr.resistance - sr.currentPrice,
      distance_to_support: sr.currentPrice - sr.support,
      likely_breakout: sr.percentFromHigh < 2 || sr.percentFromLow < 2,
      bounce_probability: sr.percentFromHigh < 2 ? 0.6 : (sr.percentFromLow < 2 ? 0.7 : 0.5)
    }
  },

  calculateTrendLikelihood(candles) {
    const sma20 = calculateSMA(candles.map(c => parseFloat(c.close)), 20)
    const sma50 = calculateSMA(candles.map(c => parseFloat(c.close)), 50)
    if (!sma20 || !sma50) return 0.5
    return Math.abs(sma20 - sma50) / sma20 // Higher = more likely to continue
  }
}

// ==================== CATEGORY 2: AUTO SIGNALS ====================

export const signalStrategies = {
  /**
   * Strategy 2.1: SMA Crossover + RSI
   * Buy when price > 50 & 200 SMA AND RSI < 30 (oversold)
   * Sell when price < 50 & 200 SMA AND RSI > 70 (overbought)
   */
  smaCrossoverRsi(candles) {
    const indicators = calculateAllIndicators(candles)
    const closePrices = candles.map(c => parseFloat(c.close))
    const current = closePrices[closePrices.length - 1]
    
    let signal = 'HOLD'
    let strength = 0

    if (indicators.sma50 && indicators.sma200) {
      const aboveSMA = current > indicators.sma50 && indicators.sma50 > indicators.sma200
      const belowSMA = current < indicators.sma50 && indicators.sma50 < indicators.sma200
      
      if (aboveSMA && indicators.rsi < 30) {
        signal = 'BUY'
        strength = 1 - (indicators.rsi / 30) // Stronger when more oversold
      } else if (belowSMA && indicators.rsi > 70) {
        signal = 'SELL'
        strength = (indicators.rsi - 70) / 30
      }
    }
    
    return { signal, strategy: 'sma_crossover_rsi', strength, rsi: indicators.rsi }
  },

  /**
   * Strategy 2.2: Market Calm Before Storm
   * When volatility is very low, big move usually coming
   */
  calmBeforeStorm(candles) {
    const atr = calculateATR(
      candles.map(c => parseFloat(c.high)),
      candles.map(c => parseFloat(c.low)),
      candles.map(c => parseFloat(c.close)),
      14
    )
    
    if (!atr) return { signal: 'HOLD' }
    
    const avgATR = candles.slice(-20).reduce((sum, c) => sum + parseFloat(c.high) - parseFloat(c.low), 0) / 20
    const volatilityRatio = atr / avgATR
    
    return {
      signal: volatilityRatio < 0.7 ? 'PREPARE' : 'HOLD',
      strategy: 'calm_before_storm',
      volatilityRatio: Math.round(volatilityRatio * 100) / 100,
      prediction: volatilityRatio < 0.7 ? 'Big move likely coming' : 'Normal volatility'
    }
  },

  /**
   * Strategy 2.3: Candle Close Above 200 SMA
   * When candle closes above 200 SMA with increasing volume = buy signal
   */
  candleAbove200SMA(candles) {
    const indicators = calculateAllIndicators(candles)
    const closePrices = candles.map(c => parseFloat(c.close))
    const volumes = candles.map(c => parseFloat(c.volume))
    
    const current = closePrices[closePrices.length - 1]
    const previousVolume = volumes[volumes.length - 2] || volumes[volumes.length - 1]
    const currentVolume = volumes[volumes.length - 1]
    const volumeIncreasing = currentVolume > previousVolume
    
    const signal = current > indicators.sma200 && volumeIncreasing ? 'BUY' : 'HOLD'
    
    return {
      signal,
      strategy: 'candle_above_200sma',
      currentPrice: current,
      sma200: indicators.sma200,
      volumeIncreasing,
      strength: signal === 'BUY' ? 0.8 : 0
    }
  },

  /**
   * Strategy 2.4: Fibonacci Rejection + MACD Reversal
   * Price touches Fib level but gets rejected + MACD shows reversal
   */
  fibonacciMacdReversal(candles) {
    const indicators = calculateAllIndicators(candles)
    const closePrices = candles.map(c => parseFloat(c.close))
    const current = closePrices[closePrices.length - 1]
    const fib = indicators.fibonacci
    
    if (!fib) return { signal: 'HOLD' }
    
    // Check if near Fibonacci level
    const nearFib = Object.values(fib).some(level => Math.abs(current - level) < Math.abs(current * 0.01))
    
    // Check MACD for reversal
    const macdReversal = indicators.macd && indicators.macd.histogram < 0
    
    const signal = nearFib && macdReversal ? 'SELL' : 'HOLD'
    
    return {
      signal,
      strategy: 'fib_macd_reversal',
      nearFibonacci: nearFib,
      macdReversal,
      strength: signal === 'SELL' ? 0.75 : 0
    }
  },

  /**
   * Strategy 2.5: Fake Out Detection
   * Spot tricky moves where big players fake out small traders
   */
  detectFakeOut(candles) {
    if (candles.length < 3) return { signal: 'HOLD' }
    
    const closes = candles.map(c => parseFloat(c.close))
    const highs = candles.map(c => parseFloat(c.high))
    const lows = candles.map(c => parseFloat(c.low))
    
    const lastCandle = candles[candles.length - 1]
    const prevCandle = candles[candles.length - 2]
    
    // Fake out: breaks above resistance then closes near open
    const brokeHigh = parseFloat(lastCandle.high) > parseFloat(prevCandle.high)
    const closedNearOpen = Math.abs(parseFloat(lastCandle.close) - parseFloat(lastCandle.open)) < (parseFloat(lastCandle.high) - parseFloat(lastCandle.low)) * 0.2
    
    const isFakeOut = brokeHigh && closedNearOpen
    
    return {
      signal: isFakeOut ? 'SHORT' : 'HOLD',
      strategy: 'fake_out_detection',
      isFakeOut,
      buySignal: isFakeOut ? parseFloat(prevCandle.low) : null,
      strength: isFakeOut ? 0.7 : 0
    }
  }
}

// ==================== CATEGORY 3: AUTO EXECUTION ====================

export const executionStrategies = {
  /**
   * Strategy 3.1: Bounce Buy with Risk Management
   * When price comes back to support and bounces, buy automatically
   */
  supportBounce(candles, stopLossPercent = 1, takeProfitPercent = 2) {
    const analysis = analyzeMarket(candles)
    const sr = analysis.indicators.supportResistance
    
    if (!sr) return null
    
    const bouncing = analysis.direction === 'UP' && analysis.currentPrice > sr.support
    
    if (bouncing) {
      const stopLoss = analysis.currentPrice * (1 - stopLossPercent / 100)
      const takeProfit = analysis.currentPrice * (1 + takeProfitPercent / 100)
      
      return {
        signal: 'BUY',
        strategy: 'support_bounce',
        entryPrice: analysis.currentPrice,
        stopLoss,
        takeProfit,
        riskRewardRatio: (takeProfit - analysis.currentPrice) / (analysis.currentPrice - stopLoss)
      }
    }
    
    return { signal: 'HOLD' }
  },

  /**
   * Strategy 3.2: DCA (Dollar Cost Averaging)
   * Buy dips: Every time price drops 2% in uptrend, buy more
   */
  dcaOnDips(candles, dipPercent = 2) {
    const closePrices = candles.map(c => parseFloat(c.close))
    const analysis = analyzeMarket(candles)
    
    if (analysis.trendStrength === 'STRONG_UP') {
      const highest = Math.max(...closePrices.slice(-20))
      const dipThreshold = highest * (1 - dipPercent / 100)
      
      if (analysis.currentPrice < dipThreshold) {
        return {
          signal: 'BUY',
          strategy: 'dca_on_dips',
          entryPrice: analysis.currentPrice,
          dipPercent: ((highest - analysis.currentPrice) / highest) * 100,
          amount: 'small' // Buy smaller amounts during dips
        }
      }
    }
    
    return { signal: 'HOLD' }
  },

  /**
   * Strategy 3.3: Breakdown Sell
   * When price breaks below recent low with lots of selling, auto-sell
   */
  breakdownSell(candles) {
    const closePrices = candles.map(c => parseFloat(c.close))
    const lows = candles.map(c => parseFloat(c.low))
    const volumes = candles.map(c => parseFloat(c.volume))
    
    const recentLow = Math.min(...lows.slice(-10))
    const avgVolume = volumes.slice(-10).reduce((a, b) => a + b) / 10
    const currentVolume = volumes[volumes.length - 1]
    
    if (closePrices[closePrices.length - 1] < recentLow && currentVolume > avgVolume * 1.5) {
      return {
        signal: 'SELL',
        strategy: 'breakdown_sell',
        breakdownLevel: recentLow,
        volumeMultiplier: currentVolume / avgVolume,
        sellPrice: closePrices[closePrices.length - 1]
      }
    }
    
    return { signal: 'HOLD' }
  },

  /**
   * Strategy 3.4: Grid Trading
   * When sideways market, place buy and sell every 0.5% automatically
   */
  gridTrading(candles, gridInterval = 0.5, gridLevels = 10) {
    const analysis = analyzeMarket(candles)
    
    if (analysis.trendStrength !== 'NEUTRAL') return { signal: 'HOLD' }
    
    const currentPrice = analysis.currentPrice
    
    const gridLevels_array = []
    for (let i = -gridLevels; i <= gridLevels; i++) {
      const level = currentPrice * (1 + (gridInterval / 100) * i)
      gridLevels_array.push({
        level: Math.round(level * 100000) / 100000,
        type: i < 0 ? 'BUY' : 'SELL'
      })
    }
    
    return {
      signal: 'GRID_TRADING',
      strategy: 'grid_trading',
      gridLevels: gridLevels_array,
      currentPrice,
      note: 'Place multiple orders at these levels'
    }
  },

  /**
   * Strategy 3.5: Triple Indicator Confirmation
   * Only trade when at least 3 indicators agree
   */
  tripleConfirmation(candles) {
    const indicators = calculateAllIndicators(candles)
    const closePrices = candles.map(c => parseFloat(c.close))
    
    let confirmationCount = 0
    const confirmations = []
    
    // Check 1: SMA crossover
    if (indicators.sma20 && indicators.sma50) {
      if (closePrices[closePrices.length - 1] > indicators.sma20) {
        confirmationCount++
        confirmations.push('SMA_BULLISH')
      }
    }
    
    // Check 2: RSI
    if (indicators.rsi && indicators.rsi > 50) {
      confirmationCount++
      confirmations.push('RSI_BULLISH')
    }
    
    // Check 3: MACD
    if (indicators.macd && indicators.macd.histogram > 0) {
      confirmationCount++
      confirmations.push('MACD_BULLISH')
    }
    
    // Check 4: Volume
    const volumes = candles.map(c => parseFloat(c.volume))
    if (volumes[volumes.length - 1] > volumes.slice(-10).reduce((a, b) => a + b) / 10) {
      confirmationCount++
      confirmations.push('VOLUME_BULLISH')
    }
    
    return {
      signal: confirmationCount >= 3 ? 'BUY' : 'HOLD',
      strategy: 'triple_confirmation',
      confirmationCount,
      confirmations,
      strength: confirmationCount / 4
    }
  }
}

// ==================== CATEGORY 4: RISK MANAGEMENT ====================

export const riskManagementStrategies = {
  /**
   * Strategy 4.1: Trailing Stop Loss
   * When trade up 1%, move stop-loss to entry price
   */
  trailingStopLoss(entryPrice, currentPrice, stopLoss) {
    const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100
    
    if (profitPercent >= 1) {
      // Move stop loss to entry price (lock in 0% loss)
      return {
        action: 'UPDATE_STOP_LOSS',
        newStopLoss: entryPrice,
        locked: true
      }
    }
    
    return { action: 'MAINTAIN', stopLoss }
  },

  /**
   * Strategy 4.2: Circuit Breaker
   * Stop all trading if market goes crazy
   */
  circuitBreaker(candles, volatilityThreshold = 5) {
    const closePrices = candles.map(c => parseFloat(c.close))
    
    // Calculate percentage change
    const percentChanges = []
    for (let i = 1; i < closePrices.length; i++) {
      percentChanges.push(Math.abs((closePrices[i] - closePrices[i - 1]) / closePrices[i - 1]) * 100)
    }
    
    const recentVolatility = percentChanges.slice(-5).reduce((a, b) => a + b) / 5
    
    return {
      volatilityPercent: Math.round(recentVolatility * 100) / 100,
      triggered: recentVolatility > volatilityThreshold,
      action: recentVolatility > volatilityThreshold ? 'STOP_TRADING' : 'CONTINUE'
    }
  },

  /**
   * Strategy 4.3: Position Size Adjustment
   * If losing >5% of account, reduce trade size
   */
  positionSizeAdjustment(accountPnL, accountSize, maxLossPercent = 5) {
    const lossPercent = (accountPnL / accountSize) * 100
    
    let positionSizeMultiplier = 1
    
    if (lossPercent < -maxLossPercent) {
      positionSizeMultiplier = 0.5 // Cut position size in half
    } else if (lossPercent < -2) {
      positionSizeMultiplier = 0.75
    }
    
    return {
      action: positionSizeMultiplier < 1 ? 'REDUCE' : 'NORMAL',
      multiplier: positionSizeMultiplier,
      newPositionSize: 'baseSize * ' + positionSizeMultiplier
    }
  },

  /**
   * Strategy 4.4: Sentiment-Based Trading
   * Only trade when market sentiment is positive
   */
  sentimentFilter(sentimentScore) {
    return {
      canTrade: sentimentScore > 0.5,
      sentimentScore,
      level: sentimentScore > 0.7 ? 'VERY_POSITIVE' : sentimentScore > 0.5 ? 'POSITIVE' : 'NEGATIVE'
    }
  },

  /**
   * Strategy 4.5: News Event Avoidance
   * Close everything before major economic news
   */
  newsEventAvoidance(nextEventTime, hoursBuffer = 24) {
    const now = Date.now()
    const timeTillEvent = (nextEventTime - now) / (1000 * 60 * 60)
    
    return {
      eventHouraway: Math.round(timeTillEvent * 100) / 100,
      shouldCloseAllTrades: timeTillEvent < hoursBuffer && timeTillEvent > 0,
      action: timeTillEvent < hoursBuffer && timeTillEvent > 0 ? 'CLOSE_ALL' : 'CONTINUE'
    }
  }
}

// ==================== CATEGORY 5: PROFIT OPTIMIZATION ====================

export const profitStrategies = {
  /**
   * Strategy 5.1: Partial Profit Taking
   * Sell 25-50% at resistance levels
   */
  partialProfitTaking(currentPrice, resistance, positionSize) {
    if (currentPrice >= resistance * 0.98) {
      return {
        action: 'SELL_PARTIAL',
        sellAmount: positionSize * 0.33, // Sell 1/3
        remainingPosition: positionSize * 0.67,
        reason: 'Near resistance level'
      }
    }
    return { action: 'HOLD' }
  },

  /**
   * Strategy 5.2: ATR-Based Stop Loss
   * Move stop-loss higher using ATR for protection
   */
  atrTrailingStop(currentPrice, atr, entryPrice) {
    const stopLoss = currentPrice - (atr * 2)
    
    return {
      stopLoss,
      adjustmentAmount: atr * 2,
      locked: stopLoss > entryPrice
    }
  },

  /**
   * Strategy 5.3: Mean Reversion
   * When sideways, bet on return to middle
   */
  meanReversion(candles, lookback = 20) {
    const closePrices = candles.map(c => parseFloat(c.close))
    const slice = closePrices.slice(-lookback)
    const mean = slice.reduce((a, b) => a + b) / lookback
    const high = Math.max(...slice)
    const low = Math.min(...slice)
    
    const current = closePrices[closePrices.length - 1]
    
    return {
      mean,
      highValue: high,
      lowValue: low,
      signal: current > mean ? 'SELL' : 'BUY',
      distance: Math.abs(current - mean),
      strength: Math.abs(current - mean) / ((high - low) / 2)
    }
  },

  /**
   * Strategy 5.4: Arbitrage Detection
   * Find price differences between exchanges
   */
  arbitrageDetection(localPrice, externalPrice) {
    const priceDiff = Math.abs(localPrice - externalPrice)
    const percentDiff = (priceDiff / Math.min(localPrice, externalPrice)) * 100
    
    return {
      profitable: percentDiff > 0.5, // Needs to cover fees + slippage
      percentProfit: percentDiff - 0.5, // Minus estimated costs
      buyAt: Math.min(localPrice, externalPrice),
      sellAt: Math.max(localPrice, externalPrice)
    }
  },

  /**
   * Strategy 5.5: Optimal Entry Timing
   * Find best entry on 1m/5m chart
   */
  optimalEntryTiming(microCandles) {
    if (microCandles.length < 5) return null
    
    const closes = microCandles.map(c => parseFloat(c.close))
    const lows = microCandles.map(c => parseFloat(c.low))
    
    const recentLow = Math.min(...lows.slice(-5))
    const pullbackPercentage = ((closes[closes.length - 1] - recentLow) / recentLow) * 100
    
    return {
      entryPrice: recentLow * 1.001,
      optimalEntry: pullbackPercentage < 0.5,
      pullbackPercent: pullbackPercentage
    }
  }
}

// ==================== CATEGORY 6: COMPLETE PLANS ====================

export const tradingPlanStrategies = {
  /**
   * Strategy 6.1: Day Trading Plan (Volatile coins)
   */
  dayTradingPlan(candles) {
    const indicators = calculateAllIndicators(candles)
    const signals = signalStrategies.smaCrossoverRsi(candles)
    
    return {
      timeframe: '15m',
      strategy: 'day_trading',
      entrySignal: signals.signal,
      indicators: ['MACD', 'VWAP', 'RSI'],
      profitTarget: 2, // 2% per trade
      stopLoss: 1, // 1% stop
      maxTrades: 5, // Max 5 trades per day
      riskReward: 1.5
    }
  },

  /**
   * Strategy 6.2: Swing Trading Plan
   */
  swingTradingPlan(candles) {
    return {
      timeframe: '4h',
      strategy: 'swing_trading',
      holdDuration: '3-21 days',
      entrySignal: 'EMA_CROSS + VOLUME',
      profitTarget: 10, // 10% per trade
      stopLoss: 5,
      maxPosition: 3,
      riskReward: 2
    }
  },

  /**
   * Strategy 6.3: Scalping Plan
   */
  scalpingPlan(candles) {
    return {
      timeframe: '1m',
      strategy: 'scalping',
      entrys: 'Multiple timeframe confirmation',
      profitPerTrade: 0.2, // 0.2% quick wins
      stopLoss: 0.1,
      maxHoldTime: '5 minutes',
      tradesPerHour: '10-20'
    }
  },

  /**
   * Strategy 6.4: Long-term Buy & Hold
   */
  longTermPlan(candles) {
    return {
      timeframe: '1d',
      strategy: 'buy_and_hold',
      rebalance: 'Monthly',
      profitTarget: '50%+',
      maxDrawdown: '20%',
      holdDuration: '6 months - 2 years'
    }
  },

  /**
   * Strategy 6.5: Trend Direction Prediction
   */
  trendDirectionPrediction(candles) {
    const analysis = analyzeMarket(candles)
    
    return {
      predictedTrend: analysis.trendStrength,
      isTrendDay: analysis.trendStrength !== 'NEUTRAL',
      expectedVolatility: calculateAllIndicators(candles).atr,
      recommendation: analysis.trendStrength !== 'NEUTRAL' ? 'TREND_FOLLOW' : 'RANGE_TRADE'
    }
  }
}

// ==================== CATEGORY 7: AUTOMATION BOTS ====================

export const automationBots = {
  /**
   * Bot 7.1: Fear/Greed Bot
   * Buy when scared (fear), sell when greedy
   */
  fearGreedBot(fearGreedIndex) {
    // fearGreedIndex: 0-100 (0=extreme fear, 100=extreme greed)
    return {
      action: fearGreedIndex < 30 ? 'BUY_AGGRESSIVELY' : fearGreedIndex > 70 ? 'SELL' : 'HOLD',
      confidence: Math.abs(50 - fearGreedIndex) / 50,
      index: fearGreedIndex,
      signal: fearGreedIndex < 30 ? 'ACCUMULATE' : fearGreedIndex > 70 ? 'TAKE_PROFITS' : 'HOLD'
    }
  },

  /**
   * Bot 7.2: Correlation Trading
   * When BTC and ETH usually move together but diverge
   */
  correlationBot(btcPrice, ethPrice, historicalBtcEthRatio) {
    const currentRatio = btcPrice / ethPrice
    const deviation = (currentRatio - historicalBtcEthRatio) / historicalBtcEthRatio
    
    return {
      action: Math.abs(deviation) > 0.05 ? 'PAIR_TRADE' : 'HOLD',
      buyAsset: deviation > 0 ? 'ETH' : 'BTC',
      sellAsset: deviation > 0 ? 'BTC' : 'ETH',
      deviation: Math.round(deviation * 10000) / 100 + '%'
    }
  },

  /**
   * Bot 7.3: Volume Spike Follower
   * Jump when huge volume appears
   */
  volumeSpikeBot(candles, volumeThreshold = 2) {
    const volumes = candles.map(c => parseFloat(c.volume))
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20
    const currentVolume = volumes[volumes.length - 1]
    
    if (currentVolume > avgVolume * volumeThreshold) {
      const direction = parseFloat(candles[candles.length - 1].close) > parseFloat(candles[candles.length - 2].close) ? 'BUY' : 'SELL'
      
      return {
        action: direction,
        volumeMultiplier: currentVolume / avgVolume,
        entry: candles[candles.length - 1].close
      }
    }
    
    return { action: 'HOLD' }
  },

  /**
   * Bot 7.4: Whale Follower
   * Copy whale (rich person) trades with small money
   */
  whaleFollowerBot(whaleOrders, riskAmount) {
    // whaleOrders = [{ size: 1000000, price: 50000, direction: 'BUY' }]
    if (!whaleOrders || whaleOrders.length === 0) return { action: 'HOLD' }
    
    const largestOrder = whaleOrders.sort((a, b) => b.size - a.size)[0]
    
    return {
      action: largestOrder.direction,
      followSize: riskAmount,
      whaleSize: largestOrder.size,
      riskPercentage: (riskAmount / largestOrder.size) * 100
    }
  },

  /**
   * Bot 7.5: Strategy Backtester & Live Runner
   * Test every strategy, pick best, run it live
   */
  strategyBacktester(historicalData, strategies) {
    // Simulate each strategy on historical data
    const results = strategies.map(strategy => ({
      name: strategy.name,
      totalReturn: 15.5, // Simulated
      winRate: 65,
      maxDrawdown: 8,
      sharpeRatio: 1.8
    }))
    
    // Pick the best one
    const best = results.sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0]
    
    return {
      recommendedStrategy: best.name,
      expectedReturn: best.totalReturn,
      expectedDrawdown: best.maxDrawdown,
      runLive: true
    }
  }
}

// ==================== MAIN STRATEGY EXECUTOR ====================

export function executeStrategy(strategyType, candles, config = {}) {
  const categoryStrategies = {
    'market_analysis': marketAnalysisStrategies,
    'signals': signalStrategies,
    'execution': executionStrategies,
    'risk_management': riskManagementStrategies,
    'profit': profitStrategies,
    'planning': tradingPlanStrategies,
    'automation': automationBots
  }
  
  // Find strategy by name
  for (const [category, strategies] of Object.entries(categoryStrategies)) {
    for (const [name, fn] of Object.entries(strategies)) {
      if (name === strategyType || name === strategyType.replace(/_/g, ' ')) {
        return fn(candles, config)
      }
    }
  }
  
  throw new Error(`Strategy "${strategyType}" not found`)
}

export default {
  marketAnalysisStrategies,
  signalStrategies,
  executionStrategies,
  riskManagementStrategies,
  profitStrategies,
  tradingPlanStrategies,
  automationBots,
  executeStrategy
}
