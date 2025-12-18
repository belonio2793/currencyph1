export default function WalletStatistics({ stats, wallet, formatNumber }) {
  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Loading statistics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Total Transactions</p>
          <p className="text-2xl font-light text-blue-900">{stats.transactionCount || 0}</p>
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Deposits</p>
          <p className="text-2xl font-light text-emerald-900">{stats.depositCount || 0}</p>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Withdrawals</p>
          <p className="text-2xl font-light text-red-900">{stats.withdrawalCount || 0}</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">Transfers</p>
          <p className="text-2xl font-light text-purple-900">{stats.totalTransfers || 0}</p>
        </div>
      </div>

      {/* Amount Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 p-6 rounded-lg border border-emerald-200">
          <h4 className="text-sm font-semibold text-emerald-900 mb-4 uppercase tracking-wider">Deposit Statistics</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-emerald-700">Total Deposited</p>
              <p className="font-semibold text-emerald-900">{formatNumber(stats.totalDeposited || 0)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-emerald-700">Largest Deposit</p>
              <p className="font-semibold text-emerald-900">{formatNumber(stats.largestDeposit || 0)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-emerald-700">Deposit Count</p>
              <p className="font-semibold text-emerald-900">{stats.depositCount || 0}</p>
            </div>
            {stats.depositCount > 0 && (
              <div className="flex justify-between items-center pt-3 border-t border-emerald-200">
                <p className="text-sm text-emerald-700">Average Deposit</p>
                <p className="font-semibold text-emerald-900">
                  {formatNumber(stats.totalDeposited / stats.depositCount)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <h4 className="text-sm font-semibold text-red-900 mb-4 uppercase tracking-wider">Withdrawal Statistics</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-red-700">Total Withdrawn</p>
              <p className="font-semibold text-red-900">{formatNumber(stats.totalWithdrawn || 0)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-red-700">Largest Withdrawal</p>
              <p className="font-semibold text-red-900">{formatNumber(stats.largestWithdrawal || 0)}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-red-700">Withdrawal Count</p>
              <p className="font-semibold text-red-900">{stats.withdrawalCount || 0}</p>
            </div>
            {stats.withdrawalCount > 0 && (
              <div className="flex justify-between items-center pt-3 border-t border-red-200">
                <p className="text-sm text-red-700">Average Withdrawal</p>
                <p className="font-semibold text-red-900">
                  {formatNumber(stats.totalWithdrawn / stats.withdrawalCount)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {(stats.firstTransaction || stats.lastTransaction) && (
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Activity Period</h4>
          <div className="space-y-3">
            {stats.firstTransaction && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-700">First Transaction</p>
                <p className="text-sm text-slate-900">
                  {new Date(stats.firstTransaction.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {stats.lastTransaction && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-700">Last Transaction</p>
                <p className="text-sm text-slate-900">
                  {new Date(stats.lastTransaction.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
