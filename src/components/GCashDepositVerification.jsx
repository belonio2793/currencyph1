import React, { useState, useEffect } from 'react'
import gcashService from '../lib/gcashService'

function GCashDepositVerification({ userId, onDepositApproved }) {
  const [pendingDeposits, setPendingDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedDepositId, setExpandedDepositId] = useState(null)
  const [verifyingId, setVerifyingId] = useState(null)

  useEffect(() => {
    loadPendingDeposits()
  }, [userId])

  const loadPendingDeposits = async () => {
    try {
      setLoading(true)
      const deposits = await gcashService.getPendingGCashDeposits(userId)
      setPendingDeposits(deposits)
      setError('')
    } catch (err) {
      console.error('Error loading pending deposits:', err)
      setError('Failed to load pending deposits')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyDeposit = async (depositId, referenceNumber) => {
    if (!referenceNumber || !referenceNumber.trim()) {
      setError('Please enter a reference number')
      return
    }

    try {
      setVerifyingId(depositId)
      setError('')

      const result = await gcashService.verifyDepositByReference(
        depositId,
        referenceNumber
      )

      // Remove from pending list
      setPendingDeposits(
        pendingDeposits.filter(d => d.id !== depositId)
      )

      setSuccess(`✓ GCash deposit verified and approved! Amount: ${result.deposit.converted_amount} ${result.deposit.wallet_currency}`)

      // Call callback if provided
      if (onDepositApproved) {
        onDepositApproved(result.deposit)
      }

      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      console.error('Error verifying deposit:', err)
      setError(err.message || 'Failed to verify deposit')
    } finally {
      setVerifyingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-slate-600 text-sm">Loading...</p>
      </div>
    )
  }

  if (pendingDeposits.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Pending GCash Deposits ({pendingDeposits.length})
      </h3>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-3">
        {pendingDeposits.map(deposit => (
          <div
            key={deposit.id}
            className="bg-white border border-slate-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-slate-900">
                    {deposit.amount} {deposit.original_currency || deposit.currency_code}
                  </span>
                  {deposit.converted_amount && (
                    <span className="text-sm text-slate-600">
                      ≈ {deposit.converted_amount} {deposit.wallet_currency || deposit.currency_code}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Created: {new Date(deposit.created_at).toLocaleString()}
                </div>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                Pending
              </span>
            </div>

            {/* Expandable section for entering reference number */}
            {expandedDepositId !== deposit.id ? (
              <button
                onClick={() => setExpandedDepositId(deposit.id)}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
              >
                {deposit.reference_number ? (
                  <>✓ Reference: {deposit.reference_number}</>
                ) : (
                  <>+ Enter GCash Reference Number</>
                )}
              </button>
            ) : (
              <GCashReferenceVerification
                deposit={deposit}
                onVerify={(ref) => handleVerifyDeposit(deposit.id, ref)}
                onCancel={() => setExpandedDepositId(null)}
                isVerifying={verifyingId === deposit.id}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GCashReferenceVerification({ deposit, onVerify, onCancel, isVerifying }) {
  const [referenceNumber, setReferenceNumber] = useState(deposit.reference_number || '')

  const handleSubmit = () => {
    onVerify(referenceNumber)
    setReferenceNumber('')
  }

  return (
    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded">
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Enter your GCash reference number from the receipt:
        </label>
        <input
          type="text"
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
          placeholder="e.g., GCR123456789"
          className="w-full px-3 py-2 border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          disabled={isVerifying}
        />
        <p className="text-xs text-slate-600 mt-1">
          You'll find this in your GCash app or receipt after completing the payment.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!referenceNumber.trim() || isVerifying}
          className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {isVerifying ? 'Verifying...' : 'Verify & Approve'}
        </button>
        <button
          onClick={onCancel}
          disabled={isVerifying}
          className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default GCashDepositVerification
