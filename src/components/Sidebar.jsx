import React, { useState, useEffect, useMemo } from 'react'
import { useDevice } from '../context/DeviceContext'

function SidebarComponent({ activeTab, onTabChange, userEmail, onShowAuth, onSignOut }) {
  const { isMobile } = useDevice()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed')
      return saved ? JSON.parse(saved) : false
    }
    return false
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState({
    account: true,
    main: true,
    financial: false,
    marketplace: false,
    community: false,
    personal: false,
    business: false,
    games: false,
    maps: false,
    system: false
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const menuGroups = [
    {
      id: 'account',
      label: 'Account',
      icon: '',
      items: [
        { id: 'profile', label: 'Profile', auth: true },
        { id: 'inbox', label: 'Inbox', auth: true },
        { id: 'my-business', label: 'My Business', auth: true, children: [
          { id: 'bir-integration', label: 'BIR Integration', auth: true },
          { id: 'digital-receipts', label: 'Digital Receipts', auth: true },
          { id: 'payments', label: 'Payments', auth: true },
          { id: 'shareholders', label: 'Shareholders', auth: true },
          { id: 'jobs-hiring', label: 'Jobs & Hiring', auth: true },
          { id: 'employees-payroll', label: 'Employees & Payroll', auth: true },
          { id: 'sales-tax', label: 'Sales & Tax Reporting', auth: true }
        ]},
        { id: 'transactions', label: 'History', auth: true },
        { id: 'wallet', label: 'Wallets', auth: true },
        { id: 'deposit', label: 'Deposit Funds', auth: true }
      ]
    },
    {
      id: 'main',
      label: 'Main',
      icon: '',
      items: [
        { id: 'home', label: 'Home', auth: false },
        { id: 'nearby', label: 'Nearby', auth: true },
        { id: 'rides', label: 'Rides', auth: true }
      ]
    },
    {
      id: 'financial',
      label: 'Financial',
      icon: '',
      items: [
        { id: 'rates', label: 'Currency Rates', auth: true },
        { id: 'payments', label: 'Payments', auth: true },
        { id: 'send', label: 'Send Money', auth: true },
        { id: 'receive', label: 'Receive Money', auth: true }
      ]
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: '',
      items: [
        { id: 'jobs', label: 'Jobs', auth: true },
        { id: 'p2p-loans', label: 'Loans', auth: true }
      ]
    },
    {
      id: 'community',
      label: 'Community',
      icon: '',
      items: [
        { id: 'online-users', label: 'Online Users', auth: true },
        { id: 'messages', label: 'Messages', auth: true },
        { id: 'investments', label: 'Market Opportunities', auth: true }
      ]
    },
    {
      id: 'personal',
      label: 'Personal',
      icon: '',
      items: [
        { id: 'bills', label: 'Bills', auth: true }
      ]
    },
    {
      id: 'business',
      label: 'Business',
      icon: '',
      items: []
    },
    {
      id: 'games',
      label: 'Games',
      icon: '',
      items: [
        { id: 'poker', label: 'Poker', auth: true },
        { id: 'chess', label: 'Chess', auth: true }
      ]
    },
    {
      id: 'maps',
      label: 'Maps',
      icon: '',
      items: [
        { id: 'shipping', label: 'Shipping', auth: true }
      ]
    },
    {
      id: 'network',
      label: 'Network',
      icon: '',
      items: [
        { id: 'network-balances', label: 'Network Balances', auth: true }
      ]
    }
  ]

  const isItemVisible = (item) => {
    if (item.public) return true
    if (item.auth) return !!userEmail
    return true
  }

  const searchItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return menuGroups
    }

    const query = searchQuery.toLowerCase()
    const filteredGroups = menuGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        const matchesItem = item.label.toLowerCase().includes(query)
        const matchesChild = item.children?.some(child => 
          child.label.toLowerCase().includes(query)
        )
        return matchesItem || matchesChild
      }).map(item => ({
        ...item,
        children: item.children?.filter(child =>
          child.label.toLowerCase().includes(query)
        )
      }))
    })).filter(group => group.items.length > 0)

    return filteredGroups
  }, [searchQuery])

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const handleNavClick = (tabId) => {
    // Map business sub-menu items to 'my-business' tab
    const businessSubItems = [
      'bir-integration',
      'digital-receipts',
      'shareholders',
      'jobs-hiring',
      'employees-payroll',
      'sales-tax'
    ]

    if (businessSubItems.includes(tabId)) {
      // Redirect to my-business page with notification
      onTabChange('my-business')
      // Store the intended section in sessionStorage to show on load
      try {
        sessionStorage.setItem('pendingBusinessSection', tabId)
      } catch (e) {
        console.debug('Could not store pending section:', e)
      }
    } else {
      onTabChange(tabId)
    }
    setSearchQuery('')
  }

  if (isMobile) {
    return null
  }

  return (
    <aside
      className={`hidden md:flex md:flex-col bg-slate-900 text-slate-100 border-r border-slate-700 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className={`flex-1 ${isCollapsed ? 'hidden' : ''}`}>
            <h1 className="text-xl font-light tracking-wide">currency.ph</h1>
            {userEmail && (
              <p className="text-xs text-slate-400 mt-1 truncate">{userEmail}</p>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-300 hover:text-white flex-shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7m0 0l-7 7m7-7H5" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Search Bar */}
        {!isCollapsed && (
          <div className="px-3 py-3 border-b border-slate-700 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Menu Groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {searchItems.map(group => {
            const visibleItems = group.items.filter(isItemVisible)
            if (visibleItems.length === 0) return null

            const isExpanded = expandedGroups[group.id]

            if (isCollapsed) {
              return (
                <div key={group.id}>
                  <div className="space-y-1">
                    {visibleItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center justify-center p-2.5 rounded-lg text-sm transition-all duration-200 ${
                          activeTab === item.id
                            ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white font-medium shadow-lg shadow-blue-500/40'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                        title={item.label}
                      >
                        <span className="text-base">{item.label.charAt(0).toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <div key={group.id} className="space-y-1">
                <div className="pt-2 mt-1 border-t border-slate-700/50"></div>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold text-slate-200 hover:bg-slate-800/60 hover:text-white transition-all duration-200 uppercase tracking-wide"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{group.icon}</span>
                    <span>{group.label}</span>
                  </span>
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
                  <div className="ml-1 space-y-0.5">
                    {visibleItems.map(item => (
                      <div key={item.id}>
                        <button
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 relative border-l-3 ${
                            activeTab === item.id
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium shadow-lg shadow-blue-500/30 border-l-sky-300'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white hover:translate-x-1 border-l-transparent'
                          }`}
                        >
                          {item.label}
                        </button>
                        {item.children && item.children.length > 0 && activeTab === item.id && (
                          <ul className="ml-4 space-y-0.5 list-none">
                            {item.children.map(child => (
                              <li
                                key={child.id}
                                className={`flex items-start text-xs transition-all duration-200 rounded-lg overflow-hidden border-l-2 ${
                                  activeTab === child.id
                                    ? 'bg-blue-800/40 text-blue-100 border-l-blue-400'
                                    : 'border-l-transparent'
                                }`}
                              >
                                <span className={`mr-2 pt-1.5 flex-shrink-0 transition-colors ${
                                  activeTab === child.id
                                    ? 'text-blue-300'
                                    : 'text-slate-600'
                                }`}>
                                  •
                                </span>
                                <button
                                  onClick={() => handleNavClick(child.id)}
                                  className={`w-full text-left px-2 py-1.5 transition-all duration-200 ${
                                    activeTab === child.id
                                      ? 'text-blue-100 font-medium'
                                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                  }`}
                                >
                                  {child.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-slate-700 ${!isCollapsed ? 'p-3' : 'p-2'} space-y-2 flex-shrink-0`}>
          {userEmail ? (
            <button
              onClick={() => onSignOut?.()}
              className={`w-full ${!isCollapsed ? 'px-3 py-2' : 'p-2 flex items-center justify-center'} text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors`}
              title={isCollapsed ? 'Sign out' : ''}
            >
              {isCollapsed ? '' : 'Sign out'}
            </button>
          ) : (
            <>
              <button
                onClick={() => onShowAuth?.('login')}
                className={`w-full ${!isCollapsed ? 'px-3 py-2' : 'p-2 flex items-center justify-center'} text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors`}
                title={isCollapsed ? 'Login' : ''}
              >
                {isCollapsed ? '' : 'Login'}
              </button>
              <button
                onClick={() => onShowAuth?.('register')}
                className={`w-full ${!isCollapsed ? 'px-3 py-2' : 'p-2 flex items-center justify-center'} text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors`}
                title={isCollapsed ? 'Register' : ''}
              >
                {isCollapsed ? '' : 'Register'}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default React.memo(SidebarComponent)
