import React, { useState, useEffect } from 'react'
import { useDevice } from '../context/DeviceContext'

export default function Sidebar({ activeTab, onTabChange, userEmail, onShowAuth, onSignOut }) {
  const { isMobile } = useDevice()
  const [isOpen, setIsOpen] = useState(!isMobile)
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
    if (isMobile) setIsOpen(false)
  }

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
          title={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 transform transition-transform duration-300 ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'w-64 bg-slate-900 text-slate-100 border-r border-slate-700 hidden md:block'
        }`}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-700">
            <h1 className="text-xl font-light tracking-wide">currency.ph</h1>
            {userEmail && (
              <p className="text-xs text-slate-400 mt-2 truncate">{userEmail}</p>
            )}
          </div>

          {/* Menu Groups */}
          <nav className="flex-1 px-3 py-4 space-y-2">
            {menuGroups.map(group => {
              const visibleItems = group.items.filter(isItemVisible)
              if (visibleItems.length === 0) return null

              const isExpanded = expandedGroups[group.id]

              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{group.icon}</span>
                      {group.label}
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

                  {/* Group items */}
                  {isExpanded && (
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
          <div className="border-t border-slate-700 p-3 space-y-2">
            {userEmail ? (
              <>
                <button
                  onClick={() => {
                    onSignOut?.()
                    if (isMobile) setIsOpen(false)
                  }}
                  className="w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onShowAuth?.('login')
                    if (isMobile) setIsOpen(false)
                  }}
                  className="w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    onShowAuth?.('register')
                    if (isMobile) setIsOpen(false)
                  }}
                  className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
