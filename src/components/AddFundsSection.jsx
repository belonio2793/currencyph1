import { useState } from 'react'

export default function AddFundsSection() {
  const [selectedMethod, setSelectedMethod] = useState(null)

  const handleAddFunds = (method) => {
    setSelectedMethod(method)
    alert(`Adding funds via ${method}... (Staging Mode)`)
    // TODO: Integrate with actual payment APIs (GCash, Maya, Stripe)
    setTimeout(() => setSelectedMethod(null), 1000)
  }

  const paymentMethods = [
    {
      id: 'gcash',
      name: 'GCash',
      icon: '💳',
      description: 'Instant mobile payment',
      minAmount: 500
    },
    {
      id: 'maya',
      name: 'Maya',
      icon: '📱',
      description: 'Digital wallet',
      minAmount: 500
    },
    {
      id: 'card',
      name: 'Bank Card',
      icon: '🏦',
      description: 'Credit/Debit card',
      minAmount: 1000
    }
  ]

  return (
    <div className="section-card">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Funds</h2>
      <p className="text-gray-600 mb-6 text-sm">Choose your preferred payment method to start contributing</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => handleAddFunds(method.name)}
            disabled={selectedMethod === method.id}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedMethod === method.id
                ? 'border-primary bg-blue-50'
                : 'border-gray-200 hover:border-primary bg-white'
            }`}
          >
            <div className="text-3xl mb-2">{method.icon}</div>
            <h3 className="font-semibold text-gray-800">{method.name}</h3>
            <p className="text-xs text-gray-500 mb-2">{method.description}</p>
            <p className="text-xs text-gray-600">Min: ₱{method.minAmount.toLocaleString()}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <strong>Staging Mode:</strong> This is a test environment. No real transactions will be processed.
        </p>
      </div>
    </div>
  )
}
