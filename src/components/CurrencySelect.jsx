import { useState, useEffect, useRef, useMemo } from 'react'

export default function CurrencySelect({ value, onChange, options = [], label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  // Get selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => opt.code === value || opt.value === value)
  }, [value, options])

  // Separate currencies by type
  const separatedCurrencies = useMemo(() => {
    const fiat = options.filter(opt => opt.type === 'currency')
    const crypto = options.filter(opt => opt.type === 'cryptocurrency')
    return { fiat, crypto }
  }, [options])

  // Filter currencies based on search
  const filteredCurrencies = useMemo(() => {
    const search = searchTerm.toLowerCase()
    
    const filtered = {
      fiat: separatedCurrencies.fiat.filter(opt =>
        opt.code.toLowerCase().includes(search) ||
        (opt.label && opt.label.toLowerCase().includes(search))
      ),
      crypto: separatedCurrencies.crypto.filter(opt =>
        opt.code.toLowerCase().includes(search) ||
        (opt.label && opt.label.toLowerCase().includes(search))
      )
    }

    return filtered
  }, [searchTerm, separatedCurrencies])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Handle option selection
  const handleSelectOption = (option) => {
    onChange(option.code || option.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const selectedLabel = selectedOption?.label || selectedOption?.code || value || 'Select Currency'

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
        </label>
      )}

      {/* Display (Read-Only) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg text-left bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="font-medium text-slate-900">
          {selectedLabel}
        </span>
        <svg 
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg">
          {/* Fixed Search Field */}
          <div className="sticky top-0 p-3 border-b border-slate-200 bg-white rounded-t-lg">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search currencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Currency List */}
          <div className="max-h-96 overflow-y-auto">
            {/* Fiat Currencies Section */}
            {filteredCurrencies.fiat.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-slate-100 sticky top-0 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  💵 Fiat Currencies ({filteredCurrencies.fiat.length})
                </div>
                {filteredCurrencies.fiat.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => handleSelectOption(option)}
                    className={`w-full px-4 py-3 text-left transition-colors border-b border-slate-100 hover:bg-blue-50 flex items-center justify-between group ${
                      selectedOption?.code === option.code ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{option.code}</div>
                      <div className="text-xs text-slate-500">{option.label || option.code}</div>
                    </div>
                    {selectedOption?.code === option.code && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Crypto Currencies Section */}
            {filteredCurrencies.crypto.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-orange-100 sticky top-0 text-xs font-semibold text-orange-700 uppercase tracking-wider border-b border-orange-200">
                  🪙 Cryptocurrencies ({filteredCurrencies.crypto.length})
                </div>
                {filteredCurrencies.crypto.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => handleSelectOption(option)}
                    className={`w-full px-4 py-3 text-left transition-colors border-b border-slate-100 hover:bg-orange-50 flex items-center justify-between group ${
                      selectedOption?.code === option.code ? 'bg-orange-100 border-l-4 border-l-orange-600' : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{option.code}</div>
                      <div className="text-xs text-slate-500">{option.label || option.code}</div>
                    </div>
                    {selectedOption?.code === option.code && (
                      <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredCurrencies.fiat.length === 0 && filteredCurrencies.crypto.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">
                <p className="text-sm">No currencies match "{searchTerm}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
