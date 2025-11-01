import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function NetworkBalances({ userId }) {
  const [schemaData, setSchemaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedTables, setExpandedTables] = useState({
    users: true,
    wallets: true,
    loans: true,
    currencies: true
  })

  useEffect(() => {
    loadSchemaData()
  }, [userId])

  const loadSchemaData = async () => {
    try {
      setLoading(true)

      // Get user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError && userError.code !== 'PGRST116') throw userError

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
        .limit(5)

      if (transactionsError && transactionsError.code !== 'PGRST116') throw transactionsError

      setSchemaData({
        user: userData,
        wallets: walletsData || [],
        loans: loansData || [],
        currencies: currenciesData || [],
        transactions: transactionsData || []
      })
      setError('')
    } catch (err) {
      console.error('Error loading schema data:', err)
      setError('Failed to load network balances data')
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

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light text-slate-900 tracking-wide mb-2">Network Balances</h1>
          <p className="text-slate-600">Complete view of your account schema and data structure</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {schemaData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
              <div className="text-sm text-slate-600 mb-2">Total Balance</div>
              <div className="text-2xl font-bold text-green-600">
                {Number(schemaData.wallets.reduce((sum, w) => sum + (w.balance || 0), 0)).toFixed(2)} PHP
              </div>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm text-slate-600 mb-2">Transactions</div>
              <div className="text-2xl font-bold text-blue-600">{schemaData.transactions.length}</div>
            </div>
          </div>
        )}

        {/* Schema Tables */}
        {schemaData && (
          <>
            <SchemaTable
              title="User Profile"
              data={schemaData.user}
              columns={['id', 'email', 'full_name', 'country_code', 'status', 'created_at']}
              tableName="users"
            />

            <SchemaTable
              title="Wallets"
              data={schemaData.wallets}
              columns={['id', 'currency_code', 'balance', 'total_deposited', 'total_withdrawn', 'is_active']}
              tableName="wallets"
            />

            <SchemaTable
              title="Loans"
              data={schemaData.loans}
              columns={['id', 'loan_type', 'requested_amount', 'total_owed', 'amount_paid', 'status', 'created_at']}
              tableName="loans"
            />

            <SchemaTable
              title="Currencies"
              data={schemaData.currencies}
              columns={['code', 'name', 'type', 'symbol', 'decimals', 'active']}
              tableName="currencies"
            />

            {schemaData.transactions.length > 0 && (
              <SchemaTable
                title="Recent Transactions"
                data={schemaData.transactions}
                columns={['id', 'type', 'amount', 'currency_code', 'description', 'created_at']}
                tableName="transactions"
              />
            )}
          </>
        )}

        {/* Schema Information */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mt-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Database Schema Overview</h3>
          <div className="space-y-3 text-sm text-slate-600">
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
