import { formatNumber } from '../../lib/currency'

export default function BalanceTrendChart({ data, wallet, formatNumber: fmt }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No balance history available</p>
      </div>
    )
  }

  // Find min and max balance for scaling
  const balances = data.map(d => d.balance || 0)
  const minBalance = Math.min(...balances, 0)
  const maxBalance = Math.max(...balances, 0)
  const balanceRange = maxBalance - minBalance || 1

  // Chart height in pixels
  const chartHeight = 200
  const chartWidth = Math.max(data.length * 4, 400)

  // Calculate bar heights
  const bars = data.map(d => {
    const balance = d.balance || 0
    const normalized = (balance - minBalance) / balanceRange
    const height = normalized * chartHeight
    return {
      ...d,
      height: Math.max(height, 2),
      normalized
    }
  })

  // Find today and highlight
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">30-Day Balance Trend</h4>

        <div className="overflow-x-auto">
          <div style={{ minWidth: `${chartWidth}px` }} className="flex items-end justify-between gap-1 h-64 bg-white border border-slate-200 rounded-lg p-4">
            {bars.map((bar, idx) => {
              const isToday = bar.date === today
              return (
                <div
                  key={idx}
                  className="flex-1 group relative"
                  style={{ minHeight: `${bar.height}px` }}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                    style={{ height: `${bar.height}px` }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <p className="font-semibold">{bar.date}</p>
                      <p>{fmt(bar.balance)}</p>
                      <p className="text-slate-300">
                        {bar.deposits > 0 ? `+${fmt(bar.deposits)}` : ''} {bar.withdrawals > 0 ? `-${fmt(bar.withdrawals)}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-300 rounded"></div>
            <span>Historical</span>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Current Balance</p>
          <p className="text-2xl font-light text-blue-900">
            {data.length > 0 ? fmt(data[data.length - 1].balance || 0) : 'N/A'}
          </p>
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Highest Balance</p>
          <p className="text-2xl font-light text-emerald-900">
            {fmt(maxBalance)}
          </p>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Lowest Balance</p>
          <p className="text-2xl font-light text-red-900">
            {fmt(Math.max(minBalance, 0))}
          </p>
        </div>
      </div>

      {/* Period Details */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Period Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Total Deposits</p>
            <p className="text-2xl font-light text-slate-900">
              {fmt(data.reduce((sum, d) => sum + (d.deposits || 0), 0))}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data.length} days</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Total Withdrawals</p>
            <p className="text-2xl font-light text-slate-900">
              {fmt(data.reduce((sum, d) => sum + (d.withdrawals || 0), 0))}
            </p>
            <p className="text-xs text-slate-500 mt-1">{data.length} days</p>
          </div>
        </div>
      </div>
    </div>
  )
}
