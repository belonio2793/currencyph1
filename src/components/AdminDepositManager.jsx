import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { depositStatusChangeService } from '../lib/depositStatusChangeService'
import { formatDateOnly, formatFullDateTime } from '../lib/dateTimeUtils'

export default function AdminDepositManager() {
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [selectedDeposit, setSelectedDeposit] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [auditHistory, setAuditHistory] = useState([])
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [reconciliationResult, setReconciliationResult] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [adminId, setAdminId] = useState(null)

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAdminId(session?.user?.id)
    }
    getCurrentUser()
  }, [])

  // Fetch deposits
  useEffect(() => {
    fetchDeposits()
  }, [filter])

  const fetchDeposits = async () => {
    try {
      setLoading(true)
      const query = supabase
        .from('deposits')
        .select(`
          *,
          users:user_id (id, email),
          wallets:wallet_id (id, balance, currency_code)
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query.eq('status', filter)
      }

      const { data, error: fetchError } = await query.limit(100)

      if (fetchError) throw fetchError
      setDeposits(data || [])
      setError('')
    } catch (err) {
      setError(`Failed to load deposits: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChangeStatus = async (depositId, newStatus, reason = '') => {
    if (!adminId) {
      setError('Admin user not found')
      return
    }

    try {
      setActionInProgress(true)
      setError('')

      // Get user email
      const { data: { session } } = await supabase.auth.getSession()
      const adminEmail = session?.user?.email || 'admin'

      // Call the safe status change function
      const result = await depositStatusChangeService.changeDepositStatus(
        depositId,
        newStatus,
        {
          adminId,
          adminEmail,
          reason,
          notes: { changedAt: new Date().toISOString() }
        }
      )

      if (result.success) {
        setSuccess(`Deposit status changed to ${newStatus}`)
        fetchDeposits()
        setSelectedDeposit(null)

        // Show wallet reconciliation result if available
        if (result.walletReconciliation) {
          setReconciliationResult(result.walletReconciliation)
          setTimeout(() => setReconciliationResult(null), 5000)
        }
      } else {
        setError(result.warnings?.join('; ') || 'Failed to change status')
      }
    } catch (err) {
      setError(`Error: ${err.message}`)
    } finally {
      setActionInProgress(false)
    }
  }

  const handleShowAuditHistory = async (depositId) => {
    try {
      const result = await depositStatusChangeService.getAuditHistory(depositId)
      setAuditHistory({
        statusHistory: result.statusHistory || [],
        auditLogs: result.auditLogs || []
      })
      setShowAuditModal(true)
    } catch (err) {
      setError(`Failed to load audit history: ${err.message}`)
    }
  }

  const handleReconcile = async (walletId) => {
    if (!adminId) {
      setError('Admin user not found')
      return
    }

    try {
      setActionInProgress(true)
      const result = await depositStatusChangeService.reconcileWalletBalance(walletId, adminId)
      setReconciliationResult(result)

      if (!result.isBalanced) {
        setError(`Balance discrepancy detected: ${result.discrepancy}`)
      } else {
        setSuccess('Wallet balance is reconciled')
      }
    } catch (err) {
      setError(`Reconciliation failed: ${err.message}`)
    } finally {
      setActionInProgress(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'completed': 'bg-blue-100 text-blue-800',
      'rejected': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Deposit Management</h1>
          <p className="text-slate-600">Approve, reject, or review deposits with complete audit trails</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
            {error}
            <button onClick={() => setError('')} className="float-right text-red-900">✕</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg border border-green-300">
            {success}
            <button onClick={() => setSuccess('')} className="float-right text-green-900">✕</button>
          </div>
        )}

        {reconciliationResult && (
          <div className={`mb-4 p-4 rounded-lg border ${
            reconciliationResult.isBalanced
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'bg-orange-100 text-orange-700 border-orange-300'
          }`}>
            <div className="font-semibold">
              {reconciliationResult.isBalanced ? '✓ Balance OK' : '⚠ Balance Discrepancy'}
            </div>
            <div className="mt-2 text-sm">
              Expected: {reconciliationResult.expectedBalance.toFixed(2)} | 
              Actual: {reconciliationResult.actualBalance.toFixed(2)} | 
              Difference: {reconciliationResult.discrepancy.toFixed(2)}
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['pending', 'approved', 'completed', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-blue-400'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Deposits List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-slate-600">Loading deposits...</div>
              ) : deposits.length === 0 ? (
                <div className="p-8 text-center text-slate-600">No deposits found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">User</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Method</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
                        <th className="px-6 py-3 text-center text-sm font-semibold text-slate-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {deposits.map(deposit => (
                        <tr
                          key={deposit.id}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedDeposit(deposit)}
                        >
                          <td className="px-6 py-4 text-sm text-slate-900">
                            <div className="font-medium">{deposit.users?.email || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{deposit.user_id.substring(0, 8)}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            {parseFloat(deposit.amount).toFixed(2)} {deposit.currency_code}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{deposit.deposit_method}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(deposit.status)}`}>
                              {deposit.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(deposit.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleShowAuditHistory(deposit.id)
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              History
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Deposit Details & Actions */}
          {selectedDeposit && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden p-6 h-fit sticky top-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-slate-900">Deposit Details</h2>
                <button
                  onClick={() => setSelectedDeposit(null)}
                  className="text-slate-400 hover:text-slate-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div>
                  <div className="text-slate-600">Deposit ID</div>
                  <div className="font-mono text-xs text-slate-900 break-all">{selectedDeposit.id}</div>
                </div>
                <div>
                  <div className="text-slate-600">Amount</div>
                  <div className="text-xl font-bold text-slate-900">
                    {parseFloat(selectedDeposit.amount).toFixed(2)} {selectedDeposit.currency_code}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Method</div>
                  <div className="text-slate-900">{selectedDeposit.deposit_method}</div>
                </div>
                <div>
                  <div className="text-slate-600">User Email</div>
                  <div className="text-slate-900">{selectedDeposit.users?.email}</div>
                </div>
                <div>
                  <div className="text-slate-600">Wallet Balance</div>
                  <div className="text-slate-900">{selectedDeposit.wallets?.balance || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-slate-600">Status</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedDeposit.status)}`}>
                    {selectedDeposit.status}
                  </span>
                </div>
                <div>
                  <div className="text-slate-600">Created</div>
                  <div className="text-slate-900 text-xs">
                    {new Date(selectedDeposit.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {selectedDeposit.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleChangeStatus(selectedDeposit.id, 'approved', 'Manual approval')}
                      disabled={actionInProgress}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {actionInProgress ? 'Processing...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleChangeStatus(selectedDeposit.id, 'rejected', 'Manual rejection')}
                      disabled={actionInProgress}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {actionInProgress ? 'Processing...' : '✗ Reject'}
                    </button>
                  </>
                )}

                {selectedDeposit.status === 'approved' && (
                  <>
                    <button
                      onClick={() => handleChangeStatus(selectedDeposit.id, 'completed', 'Mark as completed')}
                      disabled={actionInProgress}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {actionInProgress ? 'Processing...' : 'Mark Completed'}
                    </button>
                    <button
                      onClick={() => handleChangeStatus(selectedDeposit.id, 'pending', 'Manual reversal')}
                      disabled={actionInProgress}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {actionInProgress ? 'Processing...' : '↶ Revert'}
                    </button>
                  </>
                )}

                {selectedDeposit.status === 'completed' && (
                  <button
                    onClick={() => handleChangeStatus(selectedDeposit.id, 'pending', 'Reversal')}
                    disabled={actionInProgress}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {actionInProgress ? 'Processing...' : '↶ Revert'}
                  </button>
                )}

                <button
                  onClick={() => handleReconcile(selectedDeposit.wallet_id)}
                  disabled={actionInProgress}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  🔄 Reconcile Wallet
                </button>

                <button
                  onClick={() => handleShowAuditHistory(selectedDeposit.id)}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  📋 View Audit History
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit History Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Audit History</h3>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Status History */}
              {auditHistory.statusHistory?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Status Changes</h4>
                  <div className="space-y-2">
                    {auditHistory.statusHistory.map((record, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded text-sm">
                        <div className="font-medium text-slate-900">
                          {record.old_status} → {record.new_status}
                        </div>
                        <div className="text-slate-600 text-xs mt-1">
                          {new Date(record.created_at).toLocaleString()}
                        </div>
                        {record.reason && <div className="text-slate-600 mt-1">{record.reason}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Logs */}
              {auditHistory.auditLogs?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Audit Logs</h4>
                  <div className="space-y-2">
                    {auditHistory.auditLogs.map((record, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded text-sm">
                        <div className="flex justify-between items-start">
                          <div className="font-medium text-slate-900">{record.action}</div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            record.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {record.status}
                          </span>
                        </div>
                        <div className="text-slate-600 text-xs mt-1">
                          By: {record.admin_email} | {new Date(record.created_at).toLocaleString()}
                        </div>
                        {record.wallet_impact && (
                          <div className="mt-2 text-slate-700 text-xs">
                            Balance: {record.wallet_impact.balance_before?.toFixed(2)} → {record.wallet_impact.balance_after?.toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!auditHistory.statusHistory?.length && !auditHistory.auditLogs?.length && (
                <div className="text-center text-slate-600 py-4">No audit history found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
