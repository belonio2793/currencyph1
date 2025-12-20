import React, { useCallback } from 'react'
import SearchableSelect from './SearchableSelect'

/**
 * Searchable Wallet Dropdown Component
 * Extends SearchableSelect for wallet selection with special formatting
 * Features: Search by wallet name, currency, balance, or ID
 */
export default function SearchableWalletDropdown({
  wallets,
  selectedWallet,
  onChange,
  onAutofill = null,
  disabled = false,
  label = 'Select Wallet',
  showBalances = true,
  showIds = false,
  placeholder = 'Search wallet by name, currency, or balance...',
  onSelectChange = null // Callback with full wallet object
}) {
  // Format options for SearchableSelect
  const options = wallets.map(wallet => ({
    id: wallet.id,
    value: wallet.id,
    label: `${wallet.currency_name || wallet.currency_code || 'Unknown'} Wallet`,
    name: wallet.currency_name || wallet.currency_code,
    secondary: showBalances ? `Balance: ${wallet.balance.toFixed(2)}` : undefined,
    currency_name: wallet.currency_name,
    currency_code: wallet.currency_code,
    balance: wallet.balance,
    account_number: wallet.account_number,
    _fullWallet: wallet // Store full wallet data
  }))

  // Handle selection with full wallet data
  const handleSelect = useCallback((option, selectedValue) => {
    onChange(selectedValue)

    // Also provide full wallet object to callback
    if (onSelectChange) {
      onSelectChange(option._fullWallet, option)
    }

    // Trigger autofill callback if provided
    if (onAutofill) {
      onAutofill(option, option.label)
    }
  }, [onChange, onSelectChange, onAutofill])

  // Custom render for wallet options with visual enhancement
  const renderWalletOption = (option, index, handleOptionSelect) => {
    return (
      <div
        key={`wallet-${option.value}-${index}`}
        onClick={() => handleOptionSelect(option)}
        className="px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                {option.currency_code?.charAt(0) || 'W'}
              </div>
              <div>
                <div className="font-medium text-slate-900">{option.name}</div>
                {option.secondary && (
                  <div className="text-xs text-slate-500 mt-0.5">{option.secondary}</div>
                )}
              </div>
            </div>
          </div>

          {showIds && option.id && (
            <div className="text-xs text-slate-400 font-mono ml-2 group-hover:text-slate-600 transition-colors">
              {option.id.substring(0, 8)}...
            </div>
          )}

          {option._fullWallet?.account_number && (
            <div className="text-xs text-slate-400 ml-2">
              •
            </div>
          )}
        </div>

        {/* Account number if available */}
        {option._fullWallet?.account_number && (
          <div className="text-xs text-slate-400 mt-2 font-mono">
            Account: {option._fullWallet.account_number}
          </div>
        )}
      </div>
    )
  }

  // Get selected wallet data
  const selectedWalletData = wallets.find(w => w.id === selectedWallet)

  return (
    <SearchableSelect
      value={selectedWallet}
      onChange={onChange}
      options={options}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      searchKeys={['currency_name', 'currency_code', 'label', 'name']}
      onSelect={handleSelect}
      onAutofill={onAutofill}
      maxResults={10}
      showIds={showIds}
      clearable={true}
      displayFormat={(option) => {
        if (!option._fullWallet) return option.label
        return `${option.name} (${option.secondary})`
      }}
      renderOption={renderWalletOption}
      emptyMessage={wallets.length === 0 ? 'No wallets available' : 'No matching wallets found'}
    />
  )
}
