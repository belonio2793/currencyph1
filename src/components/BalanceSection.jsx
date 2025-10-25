export default function BalanceSection({ balance }) {
  const balanceItems = [
    {
      label: 'PHP Balance',
      value: `₱${balance.php.toLocaleString()}`,
      color: 'bg-blue-50 border-blue-200',
      icon: '🇵🇭'
    },
    {
      label: 'CPH Tokens',
      value: `${balance.tokens.toLocaleString()} CPH`,
      color: 'bg-green-50 border-green-200',
      icon: '💰'
    },
    {
      label: 'Bitcoin Equivalent',
      value: `₿${balance.btc.toFixed(6)}`,
      color: 'bg-orange-50 border-orange-200',
      icon: '₿'
    },
    {
      label: 'Ethereum Equivalent',
      value: `Ξ${balance.eth.toFixed(4)}`,
      color: 'bg-purple-50 border-purple-200',
      icon: 'Ξ'
    }
  ]

  return (
    <div className="section-card">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Your Balance</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {balanceItems.map((item, idx) => (
          <div key={idx} className={`${item.color} border p-4 rounded-lg`}>
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-xs text-gray-600 mb-1">{item.label}</p>
            <p className="text-xl font-bold text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-700">
          <strong>Real-time Updates:</strong> Balances are updated via Supabase subscriptions. Exchange rates from OANDA (fiat) and AbstractAPI (crypto).
        </p>
      </div>
    </div>
  )
}
