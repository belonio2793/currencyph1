import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { walletTransactionService } from '../../lib/walletTransactionService'
import { formatNumber } from '../../lib/currency'

export default function TransactionsList({ userId }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedTx, setExpandedTx] = useState(null)
  
  const itemsPerPage = 10

  useEffect(() => {
    loadTransactions()
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('public:wallet_transactions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${userId}` },
        () => loadTransactions()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [userId])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      setError('')

      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        setTransactions([])
        setLoading(false)
        return
      }

      const data = await walletTransactionService.getUserTransactions(userId, 500)
      setTransactions(data || [])
    } catch (err) {
      console.error('Error loading transactions:', err)
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const typeMatch = filterType === 'all' || tx.type === filterType
    const searchMatch = !searchTerm || 
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.currency_code?.toLowerCase().includes(searchTerm.toLowerCase())
    return typeMatch && searchMatch
  })

  // Sort transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at)
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at)
      case 'highest':
        return Number(b.amount || 0) - Number(a.amount || 0)
      case 'lowest':
        return Number(a.amount || 0) - Number(b.amount || 0)
      default:
        return 0
    }
  })

  // Paginate
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedTransactions = sortedTransactions.slice(startIdx, endIdx)
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)

  const transactionTypes = [
    { value: 'all', label: 'All Transactions' },
    { value: 'deposit', label: 'Deposits' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'transfer_in', label: 'Received' },
    { value: 'transfer_out', label: 'Sent' },
    { value: 'purchase', label: 'Purchases' },
    { value: 'reward', label: 'Rewards' },
    { value: 'rake', label: 'Fees' },
    { value: 'tip', label: 'Tips' }
  ]

  if (loading) {
    return (
      <div className="mt-12 bg-white border border-slate-200 rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="text-slate-500">Loading transactions...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-12">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">Transaction History</h2>
        <p className="text-slate-600 text-sm">
          {sortedTransactions.length} transaction{sortedTransactions.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {sortedTransactions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-500 text-lg">No transactions yet</p>
          <p className="text-slate-400 text-sm mt-2">Your transactions will appear here</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="mb-6 bg-white border border-slate-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Filter Type */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  {transactionTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Amount</option>
                  <option value="lowest">Lowest Amount</option>
                </select>
              </div>

              {/* Results Info */}
              <div className="flex items-end">
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <p className="text-slate-600">
                    {startIdx + 1}–{Math.min(endIdx, sortedTransactions.length)} of {sortedTransactions.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Currency</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Balance After</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx, idx) => {
                    const style = walletTransactionService.getTransactionStyle(tx.type)
                    const isDebit = ['withdrawal', 'transfer_out', 'purchase', 'rake', 'adjustment'].includes(tx.type)
                    const isExpanded = expandedTx === tx.id

                    return (
                      <tr key={tx.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50 hover:bg-slate-100'}>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{style.icon}</span>
                            <span className="font-medium text-slate-900">{style.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {tx.description || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {tx.currency_code}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-right">
                          <span className={isDebit ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                            {isDebit ? '−' : '+'}{formatNumber(Number(tx.amount || 0))}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-right text-slate-600">
                          {formatNumber(Number(tx.balance_after || 0))}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(tx.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded Details */}
            {expandedTx && (
              <div className="bg-blue-50 border-t border-slate-200 px-6 py-4">
                {paginatedTransactions.find(tx => tx.id === expandedTx) && (() => {
                  const tx = paginatedTransactions.find(t => t.id === expandedTx)
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Transaction ID</p>
                        <p className="text-sm font-mono text-slate-900 break-all">{tx.id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Wallet ID</p>
                        <p className="text-sm font-mono text-slate-900 break-all">{tx.wallet_id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Balance Before</p>
                        <p className="text-sm font-mono text-slate-900">{formatNumber(Number(tx.balance_before || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Reference ID</p>
                        <p className="text-sm font-mono text-slate-900 break-all">{tx.reference_id || '—'}</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                ← Previous
              </button>

              <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                      page === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
