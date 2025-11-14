import React from 'react'

const FEATURE_ROWS = [
  {
    category: 'Financial Services',
    features: [
      {
        title: 'Digital Wallet',
        description: 'Send and receive money securely with crypto and fiat',
        icon: '💳',
        color: 'bg-blue-50 border-blue-200'
      },
      {
        title: 'Payments',
        description: 'Connect GCash, PayMaya, and other payment methods',
        icon: '💰',
        color: 'bg-pink-50 border-pink-200'
      },
      {
        title: 'Network Balances',
        description: 'Track your balances across multiple networks',
        icon: '🌐',
        color: 'bg-teal-50 border-teal-200'
      }
    ]
  },
  {
    category: 'Personal Features',
    features: [
      {
        title: 'Find Nearby',
        description: 'Discover local businesses and services near you',
        icon: '📍',
        color: 'bg-green-50 border-green-200'
      },
      {
        title: 'Messages',
        description: 'Stay connected with direct messaging',
        icon: '💬',
        color: 'bg-purple-50 border-purple-200'
      },
      {
        title: 'P2P Loans',
        description: 'Browse loans and submit lending offers',
        icon: '🤝',
        color: 'bg-indigo-50 border-indigo-200'
      }
    ]
  },
  {
    category: 'Business Services',
    features: [
      {
        title: 'Digital Receipts',
        description: 'Create and manage digital receipts for transactions',
        icon: '📄',
        color: 'bg-amber-50 border-amber-200'
      },
      {
        title: 'My Business',
        description: 'Manage your businesses and employee information',
        icon: '🏢',
        color: 'bg-indigo-50 border-indigo-200'
      },
      {
        title: 'Poker Games',
        description: 'Play poker and earn rewards',
        icon: '🃏',
        color: 'bg-rose-50 border-rose-200'
      }
    ]
  }
]

export default function OfflineDisplay() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to Wisegcash</h1>
          <p className="text-lg text-slate-600 mb-8">
            Your all-in-one financial platform for crypto, payments, and business management
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
              Sign In
            </button>
            <button className="px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 font-semibold transition-colors">
              Create Account
            </button>
          </div>
        </div>

        {/* Features Sections */}
        <div className="space-y-12">
          {FEATURE_ROWS.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-3xl">
                  {sectionIdx === 0 ? '💰' : sectionIdx === 1 ? '👤' : '🏢'}
                </span>
                {section.category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.features.map((feature, featureIdx) => (
                  <div
                    key={featureIdx}
                    className={`rounded-lg border-2 p-6 transition-all hover:shadow-lg hover:scale-105 cursor-pointer ${feature.color}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-3xl flex-shrink-0">{feature.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                        <p className="text-sm text-slate-600">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="mt-16 bg-white rounded-xl shadow-lg p-8 border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Why Choose Wisegcash?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🔒', title: 'Secure', desc: 'Bank-level encryption and security' },
              { icon: '⚡', title: 'Fast', desc: 'Instant transactions and transfers' },
              { icon: '💎', title: 'Reliable', desc: 'Available 24/7 for your needs' },
              { icon: '🌍', title: 'Global', desc: 'Access from anywhere in the world' }
            ].map((benefit, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl mb-3">{benefit.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-1">{benefit.title}</h3>
                <p className="text-sm text-slate-600">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-600">
          <p className="mb-4">Ready to get started?</p>
          <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors">
            Sign In or Create Account
          </button>
        </div>
      </div>
    </div>
  )
}
