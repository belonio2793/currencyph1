import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { wisegcashAPI } from '../lib/payments'
import RequestLoanModal from './RequestLoanModal'
import LoanPaymentModal from './LoanPaymentModal'

export default function BorrowMoney({ userId, loanType }) {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [wallets, setWallets] = useState([])
  const [expandedLoanId, setExpandedLoanId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCurrency, setFilterCurrency] = useState('all')

  useEffect(() => {
    if (userId) {
      loadLoans()
      loadWallets()
    }
  }, [userId, loanType])

  const loadLoans = async () => {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', userId)
        .eq('loan_type', loanType)
        .order('created_at', { ascending: false })

      if (err) throw err
      setLoans(data || [])
      setError('')
    } catch (err) {
      console.error('Error loading loans:', err)
      setError('Failed to load loans')
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  const loadWallets = async () => {
    try {
      const walletList = await wisegcashAPI.getWallets(userId)
      setWallets(walletList || [])
    } catch (err) {
      console.warn('Error loading wallets:', err)
      setWallets([])
    }
  }

  const filteredLoans = loans.filter(loan => {
    // Status filter
    const statusMatch = activeTab === 'pending' ? loan.status === 'pending'
      : activeTab === 'active' ? loan.status === 'active'
      : activeTab === 'completed' ? loan.status === 'completed'
      : true

    // Currency filter
    const currencyMatch = filterCurrency === 'all' || loan.currency_code === filterCurrency

    // Search filter (search by ID, city, or display name)
    const searchLower = searchQuery.toLowerCase()
    const searchMatch = !searchQuery ||
      loan.id.toLowerCase().includes(searchLower) ||
      (loan.city || '').toLowerCase().includes(searchLower) ||
      (loan.display_name || '').toLowerCase().includes(searchLower) ||
      (loan.phone_number || '').includes(searchQuery)

    return statusMatch && currencyMatch && searchMatch
  })

  // Get unique currencies for filter
  const uniqueCurrencies = [...new Set(loans.map(l => l.currency_code))]

  const handleRequestSuccess = async () => {
    setShowRequestModal(false)
    await loadLoans()
  }

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false)
    setSelectedLoan(null)
    await loadLoans()
  }

  const blurPhoneNumber = (phone) => {
    if (!phone) return 'N/A'
    return phone.slice(0, 3) + '****' + phone.slice(-4)
  }

  const getLoanStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700'
      case 'active':
        return 'bg-blue-50 border-blue-200 text-blue-700'
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'rejected':
        return 'bg-red-50 border-red-200 text-red-700'
      case 'defaulted':
        return 'bg-red-50 border-red-200 text-red-700'
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-slate-900 tracking-wide mb-2">
            {loanType === 'personal' ? 'Personal Loans' : 'Business Loans'}
          </h1>
          <p className="text-slate-600">Manage your loan requests and track payments</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Request Loan Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Request New {loanType === 'personal' ? 'Personal' : 'Business'} Loan
          </button>
        </div>

        {/* Status Tabs */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-4">
            {['pending', 'active', 'completed'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({filteredLoans.length})
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-slate-500">Loading loans...</div>
          </div>
        )}

        {/* Loans List */}
        {!loading && filteredLoans.length === 0 && (
          <div className="bg-white rounded-lg p-12 text-center border border-slate-200">
            <p className="text-slate-600 mb-4">No {activeTab} loans found</p>
            {activeTab === 'pending' && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Request a loan →
              </button>
            )}
          </div>
        )}

        {/* Loans Table */}
        {!loading && filteredLoans.length > 0 && (
          <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
            <div className="w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Requested</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Total Owed</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Paid</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Remaining</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Progress</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">City</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Phone</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.map(loan => {
                    const progressPercent = loan.total_owed ? Math.min(100, ((loan.amount_paid || 0) / loan.total_owed) * 100) : 0
                    const isExpanded = expandedLoanId === loan.id
                    return (
                      <React.Fragment key={loan.id}>
                        <tr
                          className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                        >
                          <td className="px-3 py-2 text-xs font-mono text-slate-600 truncate">{loan.id.slice(0, 6)}...</td>
                          <td className="px-3 py-2 text-xs font-medium text-slate-900 whitespace-nowrap">
                            {Number(loan.requested_amount).toFixed(0)} {loan.currency_code}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-slate-900 whitespace-nowrap">
                            {Number(loan.total_owed).toFixed(0)} {loan.currency_code}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                            {Number(loan.amount_paid || 0).toFixed(0)} {loan.currency_code}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                            {Number(loan.remaining_balance || loan.total_owed).toFixed(0)} {loan.currency_code}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="font-medium text-slate-600 whitespace-nowrap">{progressPercent.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getLoanStatusColor(loan.status)}`}>
                              {loan.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 truncate">{loan.city || 'N/A'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{blurPhoneNumber(loan.phone_number)}</td>
                          <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                            {(loan.status === 'active' || loan.status === 'pending') && (
                              <button
                                onClick={() => {
                                  setSelectedLoan(loan)
                                  setShowPaymentModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                              >
                                Pay
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <td colSpan="10" className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Loan Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div><span className="text-slate-600">Loan Type:</span> <span className="font-medium text-slate-900">{loan.loan_type}</span></div>
                                    <div><span className="text-slate-600">Loan Purpose:</span> <span className="font-medium text-slate-900">{loan.loan_purpose || 'N/A'}</span></div>
                                    <div><span className="text-slate-600">Interest Rate:</span> <span className="font-medium text-slate-900">{loan.interest_rate}%</span></div>
                                    <div><span className="text-slate-600">Status:</span> <span className="font-medium text-slate-900 capitalize">{loan.status}</span></div>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Contact Info</h4>
                                  <div className="space-y-2 text-sm">
                                    <div><span className="text-slate-600">Name:</span> <span className="font-medium text-slate-900">{loan.display_name || 'N/A'}</span></div>
                                    <div><span className="text-slate-600">City:</span> <span className="font-medium text-slate-900">{loan.city || 'N/A'}</span></div>
                                    <div><span className="text-slate-600">Phone:</span> <span className="font-medium text-slate-900">{loan.phone_number || 'N/A'}</span></div>
                                    <div><span className="text-slate-600">Created:</span> <span className="font-medium text-slate-900">{new Date(loan.created_at).toLocaleDateString()}</span></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Request Loan Modal */}
      {showRequestModal && (
        <RequestLoanModal
          userId={userId}
          loanType={loanType}
          onClose={() => setShowRequestModal(false)}
          onSuccess={handleRequestSuccess}
          wallets={wallets}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedLoan && (
        <LoanPaymentModal
          loan={selectedLoan}
          userId={userId}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedLoan(null)
          }}
          onSuccess={handlePaymentSuccess}
          wallets={wallets}
        />
      )}
    </div>
  )
}
