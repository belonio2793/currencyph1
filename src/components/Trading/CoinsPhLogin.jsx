import React, { useState } from 'react'
import { coinsPhApi } from '../../lib/coinsPhApi'

export default function CoinsPhLogin({ onLoginSuccess }) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSecret, setShowSecret] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('Both API Key and Secret are required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Test the credentials by making an API call
      const testApi = new (await import('../../lib/coinsPhApi')).CoinsPhApi(apiKey, apiSecret)
      const account = await testApi.getAccount()

      if (account && account.email) {
        // Store credentials securely
        sessionStorage.setItem('coinsph_api_key', apiKey)
        sessionStorage.setItem('coinsph_api_secret', apiSecret)
        
        // Also update the global API instance
        coinsPhApi.apiKey = apiKey
        coinsPhApi.apiSecret = apiSecret

        onLoginSuccess()
        setLoading(false)
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Card */}
        <div className="bg-white rounded-t-2xl p-8 border-b-2 border-blue-100">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">💰</div>
            <h1 className="text-3xl font-bold text-slate-900">Coins.ph Trading</h1>
            <p className="text-slate-600 mt-2">Connect your account to start trading</p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-b-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700 text-sm font-medium">⚠️ {error}</p>
                <p className="text-red-600 text-xs mt-1">
                  Make sure you've created API keys on coins.ph with trading permissions
                </p>
              </div>
            )}

            {/* API Key Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your coins.ph API Key"
                disabled={loading}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-2">
                Found in your coins.ph account settings under API Management
              </p>
            </div>

            {/* API Secret Field */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                API Secret
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter your coins.ph API Secret"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-sm font-medium"
                >
                  {showSecret ? '👁️ Hide' : '👁️ Show'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Keep this secret! Never share it with anyone
              </p>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-xs text-yellow-800">
                <strong>🔒 Security Note:</strong> Your credentials are stored securely in your browser session. They are only sent to coins.ph API and never stored on our servers.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !apiKey.trim() || !apiSecret.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin">⟳</span>
                  Verifying...
                </>
              ) : (
                <>
                  <span>🔐</span>
                  Connect Account
                </>
              )}
            </button>

            {/* Help Section */}
            <div className="border-t border-slate-200 pt-6">
              <p className="text-xs text-slate-600 mb-3 font-medium">Need help?</p>
              <div className="space-y-2 text-xs text-slate-600">
                <p>
                  📚 <a 
                    href="https://coins.ph/en/api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Create API Keys on coins.ph
                  </a>
                </p>
                <p>
                  ✅ Ensure your API key has:
                </p>
                <ul className="ml-4 space-y-1">
                  <li>• Read Account Data</li>
                  <li>• Trading Permissions</li>
                  <li>• View Orders</li>
                </ul>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-xs text-slate-600">
          <p>💡 You can disconnect and use different credentials anytime</p>
        </div>
      </div>
    </div>
  )
}
