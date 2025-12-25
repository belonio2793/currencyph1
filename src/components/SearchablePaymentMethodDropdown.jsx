import React, { useState, useEffect, useRef } from 'react'

/**
 * Searchable Payment Method Dropdown with:
 * - Real-time search with auto-filter
 * - Fiat and Cryptocurrency separation
 * - Tab selection (All, Fiat, Crypto)
 */
function SearchablePaymentMethodDropdown({ 
  methods, 
  selectedMethod,
  selectedAddressMethod,
  onSelectMethod,
  onSelectCryptoMethod
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'fiat', 'crypto'
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

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

  // Get display label for selected method
  const getSelectedLabel = () => {
    if (selectedAddressMethod) {
      return `${selectedAddressMethod.name}${selectedAddressMethod.network ? ` (${selectedAddressMethod.network})` : ''}`
    }
    const method = methods.find(m => m.id === selectedMethod)
    return method ? method.name : 'Select a payment method'
  }

  const handleSelectMethod = (method) => {
    if (method.type === 'crypto') {
      onSelectCryptoMethod(method)
    } else {
      onSelectMethod(method)
    }
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
          <span className="text-slate-900 font-medium">
            {getSelectedLabel()}
          </span>
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
              placeholder="Search payment method or network..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {searchQuery && (
              <p className="text-xs text-slate-500 mt-2">
                Found {displayedMethods.length} method(s)
              </p>
            )}
          </div>

          {/* Method List */}
          <div className="max-h-96 overflow-y-auto">
            {displayedMethods.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                {methods.length === 0 ? (
                  <p>No payment methods available</p>
                ) : (
                  <p>No methods match "{searchQuery}"</p>
                )}
              </div>
            ) : (
              <>
                {/* Fiat Methods Section */}
                {(activeTab === 'all' || activeTab === 'fiat') && filterMethods(fiatMethods).length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 z-20">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fiat Payment Methods</p>
                    </div>
                    <div>
                      {filterMethods(fiatMethods).map(method => (
                        <button
                          key={method.id}
                          onClick={() => handleSelectMethod(method)}
                          className={`w-full px-4 py-3 text-left border-b border-slate-100 hover:bg-blue-50 transition-colors ${
                            selectedMethod === method.id ? 'bg-blue-100 border-blue-200' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-slate-900 font-semibold text-sm">
                                {method.name}
                              </div>
                              <div className="text-xs text-slate-600 mt-1">{method.description}</div>
                            </div>
                            {selectedMethod === method.id && (
                              <div className="text-blue-600 text-lg font-bold ml-2">✓</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Crypto Methods Section */}
                {(activeTab === 'all' || activeTab === 'crypto') && filterMethods(cryptoMethods).length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 z-20">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cryptocurrency Networks</p>
                    </div>
                    <div>
                      {filterMethods(cryptoMethods).map(method => (
                        <button
                          key={method.id}
                          onClick={() => handleSelectMethod(method)}
                          className={`w-full px-4 py-3 text-left border-b border-slate-100 hover:bg-orange-50 transition-colors ${
                            selectedAddressMethod?.id === method.id ? 'bg-orange-100 border-orange-200' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-slate-900 font-semibold text-sm">
                                {method.name}
                                {method.network && (
                                  <span className="text-xs text-orange-600 font-medium ml-2">🔗 {method.network}</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 mt-1">{method.description}</div>
                            </div>
                            {selectedAddressMethod?.id === method.id && (
                              <div className="text-orange-600 text-lg font-bold ml-2">✓</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchablePaymentMethodDropdown
