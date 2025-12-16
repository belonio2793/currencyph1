import React, { useState } from 'react'
import { useDevice } from '../context/DeviceContext'
import HeaderMap from './HeaderMap'
import CurrencySelectionModal from './CurrencySelectionModal'

const currencyLabels = {
  'PHP': 'Philippine Peso',
  'USD': 'US Dollar',
  'CAD': 'Canadian Dollar',
  'EUR': 'Euro',
  'GBP': 'British Pound',
  'JPY': 'Japanese Yen',
  'CNY': 'Chinese Yuan',
  'INR': 'Indian Rupee',
  'AUD': 'Australian Dollar',
  'CHF': 'Swiss Franc',
  'SEK': 'Swedish Krona',
  'NZD': 'New Zealand Dollar',
  'SGD': 'Singapore Dollar',
  'HKD': 'Hong Kong Dollar',
  'IDR': 'Indonesian Rupiah',
  'MYR': 'Malaysian Ringgit',
  'THB': 'Thai Baht',
  'VND': 'Vietnamese Dong',
  'KRW': 'South Korean Won',
  'ZAR': 'South African Rand',
  'BRL': 'Brazilian Real',
  'MXN': 'Mexican Peso',
  'NOK': 'Norwegian Krone',
  'DKK': 'Danish Krone',
  'AED': 'UAE Dirham'
}

export default function Navbar({ activeTab, onTabChange, globalCurrency, setGlobalCurrency, globalCryptocurrency, setGlobalCryptocurrency, userEmail, userId, totalBalancePHP, totalBalanceConverted, totalDebtConverted, totalNet, onShowAuth, onSignOut }) {
  const { isMobile, isTablet } = useDevice()
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)


  return (
    <nav className="bg-slate-50 border-b border-slate-100 sticky top-0 z-50">
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
              <button
                onClick={() => setShowCurrencyModal(true)}
                className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-slate-50 text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {globalCurrency} - {globalCurrency === 'PHP' ? 'Philippine Peso' : globalCurrency === 'USD' ? 'US Dollar' : globalCurrency === 'CAD' ? 'Canadian Dollar' : globalCurrency === 'EUR' ? 'Euro' : globalCurrency === 'GBP' ? 'British Pound' : globalCurrency === 'JPY' ? 'Japanese Yen' : globalCurrency === 'CNY' ? 'Chinese Yuan' : globalCurrency === 'INR' ? 'Indian Rupee' : globalCurrency === 'AUD' ? 'Australian Dollar' : globalCurrency === 'CHF' ? 'Swiss Franc' : globalCurrency === 'SEK' ? 'Swedish Krona' : globalCurrency === 'NZD' ? 'New Zealand Dollar' : globalCurrency === 'SGD' ? 'Singapore Dollar' : globalCurrency === 'HKD' ? 'Hong Kong Dollar' : globalCurrency === 'IDR' ? 'Indonesian Rupiah' : globalCurrency === 'MYR' ? 'Malaysian Ringgit' : globalCurrency === 'THB' ? 'Thai Baht' : globalCurrency === 'VND' ? 'Vietnamese Dong' : globalCurrency === 'KRW' ? 'South Korean Won' : globalCurrency === 'ZAR' ? 'South African Rand' : globalCurrency === 'BRL' ? 'Brazilian Real' : globalCurrency === 'MXN' ? 'Mexican Peso' : globalCurrency === 'NOK' ? 'Norwegian Krone' : globalCurrency === 'DKK' ? 'Danish Krone' : globalCurrency === 'AED' ? 'UAE Dirham' : globalCurrency}
                <svg className="inline ml-2 w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          )}

          {/* Auth buttons - right aligned */}
          <div className="ml-auto flex items-center gap-2">
            {userEmail ? (
              <>
                <span className="text-sm font-medium text-slate-600 hidden sm:inline">{userEmail}</span>
                <button onClick={() => onSignOut && onSignOut()} className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100">Sign out</button>
              </>
            ) : (
              <>
                <button onClick={() => onShowAuth && onShowAuth('login')} className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100">Login</button>
                <button onClick={() => onShowAuth && onShowAuth('register')} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Register</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Currency Selection Modal */}
      <CurrencySelectionModal
        isOpen={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
        globalCurrency={globalCurrency}
        setGlobalCurrency={setGlobalCurrency}
        globalCryptocurrency={globalCryptocurrency}
        setGlobalCryptocurrency={setGlobalCryptocurrency}
      />
    </nav>
  )
}
