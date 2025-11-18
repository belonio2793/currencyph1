# 🤖 Trading Bot System - Complete Implementation Guide

## Overview

Your complete trading bot system is now fully implemented with:
- **35 Trading Strategies** across 7 categories
- **Real-time Market Analysis** with technical indicators
- **Automated Order Execution** via Coins.ph API
- **Risk Management** with stop-loss and take-profit
- **Performance Tracking** and analytics
- **Supabase Edge Functions** for 24/7 execution

---

## 🚀 Quick Start

### 1. Access Trading Dashboard

1. Login to your account
2. Click **"🤖 Trading Bot"** in the navigation menu (under Wallets, Send, Bills, etc.)
3. You'll see the Trading Dashboard with all controls

### 2. Enable Trading

1. In the Dashboard, look for the blue controls at the top
2. Click **"✓ Trading ON"** to enable the bot
3. Choose between:
   - **📝 Paper Trading Mode** (recommended first!) - Simulates trades without real money
   - **💰 Real Trading Mode** - Executes actual trades on Coins.ph

### 3. Create Your First Strategy

1. Go to the **"Strategies"** tab
2. Click **"+ New Strategy"**
3. Fill in:
   - **Strategy Name**: e.g., "Bitcoin 1H SMA Crossover"
   - **Category**: Choose "Signals", "Execution", or "Risk Management"
   - **Strategy Type**: Pick from available types (SMA Crossover, MACD, etc.)
   - **Timeframe**: 1m, 5m, 15m, 1h, 4h, or 1d
   - **Position Size**: How much PHP to risk per trade (e.g., ₱1000)
   - **Max Open Positions**: Maximum concurrent trades (e.g., 3)
4. Click **"Create Strategy"**
5. Toggle the strategy **"ON"** to enable it

### 4. Monitor Your Trades

- **Overview Tab**: See active orders and P&L
- **Market Analysis Tab**: Analyze BTC, ETH, SOL in real-time
- **Positions Tab**: Track open trades and close them if needed
- **Performance Tab**: View detailed statistics and metrics

---

## 📊 Understanding the 35 Strategies

### CATEGORY 1: Market Analysis (Read Market)
Understand what's happening right now:

1. **Market Direction Analysis** - Is Bitcoin/Ethereum up or down? How likely to continue?
2. **Strongest Movers** - Which coins are moving most today?
3. **Indicator Divergence** - Do RSI, MACD, OBV tell different stories? (Reversal warning)
4. **Unusual Volume Detection** - Which assets have sudden volume spikes?
5. **Support/Resistance** - Find floor/ceiling prices

**How to Use**: Go to "Market Analysis" tab, select symbol, see real-time indicators

---

### CATEGORY 2: Auto Signals (Generate Buy/Sell Signals)
Get alerts when to enter/exit:

6. **SMA Crossover + RSI** - Buy when price > 50 & 200 SMA AND RSI oversold (<30)
7. **Calm Before Storm** - When volatility very low, big move coming
8. **Candle Above 200 SMA** - Closes above 200 SMA with increasing volume = BUY
9. **Fibonacci Rejection + MACD** - Fib level rejection + MACD reversal = SELL
10. **Fake Out Detection** - Spot when big players fake out small traders

**How to Use**: Create strategy with "signals" category, bot will generate signals automatically

---

### CATEGORY 3: Auto Execution (Place Orders)
Automatically execute trades:

11. **Support Bounce** - When price bounces off support, buy with automatic stop-loss
12. **DCA on Dips** - Every time price drops 2% in uptrend, buy more (Dollar Cost Average)
13. **Breakdown Sell** - When price breaks recent low with volume, auto-sell
14. **Grid Trading** - In sideways market, place buy/sell every 0.5% for small profits
15. **Triple Confirmation** - Only trade when 3+ indicators agree

**How to Use**: Create "execution" strategy, enable it, bot executes automatically based on signals

---

