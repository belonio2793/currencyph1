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

  // Filter options based on search term with priority for code matches
  const filterOptions = (list) => {
    if (!searchTerm) return list

    const search = searchTerm.toLowerCase()

    // First, prioritize exact code prefix matches, then name matches
    const codeMatches = list.filter(opt =>
      opt.code.toLowerCase().startsWith(search)
    )

    const nameMatches = list.filter(opt =>
      !opt.code.toLowerCase().startsWith(search) &&
      (opt.code.toLowerCase().includes(search) ||
       opt.metadata?.name?.toLowerCase().includes(search))
    )

    return [...codeMatches, ...nameMatches]
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
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
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
        // Support typing to jump to items (autopropagation)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const char = e.key.toLowerCase()
          const matchingIndex = flatOptions.findIndex(opt =>
            opt.code.toLowerCase().startsWith(searchTerm.toLowerCase() + char)
          )
          if (matchingIndex !== -1) {
            setHighlightedIndex(matchingIndex)
          }
        }
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

  // Reset highlighted index and auto-highlight first result when search changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm, isOpen])

  const getCurrencyTypeLabel = (type) => {
    return type === 'cryptocurrency' ? 'Cryptocurrency' : 'Fiat Currency'
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
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-left bg-white hover:border-slate-400 transition flex items-center justify-between"
        type="button"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedOption && (
            <>
              <div
                className={`w-8 h-8 flex items-center justify-center font-bold text-white text-sm border border-slate-300 ${
                  selectedOption.metadata?.type === 'cryptocurrency'
                    ? 'bg-orange-500'
                    : 'bg-blue-500'
                }`}
                title={getCurrencyTypeLabel(selectedOption.metadata?.type)}
              >
                {selectedOption.metadata?.type === 'cryptocurrency' ? 'C' : 'F'}
              </div>
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
          className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
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
          <div className="p-3 border-b border-slate-200 sticky top-0 bg-white rounded-t-lg">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search currencies... (type to filter)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="off"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <p className="text-xs text-slate-500 mt-2">
                Found {flatOptions.length} match{flatOptions.length !== 1 ? 'es' : ''}
              </p>
            )}
          </div>

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="max-h-72 overflow-y-auto"
            onKeyDown={handleKeyDown}
          >
            {flatOptions.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-500 text-sm font-medium">No currencies found</p>
                <p className="text-slate-400 text-xs mt-1">Try different search terms</p>
              </div>
            ) : (
              <>
                {/* FIAT Section */}
                {filteredFiat.length > 0 && (
                  <>
                    <div className="sticky top-12 z-10 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 bg-slate-100">
                      <div className="w-6 h-6 flex items-center justify-center font-bold text-white text-xs bg-blue-500 border border-blue-600">
                        F
                      </div>
                      <span className="text-slate-700">Fiat Currencies</span>
                      <div className="flex-1 h-px bg-slate-300 ml-auto"></div>
                    </div>
                    {filteredFiat.map((option) => (
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
                        className={`w-full text-left px-4 py-3 transition border-l-4 ${
                          flatOptions[highlightedIndex]?.code === option.code
                            ? 'bg-slate-200 border-l-slate-600'
                            : value === option.code
                            ? 'bg-slate-100 border-l-slate-500'
                            : 'border-l-transparent hover:bg-slate-50'
                        }`}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-6 h-6 flex items-center justify-center font-bold text-white text-xs bg-blue-500 border border-blue-600 flex-shrink-0">
                              F
                            </div>
                            <span className="font-semibold text-slate-900">{option.code}</span>
                            <span className="text-slate-600 text-sm truncate">
                              {option.metadata?.name}
                            </span>
                          </div>
                          {value === option.code && (
                            <svg className="w-5 h-5 text-slate-900 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Divider */}
                {filteredFiat.length > 0 && filteredCrypto.length > 0 && (
                  <div className="h-px bg-slate-200 my-2"></div>
                )}

                {/* CRYPTO Section */}
                {filteredCrypto.length > 0 && (
                  <>
                    <div className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 bg-slate-100">
                      <div className="w-6 h-6 flex items-center justify-center font-bold text-white text-xs bg-orange-500 border border-orange-600">
                        C
                      </div>
                      <span className="text-slate-700">Crypto Currencies</span>
                      <div className="flex-1 h-px bg-slate-300 ml-auto"></div>
                    </div>
                    {filteredCrypto.map((option) => (
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
                        className={`w-full text-left px-4 py-3 transition border-l-4 ${
                          flatOptions[highlightedIndex]?.code === option.code
                            ? 'bg-slate-200 border-l-slate-600'
                            : value === option.code
                            ? 'bg-slate-100 border-l-slate-500'
                            : 'border-l-transparent hover:bg-slate-50'
                        }`}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-6 h-6 flex items-center justify-center font-bold text-white text-xs bg-orange-500 border border-orange-600 flex-shrink-0">
                              C
                            </div>
                            <span className="font-semibold text-slate-900">{option.code}</span>
                            <span className="text-slate-600 text-sm truncate">
                              {option.metadata?.name}
                            </span>
                          </div>
                          {value === option.code && (
                            <svg className="w-5 h-5 text-slate-900 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
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
