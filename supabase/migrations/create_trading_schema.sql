-- Trading Tables for Coins.ph Integration

-- Strategy configurations
CREATE TABLE IF NOT EXISTS trading_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'analysis', 'signals', 'execution', 'risk', 'profit', 'planning', 'automation'
  strategy_type TEXT NOT NULL, -- 'sma_crossover', 'rsi_oversold', 'macd_cross', etc.
  enabled BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}'::jsonb, -- Strategy-specific parameters
  symbols TEXT[] DEFAULT ARRAY['BTCPHP', 'ETHPHP'], -- Symbols to trade
  timeframe TEXT DEFAULT '1h', -- Candle timeframe: 1m, 5m, 15m, 1h, 4h, 1d
  position_size_php DECIMAL(12, 2) DEFAULT 1000, -- Amount in PHP per trade
  max_open_positions INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- Market data (candles/OHLCV)
CREATE TABLE IF NOT EXISTS market_candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL, -- BTCPHP, ETHPHP, etc.
  timeframe TEXT NOT NULL, -- 1m, 5m, 15m, 1h, 4h, 1d
  open_time TIMESTAMP NOT NULL,
  close_time TIMESTAMP NOT NULL,
  open_price DECIMAL(18, 8) NOT NULL,
  high_price DECIMAL(18, 8) NOT NULL,
  low_price DECIMAL(18, 8) NOT NULL,
  close_price DECIMAL(18, 8) NOT NULL,
  volume DECIMAL(18, 8) NOT NULL,
  quote_asset_volume DECIMAL(18, 8),
  number_of_trades INT,
  taker_buy_base_asset_volume DECIMAL(18, 8),
  taker_buy_quote_asset_volume DECIMAL(18, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, timeframe, open_time)
);

CREATE INDEX idx_candles_symbol_timeframe ON market_candles(symbol, timeframe, close_time DESC);
CREATE INDEX idx_candles_timestamp ON market_candles(close_time DESC);

-- Technical indicators (cached)
CREATE TABLE IF NOT EXISTS technical_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candle_id UUID REFERENCES market_candles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  sma_20 DECIMAL(18, 8),
  sma_50 DECIMAL(18, 8),
  sma_200 DECIMAL(18, 8),
  ema_12 DECIMAL(18, 8),
  ema_26 DECIMAL(18, 8),
  rsi_14 DECIMAL(5, 2),
  macd_line DECIMAL(18, 8),
  macd_signal DECIMAL(18, 8),
  macd_histogram DECIMAL(18, 8),
  vwap DECIMAL(18, 8),
  atr_14 DECIMAL(18, 8),
  obv DECIMAL(18, 8),
  bbands_upper DECIMAL(18, 8),
  bbands_middle DECIMAL(18, 8),
  bbands_lower DECIMAL(18, 8),
  fib_levels JSONB, -- {61.8: price, 50: price, 38.2: price}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX idx_indicators_symbol_timeframe ON technical_indicators(symbol, timeframe, timestamp DESC);

-- Trading signals
CREATE TABLE IF NOT EXISTS trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES trading_strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- 'BUY', 'SELL', 'HOLD'
  signal_strength DECIMAL(3, 2) DEFAULT 1.0, -- 0.0 to 1.0 confidence
  price DECIMAL(18, 8) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  indicators JSONB, -- {sma_20: x, rsi: y, macd: z}
  reasoning TEXT,
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signals_user_symbol ON trading_signals(user_id, symbol, timestamp DESC);
CREATE INDEX idx_signals_executed ON trading_signals(executed, timestamp DESC);

-- Orders placed via bot
CREATE TABLE IF NOT EXISTS bot_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES trading_strategies(id) ON DELETE SET NULL,
  signal_id UUID REFERENCES trading_signals(id) ON DELETE SET NULL,
  coins_ph_order_id TEXT UNIQUE, -- Order ID from Coins.ph API
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'BUY' or 'SELL'
  order_type TEXT NOT NULL, -- 'MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'
  quantity DECIMAL(18, 8),
  price DECIMAL(18, 8),
  quote_qty DECIMAL(18, 8), -- PHP amount
  status TEXT DEFAULT 'PENDING', -- PENDING, OPEN, FILLED, PARTIALLY_FILLED, CANCELLED, EXPIRED
  fill_price DECIMAL(18, 8),
  filled_qty DECIMAL(18, 8),
  commission DECIMAL(18, 8),
  commission_asset TEXT DEFAULT 'PHP',
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  filled_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_symbol ON bot_orders(user_id, symbol, created_at DESC);
CREATE INDEX idx_orders_status ON bot_orders(status, created_at DESC);
CREATE INDEX idx_orders_coins_id ON bot_orders(coins_ph_order_id);

-- Trades (completed, linked buy+sell)
CREATE TABLE IF NOT EXISTS completed_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES trading_strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  entry_order_id UUID REFERENCES bot_orders(id),
  exit_order_id UUID REFERENCES bot_orders(id),
  entry_price DECIMAL(18, 8) NOT NULL,
  exit_price DECIMAL(18, 8),
  quantity DECIMAL(18, 8) NOT NULL,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,
  pnl_php DECIMAL(12, 4), -- Profit/loss in PHP
  pnl_percent DECIMAL(5, 2), -- P&L percentage
  commission_php DECIMAL(12, 4),
  status TEXT DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'STOP_LOSS_HIT', 'TAKE_PROFIT_HIT'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_user_symbol ON completed_trades(user_id, symbol, entry_time DESC);
CREATE INDEX idx_trades_status ON completed_trades(status);

-- Bot execution logs
CREATE TABLE IF NOT EXISTS bot_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES trading_strategies(id) ON DELETE SET NULL,
  execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL, -- 'ANALYSIS', 'SIGNAL', 'ORDER_PLACED', 'ORDER_FILLED', 'ERROR'
  symbol TEXT,
  details JSONB,
  error_message TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_user_strategy ON bot_execution_logs(user_id, strategy_id, execution_time DESC);
CREATE INDEX idx_logs_timestamp ON bot_execution_logs(execution_time DESC);

-- Strategy performance metrics
CREATE TABLE IF NOT EXISTS strategy_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES trading_strategies(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  trades_count INT DEFAULT 0,
  winning_trades INT DEFAULT 0,
  losing_trades INT DEFAULT 0,
  total_pnl_php DECIMAL(12, 4) DEFAULT 0,
  win_rate DECIMAL(5, 2), -- Percentage
  avg_win_php DECIMAL(12, 4),
  avg_loss_php DECIMAL(12, 4),
  max_drawdown DECIMAL(5, 2),
  sharpe_ratio DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, strategy_id, period_date)
);

-- User trading settings and preferences
CREATE TABLE IF NOT EXISTS trading_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  trading_enabled BOOLEAN DEFAULT FALSE,
  paper_trading_mode BOOLEAN DEFAULT TRUE, -- Simulated trading first
  max_daily_loss_php DECIMAL(12, 2) DEFAULT 1000,
  max_loss_percent DECIMAL(5, 2) DEFAULT 5, -- Stop trading if losing 5%
  auto_stop_loss_percent DECIMAL(5, 2) DEFAULT 1, -- 1% below entry
  auto_take_profit_percent DECIMAL(5, 2) DEFAULT 2, -- 2% above entry
  telegram_chat_id TEXT, -- For alerts
  telegram_token TEXT, -- Encrypted
  alert_on_signal BOOLEAN DEFAULT TRUE,
  alert_on_order BOOLEAN DEFAULT TRUE,
  alert_on_error BOOLEAN DEFAULT TRUE,
  min_sentiment_threshold DECIMAL(3, 2) DEFAULT 0.5, -- Only trade when market sentiment >= this
  max_news_event_hours_before INT DEFAULT 24, -- Don't trade X hours before major news
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market sentiment/news events
CREATE TABLE IF NOT EXISTS market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'ECONOMIC_REPORT', 'EARNINGS', 'INTEREST_RATE', 'FED_DECISION'
  scheduled_time TIMESTAMP NOT NULL,
  impact_level TEXT, -- 'LOW', 'MEDIUM', 'HIGH'
  related_symbols TEXT[],
  sentiment DECIMAL(3, 2), -- -1.0 to 1.0 (negative to positive)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Arbitrage opportunities
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  exchange_1 TEXT NOT NULL, -- 'COINS_PH'
  exchange_2 TEXT NOT NULL,
  price_1 DECIMAL(18, 8) NOT NULL,
  price_2 DECIMAL(18, 8) NOT NULL,
  profit_percent DECIMAL(5, 4), -- Expected profit %
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expired BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Whale watch / large orders
CREATE TABLE IF NOT EXISTS whale_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- BUY or SELL
  quantity DECIMAL(18, 8) NOT NULL,
  price DECIMAL(18, 8) NOT NULL,
  volume_usd DECIMAL(18, 2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_whale_trades_timestamp ON whale_trades(symbol, timestamp DESC);
