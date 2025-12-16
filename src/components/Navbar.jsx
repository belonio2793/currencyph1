import React, { useState } from 'react'
import { useDevice } from '../context/DeviceContext'
import HeaderMap from './HeaderMap'
import CurrencySelectionModal from './CurrencySelectionModal'

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
            <button
              onClick={() => setShowCurrencyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              <span className="hidden sm:inline">Display Currency</span>
              <span className="sm:hidden">Currency</span>
              <span className="text-xs bg-blue-800 rounded px-2 py-0.5">{globalCurrency} & {globalCryptocurrency}</span>
            </button>
          )}

          {/* Auth buttons - right aligned */}
          <div className="ml-auto flex items-center gap-2">
            {userEmail ? (
              <>
                <span className="text-sm font-medium text-slate-600">{userEmail}</span>
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
    </nav>
  )
}