### CATEGORY 4: Risk Management (Protect Your Money)
Prevent losing everything:

16. **Trailing Stop Loss** - When trade up 1%, move stop to entry (can't lose)
17. **Circuit Breaker** - Stop all trading if market too volatile
18. **Position Size Adjustment** - If losing >5%, trade smaller amounts
19. **Sentiment Filter** - Only trade when market sentiment positive
20. **News Event Avoidance** - Close trades 24h before major economic news

**How to Use**: Settings are in "Trading Settings", automatically applied to all trades

---

### CATEGORY 5: Profit Optimization (Make More Money)
Maximize gains:

21. **Partial Profit Taking** - Sell 25-50% at resistance levels to lock in gains
22. **ATR-Based Stop** - Move stop-loss using ATR for smart protection
23. **Mean Reversion** - In sideways market, bet price returns to average
24. **Arbitrage Detection** - Find price differences between exchanges (free profit!)
25. **Optimal Entry Timing** - Find best second to enter on 1m/5m charts

**How to Use**: These are automatic profit helpers, built into execution strategies

---

### CATEGORY 6: Complete Plans (Full Trading Plans)
Ready-made trading systems:

26. **Day Trading Plan** - Fast trades on volatile coins (15min chart, 2% profit/trade)
27. **Swing Trading Plan** - Hold 3-21 days (4h chart, 10% profit/trade)
28. **Scalping Plan** - Very fast (1min chart, 0.2% per trade)
29. **Long-Term Buy & Hold** - Hold 6-24 months (1d chart, rebalance monthly)
30. **Trend Direction Prediction** - Predict if today is trending or choppy

**How to Use**: Choose your style, create strategy matching the plan timeframes

---

### CATEGORY 7: Automation Bots (Full Money-Making Robots)
Advanced bots:

31. **Fear/Greed Bot** - Buy when everyone scared (Fear <30), sell when greedy (>70)
32. **Correlation Bot** - BTC & ETH usually move together - profit from divergence
33. **Volume Spike Follower** - When huge volume appears, jump in that direction
34. **Whale Follower** - Copy big traders quietly with small money
35. **Strategy Backtester** - Test each strategy on history, run best one live

**How to Use**: These run 24/7 automatically once enabled

---

## 🔑 Key Files & Structure

### Core Modules (in `/src/lib/`)

**coinsPhApi.js**
```javascript
- Real API client for Coins.ph
- Handles buying, selling, checking balance, etc.
- All requests HMAC-SHA256 signed
```

**technicalIndicators.js**
```javascript
- SMA, EMA, RSI, MACD, Bollinger Bands, ATR, OBV, VWAP
- Fibonacci levels, Support/Resistance
- Indicator divergence detection
```

**tradingStrategies.js**
```javascript
- All 35 strategies implemented
- Each returns: { signal: 'BUY'|'SELL'|'HOLD', strength: 0-1 }
```

**tradingBotOrchestrator.js**
```javascript
- Main bot engine
- Manages strategy execution, orders, positions, risk
- Call: getBotInstance(userId, paperTradingMode=true)
- Then: bot.executeAll() to run all strategies
```

### Database Schema (Supabase SQL)

**trading_strategies** - Your strategy configurations
**market_candles** - OHLCV price history
**technical_indicators** - Cached indicator values
**trading_signals** - Generated BUY/SELL signals
**bot_orders** - Orders placed by bot
**completed_trades** - Closed trades with P&L
**bot_execution_logs** - What the bot did
**strategy_performance** - Win rate, profit factor, etc.
**trading_settings** - User preferences (max loss, paper/real mode, etc.)

### Edge Functions (Supabase)

**trading-bot-executor** - Main execution function
```
POST /functions/v1/trading-bot-executor
{ action: "execute_strategies", userId: "..." }
```

**trading-bot-scheduler** - Runs every hour automatically
```
Triggers: Execute all active strategies for all users
Result: Orders placed, trades managed, P&L calculated
```

### Frontend Components (in `/src/components/Trading/`)

- **TradingDashboard.jsx** - Main interface
- **MarketAnalysis.jsx** - Real-time market data
- **StrategyManager.jsx** - Create/manage strategies
- **PositionsMonitor.jsx** - Track open trades
- **PerformanceMetrics.jsx** - Win rate, P&L stats

---

## 🎯 Usage Examples

### Example 1: Simple BTC Strategy

```
1. Click "🤖 Trading Bot" in nav
2. Go to "Strategies" tab
3. Click "+ New Strategy"
4. Fill:
   - Name: "Bitcoin SMA 1H"
   - Category: "Signals"
   - Type: "SMA Crossover + RSI"
   - Symbol: BTCPHP
   - Timeframe: 1h
   - Position Size: ₱500
   - Max Positions: 2
5. Click "Create Strategy"
6. Toggle it ON
7. Bot automatically generates BUY/SELL signals!
```

### Example 2: Check What's Happening Now

```
1. Go to Trading Dashboard
2. Click "Market Analysis" tab
3. Select BTCPHP from buttons
4. See:
   - Current price & direction
   - SMA20, SMA50, SMA200
   - RSI (overbought/oversold?)
   - MACD (trend strength)
   - Support/Resistance levels
   - Volume analysis
```

### Example 3: Monitor Your Trades

```
1. Go to "Positions" tab
2. See all open trades with:
   - Entry price vs current price
   - Unrealized P&L (PHP & %)
   - Time held
   - Close button if needed
3. Go to "Performance" tab for stats:
   - Win rate
   - Best/worst trade
   - Profit factor
```

---

## 💡 Pro Tips

### Start with Paper Trading
- Enable "📝 Paper Trading Mode" first
- It simulates trades without risking real money
- Test strategies, see how they perform
- Switch to real when confident

### Test One Strategy at a Time
- Don't enable 10 strategies at once
- Create one, watch it for 1-2 weeks
- See results before adding more

### Use Small Position Sizes
- Start with ₱500-1000 per trade
- Increase as you gain confidence
- Risk only what you can afford to lose

### Monitor Daily
- Check "Overview" tab each day
- Review "Market Analysis" for context
- Adjust if market conditions change

### Understand Each Strategy
- Read the strategy description
- Know when it works best (trending vs range-bound)
- Only use in appropriate conditions

### Risk Management is #1
- Set max daily loss (Settings)
- Use stop-loss on every trade (automatic)
- Don't risk >5% of account per trade
- Enable Circuit Breaker for protection

---

## 🔧 Configuration

### Trading Settings (First Time)

1. Go to Home page
2. Click your Profile or find Settings
3. Set:
   - **Trading Enabled**: ON/OFF
   - **Paper Trading**: ON (start here!)
   - **Max Daily Loss**: ₱5000 (stop if losing this much)
   - **Max Loss %**: 5% (stop if losing 5% of account)
   - **Auto Stop-Loss**: 1% (exit if down 1%)
   - **Auto Take-Profit**: 2% (exit if up 2%)
   - **Telegram Alerts**: (optional, for notifications)

### Strategy Config (When Creating)

```javascript
{
  "rsi_period": 14,           // RSI sensitivity
  "sma_periods": [20, 50],    // Which SMAs to track
  "macd_fast": 12,            // MACD speed
  "volume_spike": 1.5,        // Volume multiplier
  "min_candles": 100          // History required
}
```

---

## 📈 Performance Metrics Explained

**Win Rate** - % of profitable trades
- Good: >55%
- Excellent: >65%

**Profit Factor** - Total wins / Total losses
- Good: >1.5
- Excellent: >2.0

**Average Win** - Average profit per winning trade
- See if wins are bigger than losses

**Risk/Reward Ratio** - Avg win / Avg loss
- Good: >1.5 (win 1.5x your risk)

**Best/Worst Trade** - Largest win and loss
- Tells you about volatility

---

## 🚨 Emergency Controls

**Stop All Trading**
- Click "✓ Trading ON" → changes to "�� Trading OFF"
- Disables all strategies immediately
- Open positions still exist (manage manually if needed)

**Close Specific Position**
- Go to "Positions" tab
- Find the trade
- Click "Close" button
- Exits at current market price

**Switch to Paper Trading**
- Click "💰 Real Trading" → changes to "📝 Paper Trading"
- Subsequent orders are simulated, not real

---

## 🐛 Troubleshooting

### No Signals Being Generated
1. Check if strategy is enabled (toggle ON)
2. Wait for bot execution cycle (every 5 min to 1 hour)
3. Check candles are loading (Market Analysis tab)
4. Try "Execute Now" button

### Can't Get Account Balance
1. Check Coins.ph API key in settings
2. Bot may be in paper trading mode (intentional)
3. Check network connection

### Orders Not Executing
1. Confirm not in paper trading mode
2. Check Coins.ph account has balance
3. Verify API key/secret correct
4. Check order requirements met (not at extreme prices)

### No Historical Data
1. Wait for bot to fetch candles (5-10 min)
2. Check Market Analysis can load prices
3. Ensure internet connection stable

---

## 🔐 Security & Privacy

**Your API Key**
- Stored encrypted in Supabase
- Never exposed to frontend (server-side only)
- Used only for bot trades
- You can revoke anytime in Coins.ph

**Your Data**
- Trades, orders, balances: Private, not shared
- Performance data: Used only for your analytics
- Supabase encryption: AES-256

**Best Practices**
- Use separate API key for bot (don't use main account key)
- Enable IP whitelist in Coins.ph if possible
- Monitor orders periodically
- Review bot decisions in execution logs

---

## 📞 Getting Help

### Check Execution Logs
```
1. Go to Dashboard
2. Look for bot messages at top
3. These show what bot did and why
4. Errors appear in red
```

### Common Issues & Fixes

**"Failed to fetch candles"**
- Bot can't connect to Coins.ph API
- Check internet
- Coins.ph API might be down
- Try again in few minutes

**"Invalid login credentials"**
- API key/secret incorrect
- Check environment variables
- Regenerate API key in Coins.ph

**"Insufficient balance"**
- Account doesn't have enough PHP
- Deposit more to Coins.ph wallet
- Or reduce position size

**"Order rejected"**
- Price moved too far (slippage)
- Order conflicts with existing orders
- Exchange rules violated
- Reduce position size or use limit orders

---

## 🎓 Learning Path

1. **Week 1**: Paper trading, simple SMA strategy, see how it works
2. **Week 2**: Add Market Analysis to understand what strategies do
3. **Week 3**: Try different strategies, compare performance
4. **Week 4**: If confident, enable real trading with small amounts
5. **Ongoing**: Monitor performance, adjust, improve

---

## 📊 Sample Trading Schedule

**Every Hour**
- Bot runs all strategies
- Generates new signals
- Executes orders
- Closes positions hitting stop-loss/take-profit
- Logs everything

**Every Day**
- You review performance in dashboard
- Check if any strategies underperforming
- Adjust settings if needed
- Monitor account balance

**Every Week**
- Review full performance metrics
- See win rate trend
- Decide if to add/remove strategies
- Rebalance position sizes

**Every Month**
- Deep dive into stats
- Which strategies work best?
- Which lose money?
- Plan improvements

---

## 🎉 Ready to Go!

Your 35-strategy, fully-automated trading bot is ready to earn money for you!

**Next Steps:**
1. Go to Trading Bot dashboard
2. Enable paper trading mode
3. Create your first strategy
4. Watch it trade for a week
5. Review performance
6. Decide if to go real

Good luck! 🚀

---

*Last Updated: 2025*
*Powered by: Coins.ph API + Supabase + React*
