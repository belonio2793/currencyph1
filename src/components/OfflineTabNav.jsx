import React from 'react'
import HeaderMap from './HeaderMap'

export default function OfflineTabNav({ activeTab, onTabChange, globalCurrency, setGlobalCurrency }) {
  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'login', label: 'Login' },
    { id: 'register', label: 'Register' }
  ]

  return (
    <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        {/* Row 1: Logo, HeaderMap, and tabs */}
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light text-slate-900 tracking-wide">currency.ph</h1>
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
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
          <div className="hidden md:flex items-center gap-3">
            <HeaderMap />
          </div>
        </div>

        {/* Mobile HeaderMap */}
        <div className="md:hidden w-full pb-4">
          <HeaderMap />
        </div>

        {/* Currency selector */}
        <div className="border-t border-slate-100 py-2">
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
        </div>
      </div>
    </div>
  )
}
