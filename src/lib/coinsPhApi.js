const PROXY_URL = import.meta.env.VITE_PROJECT_URL?.replace(/\/$/, '') + '/functions/v1/coinsph-proxy'

export class CoinsPhApi {
  constructor() {
    // Credentials are now handled by the Supabase Edge Function
    // No need to store them on the client
  }

  /**
   * Make request through Supabase Edge Function proxy
   */
  async request(method, path, params = {}, isPublic = false) {
    try {
      if (!PROXY_URL) {
        throw new Error('Supabase project URL not configured (VITE_PROJECT_URL)')
      }

      // Prepare request payload
      const payload = {
        method,
        path,
        params,
        isPublic,
      }

      console.log('[CoinsPhApi] Calling proxy:', { method, path })

      // Call the proxy function
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || `API Error: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error(`[CoinsPhApi] ${method} ${path}:`, error.message)
      throw error
    }
  }

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get current price of a symbol
   */
  async getPrice(symbol) {
    return this.request('GET', '/openapi/quote/v1/ticker/price', { symbol }, false)
  }

  /**
   * Get ticker info (24h stats)
   */
  async getTicker(symbol) {
    return this.request('GET', '/openapi/quote/v1/ticker/24hr', { symbol }, false)
  }

  /**
   * Get klines/candlestick data
   */
  async getKlines(symbol, interval = '1h', limit = 100, startTime = null, endTime = null) {
    const params = { symbol, interval, limit }
    if (startTime) params.startTime = startTime
    if (endTime) params.endTime = endTime
    return this.request('GET', '/openapi/quote/v1/klines', params, true)
  }

  /**
   * Get order book
   */
  async getOrderBook(symbol, limit = 20) {
    return this.request('GET', '/openapi/quote/v1/depth', { symbol, limit }, true)
  }

  /**
   * Get recent trades
   */
  async getRecentTrades(symbol, limit = 100) {
    return this.request('GET', '/openapi/quote/v1/trades', { symbol, limit }, true)
  }

  /**
   * Get exchange info
   */
  async getExchangeInfo() {
    return this.request('GET', '/openapi/v1/exchangeInfo', {}, true)
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  /**
   * Get account information and balances
   */
  async getAccount() {
    return this.request('GET', '/openapi/v3/account', {})
  }

  /**
   * Get balance of specific asset
   */
  async getBalance(asset) {
    const account = await this.getAccount()
    const balance = account.balances?.find(b => b.asset === asset)
    return balance || { asset, free: '0', locked: '0' }
  }

  /**
   * Get list of open orders
   */
  async getOpenOrders(symbol = null) {
    const params = {}
    if (symbol) params.symbol = symbol
    return this.request('GET', '/openapi/v3/openOrders', params)
  }

  /**
   * Get order history
   */
  async getOrderHistory(symbol, limit = 100) {
    return this.request('GET', '/openapi/v3/allOrders', { symbol, limit })
  }

  /**
   * Get specific order details
   */
  async getOrder(symbol, orderId = null, origClientOrderId = null) {
    const params = { symbol }
    if (orderId) params.orderId = orderId
    if (origClientOrderId) params.origClientOrderId = origClientOrderId
    return this.request('GET', '/openapi/v3/order', params)
  }

  /**
   * Place a new order
   */
  async placeOrder(symbol, side, type, quantity = null, price = null, quoteOrderQty = null, options = {}) {
    const params = {
      symbol,
      side: side.toUpperCase(), // BUY or SELL
      type: type.toUpperCase(), // MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT
      ...options
    }

    if (quantity) params.quantity = quantity
    if (price) params.price = price
    if (quoteOrderQty) params.quoteOrderQty = quoteOrderQty // For MARKET orders: spend this much PHP

    return this.request('POST', '/openapi/v3/order', params)
  }

  /**
   * Market BUY order
   */
  async buyMarket(symbol, quoteOrderQty) {
    return this.placeOrder(symbol, 'BUY', 'MARKET', null, null, quoteOrderQty)
  }

  /**
   * Market SELL order
   */
  async sellMarket(symbol, quantity) {
    return this.placeOrder(symbol, 'SELL', 'MARKET', quantity)
  }

  /**
   * Limit BUY order
   */
  async buyLimit(symbol, quantity, price) {
    return this.placeOrder(symbol, 'BUY', 'LIMIT', quantity, price, null, {
      timeInForce: 'GTC' // Good Till Cancel
    })
  }

  /**
   * Limit SELL order
   */
  async sellLimit(symbol, quantity, price) {
    return this.placeOrder(symbol, 'SELL', 'LIMIT', quantity, price, null, {
      timeInForce: 'GTC'
    })
  }

  /**
   * Stop Loss order
   */
  async stopLoss(symbol, side, quantity, stopPrice) {
    return this.placeOrder(symbol, side, 'STOP_LOSS', quantity, stopPrice)
  }

  /**
   * Take Profit order
   */
  async takeProfit(symbol, side, quantity, stopPrice) {
    return this.placeOrder(symbol, side, 'TAKE_PROFIT', quantity, stopPrice)
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol, orderId = null, origClientOrderId = null) {
    const params = { symbol }
    if (orderId) params.orderId = orderId
    if (origClientOrderId) params.origClientOrderId = origClientOrderId
    return this.request('DELETE', '/openapi/v3/order', params)
  }

  /**
   * Get trade history
   */
  async getMyTrades(symbol, limit = 500) {
    return this.request('GET', '/openapi/v3/myTrades', { symbol, limit })
  }

  /**
   * Get account trades with filters
   */
  async getAccountTrades(options = {}) {
    return this.request('GET', '/openapi/v3/myTrades', options)
  }

  /**
   * Ping server (test connectivity)
   */
  async ping() {
    return this.request('GET', '/openapi/v1/ping', {}, true)
  }

  /**
   * Get server time
   */
  async getServerTime() {
    const response = await this.request('GET', '/openapi/v1/time', {}, true)
    return response.serverTime
  }

  // ==================== WALLET ENDPOINTS ====================

  /**
   * Get all coins' information
   */
  async getAllCoinsInformation() {
    return this.request('GET', '/openapi/wallet/v1/coin/all/information', {})
  }

  /**
   * Get deposit address for a specific coin
   */
  async getDepositAddress(coin) {
    return this.request('GET', '/openapi/wallet/v1/deposit/address', { coin })
  }

  /**
   * Get deposit history
   */
  async getDepositHistory(coin = null, offset = 0, limit = 100, startTime = null, endTime = null) {
    const params = { offset, limit }
    if (coin) params.coin = coin
    if (startTime) params.startTime = startTime
    if (endTime) params.endTime = endTime
    return this.request('GET', '/openapi/wallet/v1/deposit/hisrec', params)
  }

  /**
   * Withdraw - initiate a withdrawal
   */
  async withdraw(coin, withdrawOrderId = null, network = null, address = null, amount = null, addressTag = null, transactionFeeFlag = null, options = {}) {
    const params = { coin, ...options }
    if (withdrawOrderId) params.withdrawOrderId = withdrawOrderId
    if (network) params.network = network
    if (address) params.address = address
    if (amount) params.amount = amount
    if (addressTag) params.addressTag = addressTag
    if (transactionFeeFlag !== null) params.transactionFeeFlag = transactionFeeFlag
    return this.request('POST', '/openapi/wallet/v1/withdraw/apply', params)
  }

  /**
   * Get withdraw history
   */
  async getWithdrawHistory(coin = null, offset = 0, limit = 100, startTime = null, endTime = null) {
    const params = { offset, limit }
    if (coin) params.coin = coin
    if (startTime) params.startTime = startTime
    if (endTime) params.endTime = endTime
    return this.request('GET', '/openapi/wallet/v1/withdraw/history', params)
  }

  /**
   * Get trading rules and limits
   */
  async getTradingRules() {
    const info = await this.getExchangeInfo()
    const symbols = {}
    
    info.symbols?.forEach(symbol => {
      symbols[symbol.symbol] = {
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        minPrice: this.getFilter(symbol, 'PRICE_FILTER')?.minPrice,
        maxPrice: this.getFilter(symbol, 'PRICE_FILTER')?.maxPrice,
        minQty: this.getFilter(symbol, 'LOT_SIZE')?.minQty,
        maxQty: this.getFilter(symbol, 'LOT_SIZE')?.maxQty,
        minNotional: this.getFilter(symbol, 'MIN_NOTIONAL')?.minNotional,
        status: symbol.status
      }
    })

    return symbols
  }

  /**
   * Helper to get filter from symbol info
   */
  getFilter(symbol, filterType) {
    return symbol.filters?.find(f => f.filterType === filterType)
  }
}

// Export singleton instance
export const coinsPhApi = new CoinsPhApi()

export default coinsPhApi
