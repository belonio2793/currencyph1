import { useState, useEffect, useRef } from 'react'

export default function SearchableSelect({ value, onChange, options = [], label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)
  const optionsListRef = useRef(null)

  // Separate FIAT and CRYPTO currencies
  const fiatCurrencies = options.filter(opt => opt.metadata?.type === 'currency')
  const cryptoCurrencies = options.filter(opt => opt.metadata?.type === 'cryptocurrency')

  // Filter options based on search term
  const filterOptions = (list) => {
    if (!searchTerm) return list

    const search = searchTerm.toLowerCase()
    return list.filter(opt =>
      opt.code.toLowerCase().includes(search) ||
      opt.metadata?.name?.toLowerCase().includes(search)
    )
  }

  const filteredFiat = filterOptions(fiatCurrencies)
  const filteredCrypto = filterOptions(cryptoCurrencies)

  // Flatten list for navigation
  const flatOptions = [
    ...filteredFiat,
    ...filteredCrypto
  ]

  const selectedOption = options.find(opt => opt.code === value)

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

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < flatOptions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : flatOptions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (flatOptions[highlightedIndex]) {
          onChange(flatOptions[highlightedIndex].code)
          setIsOpen(false)
          setSearchTerm('')
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
        break
      default:
        break
    }
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && optionsListRef.current) {
      const highlightedElement = optionsListRef.current.querySelector('[data-highlighted="true"]')
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm])

  const getCurrencyTypeColor = (type) => {
    return type === 'cryptocurrency'
      ? 'bg-orange-50 text-orange-700'
      : 'bg-blue-50 text-blue-700'
  }

  const getCurrencyTypeLabel = (type) => {
    return type === 'cryptocurrency' ? '₿' : '💵'
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
        </label>
      )}

      {/* Button / Input Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left bg-white hover:border-slate-400 transition flex items-center justify-between"
        type="button"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedOption && (
            <>
              <span className="text-lg">
                {getCurrencyTypeLabel(selectedOption.metadata?.type)}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">
                  {selectedOption.code}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {selectedOption.metadata?.name}
                </div>
              </div>
            </>
          )}
        </div>
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-xl z-50">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-200 sticky top-0 bg-white">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoComplete="off"
            />
          </div>

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="max-h-64 overflow-y-auto"
            onKeyDown={handleKeyDown}
          >
            {flatOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                No currencies found matching "{searchTerm}"
              </div>
            ) : (
              <>
                {/* FIAT Section */}
                {filteredFiat.length > 0 && (
                  <>
                    <div className="px-4 py-2 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-blue-600">💵</span>
                      FIAT Currencies
                      <div className="flex-1 h-px bg-slate-200 ml-2"></div>
                    </div>
                    {filteredFiat.map((option, index) => (
                      <button
                        key={option.code}
                        onClick={() => {
                          onChange(option.code)
                          setIsOpen(false)
                          setSearchTerm('')
                        }}
                        data-highlighted={flatOptions[highlightedIndex]?.code === option.code}
                        onMouseEnter={() => {
                          const idx = flatOptions.findIndex(o => o.code === option.code)
                          setHighlightedIndex(idx)
                        }}
                        className={`w-full text-left px-4 py-3 transition ${
                          flatOptions[highlightedIndex]?.code === option.code
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        } ${value === option.code ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''}`}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-semibold text-slate-900">{option.code}</span>
                            <span className="text-slate-600 text-sm truncate">
                              {option.metadata?.name}
                            </span>
                          </div>
                          {value === option.code && (
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* CRYPTO Section */}
                {filteredCrypto.length > 0 && (
                  <>
                    {filteredFiat.length > 0 && (
                      <div className="h-px bg-slate-200 my-1"></div>
                    )}
                    <div className="px-4 py-2 mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-orange-600">₿</span>
                      Cryptocurrencies
                      <div className="flex-1 h-px bg-slate-200 ml-2"></div>
                    </div>
                    {filteredCrypto.map((option, index) => (
                      <button
                        key={option.code}
                        onClick={() => {
                          onChange(option.code)
                          setIsOpen(false)
                          setSearchTerm('')
                        }}
                        data-highlighted={flatOptions[highlightedIndex]?.code === option.code}
                        onMouseEnter={() => {
                          const idx = flatOptions.findIndex(o => o.code === option.code)
                          setHighlightedIndex(idx)
                        }}
                        className={`w-full text-left px-4 py-3 transition ${
                          flatOptions[highlightedIndex]?.code === option.code
                            ? 'bg-orange-50'
                            : 'hover:bg-slate-50'
                        } ${value === option.code ? 'bg-orange-100 border-l-4 border-l-orange-600' : ''}`}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-semibold text-slate-900">{option.code}</span>
                            <span className="text-slate-600 text-sm truncate">
                              {option.metadata?.name}
                            </span>
                          </div>
                          {value === option.code && (
                            <svg className="w-5 h-5 text-orange-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
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
