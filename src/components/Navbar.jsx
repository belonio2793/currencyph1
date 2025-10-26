import { useState } from 'react'

export default function Navbar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'dashboard', label: '💼 Dashboard' },
    { id: 'wallet', label: '💳 Wallet' },
    { id: 'send', label: '📤 Send' },
    { id: 'bills', label: '📋 Bills' },
    { id: 'transactions', label: '📊 History' },
    { id: 'profile', label: '👤 Profile' }
  ]

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-blue-600">💰 WiseGCash</h1>
            <div className="hidden md:flex space-x-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden pb-2 border-t border-gray-100">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap text-sm ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
