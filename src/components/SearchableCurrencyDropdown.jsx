import React, { useState, useEffect, useRef } from 'react'

/**
 * Searchable Currency Dropdown with:
 * - Real-time search with auto-filter
 * - Fiat and Cryptocurrency separation
 * - Tab selection (All, Fiat, Crypto)
 */
function SearchableCurrencyDropdown({ 
  currencies, 
  selectedCurrency, 
  onChange,
  defaultTab = 'all'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState(defaultTab) // 'all', 'fiat', 'crypto'
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const selectedCurrencyData = currencies.find(c => c.code === selectedCurrency)

  // Separate currencies by type and sort alphabetically by name
  const fiatCurrencies = currencies
    .filter(c => c.type === 'fiat')
    .sort((a, b) => a.code.localeCompare(b.code))
  const cryptoCurrencies = currencies
    .filter(c => c.type === 'crypto')
    .sort((a, b) => a.code.localeCompare(b.code))

  // Filter currencies based on search query
  const filterCurrencies = (currencyList) => {
    if (!searchQuery.trim()) return currencyList
    
    const query = searchQuery.toLowerCase()
    return currencyList.filter(c => 
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query)
    )
  }

  // Get currencies to display based on active tab
  const getDisplayedCurrencies = () => {
    let list = []
    if (activeTab === 'all' || activeTab === 'fiat') {
      list = list.concat(filterCurrencies(fiatCurrencies))
    }
    if (activeTab === 'all' || activeTab === 'crypto') {
      list = list.concat(filterCurrencies(cryptoCurrencies))
    }
    return list
  }

  const displayedCurrencies = getDisplayedCurrencies()

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

  const handleSelectCurrency = (currencyCode) => {
    onChange(currencyCode)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-base text-left flex justify-between items-center hover:border-slate-400 transition-colors"
      >
        <div>
          {selectedCurrencyData ? (
            <div className="text-slate-900 font-medium">
              {selectedCurrencyData.name} ({selectedCurrencyData.code})
            </div>
          ) : (
            <span className="text-slate-500">Select a currency</span>
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
          {/* Tab Selection */}
          <div className="sticky top-0 z-10 p-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => {
                  setActiveTab('all')
                  setSearchQuery('')
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setActiveTab('fiat')
                  setSearchQuery('')
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'fiat'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Fiat
              </button>
              <button
                onClick={() => {
                  setActiveTab('crypto')
                  setSearchQuery('')
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'crypto'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Crypto
              </button>
            </div>

            {/* Search Input */}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search currency name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {searchQuery && (
              <p className="text-xs text-slate-500 mt-2">
                Found {displayedCurrencies.length} currency(ies)
              </p>
            )}
          </div>

          {/* Currency List */}
          <div className="max-h-96 overflow-y-auto">
            {displayedCurrencies.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                {currencies.length === 0 ? (
                  <p>No currencies available</p>
                ) : (
                  <p>No currencies match "{searchQuery}"</p>
                )}
              </div>
            ) : (
              <>
                {/* Fiat Currencies Section */}
                {(activeTab === 'all' || activeTab === 'fiat') && filterCurrencies(fiatCurrencies).length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 sticky top-24 z-20">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fiat Currencies</p>
                      </div>
                    )}
                    {filterCurrencies(fiatCurrencies).map(c => (
                      <button
                        key={c.code}
                        onClick={() => handleSelectCurrency(c.code)}
                        className={`w-full px-4 py-3 text-left border-b border-slate-100 hover:bg-blue-50 transition-colors ${
                          selectedCurrency === c.code ? 'bg-blue-100 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-slate-900 font-semibold text-sm">
                              {c.name}
                              <span className="text-xs text-slate-500 font-normal ml-2">({c.code})</span>
                            </div>
                          </div>
                          {selectedCurrency === c.code && (
                            <div className="text-blue-600 text-lg font-bold ml-2">✓</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Crypto Currencies Section */}
                {(activeTab === 'all' || activeTab === 'crypto') && filterCurrencies(cryptoCurrencies).length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 sticky top-24 z-20">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cryptocurrencies</p>
                      </div>
                    )}
                    {filterCurrencies(cryptoCurrencies).map(c => (
                      <button
                        key={c.code}
                        onClick={() => handleSelectCurrency(c.code)}
                        className={`w-full px-4 py-3 text-left border-b border-slate-100 hover:bg-orange-50 transition-colors ${
                          selectedCurrency === c.code ? 'bg-orange-100 border-orange-200' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-slate-900 font-semibold text-sm">
                              {c.name}
                              <span className="text-xs text-slate-500 font-normal ml-2">({c.code})</span>
                            </div>
                          </div>
                          {selectedCurrency === c.code && (
                            <div className="text-orange-600 text-lg font-bold ml-2">✓</div>
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

export default SearchableCurrencyDropdown
