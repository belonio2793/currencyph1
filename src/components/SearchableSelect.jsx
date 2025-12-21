import React, { useState, useEffect, useRef, useMemo } from 'react'

/**
 * Advanced Searchable Select Component
 * Features:
 * - Real-time search/filtering
 * - Autofill suggestions
 * - Character input detection
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Auto-propagation of related fields
 * - Performance optimized with memoization
 * - Customizable display and value formats
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Search or select...',
  label,
  disabled = false,
  required = false,
  className = '',
  searchKeys = [], // Keys to search in (for object options)
  displayFormat = null, // Function to format display text
  autofillThreshold = 1, // Minimum characters before showing suggestions
  maxResults = 10,
  onAutofill = null, // Callback when autofill is triggered
  onSelect = null, // Callback when item is selected
  onChangeText = null, // Callback on input change (character detection)
  clearable = true,
  showIds = false, // Show ID/secondary info
  groupBy = null, // Function to group options
  emptyMessage = 'No options found',
  renderOption = null, // Custom render function for options
  filterFunction = null, // Custom filter function
  allowCustomInput = false, // Allow typing values not in list
  highlightMatches = true, // Highlight search matches
  debounceMs = 200 // Debounce search input
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [inputValue, setInputValue] = useState('')
  const [lastInputTime, setLastInputTime] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // Find selected option
  const selectedOption = useMemo(() => {
    return options.find(opt => {
      if (typeof opt === 'string') return opt === value
      return opt.value === value || opt.id === value
    })
  }, [value, options])

  // Format display value
  const displayValue = useMemo(() => {
    if (!selectedOption) return value || ''
    if (displayFormat) return displayFormat(selectedOption)
    if (typeof selectedOption === 'string') return selectedOption
    return selectedOption.label || selectedOption.name || selectedOption.value || ''
  }, [selectedOption, value, displayFormat])

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    let filtered = options

    if (searchTerm) {
      if (filterFunction) {
        // Use custom filter function
        filtered = filterFunction(options, searchTerm)
      } else {
        // Default filter: search across specified keys or basic string search
        const lowerTerm = searchTerm.toLowerCase()
        filtered = options.filter(opt => {
          if (typeof opt === 'string') {
            return opt.toLowerCase().includes(lowerTerm)
          }

          // Search in specified keys
          if (searchKeys.length > 0) {
            return searchKeys.some(key => {
              const value = opt[key]
              return value && String(value).toLowerCase().includes(lowerTerm)
            })
          }

          // Default: search in common fields
          const searchableFields = [
            opt.label,
            opt.name,
            opt.value,
            opt.title,
            opt.currency_name,
            opt.currency_code,
            opt.text
          ]

          return searchableFields.some(field => {
            return field && String(field).toLowerCase().includes(lowerTerm)
          })
        })
      }
    }

    // Group options if groupBy provided
    if (groupBy && searchTerm === '') {
      return filtered
    }

    return filtered.slice(0, maxResults)
  }, [options, searchTerm, searchKeys, filterFunction, maxResults, groupBy])

  // Handle input change with debounce and character detection
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSearchTerm(newValue)
    setHighlightedIndex(-1)

    // Trigger character detection callback
    if (onChangeText) {
      onChangeText({
        value: newValue,
        length: newValue.length,
        isEmpty: newValue.length === 0,
        timestamp: Date.now()
      })
    }

    // Show suggestions if threshold met
    if (newValue.length >= autofillThreshold) {
      setIsOpen(true)
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Auto-select if exact match found
    if (filteredOptions.length === 1 && newValue.length > 0) {
      debounceTimerRef.current = setTimeout(() => {
        if (onAutofill) {
          onAutofill(filteredOptions[0], newValue)
        }
      }, debounceMs)
    }
  }

  // Handle option selection
  const handleSelectOption = (option) => {
    const selectedValue = typeof option === 'string' ? option : (option.value || option.id)
    const selectedLabel = typeof option === 'string' ? option : (option.label || option.name || option.value)

    setInputValue(selectedLabel)
    onChange(selectedValue)
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)

    if (onSelect) {
      onSelect(option, selectedValue)
    }
  }

  // Handle clear
  const handleClear = (e) => {
    e.stopPropagation()
    setInputValue('')
    setSearchTerm('')
    onChange(null)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelectOption(filteredOptions[highlightedIndex])
        } else if (allowCustomInput && inputValue) {
          onChange(inputValue)
          setIsOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
      case 'Tab':
        setIsOpen(false)
        break
      default:
        break
    }
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync input value with selected option on initial load
  useEffect(() => {
    if (selectedOption && !searchTerm) {
      setInputValue(displayValue)
    }
  }, [value, selectedOption, displayValue, searchTerm])

  // Highlight matched text
  const highlightText = (text, query) => {
    if (!highlightMatches || !query) return text

    const parts = String(text).split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => (
      <span
        key={i}
        className={part.toLowerCase() === query.toLowerCase() ? 'font-semibold text-blue-600' : ''}
      >
        {part}
      </span>
    ))
  }

  // Render single option
  const renderOptionItem = (option, index) => {
    const isHighlighted = index === highlightedIndex
    let optionLabel = displayFormat ? displayFormat(option) : (
      typeof option === 'string' ? option : (option.label || option.name || option.value || '')
    )
    let optionSecondary = ''

    if (typeof option === 'object') {
      optionSecondary = option.secondary || option.code || option.currency_code || ''
    }

    return (
      <div
        key={`${typeof option === 'string' ? option : option.id || option.value}-${index}`}
        onClick={() => handleSelectOption(option)}
        className={`px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 ${
          isHighlighted ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-50'
        } ${selectedOption === option ? 'bg-blue-50' : ''}`}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium text-slate-900">
              {highlightText(optionLabel, searchTerm)}
            </div>
            {optionSecondary && (
              <div className="text-xs text-slate-500 mt-1">
                {highlightText(optionSecondary, searchTerm)}
              </div>
            )}
          </div>
          {showIds && typeof option === 'object' && (option.id || option.value) && (
            <div className="text-xs text-slate-400 font-mono ml-2">
              {option.id || option.value}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm || inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-10 sm:min-h-11 text-sm sm:text-base ${
            disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
          } ${isOpen ? 'border-blue-500' : ''}`}
        />

        {/* Clear Button */}
        {clearable && (inputValue || value) && !disabled && (
          <button
            onClick={handleClear}
            className="absolute right-9 sm:right-10 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear selection"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Dropdown Arrow */}
        <svg
          className={`absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 transition-transform pointer-events-none ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-72 sm:max-h-96 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) =>
              renderOption ? renderOption(option, index, handleSelectOption) : renderOptionItem(option, index)
            )
          ) : (
            <div className="px-4 py-8 text-center text-slate-500">
              {allowCustomInput && inputValue ? (
                <div>
                  <p className="text-sm mb-2">{emptyMessage}</p>
                  <p className="text-xs text-slate-400">Press Enter to use "{inputValue}"</p>
                </div>
              ) : (
                <p className="text-sm">{emptyMessage}</p>
              )}
            </div>
          )}

          {filteredOptions.length > maxResults && (
            <div className="px-4 py-2 text-center text-xs text-slate-500 border-t border-slate-100 bg-slate-50">
              Showing {maxResults} of {filteredOptions.length} results. Refine your search.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
