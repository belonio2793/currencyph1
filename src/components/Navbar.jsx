import React, { useState } from 'react'
import HeaderMap from './HeaderMap'

export default function Navbar({ activeTab, onTabChange, globalCurrency, setGlobalCurrency, userEmail, userId, totalBalancePHP, totalBalanceConverted, totalDebtConverted, totalNet, onShowAuth, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [borrowDropdownOpen, setBorrowDropdownOpen] = useState(false)

  const mainNav = [
    { id: 'home', label: 'Home', public: true },
    { id: 'nearby', label: 'Nearby', auth: true },
    { id: 'online-users', label: 'Online Users', auth: true },
    { id: 'rates', label: 'Rates', auth: true },
    { id: 'deposit', label: 'Deposit', auth: true }
  ]

  const secondaryNav = [
    { id: 'investments', label: 'Community Projects', auth: true }
  ]

  // Buttons that should appear under the Community Projects row
  const investmentsRowButtons = [
    { id: 'wallet', label: 'Wallets', auth: true },
    { id: 'send', label: 'Send', auth: true },
    { id: 'bills', label: 'Bills', auth: true },
    { id: 'transactions', label: 'History', auth: true },
    { id: 'profile', label: 'Profile', auth: true },
    { id: 'inbox', label: 'Inbox', auth: true },
    { id: 'my-business', label: 'My Business', auth: true }
  ]

  // Loans dropdown options
  const loansOptions = [
    { id: 'p2p-loans', label: 'Peer To Peer Loan Marketplace', auth: true }
  ]

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Row 1: Logo and HeaderMap */}
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-2xl md:text-2xl font-light text-slate-900 tracking-wide">currency.ph</h1>
            {userEmail && (
              <div className="ml-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-sm text-slate-700 hidden sm:inline-flex items-center">
                <span className="text-slate-400 mr-2 text-xs">Total</span>
                {/* Display total balance (not net) in the selected display currency */}
                {typeof totalBalanceConverted !== 'undefined' ? (
                  <span className={`font-medium text-slate-900`}>
                    {Number(totalBalanceConverted || 0).toFixed(2)} {globalCurrency}
                  </span>
                ) : (
                  <span className="font-medium text-slate-900">{Number(totalBalancePHP || 0).toFixed(2)} PHP</span>
                )}
              </div>
            )}
            {/* Borrow Money Dropdown - Next to Total Balance */}

            {/* Desktop main navigation in the topmost header */}
            <div className="hidden md:flex items-center gap-3 ml-4">
              {/* Jobs tab - First tab to the left of Loans */}
              {userEmail && (
                <button
                  onClick={() => onTabChange('jobs')}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    activeTab === 'jobs' ? 'text-slate-900 bg-slate-50' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Jobs
                </button>
              )}

              {/* Loans dropdown (now in same row for consistent spacing) */}
              {userEmail && (
                <div className="relative">
                  {(() => {
                    const isLoansActive = loansOptions.some(o => o.id === activeTab) || activeTab === 'loans'
                    return (
                      <>
                        <button
                          onClick={() => setBorrowDropdownOpen(!borrowDropdownOpen)}
                          className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${isLoansActive ? 'text-slate-900 bg-slate-50' : 'text-slate-700 hover:text-slate-900'}`}
                        >
                          Loans
                        </button>
                        {borrowDropdownOpen && (
                          <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50">
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 rounded-t-lg">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Loans</p>
                            </div>
                            {loansOptions.map(option => (
                              <button
                                key={option.id}
                                onClick={() => {
                                  onTabChange(option.id)
                                  setBorrowDropdownOpen(false)
                                }}
                                className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-100 last:border-b-0"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {mainNav.filter(btn => (btn.public || (!btn.auth) || userEmail) && !['home','nearby','rates'].includes(btn.id)).map(btn => (
                <button
                  key={btn.id}
                  onClick={() => { onTabChange(btn.id); setMobileMenuOpen(false) }}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    activeTab === btn.id ? 'text-slate-900 bg-slate-50' : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <HeaderMap userId={userId} />
          </div>
        </div>
        <div className="md:hidden w-full pb-4">
          <HeaderMap />
        </div>

        {/* Row 2: Currency selector and Navigation */}
        <div className="border-t border-slate-100 py-2 flex flex-wrap items-center gap-2">
          {globalCurrency && setGlobalCurrency && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Display Currency:</label>
              <select
                value={globalCurrency}
                onChange={(e) => setGlobalCurrency(e.target.value)}
                className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-white"
              >
                <option value="PHP">PHP - Philippine Peso</option>
                <option value="USD">USD - US Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CNY">CNY - Chinese Yuan</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="SEK">SEK - Swedish Krona</option>
                <option value="NZD">NZD - New Zealand Dollar</option>
                <option value="SGD">SGD - Singapore Dollar</option>
                <option value="HKD">Hong Kong Dollar</option>
                <option value="IDR">Indonesian Rupiah</option>
                <option value="MYR">Malaysian Ringgit</option>
                <option value="THB">Thai Baht</option>
                <option value="VND">Vietnamese Dong</option>
                <option value="KRW">South Korean Won</option>
                <option value="ZAR">South African Rand</option>
                <option value="BRL">Brazilian Real</option>
                <option value="MXN">Mexican Peso</option>
                <option value="NOK">Norwegian Krone</option>
                <option value="DKK">Danish Krone</option>
                <option value="AED">UAE Dirham</option>
              </select>
            </div>
          )}

          {/* Desktop navigation */}
          <div className="hidden md:flex flex-wrap items-center gap-1">
            {mainNav
              .filter(btn => (btn.public || (!btn.auth) || userEmail))
              .filter(btn => btn.id !== 'deposit')
              .map(btn => (
                <button
                  key={btn.id}
                  onClick={() => {
                    onTabChange(btn.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    activeTab === btn.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {btn.label}
                </button>
              ))}

            {/* Auth controls will be rendered in the investments row */}
          </div>

          {/* Secondary row for Community Projects (desktop) - only show when signed in */}
          {userEmail && (
            <div className="hidden md:flex w-full mt-2 pt-2 border-t border-slate-100">
              <div className="w-full px-4 flex items-center">
                <div className="flex items-center gap-2">
                  {secondaryNav.filter(btn => !btn.auth || userEmail).map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => onTabChange(btn.id)}
                      className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                        activeTab === btn.id ? 'text-slate-900 bg-slate-100' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}

                  {/* Buttons moved into the Community Projects row */}
                  <div className="ml-2 flex items-center gap-2">
                    {investmentsRowButtons.filter(btn => (!btn.auth) || userEmail).map(btn => (
                      <button key={btn.id} onClick={() => onTabChange(btn.id)} className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${activeTab === btn.id ? 'text-slate-900 bg-slate-100' : 'text-slate-700 hover:bg-slate-100'}`}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right-aligned auth controls */}
                <div className="ml-auto flex items-center gap-2">
                  {userEmail ? (
                    <>
                      <span className="text-sm font-medium text-blue-600 truncate max-w-[200px]">{userEmail}</span>
                      <button onClick={() => onSignOut && onSignOut()} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50">Sign out</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onShowAuth && onShowAuth('login')} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50">Login</button>
                      <button onClick={() => onShowAuth && onShowAuth('register')} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Register</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 ml-auto"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-2 border-t border-slate-100">
            <div className="space-y-1">
              {/* Jobs tab for mobile */}
              {userEmail && (
                <button
                  onClick={() => {
                    onTabChange('jobs')
                    setMobileMenuOpen(false)
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'jobs'
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  Jobs
                </button>
              )}

              {mainNav.concat(secondaryNav, investmentsRowButtons).filter(btn => (btn.public || !btn.auth || userEmail)).map(btn => (
                <button
                  key={btn.id}
                  onClick={() => {
                    onTabChange(btn.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === btn.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {btn.label}
                </button>
              ))}


              {/* Mobile Borrow Money dropdown */}
              {userEmail && (
                <div className="border-t border-slate-100 mt-2 pt-2">
                  <div className="text-xs font-bold text-green-700 px-3 py-2 uppercase tracking-wide">Loans</div>
                  {loansOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        onTabChange(option.id)
                        setMobileMenuOpen(false)
                      }}
                      className="block w-full text-left px-6 py-2 rounded-lg text-sm text-slate-600 hover:bg-green-50 hover:text-green-700 transition-colors hover:font-medium"
                    >
                      <span className="text-green-600 mr-2">→</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Mobile auth buttons */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                {userEmail ? (
                  <>
                    <div className="px-3 text-sm text-slate-600">{userEmail}</div>
                    <button onClick={() => onSignOut && onSignOut()} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200">Sign out</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { onShowAuth && onShowAuth('login'); setMobileMenuOpen(false) }} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200">Login</button>
                    <button onClick={() => { onShowAuth && onShowAuth('register'); setMobileMenuOpen(false) }} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">Register</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
