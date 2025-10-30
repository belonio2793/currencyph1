import { useState } from 'react'
import React, { useState } from 'react'
import HeaderMap from './HeaderMap'

export default function Navbar({ activeTab, onTabChange, globalCurrency, setGlobalCurrency, userEmail, onShowAuth, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const mainNav = [
    { id: 'home', label: 'Home', public: true },
    { id: 'nearby', label: 'Nearby', public: true }
  ]

  const secondaryNav = [
    { id: 'investments', label: 'Manage Investments' }
  ]

  // Buttons that should appear under the Manage Investments row
  const investmentsRowButtons = [
    { id: 'wallet', label: 'Wallets', auth: true },
    { id: 'send', label: 'Send', auth: true },
    { id: 'bills', label: 'Bills', auth: true },
    { id: 'transactions', label: 'History', auth: true },
    { id: 'profile', label: 'Profile', auth: true },
    { id: 'inbox', label: 'Inbox', auth: true }
  ]

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Row 1: Logo and HeaderMap */}
        <div className="py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-2xl md:text-2xl font-light text-slate-900 tracking-wide">currency.ph</h1>
          </div>
          <div className="hidden md:block">
            <HeaderMap />
          </div>
        </div>
        <div className="md:hidden w-full pb-4">
          <HeaderMap />
        </div>

        {/* Row 2: Currency selector and Navigation */}
        <div className="border-t border-slate-100 py-3 flex flex-wrap items-center gap-3">
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
                <option value="HKD">HKD - Hong Kong Dollar</option>
                <option value="IDR">IDR - Indonesian Rupiah</option>
                <option value="MYR">MYR - Malaysian Ringgit</option>
                <option value="THB">THB - Thai Baht</option>
                <option value="VND">VND - Vietnamese Dong</option>
                <option value="KRW">KRW - South Korean Won</option>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="BRL">BRL - Brazilian Real</option>
                <option value="MXN">MXN - Mexican Peso</option>
                <option value="NOK">NOK - Norwegian Krone</option>
                <option value="DKK">DKK - Danish Krone</option>
                <option value="AED">AED - UAE Dirham</option>
              </select>
            </div>
          )}

          {/* Desktop navigation */}
          <div className="hidden md:flex flex-wrap items-center gap-1">
            {mainNav.filter(btn => (btn.public || (!btn.auth) || userEmail)).map(btn => (
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

          {/* Secondary row for Manage Investments (desktop) */}
          <div className="hidden md:flex w-full mt-4 pt-3 border-t border-slate-100">
            <div className="w-full px-4 flex items-center gap-3">
              {secondaryNav.map(btn => (
                <button
                  key={btn.id}
                  onClick={() => onTabChange(btn.id)}
                  className={`px-4 py-2 text-sm font-semibold transition-colors rounded-md ${
                    activeTab === btn.id ? 'text-white bg-blue-600' : 'text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                >
                  {btn.label}
                </button>
              ))}

              {/* Buttons moved into the Manage Investments row */}
              <div className="ml-4 flex items-center gap-2">
                {investmentsRowButtons.filter(btn => (!btn.auth) || userEmail).map(btn => (
                  <button key={btn.id} onClick={() => onTabChange(btn.id)} className={`px-3 py-2 text-sm rounded-md ${activeTab === btn.id ? 'text-white bg-blue-600' : 'text-slate-700 bg-white hover:bg-slate-50'}`}>
                    {btn.label}
                  </button>
                ))}

                {/* Auth controls */}
                {userEmail ? (
                  <>
                    <span className="text-sm text-slate-600">{userEmail}</span>
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
          <div className="md:hidden pb-4 border-t border-slate-100">
            <div className="space-y-2">
              {mainNav.concat(rightNav).filter(btn => (btn.public || !btn.auth) || userEmail).map(btn => (
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

              {/* include secondary nav in mobile list */}
              {secondaryNav.map(btn => (
                <button
                  key={btn.id}
                  onClick={() => {
                    onTabChange(btn.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === btn.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {btn.label}
                </button>
              ))}

              {/* Mobile auth buttons */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {userEmail ? (
                  <>
                    <div className="px-3 text-sm text-slate-600">{userEmail}</div>
                    <button onClick={() => onSignOut && onSignOut()} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200">Sign out</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { onShowAuth && onShowAuth('login'); setMobileMenuOpen(false) }} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200">Login</button>
                    <button onClick={() => { onShowAuth && onShowAuth('register'); setMobileMenuOpen(false) }} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">Register</button>
                    <button onClick={() => { onShowAuth && onShowAuth('login'); setMobileMenuOpen(false) }} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-slate-50">Guest: guest/guest</button>
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
