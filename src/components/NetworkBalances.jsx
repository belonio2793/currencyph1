import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function NetworkBalances({ userId }) {
  const [schemaData, setSchemaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTable, setSelectedTable] = useState('network_balances')
  const [expandedTables, setExpandedTables] = useState({
    users: true,
    wallets: true,
    loans: true,
    currencies: true,
    wallet_transactions: true,
    loan_payments: true,
    network_balances: true
  })

  const tableOptions = [
    {
      id: 'network_balances',
      label: 'Network Balances',
      description: 'Reconciled balances across all users and house accounts',
      metadata: 'Status: reconciled/discrepancy | Currencies: all active | Updated: every 24 hours'
    },
    {
      id: 'wallets',
      label: 'Wallets',
      description: 'Multi-currency wallets and balances',
      metadata: 'Per-user wallets | Supports fiat & crypto | Tracks deposits/withdrawals'
    },
    {
      id: 'loans',
      label: 'Loans',
      description: 'Loan requests and tracking',
      metadata: 'Types: personal/business/partner | Interest rate: 10% | Status: pending/active/completed'
    },
    {
      id: 'wallet_transactions',
      label: 'Wallet Transactions',
      description: 'Audit trail of balance changes',
      metadata: 'Types: deposit/withdrawal/transfer/payment | Ordered by date | Supports all currencies'
    },
    {
      id: 'loan_payments',
      label: 'Loan Payments',
      description: 'Individual loan payment records',
      metadata: 'Methods: wallet/GCash/crypto | Tracks status | Linked to loans'
    },
    {
      id: 'currencies',
      label: 'Currencies',
      description: 'Supported currencies (fiat & crypto)',
      metadata: 'PHP (default) | BTC | USD | EUR | All with symbols & decimals'
    },
    {
      id: 'users',
      label: 'User Profile',
      description: 'Account information and details',
      metadata: 'Email | Full name | Country | Status | Created timestamp'
    }
  ]

  useEffect(() => {
    loadSchemaData()
  }, [userId])

  const loadSchemaData = async () => {
    try {
      setLoading(true)

      // Get user data
      let userData = null
      const { data: fetchedUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError && userError.code !== 'PGRST116') {
        console.warn('Could not fetch user data:', userError)
      } else {
        userData = fetchedUser
      }

      // Get network balances (latest records) - be lenient with errors
      let networkBalancesData = []
      const { data: allBalances, error: networkBalancesError } = await supabase
        .from('network_balances')
        .select('*')
        .order('reconciliation_date', { ascending: false })
        .limit(100)

      if (networkBalancesError) {
        console.warn('Could not fetch all network balances, trying house only:', networkBalancesError)
        // Try fetching just house balances as fallback
        const { data: houseBalances, error: houseError } = await supabase
          .from('network_balances')
          .select('*')
          .eq('entity_type', 'house')
          .order('reconciliation_date', { ascending: false })
          .limit(100)

        if (houseError) {
          console.warn('Could not fetch house balances either:', houseError)
          networkBalancesData = []
        } else {
          networkBalancesData = houseBalances || []
        }
      } else {
        networkBalancesData = allBalances || []
      }

      // Get user wallets
      const { data: walletsData, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)

      if (walletsError) throw walletsError

      // Get user loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', userId)

      if (loansError) throw loansError

      // Get currencies
      const { data: currenciesData, error: currenciesError } = await supabase
        .from('currencies')
        .select('*')
        .limit(10)

      if (currenciesError) throw currenciesError

      // Get wallet transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (transactionsError && transactionsError.code !== 'PGRST116') throw transactionsError

      // Get loan payments
      const { data: loanPaymentsData, error: loanPaymentsError } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (loanPaymentsError && loanPaymentsError.code !== 'PGRST116') throw loanPaymentsError

      setSchemaData({
        user: userData,
        network_balances: networkBalancesData || [],
        wallets: walletsData || [],
        loans: loansData || [],
        currencies: currenciesData || [],
        wallet_transactions: transactionsData || [],
        loan_payments: loanPaymentsData || []
      })
      setError('')
    } catch (err) {
      const errorMessage = err?.message || err?.details || JSON.stringify(err)
      console.error('Error loading schema data:', errorMessage, err)
      setError(`Failed to load network balances data: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }))
  }

  const SchemaTable = ({ title, data, columns, tableName }) => (
    <div className="mb-6 bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => toggleTable(tableName)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 hover:from-blue-100 hover:to-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-5 h-5 text-blue-600 transition-transform ${expandedTables[tableName] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <span className="text-sm text-slate-600 ml-2">({Array.isArray(data) ? data.length : 1})</span>
        </div>
      </button>

      {expandedTables[tableName] && data && (
        <div className="overflow-x-auto">
          {Array.isArray(data) && data.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns.map(col => (
                    <th key={col} className="px-6 py-3 text-left text-sm font-semibold text-slate-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(data) ? data : [data]).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    {columns.map(col => (
                      <td key={col} className="px-6 py-3 text-sm text-slate-700">
                        <div className="max-w-xs truncate">
                          {typeof row[col] === 'object' ? JSON.stringify(row[col]).substring(0, 50) + '...' : String(row[col] || 'N/A')}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-8 text-center text-slate-500">
              No data available
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 flex items-center justify-center">
        <div className="text-slate-600">Loading network balances...</div>
      </div>
    )
  }

  const getTableData = () => {
    switch(selectedTable) {
      case 'network_balances':
        return { data: schemaData?.network_balances || [], columns: ['id', 'entity_type', 'currency_code', 'wallet_balance', 'computed_balance', 'balance_difference', 'status', 'reconciliation_date'] }
      case 'wallets':
        return { data: schemaData?.wallets || [], columns: ['id', 'currency_code', 'balance', 'total_deposited', 'total_withdrawn', 'is_active'] }
      case 'loans':
        return { data: schemaData?.loans || [], columns: ['id', 'loan_type', 'requested_amount', 'total_owed', 'amount_paid', 'status', 'created_at'] }
      case 'wallet_transactions':
        return { data: schemaData?.wallet_transactions || [], columns: ['id', 'type', 'amount', 'currency_code', 'description', 'created_at'] }
      case 'loan_payments':
        return { data: schemaData?.loan_payments || [], columns: ['id', 'loan_id', 'amount', 'payment_method', 'status', 'created_at'] }
      case 'currencies':
        return { data: schemaData?.currencies || [], columns: ['code', 'name', 'type', 'symbol', 'decimals', 'active'] }
      case 'users':
        return { data: schemaData?.user ? [schemaData.user] : [], columns: ['id', 'email', 'full_name', 'country_code', 'status', 'created_at'] }
      default:
        return { data: [], columns: [] }
    }
  }

  const selectedTableInfo = tableOptions.find(t => t.id === selectedTable)
  const { data: tableData, columns: tableColumns } = getTableData()

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-slate-900 tracking-wide mb-2">Network Balances</h1>
          <p className="text-slate-600">View your financial data by category</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {schemaData && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm text-slate-600 mb-2">Reconciled Records</div>
              <div className="text-2xl font-bold text-blue-600">
                {schemaData.network_balances.filter(r => r.status === 'reconciled').length}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm text-slate-600 mb-2">Discrepancies</div>
              <div className="text-2xl font-bold text-orange-600">
                {schemaData.network_balances.filter(r => r.status === 'discrepancy').length}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm text-slate-600 mb-2">Total Wallets</div>
              <div className="text-2xl font-bold text-blue-600">{schemaData.wallets.length}</div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm text-slate-600 mb-2">Active Loans</div>
              <div className="text-2xl font-bold text-blue-600">
                {schemaData.loans.filter(l => l.status === 'active').length}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm text-slate-600 mb-2">Transactions</div>
              <div className="text-2xl font-bold text-blue-600">{schemaData.wallet_transactions.length}</div>
            </div>
          </div>
        )}

        {/* Table Selector Dropdown */}
        {schemaData && (
          <div className="mb-6 bg-white rounded-lg border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-900 mb-3">Select Data View</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-white mb-4"
            >
              {tableOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>

            {/* Display metadata for selected table */}
            {tableOptions.find(t => t.id === selectedTable) && (
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <div className="text-sm text-slate-900 mb-2">
                  <strong>{tableOptions.find(t => t.id === selectedTable)?.label}</strong>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><span className="font-medium">Description:</span> {tableOptions.find(t => t.id === selectedTable)?.description}</div>
                  <div><span className="font-medium">Metadata:</span> {tableOptions.find(t => t.id === selectedTable)?.metadata}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Table View */}
        {schemaData && selectedTableInfo && (
          <SchemaTable
            title={selectedTableInfo.label}
            data={tableData}
            columns={tableColumns}
            tableName={selectedTable}
          />
        )}

        {/* Schema Information */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mt-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Database Schema Overview</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <strong className="text-slate-900">Network Balances:</strong> Reconciled balances across all users and house accounts. Automatically updated every 24 hours. Compares wallet balances against computed balances from transactions and flags discrepancies. Tracks deposits, withdrawals, and transaction counts per currency per entity (user or house).
            </div>
            <div>
              <strong className="text-slate-900">Users Table:</strong> Stores user account information including email, full name, and country code. Each user gets a UUID primary key.
            </div>
            <div>
              <strong className="text-slate-900">Wallets Table:</strong> Manages multi-currency wallets. Each user can have multiple wallets (one per currency). Tracks balance, total deposits, and total withdrawals.
            </div>
            <div>
              <strong className="text-slate-900">Loans Table:</strong> Tracks loan requests with type (personal/business), amount, total owed (with 10% interest), and payment status.
            </div>
            <div>
              <strong className="text-slate-900">Wallet Transactions:</strong> Audit trail of all balance changes including deposits, withdrawals, transfers, and adjustments.
            </div>
            <div>
              <strong className="text-slate-900">Loan Payments:</strong> Records individual loan payments with method (wallet, GCash, crypto, etc.) and status tracking.
            </div>
            <div>
              <strong className="text-slate-900">Currencies:</strong> Master list of all supported currencies (fiat and crypto) with symbols and decimals.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
