import { walletTransactionService } from '../../lib/walletTransactionService'

export default function TransactionHistory({ transactions, wallet, formatNumber }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No transactions yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 mb-4">
        Showing {transactions.length} recent transactions
      </p>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {transactions.map((tx) => {
          const style = walletTransactionService.getTransactionStyle(tx.type)
          const isDebit = ['withdrawal', 'transfer_out', 'purchase', 'rake', 'adjustment'].includes(tx.type)

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="text-2xl">{style.icon}</div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{style.label}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(tx.created_at).toLocaleString()}
                  </p>
                  {tx.description && (
                    <p className="text-xs text-slate-400 mt-1">{tx.description}</p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className={`font-semibold text-lg ${
                  isDebit ? 'text-red-600' : 'text-green-600'
                }`}>
                  {isDebit ? '−' : '+'}{formatNumber(Number(tx.amount || 0))}
                </p>
                <p className="text-xs text-slate-500">{wallet.currency_code}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
