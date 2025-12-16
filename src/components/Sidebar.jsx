import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  const [expandedGroups, setExpandedGroups] = useState({
    jobs: true,
    navigation: true,
    community: userEmail ? true : false
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const menuGroups = [
    {
      id: 'jobs',
      label: 'Opportunities',
      icon: '💼',
      items: [
        { id: 'jobs', label: 'Jobs', auth: true },
        { id: 'p2p-loans', label: 'Loans', auth: true },
        { id: 'deposit', label: 'Deposit', auth: true }
      ]
    },
    {
      id: 'navigation',
      label: 'Main',
      icon: '🏠',
      items: [
        { id: 'home', label: 'Home', public: true },
        { id: 'nearby', label: 'Nearby', auth: true },
        { id: 'rides', label: 'Rides', auth: true },
        { id: 'online-users', label: 'Online Users', auth: true },
        { id: 'rates', label: 'Rates', auth: true }
      ]
    },
    {
      id: 'community',
      label: 'Account',
      icon: '👥',
      items: [
        { id: 'investments', label: 'Community Projects', auth: true },
        { id: 'wallet', label: 'Wallets', auth: true },
        { id: 'send', label: 'Send', auth: true },
        { id: 'bills', label: 'Bills', auth: true },
        { id: 'transactions', label: 'History', auth: true },
        { id: 'profile', label: 'Profile', auth: true },
        { id: 'inbox', label: 'Inbox', auth: true },
        { id: 'my-business', label: 'My Business', auth: true }
      ]
    }
  ]

  const isItemVisible = (item) => {
    if (item.public) return true
    if (item.auth) return !!userEmail
    return true
  }

  const handleNavClick = (tabId) => {
    onTabChange(tabId)
  }

  // Hide completely on mobile
  if (isMobile) {
    return null
  }

  // Only render sidebar on desktop
  return (
    <aside
      className={`hidden md:flex md:flex-col bg-slate-900 text-slate-100 border-r border-slate-700 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="h-full flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className={`flex-1 ${isCollapsed ? 'hidden' : ''}`}>
            <h1 className="text-xl font-light tracking-wide">currency.ph</h1>
            {userEmail && (
              <p className="text-xs text-slate-400 mt-2 truncate">{userEmail}</p>
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

        {/* Menu Groups */}
        <nav className={`flex-1 ${!isCollapsed ? 'px-3' : 'px-2'} py-4 space-y-2`}>
          {menuGroups.map(group => {
            const visibleItems = group.items.filter(isItemVisible)
            if (visibleItems.length === 0) return null

            const isExpanded = expandedGroups[group.id]

            // On desktop collapsed, don't show group headers
            if (isCollapsed) {
              return (
                <div key={group.id}>
                  <div className="space-y-1">
                    {visibleItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center justify-center p-2 rounded-lg text-sm transition-colors ${
                          activeTab === item.id
                            ? 'bg-blue-600 text-white font-medium'
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
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between ${isCollapsed ? 'justify-center' : ''} px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors`}
                  title={isCollapsed ? group.label : ''}
                >
                  <span className={`flex items-center ${isCollapsed ? 'justify-center' : ''} gap-2`}>
                    <span className="text-base">{group.icon}</span>
                    {!isCollapsed && group.label}
                  </span>
                  {!isCollapsed && (
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                </button>

                {/* Group items */}
                {isExpanded && !isCollapsed && (
                  <div className="ml-2 space-y-1 mt-2">
                    {visibleItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeTab === item.id
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-slate-700 ${!isCollapsed ? 'p-3' : 'p-2'} space-y-2`}>
          {userEmail ? (
            <>
              <button
                onClick={() => onSignOut?.()}
                className={`w-full ${!isCollapsed ? 'px-3 py-2' : 'p-2 flex items-center justify-center'} text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors`}
                title={isCollapsed ? 'Sign out' : ''}
              >
                {isCollapsed ? '⬅️' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onShowAuth?.('login')}
                className={`w-full ${!isCollapsed ? 'px-3 py-2' : 'p-2 flex items-center justify-center'} text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors`}
                title={isCollapsed ? 'Login' : ''}
              >
                {isCollapsed ? '🔐' : 'Login'}
              </button>
              <button
                onClick={() => onShowAuth?.('register')}
                className={`w-full ${!isCollapsed ? 'px-3 py-2' : 'p-2 flex items-center justify-center'} text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors`}
                title={isCollapsed ? 'Register' : ''}
              >
                {isCollapsed ? '✏️' : 'Register'}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default React.memo(SidebarComponent)
