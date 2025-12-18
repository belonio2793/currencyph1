import { walletTransactionService } from '../../lib/walletTransactionService'

export default function ActivityTimeline({ transactions, wallet, formatNumber }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No activity yet</p>
      </div>
    )
  }

  // Group transactions by date
  const groupedByDate = {}
  transactions.forEach(tx => {
    const date = new Date(tx.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    if (!groupedByDate[date]) {
      groupedByDate[date] = []
    }
    groupedByDate[date].push(tx)
  })

  const dates = Object.keys(groupedByDate)

  return (
    <div className="space-y-8">
      {dates.map((date, dateIdx) => {
        const dayTransactions = groupedByDate[date]
        return (
          <div key={dateIdx}>
            <div className="flex items-center gap-4 mb-4">
              <h4 className="text-sm font-semibold text-slate-900">{date}</h4>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full">
                {dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="relative pl-6">
              {/* Vertical line */}
              {dateIdx < dates.length - 1 && (
                <div className="absolute left-0 top-8 w-0.5 h-24 bg-slate-200"></div>
              )}

              <div className="space-y-4">
                {dayTransactions.map((tx, txIdx) => {
                  const style = walletTransactionService.getTransactionStyle(tx.type)
                  const isDebit = ['withdrawal', 'transfer_out', 'purchase', 'rake', 'adjustment'].includes(tx.type)

                  return (
                    <div key={tx.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[30px] top-2 w-3 h-3 rounded-full border-2 border-white ${
                        isDebit ? 'bg-red-500' : 'bg-green-500'
                      }`}></div>

                      {/* Card */}
                      <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-2xl">{style.icon}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900">{style.label}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(tx.created_at).toLocaleTimeString()}
                              </p>
                              {tx.description && (
                                <p className="text-sm text-slate-600 mt-1">{tx.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="text-right whitespace-nowrap">
                            <p className={`font-semibold text-lg ${
                              isDebit ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {isDebit ? '−' : '+'}{formatNumber(Number(tx.amount || 0))}
                            </p>
                            <p className="text-xs text-slate-500">{wallet.currency_code}</p>
                          </div>
                        </div>

                        {/* Balance change info */}
                        {tx.balance_before !== undefined && tx.balance_after !== undefined && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                            <span>Before: {formatNumber(Number(tx.balance_before || 0))}</span>
                            <span>After: {formatNumber(Number(tx.balance_after || 0))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
