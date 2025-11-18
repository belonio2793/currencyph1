import { coinsPhApi } from './coinsPhApi'
import { calculateAllIndicators, analyzeMarket } from './technicalIndicators'
import { executeStrategy } from './tradingStrategies'
import { supabase } from './supabaseClient'

/**
 * Trading Bot Orchestrator
 * Manages strategy execution, order placement, and monitoring
 */

export class TradingBotOrchestrator {
  constructor(userId, paperTradingMode = true) {
    this.userId = userId
    this.paperTradingMode = paperTradingMode
    this.activePositions = new Map()
    this.orders = new Map()
    this.performanceMetrics = {}
    this.lastExecutionTime = {}
    this.executionHistory = []
  }

  /**
   * Initialize bot with user settings
   */
  async initialize() {
    try {
      const { data: settings } = await supabase
        .from('trading_settings')
        .select('*')
        .eq('user_id', this.userId)
        .single()

      if (settings) {
        this.paperTradingMode = settings.paper_trading_mode
        this.maxDailyLoss = settings.max_daily_loss_php
        this.maxLossPercent = settings.max_loss_percent
      }

      await this.loadActiveStrategies()
      await this.loadActivePositions()
      
      console.log('[Bot] Initialized successfully', {
        userId: this.userId,
        paperTradingMode: this.paperTradingMode
      })
      
      return true
    } catch (error) {
      console.error('[Bot] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Load all active trading strategies for user
   */
  async loadActiveStrategies() {
    try {
      const { data: strategies } = await supabase
        .from('trading_strategies')
        .select('*')
        .eq('user_id', this.userId)
        .eq('enabled', true)

      this.strategies = strategies || []
      console.log(`[Bot] Loaded ${this.strategies.length} active strategies`)
      return this.strategies
    } catch (error) {
      console.error('[Bot] Failed to load strategies:', error)
      return []
    }
  }

  /**
   * Load active positions from database
   */
  async loadActivePositions() {
    try {
      const { data: trades } = await supabase
        .from('completed_trades')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'OPEN')

      trades?.forEach(trade => {
        this.activePositions.set(trade.id, trade)
      })

      console.log(`[Bot] Loaded ${this.activePositions.size} active positions`)
      return this.activePositions
    } catch (error) {
      console.error('[Bot] Failed to load positions:', error)
      return this.activePositions
    }
  }

  /**
   * Execute all active strategies once
   */
  async executeAll() {
    const results = []
    
    for (const strategy of this.strategies) {
      try {
        const result = await this.executeStrategy(strategy)
        results.push(result)
      } catch (error) {
        console.error(`[Bot] Error executing strategy ${strategy.id}:`, error)
        await this.logExecution({
          strategy_id: strategy.id,
          event_type: 'ERROR',
          error_message: error.message,
          success: false
        })
      }
    }

    // Check and manage risk
    await this.manageRisk()

    return results
  }

  /**
   * Execute a single strategy
   */
  async executeStrategy(strategy) {
    try {
      const symbols = strategy.symbols || ['BTCPHP', 'ETHPHP']
      const results = []

      for (const symbol of symbols) {
        try {
          const candles = await this.fetchCandles(symbol, strategy.timeframe)
          
          if (!candles || candles.length === 0) {
            console.warn(`[Bot] No candles for ${symbol}`)
            continue
          }

          // Execute strategy logic
          const signal = this.evaluateStrategy(strategy.strategy_type, candles, strategy.config)
          
          if (signal && signal.signal !== 'HOLD') {
            // Generate trading signal
            const signalRecord = await this.createSignal(strategy.id, symbol, signal)
            
            // Execute order if not paper trading
            if (!this.paperTradingMode && signal.autoExecute) {
              const order = await this.executeOrder(strategy, symbol, signal)
              results.push({ symbol, signal, order })
            } else {
              results.push({ symbol, signal, paperTrade: true })
            }
          }

          this.lastExecutionTime[strategy.id] = Date.now()
        } catch (error) {
          console.error(`[Bot] Error executing strategy for ${symbol}:`, error)
        }
      }

      return { strategyId: strategy.id, results }
    } catch (error) {
      console.error('[Bot] Strategy execution failed:', error)
      throw error
    }
  }

  /**
   * Fetch candles from API
   */
  async fetchCandles(symbol, interval = '1h', limit = 500) {
    try {
      const candles = await coinsPhApi.getKlines(symbol, interval, limit)
      
      // Save to database
      if (candles && candles.length > 0) {
        await this.saveCandles(symbol, interval, candles)
      }
      
      return candles
    } catch (error) {
      console.error(`[Bot] Failed to fetch candles for ${symbol}:`, error)
      // Fallback: try to get from database
      return this.loadCandlesFromDB(symbol, interval)
    }
  }

  /**
   * Save candles to database
   */
  async saveCandles(symbol, timeframe, candles) {
    try {
      const records = candles.map(c => ({
        symbol,
        timeframe,
        open_time: new Date(c[0]),
        close_time: new Date(c[6]),
        open_price: parseFloat(c[1]),
        high_price: parseFloat(c[2]),
        low_price: parseFloat(c[3]),
        close_price: parseFloat(c[4]),
        volume: parseFloat(c[7]),
        quote_asset_volume: parseFloat(c[8])
      }))

      await supabase
        .from('market_candles')
        .upsert(records, { onConflict: 'symbol,timeframe,open_time' })
        .select()
    } catch (error) {
      console.error('[Bot] Failed to save candles:', error)
    }
  }

  /**
   * Load candles from database
   */
  async loadCandlesFromDB(symbol, timeframe, limit = 100) {
    try {
      const { data } = await supabase
        .from('market_candles')
        .select('*')
        .eq('symbol', symbol)
        .eq('timeframe', timeframe)
        .order('close_time', { ascending: false })
        .limit(limit)

      return data?.map(d => [
        d.open_time,
        d.open_price,
        d.high_price,
        d.low_price,
        d.close_price,
        null,
        d.close_time,
        d.volume,
        d.quote_asset_volume
      ]) || []
    } catch (error) {
      console.error('[Bot] Failed to load candles from DB:', error)
      return []
    }
  }

  /**
   * Evaluate strategy and return signal
   */
  evaluateStrategy(strategyType, candles, config = {}) {
    try {
      // Convert API candles format to expected format
      const formattedCandles = candles.map(c => ({
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[7],
        time: c[0]
      }))

      const signal = executeStrategy(strategyType, formattedCandles, config)
      
      if (signal && signal.signal && signal.signal !== 'HOLD') {
        return {
          ...signal,
          autoExecute: this.shouldAutoExecute(signal),
          confidence: signal.strength || signal.confidence || 0.5
        }
      }

      return null
    } catch (error) {
      console.error('[Bot] Strategy evaluation failed:', error)
      return null
    }
  }

  /**
   * Determine if signal should auto-execute
   */
  shouldAutoExecute(signal) {
    // Only auto-execute if confidence high enough
    const confidence = signal.strength || signal.confidence || 0
    return confidence > 0.7 // 70%+ confidence
  }

  /**
   * Create trading signal record
   */
  async createSignal(strategyId, symbol, signal) {
    try {
      const { data } = await supabase
        .from('trading_signals')
        .insert({
          user_id: this.userId,
          strategy_id: strategyId,
          symbol,
          signal_type: signal.signal,
          signal_strength: signal.strength || signal.confidence || 0.5,
          price: signal.entryPrice || signal.currentPrice || 0,
          indicators: signal.indicators || {},
          reasoning: signal.reasoning || signal.strategy || ''
        })
        .select()
        .single()

      return data
    } catch (error) {
      console.error('[Bot] Failed to create signal:', error)
      return null
    }
  }

  /**
   * Execute buy/sell order
   */
  async executeOrder(strategy, symbol, signal) {
    try {
      if (!this.paperTradingMode) {
        // Real trading
        const positionSize = strategy.position_size_php || 1000

        if (signal.signal === 'BUY') {
          const order = await coinsPhApi.buyMarket(symbol, positionSize)
          return await this.recordOrder(strategy, symbol, 'BUY', order)
        } else if (signal.signal === 'SELL') {
          // Get current position
          const account = await coinsPhApi.getAccount()
          const baseAsset = symbol.replace('PHP', '')
          const balance = account.balances?.find(b => b.asset === baseAsset)
          
          if (balance && parseFloat(balance.free) > 0) {
            const order = await coinsPhApi.sellMarket(symbol, balance.free)
            return await this.recordOrder(strategy, symbol, 'SELL', order)
          }
        }
      } else {
        // Paper trading - simulate order
        return {
          coins_ph_order_id: `PAPER_${Date.now()}`,
          symbol,
          side: signal.signal,
          status: 'FILLED',
          fill_price: signal.entryPrice || 0,
          filled_qty: (strategy.position_size_php || 1000) / (signal.entryPrice || 1),
          paperTrade: true
        }
      }
    } catch (error) {
      console.error('[Bot] Order execution failed:', error)
      throw error
    }
  }

  /**
   * Record order in database
   */
  async recordOrder(strategy, symbol, side, coinsPhOrder) {
    try {
      const { data } = await supabase
        .from('bot_orders')
        .insert({
          user_id: this.userId,
          strategy_id: strategy.id,
          symbol,
          side,
          order_type: 'MARKET',
          coins_ph_order_id: coinsPhOrder.orderId || `PAPER_${Date.now()}`,
          quantity: coinsPhOrder.executedQty || coinsPhOrder.filled_qty || 0,
          price: coinsPhOrder.price || 0,
          quote_qty: coinsPhOrder.cummulativeQuoteQty || strategy.position_size_php || 0,
          status: coinsPhOrder.status || 'FILLED'
        })
        .select()
        .single()

      this.orders.set(data.id, data)
      return data
    } catch (error) {
      console.error('[Bot] Failed to record order:', error)
      return null
    }
  }

  /**
   * Check and manage risk (stop losses, take profits, etc)
   */
  async manageRisk() {
    try {
      const now = Date.now()
      
      for (const [positionId, position] of this.activePositions) {
        try {
          // Update position PnL
          const currentPrice = await this.getCurrentPrice(position.symbol)
          const pnl = (currentPrice - position.entry_price) * position.quantity
          
          // Check stop loss
          if (pnl < 0 && Math.abs(pnl) > (position.entry_price * position.quantity * (this.maxLossPercent / 100))) {
            console.log(`[Bot] Stop loss triggered for position ${positionId}`)
            await this.closePosition(positionId, currentPrice, 'STOP_LOSS_HIT')
          }
          
          // Check take profit
          if (pnl > 0 && pnl > (position.entry_price * position.quantity * 0.05)) {
            // Simple: take profit at 5%
            console.log(`[Bot] Take profit triggered for position ${positionId}`)
            await this.closePosition(positionId, currentPrice, 'TAKE_PROFIT_HIT')
          }
        } catch (error) {
          console.error(`[Bot] Risk management error for position ${positionId}:`, error)
        }
      }

      // Check daily loss limit
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: todayTrades } = await supabase
        .from('completed_trades')
        .select('pnl_php')
        .eq('user_id', this.userId)
        .gte('created_at', todayStart.toISOString())

      const dailyPnL = todayTrades?.reduce((sum, t) => sum + (t.pnl_php || 0), 0) || 0
      
      if (dailyPnL < -this.maxDailyLoss) {
        console.warn(`[Bot] Daily loss limit hit: ${dailyPnL} PHP`)
        await this.disableAllStrategies()
      }
    } catch (error) {
      console.error('[Bot] Risk management failed:', error)
    }
  }

  /**
   * Get current price for symbol
   */
  async getCurrentPrice(symbol) {
    try {
      const priceData = await coinsPhApi.getPrice(symbol)
      return parseFloat(priceData.price)
    } catch (error) {
      console.error(`[Bot] Failed to get price for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId, exitPrice, reason = 'MANUAL') {
    try {
      const position = this.activePositions.get(positionId)
      
      const pnl = (exitPrice - position.entry_price) * position.quantity
      const pnlPercent = (pnl / (position.entry_price * position.quantity)) * 100

      const { data } = await supabase
        .from('completed_trades')
        .update({
          exit_price: exitPrice,
          exit_time: new Date(),
          pnl_php: pnl,
          pnl_percent: pnlPercent,
          status: reason
        })
        .eq('id', positionId)
        .select()
        .single()

      this.activePositions.delete(positionId)
      console.log(`[Bot] Position closed: ${reason}, PnL: ${pnl} PHP (${pnlPercent}%)`)
      
      return data
    } catch (error) {
      console.error('[Bot] Failed to close position:', error)
    }
  }

  /**
   * Disable all strategies (emergency)
   */
  async disableAllStrategies() {
    try {
      await supabase
        .from('trading_strategies')
        .update({ enabled: false })
        .eq('user_id', this.userId)

      this.strategies = []
      console.warn('[Bot] All strategies disabled (emergency stop)')
    } catch (error) {
      console.error('[Bot] Failed to disable strategies:', error)
    }
  }

  /**
   * Log execution event
   */
  async logExecution(log) {
    try {
      await supabase
        .from('bot_execution_logs')
        .insert({
          user_id: this.userId,
          strategy_id: log.strategy_id,
          event_type: log.event_type,
          symbol: log.symbol,
          details: log.details,
          error_message: log.error_message,
          success: log.success !== false
        })
    } catch (error) {
      console.error('[Bot] Failed to log execution:', error)
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(strategyId = null) {
    try {
      let query = supabase
        .from('strategy_performance')
        .select('*')
        .eq('user_id', this.userId)

      if (strategyId) {
        query = query.eq('strategy_id', strategyId)
      }

      const { data } = await query

      return data
    } catch (error) {
      console.error('[Bot] Failed to get performance metrics:', error)
      return []
    }
  }

  /**
   * Start continuous bot loop
   */
  startLoop(intervalMs = 300000) { // 5 minutes default
    console.log(`[Bot] Starting execution loop every ${intervalMs}ms`)
    
    this.loopInterval = setInterval(() => {
      this.executeAll().catch(err => {
        console.error('[Bot] Loop execution error:', err)
      })
    }, intervalMs)

    return this.loopInterval
  }

  /**
   * Stop the bot loop
   */
  stopLoop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval)
      console.log('[Bot] Execution loop stopped')
    }
  }
}

// Create and manage bot instances
const botInstances = new Map()

export async function getBotInstance(userId, paperTradingMode = true) {
  if (!botInstances.has(userId)) {
    const bot = new TradingBotOrchestrator(userId, paperTradingMode)
    await bot.initialize()
    botInstances.set(userId, bot)
  }
  return botInstances.get(userId)
}

export function stopBotInstance(userId) {
  const bot = botInstances.get(userId)
  if (bot) {
    bot.stopLoop()
    botInstances.delete(userId)
  }
}

export default TradingBotOrchestrator
