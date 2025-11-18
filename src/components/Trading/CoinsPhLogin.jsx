import React, { useState } from 'react'
import { coinsPhApi } from '../../lib/coinsPhApi'

export default function CoinsPhLogin({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConnect = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[CoinsPhLogin] Testing connection to coins.ph API...')

      // Test the connection by fetching account info
      const account = await coinsPhApi.getAccount()

      if (account && account.email) {
        console.log('[CoinsPhLogin] Successfully connected:', account.email)
        
        // Store connected status
        sessionStorage.setItem('coinsph_connected', 'true')
        
        setLoading(false)
        onLoginSuccess()
      } else {
        throw new Error('Invalid response from API - no account email found')
      }
    } catch (err) {
      console.error('[CoinsPhLogin] Connection error:', err)
      
      // Provide specific error messages
      const errorMsg = err.message || 'Connection failed'
      
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        setError('API credentials are invalid or expired.')
      } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
        setError('API credentials do not have the required permissions.')
      } else if (errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
        setError('Network error. Please check your internet connection and try again.')
      } else {
        setError(errorMsg)
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Card */}
        <div className="bg-white rounded-t-2xl p-8 border-b-2 border-blue-100">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">💰</div>
            <h1 className="text-3xl font-bold text-slate-900">Coins.ph Trading</h1>
            <p className="text-slate-600 mt-2">Connect to your trading account</p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-b-2xl p-8 shadow-xl">
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700 font-medium">⚠️ Connection Failed</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-900 text-sm leading-relaxed">
                <strong>🔐 Secure Connection</strong><br/>
                Your coins.ph account is connected through a secure proxy. Click the button below to verify and start trading.
              </p>
            </div>

            {/* Account Status Info */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">🌐</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">API Status</p>
                  <p className="text-xs text-slate-600">Ready to connect</p>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3 mt-3 text-xs text-slate-600">
                <p>✓ Credentials configured</p>
                <p>✓ Secure proxy enabled</p>
                <p>✓ CORS issues resolved</p>
              </div>
            </div>

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin">⟳</span>
                  Connecting...
                </>
              ) : (
                <>
                  <span>🔗</span>
                  Connect Account
                </>
              )}
            </button>

            {/* Help Section */}
            <div className="border-t border-slate-200 pt-6">
              <p className="text-xs text-slate-600 mb-3 font-medium">How it works:</p>
              <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside">
                <li>Click "Connect Account" to verify your credentials</li>
                <li>Your account details will load securely</li>
                <li>Start viewing balances and managing trades</li>
              </ol>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>🔒 Security:</strong> All communication is encrypted and routed through Supabase's secure Edge Functions. Your account data is never stored on our servers.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-xs text-slate-600">
          <p>💡 Your trading session is secure and private</p>
        </div>
      </div>
    </div>
  )
}
