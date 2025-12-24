import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function WalletInitializationModal({
  isOpen,
  currencyCode,
  currencyName,
  currencySymbol,
  userId,
  onClose,
  onSuccess,
  onCancel,
  onWalletDetected  // New callback: triggered when wallet is detected in database
}) {
  const [status, setStatus] = useState('initializing') // 'initializing', 'checking', 'success', 'error', 'cancelled'
  const [error, setError] = useState('')
  const [checkCount, setCheckCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [walletData, setWalletData] = useState(null)

  // Timer for elapsed time display
  useEffect(() => {
    if (!isOpen || status === 'success' || status === 'error' || status === 'cancelled') return

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, status])

  // Polling mechanism to check if wallet was created
  useEffect(() => {
    if (!isOpen || !currencyCode || !userId) return
    if (status === 'success' || status === 'error' || status === 'cancelled') return

    const pollWallet = async () => {
      try {
        // Check if wallet exists in database
        const { data, error: err } = await supabase
          .from('wallets')
          .select('id, user_id, currency_code, balance, type, created_at, account_number')
          .eq('user_id', userId)
          .eq('currency_code', currencyCode)
          .single()

        if (err && err.code !== 'PGRST116') {
          // PGRST116 = not found, which is expected on first few checks
          console.warn(`Poll attempt ${checkCount + 1}: Error checking wallet:`, err)
          setCheckCount(prev => prev + 1)
          return
        }

        if (data) {
          // Wallet found!
          console.log(`✓ Wallet created successfully on check ${checkCount + 1}:`, data)
          setWalletData(data)
          setStatus('success')

          // Immediately notify parent component so it can refresh
          if (onWalletDetected) {
            onWalletDetected(data)
          }

          return
        }

        // Wallet not found yet, will retry
        setCheckCount(prev => prev + 1)
      } catch (err) {
        console.error(`Poll attempt ${checkCount + 1}: Unexpected error:`, err)
        setCheckCount(prev => prev + 1)
      }
    }

    // Start polling after a short delay, then every 2 seconds
    const initialDelay = setTimeout(() => {
      pollWallet()
    }, 500)

    const pollInterval = setInterval(() => {
      pollWallet()
    }, 2000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(pollInterval)
    }
  }, [isOpen, currencyCode, userId, status, checkCount])

  // Timeout: if polling takes more than 5 minutes, mark as timeout
  useEffect(() => {
    if (elapsedTime > 300 && status === 'initializing') {
      setStatus('error')
      setError('Wallet initialization timed out after 5 minutes. Please contact support.')
    }
  }, [elapsedTime, status])

  const handleCancel = () => {
    setStatus('cancelled')
    if (onCancel) onCancel()
    setTimeout(() => {
      if (onClose) onClose()
    }, 300)
  }

  const handleClose = () => {
    if (status === 'success') {
      if (onSuccess) onSuccess(walletData)
    }
    if (onClose) onClose()
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">
            {status === 'success' ? '✓ Wallet Created' : 'Creating Wallet'}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          {/* Currency Info */}
          <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {currencyCode === 'BTC'
                  ? '₿'
                  : currencyCode === 'ETH'
                  ? 'Ξ'
                  : currencyCode === 'PHP'
                  ? '₱'
                  : currencyCode === 'USD'
                  ? '$'
                  : currencyCode === 'EUR'
                  ? '€'
                  : currencySymbol || currencyCode}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600">Currency</p>
                <p className="text-lg font-semibold text-slate-900">{currencyCode}</p>
                {currencyName && <p className="text-xs text-slate-500">{currencyName}</p>}
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {status === 'initializing' && (
            <div className="space-y-4">
              {/* Loading Animation */}
              <div className="flex justify-center mb-6">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-blue-600 animate-spin"></div>
                </div>
              </div>

              <p className="text-center text-slate-900 font-medium">
                Initializing your {currencyCode} wallet...
              </p>

              <p className="text-center text-sm text-slate-600">
                This may take 30 seconds to 2 minutes
              </p>

              {/* Progress Details */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Status:</span>
                  <span className="text-blue-600 font-medium">Setting up infrastructure...</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Checks:</span>
                  <span className="text-slate-900 font-mono font-medium">{checkCount + 1}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Elapsed Time:</span>
                  <span className="text-slate-900 font-mono font-medium">{formatTime(elapsedTime)}</span>
                </div>
              </div>
            </div>
          )}

          {status === 'success' && walletData && (
            <div className="space-y-4">
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              <p className="text-center text-slate-900 font-medium">
                {currencyCode} wallet is ready!
              </p>

              <p className="text-center text-sm text-slate-600">
                Your wallet has been successfully created and is now active.
              </p>

              {/* Wallet Details */}
              <div className="space-y-3 pt-4 bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-xs">
                  <p className="text-slate-600 mb-1">Wallet ID:</p>
                  <p className="text-xs font-mono text-slate-900 break-all bg-white p-2 rounded border border-green-100">
                    {walletData.id}
                  </p>
                </div>

                {walletData.account_number && (
                  <div className="text-xs">
                    <p className="text-slate-600 mb-1">Account Number:</p>
                    <p className="text-sm font-mono text-slate-900 bg-white p-2 rounded border border-green-100">
                      {walletData.account_number}
                    </p>
                  </div>
                )}

                <div className="text-xs">
                  <p className="text-slate-600 mb-1">Type:</p>
                  <p className="text-sm font-medium text-slate-900 bg-white p-2 rounded border border-green-100 capitalize">
                    {walletData.type} wallet
                  </p>
                </div>

                <div className="text-xs">
                  <p className="text-slate-600 mb-1">Created:</p>
                  <p className="text-sm text-slate-900 bg-white p-2 rounded border border-green-100">
                    {new Date(walletData.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              {/* Error Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              <p className="text-center text-slate-900 font-medium">
                Wallet Creation Failed
              </p>

              <p className="text-center text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                {error || `Failed to create ${currencyCode} wallet. Please try again.`}
              </p>

              <p className="text-center text-xs text-slate-600 pt-2">
                If the problem persists, please contact support.
              </p>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="space-y-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-amber-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              <p className="text-center text-slate-900 font-medium">
                Wallet Creation Cancelled
              </p>

              <p className="text-center text-sm text-slate-600">
                You can try creating this wallet again later.
              </p>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3">
          {status === 'initializing' && (
            <>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <div className="flex-1 px-4 py-2 bg-slate-200 text-slate-500 rounded-lg text-sm font-medium flex items-center justify-center cursor-not-allowed">
                Creating...
              </div>
            </>
          )}

          {status === 'success' && (
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              Done
            </button>
          )}

          {(status === 'error' || status === 'cancelled') && (
            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium text-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
