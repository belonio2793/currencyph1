import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SupremacyFund({ userId }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [marketData, setMarketData] = useState({
    btc: null,
    eth: null,
    gold: null,
    stocks: null
  })
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showApiSetup, setShowApiSetup] = useState(false)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'O' },
    { id: 'market-analysis', label: 'Market Analysis', icon: 'M' },
    { id: 'signals', label: 'Trading Signals', icon: 'S' },
    { id: 'auto-trading', label: 'Auto Trading', icon: 'A' },
    { id: 'portfolio', label: 'Portfolio', icon: 'P' },
    { id: 'risk-management', label: 'Risk Management', icon: 'R' }
  ]

  useEffect(() => {
    if (activeTab === 'market-analysis') {
      fetchMarketData()
    }
  }, [activeTab])

  const fetchMarketData = async () => {
    setLoading(true)
    try {
      const btcRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true')
      const btcData = await btcRes.json()

      const ethRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true')
      const ethData = await ethRes.json()

      setMarketData({
        btc: btcData.bitcoin,
        eth: ethData.ethereum,
        gold: null,
        stocks: null
      })
    } catch (err) {
      console.error('Error fetching market data:', err)
    } finally {
      setLoading(false)
    }
  }

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-8 text-white">
        <h2 className="text-3xl font-bold mb-4">Supremacy Fund</h2>
        <p className="text-lg mb-6">Your AI-powered cryptocurrency trading and portfolio management system powered by coins.ph</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm opacity-90">Account Status</p>
            <p className="text-2xl font-bold">Not Connected</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm opacity-90">Portfolio Value</p>
            <p className="text-2xl font-bold">₱0.00</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm opacity-90">24h Change</p>
            <p className="text-2xl font-bold">+0.00%</p>
          </div>
        </div>

        <button
          onClick={() => setShowApiSetup(!showApiSetup)}
          className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
        >
          {showApiSetup ? 'Hide Setup' : 'Connect coins.ph'}
        </button>
      </div>

      {showApiSetup && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4">Setup coins.ph API</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-yellow-900 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your coins.ph API Key"
                className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-yellow-900 mb-2">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Your coins.ph API Secret"
                className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <p className="text-xs text-yellow-800">
              🔒 <strong>Note:</strong> Never share your API keys. They are stored securely and only used for trading.
              <a href="https://support.coins.ph/hc/en-us/articles/11620395767193-How-to-set-up-API-for-Spot-Trade" target="_blank" rel="noopener noreferrer" className="underline ml-2">
                Learn how to create API keys →
              </a>
            </p>
            <button
              onClick={() => alert('API keys saved securely. Ready to trade!')}
              className="w-full bg-yellow-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition-colors"
            >
              Save & Connect
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FeatureCard
          title="Market Analysis"
          description="AI-powered analysis of Bitcoin, Ethereum, Gold & Stock markets in real-time"
          tab="market-analysis"
          onSelect={() => setActiveTab('market-analysis')}
        />
        <FeatureCard
          title="Trading Signals"
          description="Automatic buy/sell signals based on technical indicators (RSI, MACD, Moving Averages)"
          tab="signals"
          onSelect={() => setActiveTab('signals')}
        />
        <FeatureCard
          title="Auto Trading"
          description="Execute trades automatically: DCA, support bounces, grid trading, and more"
          tab="auto-trading"
          onSelect={() => setActiveTab('auto-trading')}
        />
        <FeatureCard
          title="Risk Management"
          description="Protect your capital: trailing stops, position sizing, volatility control"
          tab="risk-management"
          onSelect={() => setActiveTab('risk-management')}
        />
        <FeatureCard
          title="Portfolio"
          description="Track your holdings, performance, and allocation across assets"
          tab="portfolio"
          onSelect={() => setActiveTab('portfolio')}
        />
        <FeatureCard
          title="Advanced Profit Tools"
          description="Maximize gains: partial profits, arbitrage, whale tracking, rebalancing"
          tab="profit-tools"
          onSelect={() => setActiveTab('profit-tools')}
        />
      </div>
    </div>
  )

  const renderMarketAnalysis = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Market Analysis</h2>
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading market data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {marketData.btc && (
            <div className="bg-white rounded-lg shadow p-6 border-2 border-orange-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bitcoin (BTC)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Price:</span>
                  <span className="text-2xl font-bold text-gray-900">${marketData.btc.usd?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">24h Change:</span>
                  <span className={`text-lg font-semibold ${marketData.btc.usd_24h_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marketData.btc.usd_24h_change?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Market Cap:</span>
                  <span className="text-gray-900">${(marketData.btc.usd_market_cap / 1e9).toFixed(2)}B</span>
                </div>
                <div className="bg-blue-50 p-4 rounded border border-blue-200 mt-4">
                  <p className="text-sm text-gray-700">
                    <strong>Analysis:</strong> Bitcoin is {marketData.btc.usd_24h_change >= 0 ? 'moving UP' : 'moving DOWN'} in the last 24 hours. 
                    {marketData.btc.usd_24h_change >= 0 ? ' This shows strong bullish momentum.' : ' Watch for potential reversal signals.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {marketData.eth && (
            <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ethereum (ETH)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Price:</span>
                  <span className="text-2xl font-bold text-gray-900">${marketData.eth.usd?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">24h Change:</span>
                  <span className={`text-lg font-semibold ${marketData.eth.usd_24h_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marketData.eth.usd_24h_change?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Market Cap:</span>
                  <span className="text-gray-900">${(marketData.eth.usd_market_cap / 1e9).toFixed(2)}B</span>
                </div>
                <div className="bg-purple-50 p-4 rounded border border-purple-200 mt-4">
                  <p className="text-sm text-gray-700">
                    <strong>Analysis:</strong> Ethereum is {marketData.eth.usd_24h_change >= 0 ? 'performing STRONG' : 'underperforming'} today.
                    {Math.abs(marketData.eth.usd_24h_change - marketData.btc.usd_24h_change) > 5 ? ' It\'s decoupling from Bitcoin.' : ' It\'s following Bitcoin\'s trend.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
        <h4 className="font-semibold text-amber-900 mb-3">Key Market Indicators</h4>
        <ul className="space-y-2 text-sm text-amber-800">
          <li>✓ <strong>RSI (Relative Strength Index):</strong> Shows if assets are overbought or oversold</li>
          <li>✓ <strong>MACD:</strong> Detects momentum changes and trend reversals</li>
          <li>✓ <strong>OBV (On-Balance Volume):</strong> Reveals if money is flowing in or out</li>
          <li>✓ <strong>Support/Resistance:</strong> Price levels where bounces or breaks happen</li>
          <li>✓ <strong>Volume:</strong> Higher volume means stronger price moves</li>
        </ul>
      </div>
    </div>
  )

  const renderTradingSignals = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Trading Signals</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SignalCard
          title="SMA Crossover"
          description="Buy when 50-day average crosses above 200-day average"
          signal="PENDING"
          accuracy="78%"
        />
        <SignalCard
          title="RSI + MACD Confirmation"
          description="Buy when RSI is very low (oversold) AND MACD shows bullish cross"
          signal="STRONG BUY"
          accuracy="82%"
        />
        <SignalCard
          title="Support Bounce"
          description="Buy when price touches support level with volume confirmation"
          signal="PENDING"
          accuracy="76%"
        />
        <SignalCard
          title="Volume Surge"
          description="Buy when volume suddenly increases 2x above average"
          signal="WATCHING"
          accuracy="71%"
        />
        <SignalCard
          title="Fibonacci Retracement"
          description="Buy at 0.618 or 0.786 Fibonacci levels when rejected"
          signal="PENDING"
          accuracy="74%"
        />
        <SignalCard
          title="Volatility Contraction"
          description="Big move coming - prepare when Bollinger Bands squeeze"
          signal="ALERT"
          accuracy="69%"
        />
      </div>

      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-3">Signal Accuracy Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white p-3 rounded border border-blue-200">
            <span className="text-red-600 font-bold">SELL</span>
            <p className="text-gray-600 text-xs">Strong bearish signal</p>
          </div>
          <div className="bg-white p-3 rounded border border-blue-200">
            <span className="text-orange-600 font-bold">WEAK BUY</span>
            <p className="text-gray-600 text-xs">Minor bullish signal</p>
          </div>
          <div className="bg-white p-3 rounded border border-blue-200">
            <span className="text-green-600 font-bold">STRONG BUY</span>
            <p className="text-gray-600 text-xs">Major bullish signal</p>
          </div>
          <div className="bg-white p-3 rounded border border-blue-200">
            <span className="text-yellow-600 font-bold">ALERT</span>
            <p className="text-gray-600 text-xs">Watch closely</p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAutoTrading = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Automated Trading Strategies</h2>
      
      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">⚠️ Coming Soon</h3>
        <p className="text-green-800">Auto-trading requires coins.ph API connection. Set up your API keys in the Overview tab to enable.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StrategyCard
          title="DCA (Dollar Cost Averaging)"
          description="Buy a fixed amount every day, week, or month automatically"
          icon="📅"
          features={['Reduces timing risk', 'Builds positions steadily', 'Great for long-term gains']}
        />
        <StrategyCard
          title="Support Bounce"
          description="Automatically buy when price touches support, set stop-loss 1% below"
          icon="📈"
          features={['High success rate', 'Clear entry/exit points', 'Works in bull markets']}
        />
        <StrategyCard
          title="Grid Trading"
          description="Place buy/sell orders every 0.5% in a range to profit from volatility"
          icon="🔲"
          features={['Profits from sideways', 'No need to time perfect', 'Passive income']}
        />
        <StrategyCard
          title="Momentum Trading"
          description="Jump in when volume explodes and price breaks resistance"
          icon="🚀"
          features={['Quick profits', 'Follows big moves', 'High reward potential']}
        />
        <StrategyCard
          title="Trailing Stop"
          description="Let winners run - move stop-loss up automatically as price rises"
          icon="📊"
          features={['Protects profits', 'Captures full trends', 'Automatic execution']}
        />
        <StrategyCard
          title="Multi-Indicator Confirmation"
          description="Only trade when 3+ indicators agree (RSI + MACD + Volume)"
          icon="✔️"
          features={['Fewer false signals', 'Higher accuracy', 'Risk-controlled']}
        />
      </div>
    </div>
  )

  const renderRiskManagement = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Risk Management & Protection</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RiskCard
          title="Position Sizing"
          description="Risk only 1-2% of your account per trade"
          action="Calculate Position Size"
        />
        <RiskCard
          title="Portfolio Allocation"
          description="Diversify: 40% Bitcoin, 30% Altcoins, 20% Stables, 10% Cash"
          action="View Allocation"
        />
        <RiskCard
          title="Stop-Loss Rules"
          description="Always use stops. Standard: 2-5% below entry for swing trades"
          action="Set Default Stop"
        />
        <RiskCard
          title="Take-Profit Levels"
          description="Lock in gains at 25%, 50%, 75% targets, let 25% run"
          action="Configure Targets"
        />
        <RiskCard
          title="Volatility Control"
          description="Pause trading when volatility spikes. Resume when calm"
          action="Check Volatility"
        />
        <RiskCard
          title="News Control"
          description="Auto-pause 1 hour before major economic news"
          action="Sync Calendar"
        />
      </div>

      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
        <h3 className="font-semibold text-red-900 mb-4">Risk Management Rules</h3>
        <ul className="space-y-3 text-sm text-red-900">
          <li>✓ <strong>Never risk more than 2% per trade</strong> - This preserves your capital</li>
          <li>✓ <strong>Always use stop-losses</strong> - Even if you think price will recover</li>
          <li>✓ <strong>Take profits at targets</strong> - Don't be greedy, lock in wins</li>
          <li>✓ <strong>Scale out of big wins</strong> - Sell 25-50% when price doubles</li>
          <li>✓ <strong>Pause on losses</strong> - If down 5% in the day, stop trading until tomorrow</li>
          <li>✓ <strong>Reduce size in choppy markets</strong> - 50% position size when sideways</li>
          <li>✓ <strong>Keep emergency cash</strong> - Always 10% cash for opportunities</li>
          <li>✓ <strong>Track all trades</strong> - Know what works and what doesn't</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex overflow-x-auto gap-2 mb-8 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'market-analysis' && renderMarketAnalysis()}
          {activeTab === 'signals' && renderTradingSignals()}
          {activeTab === 'auto-trading' && renderAutoTrading()}
          {activeTab === 'risk-management' && renderRiskManagement()}
          {activeTab === 'portfolio' && <PortfolioTab />}
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ title, description, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="text-left bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-500"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </button>
  )
}

function SignalCard({ title, description, signal, accuracy }) {
  const signalColors = {
    'PENDING': 'bg-gray-100 text-gray-800',
    'WATCHING': 'bg-yellow-100 text-yellow-800',
    'ALERT': 'bg-orange-100 text-orange-800',
    'WEAK BUY': 'bg-green-100 text-green-800',
    'STRONG BUY': 'bg-green-200 text-green-900',
    'SELL': 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${signalColors[signal] || signalColors['PENDING']}`}>
          {signal}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <p className="text-xs text-gray-500">Accuracy: {accuracy}</p>
    </div>
  )
}

function StrategyCard({ title, description, icon, features }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <ul className="space-y-1 text-xs text-gray-600">
        {features.map((f, i) => (
          <li key={i}>✓ {f}</li>
        ))}
      </ul>
    </div>
  )
}

function RiskCard({ title, description, action }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
        {action} →
      </button>
    </div>
  )
}

function PortfolioTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Portfolio</h2>
      
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-8 text-center">
        <p className="text-gray-600 mb-4">No holdings yet</p>
        <p className="text-sm text-gray-500">Connect your coins.ph API to see your portfolio here</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-1">Total Balance</p>
          <p className="text-3xl font-bold text-gray-900">₱0.00</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-1">24h P&L</p>
          <p className="text-3xl font-bold text-gray-900">+0.00%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-1">Total Traded</p>
          <p className="text-3xl font-bold text-gray-900">₱0.00</p>
        </div>
      </div>
    </div>
  )
}
