import React from 'react'

export default function OfflineTabNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'login', label: 'Login' },
    { id: 'register', label: 'Register' }
  ]

  return (
    <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-light text-slate-900 tracking-wide py-4">currency.ph</h1>
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
