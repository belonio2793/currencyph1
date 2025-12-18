import React, { useState } from 'react'

function Footer({ onNavigate, userEmail }) {
  const [expandedGroups, setExpandedGroups] = useState({
    account: true,
    main: true,
    financial: false,
    marketplace: false,
    community: false,
    personal: false,
    games: false,
    maps: false,
    network: false
  })

  const footerCategories = [
    {
      id: 'account',
      label: 'Account',
      items: [
        { label: 'Profile', tab: 'profile' },
        { label: 'Inbox', tab: 'inbox' },
        { label: 'My Business', tab: 'my-business' },
        { label: 'History', tab: 'transactions' },
        { label: 'Wallet', tab: 'wallet' },
        { label: 'Deposit Funds', tab: 'deposit' }
      ]
    },
    {
      id: 'main',
      label: 'Main',
      items: [
        { label: 'Nearby', tab: 'nearby' },
        { label: 'Rides', tab: 'rides' }
      ]
    },
    {
      id: 'financial',
      label: 'Financial',
      items: [
        { label: 'Currency Rates', tab: 'rates' },
        { label: 'Payments', tab: 'payments-financial' },
        { label: 'Send Money', tab: 'send' },
        { label: 'Receive Money', tab: 'receive' }
      ]
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      items: [
        { label: 'Jobs', tab: 'jobs' },
        { label: 'Loans', tab: 'p2p-loans' }
      ]
    },
    {
      id: 'community',
      label: 'Community',
      items: [
        { label: 'Online Users', tab: 'online-users' },
        { label: 'Messages', tab: 'messages' },
        { label: 'Market Opportunities', tab: 'investments' }
      ]
    },
    {
      id: 'personal',
      label: 'Personal',
      items: [
        { label: 'Bills', tab: 'bills' }
      ]
    },
    {
      id: 'games',
      label: 'Games',
      items: [
        { label: 'Poker', tab: 'poker' },
        { label: 'Chess', tab: 'chess' }
      ]
    },
    {
      id: 'maps',
      label: 'Maps',
      items: [
        { label: 'Shipping', tab: 'shipping' }
      ]
    },
    {
      id: 'network',
      label: 'Network',
      items: [
        { label: 'Network Balances', tab: 'network-balances' }
      ]
    }
  ]

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const handleLinkClick = (tab) => {
    onNavigate?.(tab)
  }

  return (
    <footer className="mt-16 bg-slate-900 text-slate-100 border-t border-slate-700">
      <div className="w-full">
        {/* Footer Content Grid */}
        <div className="px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {footerCategories.map(category => {
              const isExpanded = expandedGroups[category.id]

              return (
                <div key={category.id} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(category.id)}
                    className="w-full flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800/60 px-3 py-2 rounded-lg transition-all duration-200 uppercase tracking-wide"
                  >
                    <span>{category.label}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <ul className="space-y-1 ml-1">
                      {category.items.map(item => (
                        <li key={item.tab}>
                          <button
                            onClick={() => handleLinkClick(item.tab)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200 border-l-3 border-l-transparent hover:translate-x-1"
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-slate-700 px-6 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} currency.ph • All rights reserved
            </p>
            <div className="flex gap-6 text-xs">
              <button
                onClick={() => handleLinkClick('about')}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                About
              </button>
              <a
                href="#"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="#"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default React.memo(Footer)
