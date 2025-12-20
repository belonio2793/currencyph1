import React, { useCallback } from 'react'
import SearchableSelect from './SearchableSelect'

/**
 * Searchable Currency Dropdown Component
 * Extends SearchableSelect for currency selection with special formatting
 * Features: Search by currency code, name, or symbol
 */
export default function SearchableCurrencyDropdown({
  currencies = [],
  selectedCurrency,
  onChange,
  onAutofill = null,
  disabled = false,
  label = 'Select Currency',
  placeholder = 'Search currency by code or name...',
  showSymbols = true,
  showCodes = true,
  filterByType = null, // 'fiat', 'crypto', or null for all
  onSelectChange = null
}) {
  // Filter by type if specified
  let filteredCurrencies = currencies
  if (filterByType) {
    filteredCurrencies = currencies.filter(c => c.type === filterByType)
  }

  // Format options for SearchableSelect
  const options = filteredCurrencies.map(currency => ({
    id: currency.code || currency.id,
    value: currency.code || currency.value,
    label: currency.name || currency.label,
    name: currency.name,
    code: currency.code,
    symbol: currency.symbol,
    secondary: currency.symbol ? `${currency.symbol} (${currency.code})` : currency.code,
    type: currency.type,
    exchange_rate: currency.exchange_rate,
    _fullCurrency: currency
  }))

  // Handle selection
  const handleSelect = useCallback((option, selectedValue) => {
    onChange(selectedValue)

    if (onSelectChange) {
      onSelectChange(option._fullCurrency, option)
    }

    if (onAutofill) {
      onAutofill(option, option.label)
    }
  }, [onChange, onSelectChange, onAutofill])

  // Custom render for currency options
  const renderCurrencyOption = (option, index, handleOptionSelect) => {
    return (
      <div
        key={`currency-${option.value}-${index}`}
        onClick={() => handleOptionSelect(option)}
        className="px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {/* Currency symbol badge */}
              {showSymbols && option.symbol && (
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-700">
                  {option.symbol.charAt(0)}
                </div>
              )}

              <div>
                {/* Currency name */}
                <div className="font-medium text-slate-900">
                  {option.name}
                </div>

                {/* Currency code and symbol */}
                {showCodes && (
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <span className="font-mono">{option.code}</span>
                    {option.symbol && <span className="text-slate-400">•</span>}
                    {option.symbol && <span>{option.symbol}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Type badge */}
          {option.type && (
            <div className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
              option.type === 'crypto' 
                ? 'bg-orange-100 text-orange-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {option.type.charAt(0).toUpperCase() + option.type.slice(1)}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <SearchableSelect
      value={selectedCurrency}
      onChange={onChange}
      options={options}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      searchKeys={['name', 'code', 'symbol', 'label']}
      onSelect={handleSelect}
      onAutofill={onAutofill}
      maxResults={12}
      clearable={true}
      displayFormat={(option) => {
        if (!option._fullCurrency) return option.label
        return `${option.name} (${option.code})`
      }}
      renderOption={renderCurrencyOption}
      emptyMessage={filteredCurrencies.length === 0 ? 'No currencies available' : 'No matching currencies found'}
    />
  )
}
