import { useState } from 'react'
import HeaderMap from './HeaderMap'

export default function Navbar({ activeTab, onTabChange, globalCurrency, setGlobalCurrency, userEmail, onShowAuth, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const mainNav = [
    { id: 'home', label: 'Home' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'wallet', label: 'Wallets' },
    { id: 'send', label: 'Send' }
  ]

  const secondaryNav = [
    { id: 'investments', label: 'Manage Investments' }
  ]

  const rightNav = [
    { id: 'bills', label: 'Bills' },
    { id: 'transactions', label: 'History' },
    { id: 'profile', label: 'Profile' }
  ]

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Row 1: Logo and HeaderMap */}
        <div className="py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-2xl md:text-2xl font-light text-slate-900 tracking-wide">currency.ph</h1>
            <div className="text-xs text-slate-500">play in the philippines</div>
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
            {mainNav.map(btn => (
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

            {/* Right-side nav items */}
            {rightNav.map(btn => (
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
          </div>

          {/* Secondary row for Manage Investments (desktop) */}
          <div className="hidden md:flex w-full mt-4 pt-3 border-t border-slate-100">
            <div className="w-full px-4 flex">
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
              {mainNav.concat(rightNav).map(btn => (
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
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
