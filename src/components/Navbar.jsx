import React, { useState, useEffect } from 'react'
import { useDevice } from '../context/DeviceContext'
import HeaderMap from './HeaderMap'
import CurrencySelectionModal from './CurrencySelectionModal'
import { convertFiatToCryptoDb, getCryptoRateWithTimestamp } from '../lib/cryptoRatesDb'

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
  const [displayType, setDisplayType] = useState('fiat') // 'fiat' or 'crypto'
  const [cryptoBalance, setCryptoBalance] = useState(null)
  const [loadingCrypto, setLoadingCrypto] = useState(false)

  // Fetch crypto balance when displayType changes to 'crypto'
  useEffect(() => {
    if (displayType === 'crypto' && userEmail && totalBalanceConverted && globalCryptocurrency) {
      setLoadingCrypto(true)
      convertFiatToCryptoDb(totalBalanceConverted, globalCurrency, globalCryptocurrency)
        .then(balance => {
          setCryptoBalance(balance)
          setLoadingCrypto(false)
        })
        .catch(error => {
          console.error('Failed to fetch crypto balance:', error)
          setCryptoBalance(null)
          setLoadingCrypto(false)
        })
    }
  }, [displayType, totalBalanceConverted, globalCurrency, globalCryptocurrency, userEmail])


  return (
    <nav className="bg-slate-50 border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Row 1: Logo and HeaderMap */}
        <div className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-2xl md:text-2xl font-light text-slate-900 tracking-wide">currency.ph</h1>
            {userEmail && (
              <div className="ml-2 flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 text-sm text-slate-700 hidden sm:inline-flex">
                <div className="px-3 py-1 flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Total</span>
                  {/* Display toggle buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => setDisplayType('fiat')}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        displayType === 'fiat'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Fiat
                    </button>
                    <button
                      onClick={() => setDisplayType('crypto')}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        displayType === 'crypto'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Crypto
                    </button>
                  </div>
                </div>
                <div className="px-3 py-1 border-l border-slate-200">
                  {displayType === 'fiat' ? (
                    <>
                      {typeof totalBalanceConverted !== 'undefined' ? (
                        <span className={`font-medium text-slate-900`}>
                          {Number(totalBalanceConverted || 0).toFixed(2)} {globalCurrency}
                        </span>
                      ) : (
                        <span className="font-medium text-slate-900">{Number(totalBalancePHP || 0).toFixed(2)} PHP</span>
                      )}
                    </>
                  ) : (
                    <span className="font-medium text-slate-900 text-xs">
                      {loadingCrypto ? (
                        <span className="text-slate-400">Loading...</span>
                      ) : cryptoBalance !== null ? (
                        <>{cryptoBalance.toFixed(8)} {globalCryptocurrency}</>
                      ) : (
                        <span className="text-slate-400">Unable to load rate</span>
                      )}
                    </span>
                  )}
                </div>
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
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Display Currency:</label>
                <button
                  onClick={() => setShowCurrencyModal(true)}
                  className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-slate-50 text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span>{globalCurrency} - {currencyLabels[globalCurrency] || globalCurrency}</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>

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
