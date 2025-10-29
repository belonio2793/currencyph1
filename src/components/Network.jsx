import React from 'react'
import BalancesSummaryDashboard from './BalancesSummaryDashboard'

export default function Network({ userId }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-light text-slate-900 mb-3 tracking-tight">Network</h1>
        <p className="text-slate-600 text-lg">Transparent public ledger showing real-time transactions and balances across the platform</p>
      </div>
      
      <BalancesSummaryDashboard userId={userId} />
    </div>
  )
}
