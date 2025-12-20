import { useState, useCallback, useRef } from 'react'

/**
 * Custom hook for managing searchable select state with autofill and auto-propagation
 * Features:
 * - Autofill suggestions
 * - Auto-propagation of related fields
 * - Debounced search
 * - Value history tracking
 * - Change callbacks
 */
export function useSearchableSelect(initialValue = null, options = []) {
  const [value, setValue] = useState(initialValue)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [relatedValues, setRelatedValues] = useState({})
  const debounceRef = useRef(null)

  // Handle value change
  const handleChange = useCallback((newValue, metadata = {}) => {
    setValue(newValue)
    setSearchTerm('')
    setIsOpen(false)

    // Track history
    setHistory(prev => [...prev.slice(-9), { value: newValue, timestamp: Date.now(), ...metadata }])
  }, [])

  // Handle autofill (selecting first matching option)
  const handleAutofill = useCallback((option, searchQuery) => {
    const selectedValue = typeof option === 'string' ? option : (option.value || option.id)
    handleChange(selectedValue, { autofilled: true, searchQuery })
  }, [handleChange])

  // Handle character input detection
  const handleCharacterInput = useCallback((inputData) => {
    setSearchTerm(inputData.value)

    // Trigger autofill if only one match and threshold met
    if (inputData.value.length >= 2) {
      const matches = filterOptions(options, inputData.value)
      if (matches.length === 1) {
        // Auto-fill after user stops typing
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          handleAutofill(matches[0], inputData.value)
        }, 500)
      }
    }
  }, [options, handleAutofill])

  // Auto-propagate related field values
  const propagateToRelated = useCallback((fieldName, selectedOption) => {
    if (!selectedOption || typeof selectedOption === 'string') return

    // Extract related data from the option
    const propagatedValues = {}
    
    // Common field mappings
    const mappings = {
      currency: ['currencyCode', 'currency_code', 'code'],
      country: ['countryCode', 'country_code'],
      network: ['blockchain', 'chain', 'network'],
      amount: ['minimumAmount', 'maximum', 'value'],
      category: ['type', 'category_type'],
      status: ['statusCode', 'state']
    }

    // Look for mapped fields
    if (mappings[fieldName]) {
      for (const key of mappings[fieldName]) {
        if (selectedOption[key]) {
          propagatedValues[key] = selectedOption[key]
        }
      }
    }

    // Also include any fields prefixed with undersmeta
    Object.keys(selectedOption).forEach(key => {
      if (key.startsWith('_meta')) {
        propagatedValues[key] = selectedOption[key]
      }
    })

    setRelatedValues(prev => ({ ...prev, ...propagatedValues }))
    return propagatedValues
  }, [])

  // Filter options based on search term
  const filterOptions = (optionsList, term) => {
    if (!term) return optionsList
    const lowerTerm = term.toLowerCase()
    return optionsList.filter(opt => {
      if (typeof opt === 'string') return opt.toLowerCase().includes(lowerTerm)
      const searchFields = [opt.label, opt.name, opt.value, opt.title, opt.code]
      return searchFields.some(f => f && String(f).toLowerCase().includes(lowerTerm))
    })
  }

  // Get history
  const getHistory = useCallback(() => history, [history])

  // Clear everything
  const reset = useCallback(() => {
    setValue(initialValue)
    setSearchTerm('')
    setIsOpen(false)
    setHistory([])
    setRelatedValues({})
  }, [initialValue])

  // Get current state
  const getState = useCallback(() => ({
    value,
    searchTerm,
    isOpen,
    relatedValues,
    history,
    selectedOption: options.find(opt => {
      if (typeof opt === 'string') return opt === value
      return opt.value === value || opt.id === value
    })
  }), [value, searchTerm, isOpen, relatedValues, history, options])

  return {
    // State
    value,
    searchTerm,
    isOpen,
    relatedValues,
    history,

    // Handlers
    handleChange,
    handleAutofill,
    handleCharacterInput,
    propagateToRelated,
    setIsOpen,
    setSearchTerm,
    reset,

    // Utilities
    getState,
    getHistory,
    filterOptions
  }
}

/**
 * Hook for managing multiple dependent select dropdowns with auto-propagation
 * When one dropdown changes, automatically update related dropdowns
 */
export function useDependentSelects(initialValues = {}) {
  const [selects, setSelects] = useState(initialValues)
  const dependencies = useRef({}) // Maps field -> [dependent fields]

  // Register dependency relationship
  const registerDependency = useCallback((sourceField, dependentField, transformFn) => {
    if (!dependencies.current[sourceField]) {
      dependencies.current[sourceField] = []
    }
    dependencies.current[sourceField].push({ field: dependentField, transform: transformFn })
  }, [])

  // Handle value change with auto-propagation
  const handleSelectChange = useCallback((fieldName, newValue, selectedOption) => {
    // Update the field
    const newState = { ...selects, [fieldName]: newValue }

    // Find and apply all dependent updates
    if (dependencies.current[fieldName]) {
      for (const dep of dependencies.current[fieldName]) {
        if (dep.transform) {
          newState[dep.field] = dep.transform(selectedOption, newValue)
        } else {
          newState[dep.field] = null // Clear dependent field
        }
      }
    }

    setSelects(newState)
  }, [selects])

  // Reset all selects
  const resetAll = useCallback(() => {
    setSelects(initialValues)
  }, [initialValues])

  return {
    selects,
    handleSelectChange,
    registerDependency,
    setValue: (field, value) => setSelects(prev => ({ ...prev, [field]: value })),
    getValue: (field) => selects[field],
    getAll: () => ({ ...selects }),
    resetAll
  }
}

/**
 * Hook for search term debouncing and optimization
 * Prevents excessive filtering/API calls while typing
 */
export function useSearchDebounce(initialTerm = '', delayMs = 300) {
  const [searchTerm, setSearchTerm] = useState(initialTerm)
  const [debouncedTerm, setDebouncedTerm] = useState(initialTerm)
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef(null)

  const updateSearchTerm = useCallback((term) => {
    setSearchTerm(term)
    setIsSearching(true)

    // Clear existing debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(term)
      setIsSearching(false)
    }, delayMs)
  }, [delayMs])

  const clearSearch = useCallback(() => {
    setSearchTerm('')
    setDebouncedTerm('')
    setIsSearching(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return {
    searchTerm,
    debouncedTerm,
    isSearching,
    updateSearchTerm,
    clearSearch
  }
}
