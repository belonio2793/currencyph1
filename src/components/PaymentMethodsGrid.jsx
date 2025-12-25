import React, { useState, useRef, useEffect } from 'react'
import { convertCurrency, formatConvertedAmount, isCryptoCurrency } from '../lib/currency'

/**
 * Payment Method Grid Display with:
 * - All methods visible by default (not dropdown)
 * - Real-time search with auto-filter
 * - Fiat and Cryptocurrency tabs
 * - Grid layout for better visibility
 * - Converted amounts for each payment method
 */
function PaymentMethodsGrid({
  methods,
  selectedMethod,
  selectedAddressMethod,
  onSelectMethod,
  onSelectCryptoMethod,
  amount = null,
  selectedCurrency = null,
  exchangeRates = {},
  walletData = null
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'fiat', 'crypto'

  // Separate methods by type and sort
  const fiatMethods = methods
    .filter(m => m.type === 'fiat')
    .sort((a, b) => a.name.localeCompare(b.name))
  const cryptoMethods = methods
    .filter(m => m.type === 'crypto')
    .sort((a, b) => a.name.localeCompare(b.name))

  // Filter methods based on search query
  const filterMethods = (methodList) => {
    if (!searchQuery.trim()) return methodList
    
    const query = searchQuery.toLowerCase()
    return methodList.filter(m => 
      m.id.toLowerCase().includes(query) ||
      m.name.toLowerCase().includes(query) ||
      m.description.toLowerCase().includes(query) ||
      (m.network && m.network.toLowerCase().includes(query))
    )
  }

  // Get methods to display based on active tab
  const getDisplayedMethods = () => {
    let list = []
    if (activeTab === 'all' || activeTab === 'fiat') {
      list = list.concat(filterMethods(fiatMethods))
    }
    if (activeTab === 'all' || activeTab === 'crypto') {
      list = list.concat(filterMethods(cryptoMethods))
    }
    return list
  }

  const displayedMethods = getDisplayedMethods()
  const filteredFiatMethods = filterMethods(fiatMethods)
  const filteredCryptoMethods = filterMethods(cryptoMethods)

  const handleSelectMethod = (method) => {
    if (method.type === 'crypto') {
      onSelectCryptoMethod(method)
    } else {
      onSelectMethod(method)
    }
  }

  return (
    <div className="w-full">
      {/* Search and Tabs Section */}
      <div className="mb-6 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search payment method, network, or crypto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {searchQuery && (
            <p className="text-xs text-slate-500 mt-2">
              Found {displayedMethods.length} method(s)
            </p>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setActiveTab('all')
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-600 text-white'
                : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Methods
          </button>
          <button
            onClick={() => {
              setActiveTab('fiat')
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'fiat'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Fiat ({fiatMethods.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('crypto')
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'crypto'
                ? 'bg-orange-600 text-white'
                : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Crypto ({cryptoMethods.length})
          </button>
        </div>
      </div>

      {/* Methods Display */}
      <div className="space-y-6">
        {displayedMethods.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {methods.length === 0 ? (
              <p>No payment methods available</p>
            ) : (
              <p>No methods match "{searchQuery}"</p>
            )}
          </div>
        ) : (
          <>
            {/* Fiat Methods Section */}
            {(activeTab === 'all' || activeTab === 'fiat') && filteredFiatMethods.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 px-2">
                  Fiat Payment Methods
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredFiatMethods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => handleSelectMethod(method)}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                        selectedMethod === method.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{method.icon}</span>
                            <div className="text-slate-900 font-semibold text-sm">
                              {method.name}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-2">{method.description}</p>
                        </div>
                        {selectedMethod === method.id && (
                          <div className="text-blue-600 text-xl font-bold ml-2">✓</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Crypto Methods Section */}
            {(activeTab === 'all' || activeTab === 'crypto') && filteredCryptoMethods.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 px-2">
                  Cryptocurrency Networks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCryptoMethods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => handleSelectMethod(method)}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                        selectedAddressMethod?.id === method.id
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{method.icon}</span>
                            <div>
                              <div className="text-slate-900 font-semibold text-sm">
                                {method.name}
                              </div>
                              {method.network && (
                                <div className="text-xs text-orange-600 font-medium mt-1">
                                  🔗 {method.network}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-2">{method.description}</p>
                        </div>
                        {selectedAddressMethod?.id === method.id && (
                          <div className="text-orange-600 text-xl font-bold ml-2">✓</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PaymentMethodsGrid
