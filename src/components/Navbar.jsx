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
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Display Currency:</label>
                <select
                  value={globalCurrency}
                  onChange={(e) => setGlobalCurrency(e.target.value)}
                  className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-slate-50"
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

              {globalCryptocurrency && setGlobalCryptocurrency && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Display Cryptocurrency:</label>
                  <select
                    value={globalCryptocurrency}
                    onChange={(e) => setGlobalCryptocurrency(e.target.value)}
                    className="px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm font-medium bg-slate-50"
                  >
                    <option value="BTC">BTC - Bitcoin</option>
                    <option value="ETH">ETH - Ethereum</option>
                    <option value="USDT">USDT - Tether</option>
                    <option value="BNB">BNB - Binance Coin</option>
                    <option value="SOL">SOL - Solana</option>
                    <option value="XRP">XRP - Ripple</option>
                    <option value="ADA">ADA - Cardano</option>
                    <option value="DOGE">DOGE - Dogecoin</option>
                    <option value="DOT">DOT - Polkadot</option>
                    <option value="BCH">BCH - Bitcoin Cash</option>
                    <option value="LTC">LTC - Litecoin</option>
                    <option value="USDC">USDC - USD Coin</option>
                    <option value="LINK">LINK - Chainlink</option>
                    <option value="MATIC">MATIC - Polygon</option>
                    <option value="UNI">UNI - Uniswap</option>
                  </select>
                </div>
              )}
            </div>
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
