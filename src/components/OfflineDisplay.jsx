import React from 'react'
import { useDevice } from '../context/DeviceContext'

const FEATURE_ROWS = [
  {
    category: 'Financial Services',
    features: [
      {
        title: 'Digital Wallet',
        description: 'Send and receive money securely with crypto and fiat',
        icon: 'W',
        color: 'bg-blue-50 border-blue-200'
      },
      {
        title: 'Payments',
        description: 'Connect GCash, PayMaya, and other payment methods',
        icon: 'P',
        color: 'bg-pink-50 border-pink-200'
      },
      {
        title: 'Network Balances',
        description: 'Track your balances across multiple networks',
        icon: 'N',
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
        icon: 'F',
        color: 'bg-green-50 border-green-200'
      },
      {
        title: 'Messages',
        description: 'Stay connected with direct messaging',
        icon: 'M',
        color: 'bg-purple-50 border-purple-200'
      },
      {
        title: 'P2P Loans',
        description: 'Browse loans and submit lending offers',
        icon: 'L',
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
        icon: 'R',
        color: 'bg-amber-50 border-amber-200'
      },
      {
        title: 'My Business',
        description: 'Manage your businesses and employee information',
        icon: 'B',
        color: 'bg-indigo-50 border-indigo-200'
      }
    ]
  },
  {
    category: 'Games',
    features: [
      {
        title: 'Poker',
        description: 'Play poker and earn rewards',
        icon: 'PK',
        color: 'bg-rose-50 border-rose-200'
      }
    ]
  }
]

export default function OfflineDisplay({ onShowAuth }) {
  const { isMobile, isTablet } = useDevice()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 sm:py-12 px-3 sm:px-4">
      <div className={`${isMobile ? 'mx-auto' : 'max-w-6xl mx-auto'}`}>
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className={`font-bold text-slate-900 mb-4 ${isMobile ? 'text-2xl' : 'text-4xl'}`}>Welcome to Currency</h1>
          <div className={`flex gap-2 sm:gap-4 justify-center ${isMobile ? 'flex-col' : 'flex-row'}`}>
            <button onClick={() => onShowAuth?.('login')} className={`bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors ${isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3'}`}>
              Sign In
            </button>
            <button onClick={() => onShowAuth?.('register')} className={`bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 font-semibold transition-colors ${isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3'}`}>
              Create Account
            </button>
          </div>
        </div>

        {/* Features Sections */}
        <div className="space-y-8 sm:space-y-12">
          {FEATURE_ROWS.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <h2 className={`font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                <span className="inline-block w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-700 flex-shrink-0">
                  {sectionIdx === 0 ? 'FS' : sectionIdx === 1 ? 'PF' : sectionIdx === 2 ? 'BS' : 'GM'}
                </span>
                <span className={isMobile ? 'text-sm' : 'text-base'}>{section.category}</span>
              </h2>
              <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                {section.features.map((feature, featureIdx) => (
                  <div
                    key={featureIdx}
                    className={`rounded-lg border-2 p-4 sm:p-6 transition-all ${!isMobile && 'hover:shadow-lg hover:scale-105'} cursor-pointer ${feature.color}`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-700 flex-shrink-0 text-xs sm:text-sm">{feature.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-slate-900 mb-1 ${isMobile ? 'text-sm' : 'text-base'}`}>{feature.title}</h3>
                        <p className={`text-slate-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className={`mt-12 sm:mt-16 bg-white rounded-xl shadow-lg border border-slate-200 ${isMobile ? 'p-4' : 'p-8'}`}>
          <h2 className={`font-bold text-slate-900 mb-6 sm:mb-8 ${isMobile ? 'text-lg' : 'text-2xl'}`}>Why Choose Currency?</h2>
          <div className={`grid gap-4 sm:gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
            {[
              { icon: 'S', title: 'Secure', desc: 'Bank-level encryption and security' },
              { icon: 'F', title: 'Fast', desc: 'Instant transactions and transfers' },
              { icon: 'R', title: 'Reliable', desc: 'Available 24/7 for your needs' },
              { icon: 'G', title: 'Global', desc: 'Access from anywhere in the world' }
            ].map((benefit, idx) => (
              <div key={idx} className="text-center">
                <div className={`rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-700 mb-2 sm:mb-3 mx-auto ${isMobile ? 'w-12 h-12 text-lg' : 'w-16 h-16 text-2xl'}`}>{benefit.icon}</div>
                <h3 className={`font-semibold text-slate-900 mb-1 ${isMobile ? 'text-sm' : 'text-base'}`}>{benefit.title}</h3>
                <p className={`text-slate-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 sm:mt-12 text-center text-slate-600">
          <p className={`mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}>Ready to get started?</p>
          <button onClick={() => onShowAuth?.('login')} className={`bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors ${isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3'}`}>
            Sign In or Create Account
          </button>
        </div>
      </div>
    </div>
  )
}
