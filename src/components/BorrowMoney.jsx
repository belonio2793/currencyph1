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

        {/* Search & Filter Section */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-3 flex-wrap">
            {/* Search Input */}
            <div className="flex-1 min-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, city, name, or phone..."
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
              />
            </div>

            {/* Currency Filter */}
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
            >
              <option value="all">All Currencies</option>
              {uniqueCurrencies.map(currency => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>

            {/* Clear Filters Button */}
            {(searchQuery || filterCurrency !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterCurrency('all')
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Results Counter */}
          <div className="text-sm text-slate-600">
            Showing {filteredLoans.length} of {loans.length} loans
          </div>
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

            {/* Network Balances Tab */}
            <button
              onClick={() => setActiveTab('network-balances')}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ml-auto ${
                activeTab === 'network-balances'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Network Balances
            </button>
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
          <div className="space-y-2 mb-6">
            {filteredLoans.map(loan => {
              const progressPercent = loan.total_owed ? Math.min(100, ((loan.amount_paid || 0) / loan.total_owed) * 100) : 0
              const isExpanded = expandedLoanId === loan.id
              return (
                <div key={loan.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  {/* Main Row */}
                  <div
                    className="grid grid-cols-10 gap-2 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors items-center"
                    onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                  >
                    <div className="text-xs font-mono text-slate-600 truncate">{loan.id.slice(0, 6)}...</div>
                    <div className="text-xs font-medium text-slate-900 whitespace-nowrap">
                      {Number(loan.requested_amount).toFixed(0)} {loan.currency_code}
                    </div>
                    <div className="text-xs font-medium text-slate-900 whitespace-nowrap">
                      {Number(loan.total_owed).toFixed(0)} {loan.currency_code}
                    </div>
                    <div className="text-xs text-slate-600 whitespace-nowrap">
                      {Number(loan.amount_paid || 0).toFixed(0)} {loan.currency_code}
                    </div>
                    <div className="text-xs text-slate-600 whitespace-nowrap">
                      {Number(loan.remaining_balance || loan.total_owed).toFixed(0)} {loan.currency_code}
                    </div>
                    <div className="text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="font-medium text-slate-600 whitespace-nowrap text-xs">{progressPercent.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getLoanStatusColor(loan.status)}`}>
                        {loan.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">{loan.city || 'N/A'}</div>
                    <div className="text-xs text-slate-600 whitespace-nowrap">{blurPhoneNumber(loan.phone_number)}</div>
                    <div className="text-xs" onClick={(e) => e.stopPropagation()}>
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
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Network Balances Tab */}
        {activeTab === 'network-balances' && !loading && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Loans */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-600 mb-1">Total Loans</div>
                <div className="text-2xl font-bold text-slate-900">{loans.length}</div>
              </div>

              {/* Total Debt */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-600 mb-1">Total Debt</div>
                <div className="text-2xl font-bold text-red-600">
                  {Number(loans.reduce((sum, l) => sum + (l.remaining_balance || l.total_owed || 0), 0)).toFixed(2)} {loanType === 'personal' ? 'PHP' : 'PHP'}
                </div>
              </div>

              {/* Total Paid */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-600 mb-1">Total Paid</div>
                <div className="text-2xl font-bold text-green-600">
                  {Number(loans.reduce((sum, l) => sum + (l.amount_paid || 0), 0)).toFixed(2)} {loanType === 'personal' ? 'PHP' : 'PHP'}
                </div>
              </div>

              {/* Active Loans */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-600 mb-1">Active Loans</div>
                <div className="text-2xl font-bold text-blue-600">
                  {loans.filter(l => l.status === 'active').length}
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By Status */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Loans by Status</h3>
                <div className="space-y-2">
                  {['pending', 'active', 'completed', 'rejected', 'defaulted'].map(status => {
                    const count = loans.filter(l => l.status === status).length
                    if (count === 0) return null
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 capitalize">{status}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                status === 'pending' ? 'bg-yellow-500'
                                : status === 'active' ? 'bg-blue-500'
                                : status === 'completed' ? 'bg-green-500'
                                : status === 'rejected' ? 'bg-red-500'
                                : 'bg-red-600'
                              }`}
                              style={{ width: `${(count / loans.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 min-w-max">{count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By Currency */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Loans by Currency</h3>
                <div className="space-y-2">
                  {uniqueCurrencies.map(currency => {
                    const currencyLoans = loans.filter(l => l.currency_code === currency)
                    const total = currencyLoans.reduce((sum, l) => sum + (l.remaining_balance || l.total_owed || 0), 0)
                    return (
                      <div key={currency} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">{currency}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-500"
                              style={{ width: `${(currencyLoans.length / loans.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 min-w-max">{Number(total).toFixed(0)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* All Loans Table */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">All {loanType === 'personal' ? 'Personal' : 'Business'} Loans</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Total Owed</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Remaining</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map(loan => (
                      <tr key={loan.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs font-mono text-slate-600 truncate">{loan.id.slice(0, 6)}...</td>
                        <td className="px-3 py-2 text-xs text-slate-900">{Number(loan.requested_amount).toFixed(0)}</td>
                        <td className="px-3 py-2 text-xs text-slate-900 font-medium">{Number(loan.total_owed).toFixed(0)}</td>
                        <td className="px-3 py-2 text-xs text-slate-900">{Number(loan.remaining_balance || loan.total_owed).toFixed(0)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getLoanStatusColor(loan.status)}`}>
                            {loan.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{loan.currency_code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loans.length === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    No {loanType === 'personal' ? 'personal' : 'business'} loans found
                  </div>
                )}
              </div>
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
