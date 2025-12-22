import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getWalletDisplayPreferences, setWalletDisplayPreferences, addWalletDisplayCurrency, removeWalletDisplayCurrency } from '../lib/walletPreferences'
import { currencyAPI } from '../lib/payments'

export default function WalletDisplayCustomizer({ userId, onClose, onUpdate }) {
  const [allFiatCurrencies, setAllFiatCurrencies] = useState([])
  const [allCryptoCurrencies, setAllCryptoCurrencies] = useState([])
  const [selectedCurrencies, setSelectedCurrencies] = useState(['PHP'])
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('currency') // 'currency' or 'cryptocurrency'

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch both fiat and crypto currencies
      const { data: currencies, error: currError } = await supabase
        .from('currencies')
        .select('code, name, symbol, type')
        .eq('active', true)
        .order('code')

      if (currError) {
        console.error('Error fetching currencies:', currError)
        return
      }

      const fiat = (currencies || []).filter(c => c.type === 'fiat')
      const crypto = (currencies || []).filter(c => c.type === 'crypto')

      setAllFiatCurrencies(fiat)
      setAllCryptoCurrencies(crypto)

      // Load user preferences
      const prefs = await getWalletDisplayPreferences(userId)
      setSelectedCurrencies(prefs)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCurrency = async (currencyCode) => {
    if (currencyCode === 'PHP') {
      return // Don't allow unchecking PHP
    }

    let updated
    if (selectedCurrencies.includes(currencyCode)) {
      updated = selectedCurrencies.filter(c => c !== currencyCode)
    } else {
      updated = [...selectedCurrencies, currencyCode]
    }

    setSelectedCurrencies(updated)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage('')

      // Save preferences
      await setWalletDisplayPreferences(userId, selectedCurrencies)

      // Create wallets for selected currencies
      try {
        const { data: existingWallets, error: fetchErr } = await supabase
          .from('wallets')
          .select('currency_code')
          .eq('user_id', userId)

        if (!fetchErr) {
          const existingCodes = (existingWallets || []).map(w => w.currency_code)
          const missingCurrencies = selectedCurrencies.filter(code => !existingCodes.includes(code))

          // Create wallets for missing currencies using currencyAPI (which generates account numbers)
          if (missingCurrencies.length > 0) {
            for (const currencyCode of missingCurrencies) {
              try {
                await currencyAPI.createWallet(userId, currencyCode)
              } catch (err) {
                // Continue with next currency if one fails
                console.warn(`Warning: Could not create wallet for ${currencyCode}:`, err)
              }
            }
          }
        }
      } catch (walletErr) {
        console.warn('Warning: Wallet creation failed (preferences still saved):', walletErr)
      }

      setMessage('✓ Preferences saved!')

      // Call callback if provided
      if (onUpdate) {
        onUpdate(selectedCurrencies)
      }

      // Clear message after 2 seconds
      setTimeout(() => {
        setMessage('')
        if (onClose) {
          onClose()
        }
      }, 2000)
    } catch (err) {
      console.error('Error saving preferences:', err)
      setMessage('✗ Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSelectedCurrencies(['PHP'])
    setSearchInput('')
    setShowDropdown(false)
  }

  const getFilteredCurrencies = () => {
    const currencies = activeTab === 'currency' ? allFiatCurrencies : allCryptoCurrencies

    if (!searchInput) {
      return currencies
    }

    const query = searchInput.toLowerCase()
    return currencies.filter(c =>
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query)
    )
  }

  const filteredCurrencies = getFilteredCurrencies()

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-8 border border-slate-200">
        <p className="text-slate-500 text-center text-lg">Loading currencies...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-8">
      <div className="mb-8">
        <h2 className="text-4xl font-light text-slate-900 mb-3">Add Currencies to Wallet</h2>
        <p className="text-base text-slate-600">
          Select which currencies to add to your account. PHP is always included.
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg text-base ${
          message.includes('✓')
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Currency Type Tabs */}
      <div className="mb-8 border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => {
              setActiveTab('currency')
              setSearchInput('')
            }}
            className={`pb-3 px-2 font-medium text-base border-b-2 transition-colors ${
              activeTab === 'currency'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Fiat Currency ({allFiatCurrencies.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('cryptocurrency')
              setSearchInput('')
            }}
            className={`pb-3 px-2 font-medium text-base border-b-2 transition-colors ${
              activeTab === 'cryptocurrency'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Cryptocurrency ({allCryptoCurrencies.length})
          </button>
        </div>
      </div>

      {/* Search and Dropdown */}
      <div className="mb-8">
        <label className="block text-lg font-medium text-slate-700 mb-3">
          {activeTab === 'currency' ? 'Search Fiat Currencies' : 'Search Cryptocurrencies'}
        </label>

        <div className="relative">
          <input
            type="text"
            placeholder={activeTab === 'currency' ? 'Search by code or name... (USD, EUR, GBP, etc.)' : 'Search by code... (BTC, ETH, SOL, etc.)'}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />

          {/* Dropdown */}
          {showDropdown && filteredCurrencies.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-3 bg-white border border-slate-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {filteredCurrencies.map(currency => (
                <div
                  key={currency.code}
                  onClick={() => handleToggleCurrency(currency.code)}
                  className={`px-5 py-4 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ${
                    selectedCurrencies.includes(currency.code)
                      ? 'bg-blue-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedCurrencies.includes(currency.code)}
                      onChange={() => {}}
                      className="w-5 h-5 text-blue-600 rounded"
                      disabled={currency.code === 'PHP'}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-base">{currency.code}</p>
                      <p className="text-sm text-slate-500">{currency.name}</p>
                    </div>
                    <p className="text-base text-slate-600">{currency.symbol}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-slate-500 mt-3">
          Type to search by currency code (USD, EUR, etc.) or currency name
        </p>
      </div>

      {/* Selected Currencies */}
      <div className="mb-8">
        <label className="block text-lg font-medium text-slate-700 mb-4">
          Selected Currencies ({selectedCurrencies.length})
        </label>

        <div className="flex flex-wrap gap-3">
          {selectedCurrencies.length === 0 ? (
            <p className="text-base text-slate-500">Select currencies to display</p>
          ) : (
            selectedCurrencies.map(code => {
              const currency = allFiatCurrencies.find(c => c.code === code)
              if (!currency) return null

              return (
                <div
                  key={code}
                  className={`px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3 ${
                    code === 'PHP'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  <span>{code}</span>
                  {code !== 'PHP' && (
                    <button
                      onClick={() => handleToggleCurrency(code)}
                      className="hover:text-red-600 font-bold text-lg"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={handleReset}
          className="px-6 py-3 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-base font-medium"
        >
          Reset to PHP Only
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors text-base font-medium"
          >
            Cancel
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-3 text-white rounded-lg transition-colors text-base font-medium ${
            saving
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
