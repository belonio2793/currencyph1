import React, { useState, useEffect, useRef } from 'react'
import { formatNumber } from '../lib/currency'

/**
 * Enhanced Wallet Dropdown with:
 * - Fiat and Cryptocurrency separation
 * - Real-time search with autopropagation
 * - Wallet details display
 * - Easy currency/balance visibility
 */
function EnhancedWalletDropdown({ wallets, selectedWallet, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const selectedWalletData = wallets.find(w => w.id === selectedWallet)

  // Separate wallets by type
  const fiatWallets = wallets.filter(w => w.currency_type === 'fiat')
  const cryptoWallets = wallets.filter(w => w.currency_type === 'crypto')

  // Filter wallets based on search query
  const filterWallets = (walletList) => {
    if (!searchQuery.trim()) return walletList
    
    const query = searchQuery.toLowerCase()
    return walletList.filter(w => 
      w.currency_code.toLowerCase().includes(query) ||
      w.currency_name.toLowerCase().includes(query) ||
      (w.account_number && w.account_number.includes(query))
    )
  }

  const filteredFiatWallets = filterWallets(fiatWallets)
  const filteredCryptoWallets = filterWallets(cryptoWallets)
  const hasResults = filteredFiatWallets.length > 0 || filteredCryptoWallets.length > 0

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const handleSelectWallet = (walletId) => {
    onChange(walletId)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-base text-left flex justify-between items-center hover:border-slate-400 transition-colors"
      >
        <div className="flex-1">
          {selectedWalletData ? (
            <div>
              <div className="text-slate-900 font-medium">
                {selectedWalletData.currency_name} • Balance: {formatNumber(selectedWalletData.balance)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <span className="text-blue-600">Wallet ID:</span>{' '}
                <span className="font-mono">{selectedWalletData.id}</span>
                {selectedWalletData.account_number && (
                  <>
                    {' '} • <span className="text-blue-600">Account:</span>{' '}
                    <span className="font-mono">{selectedWalletData.account_number}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <span className="text-slate-500">Select a wallet</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-xl">
          {/* Search Input */}
          <div className="sticky top-0 z-10 p-4 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by currency, name, or account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {searchQuery && (
              <p className="text-xs text-slate-500 mt-2">
                Found {filteredFiatWallets.length + filteredCryptoWallets.length} wallet(s)
              </p>
            )}
          </div>

          {/* Wallet List */}
          <div className="max-h-96 overflow-y-auto">
            {!hasResults ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                {wallets.length === 0 ? (
                  <p>No wallets available</p>
                ) : (
                  <p>No wallets match "{searchQuery}"</p>
                )}
              </div>
            ) : (
              <>
                {/* Fiat Wallets Section */}
                {filteredFiatWallets.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 sticky z-20" style={{ top: '0px' }}>
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fiat Currencies</p>
                    </div>
                    {filteredFiatWallets.map(w => (
                      <button
                        key={w.id}
                        onClick={() => handleSelectWallet(w.id)}
                        className={`w-full px-4 py-4 text-left border-b border-slate-100 hover:bg-blue-50 transition-colors ${
                          selectedWallet === w.id ? 'bg-blue-100 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-slate-900 font-semibold text-sm">
                              {w.currency_name}
                              <span className="text-xs text-slate-500 font-normal ml-2">({w.currency_code})</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-2">
                              Balance: <span className="font-semibold text-slate-900">{formatNumber(w.balance)}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              <span className="text-blue-600">ID:</span> <span className="font-mono">{w.id.substring(0, 12)}...</span>
                              {w.account_number && (
                                <>
                                  {' '} • <span className="text-blue-600">Account:</span> {w.account_number}
                                </>
                              )}
                            </div>
                          </div>
                          {selectedWallet === w.id && (
                            <div className="text-blue-600 text-lg font-bold ml-2">✓</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Crypto Wallets Section */}
                {filteredCryptoWallets.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cryptocurrencies</p>
                    </div>
                    {filteredCryptoWallets.map(w => (
                      <button
                        key={w.id}
                        onClick={() => handleSelectWallet(w.id)}
                        className={`w-full px-4 py-4 text-left border-b border-slate-100 hover:bg-purple-50 transition-colors ${
                          selectedWallet === w.id ? 'bg-purple-100 border-purple-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-slate-900 font-semibold text-sm">
                              {w.currency_name}
                              <span className="text-xs text-slate-500 font-normal ml-2">({w.currency_code})</span>
                            </div>
                            <div className="text-xs text-slate-600 mt-2">
                              Balance: <span className="font-semibold text-slate-900">{formatNumber(w.balance)}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              <span className="text-purple-600">ID:</span> <span className="font-mono">{w.id.substring(0, 12)}...</span>
                            </div>
                          </div>
                          {selectedWallet === w.id && (
                            <div className="text-purple-600 text-lg font-bold ml-2">✓</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedWalletDropdown
