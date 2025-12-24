import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getWalletDisplayPreferences, setWalletDisplayPreferences } from '../lib/walletPreferences'
import { currencyAPI } from '../lib/payments'
import WalletInitializationModal from './WalletInitializationModal'

export default function WalletDisplayCustomizer({ userId, onClose, onUpdate }) {
  const [allFiatCurrencies, setAllFiatCurrencies] = useState([])
  const [allCryptoCurrencies, setAllCryptoCurrencies] = useState([])
  const [userWallets, setUserWallets] = useState([])
  const [selectedCurrencies, setSelectedCurrencies] = useState(['PHP'])
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('currency') // 'currency' or 'cryptocurrency'
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [creatingWallet, setCreatingWallet] = useState(null) // Track which wallet is being created
  const [initializingCurrency, setInitializingCurrency] = useState(null) // Currency being initialized
  const [showInitializationModal, setShowInitializationModal] = useState(false) // Show initialization modal

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch all currencies
      const { data: currencies } = await supabase
        .from('currencies')
        .select('code, name, symbol, type')
        .eq('active', true)
        .order('code')

      if (currencies) {
        setAllFiatCurrencies(currencies.filter(c => c.type === 'fiat'))
        setAllCryptoCurrencies(currencies.filter(c => c.type === 'crypto'))
      }

      // Fetch user's existing wallets
      const { data: wallets } = await supabase
        .from('wallets')
        .select('currency_code')
        .eq('user_id', userId)

      if (wallets) {
        const walletCodes = wallets.map(w => w.currency_code)
        setUserWallets(walletCodes)

        // All existing wallets should be shown on dashboard by default
        setSelectedCurrencies(walletCodes)
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }


  const handleCreateWallet = async (currencyCode) => {
    try {
      setCreatingWallet(currencyCode)
      setMessage('')

      // Find the currency details
      const allCurrencies = [...allFiatCurrencies, ...allCryptoCurrencies]
      const currencyData = allCurrencies.find(c => c.code === currencyCode)

      // Set the initializing currency for the modal
      setInitializingCurrency({
        code: currencyCode,
        name: currencyData?.name || currencyCode,
        symbol: currencyData?.symbol
      })

      // Show the initialization modal
      setShowInitializationModal(true)

      // Create wallet in the background
      const newWallet = await currencyAPI.createWallet(userId, currencyCode)

      if (newWallet) {
        console.log(`✓ Wallet created for ${currencyCode}:`, newWallet)
        // The modal will handle polling and showing success
        // Just update our local state
        setUserWallets(prev => {
          if (prev.includes(currencyCode)) return prev
          return [...prev, currencyCode]
        })

        setSelectedCurrencies(prev => {
          if (prev.includes(currencyCode)) return prev
          return [...prev, currencyCode]
        })
      } else {
        throw new Error('Wallet creation returned null')
      }
    } catch (err) {
      console.error('Error creating wallet:', err)
      // The modal will show this error via its error state
      // based on timeout or polling failure
    } finally {
      setCreatingWallet(null)
    }
  }

  const handleInitializationSuccess = (walletData) => {
    // Wallet was successfully created and found in database
    console.log('Wallet initialization successful:', walletData)

    const currencyCode = initializingCurrency?.code

    // Update local state
    setUserWallets(prev => {
      if (prev.includes(currencyCode)) return prev
      return [...prev, currencyCode]
    })

    setSelectedCurrencies(prev => {
      if (prev.includes(currencyCode)) return prev
      return [...prev, currencyCode]
    })

    // Notify parent
    if (onUpdate) {
      onUpdate(selectedCurrencies)
    }

    // Show brief success message
    setMessage(`✓ ${currencyCode} wallet created successfully!`)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleInitializationCancel = () => {
    // User cancelled the initialization process
    const currencyCode = initializingCurrency?.code
    console.log(`Wallet creation cancelled for ${currencyCode}`)

    setMessage(`Wallet creation for ${currencyCode} was cancelled.`)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleInitializationModalClose = () => {
    setShowInitializationModal(false)
    setInitializingCurrency(null)

    // Refresh wallet list to ensure we have latest data
    loadData()
  }

  const handleSavePreferences = async () => {
    try {
      setSaving(true)
      setMessage('')

      // Save display preferences
      await setWalletDisplayPreferences(userId, selectedCurrencies)

      // Create wallets for any selected currencies that don't have wallets yet
      const missingCurrencies = selectedCurrencies.filter(code => !userWallets.includes(code))

      if (missingCurrencies.length > 0) {
        setMessage(`Creating ${missingCurrencies.length} wallet(s)...`)

        for (const currencyCode of missingCurrencies) {
          try {
            // Find currency details
            const allCurrencies = [...allFiatCurrencies, ...allCryptoCurrencies]
            const currencyData = allCurrencies.find(c => c.code === currencyCode)

            // Show initialization modal
            setInitializingCurrency({
              code: currencyCode,
              name: currencyData?.name || currencyCode,
              symbol: currencyData?.symbol
            })
            setShowInitializationModal(true)

            // Create wallet
            const newWallet = await currencyAPI.createWallet(userId, currencyCode)

            if (newWallet) {
              // Optimistically update the local list
              setUserWallets(prev => {
                if (prev.includes(currencyCode)) return prev
                return [...prev, currencyCode]
              })
            }
          } catch (err) {
            console.warn(`Warning: Could not create wallet for ${currencyCode}:`, err)
          }
        }

        // Hide modal after batch creation
        setShowInitializationModal(false)
        setInitializingCurrency(null)
      }

      setMessage('✓ Preferences saved! Wallets created.')

      if (onUpdate) {
        onUpdate(selectedCurrencies)
      }

      // Close after a short delay to show success message
      setTimeout(() => {
        setMessage('')
        if (onClose) {
          onClose()
        }
      }, 1500)
    } catch (err) {
      console.error('Error saving preferences:', err)
      setMessage('✗ Failed to save preferences')
      setShowInitializationModal(false)
      setInitializingCurrency(null)
    } finally {
      setSaving(false)
    }
  }

  const getFilteredCurrencies = () => {
    const currencies = activeTab === 'currency' ? allFiatCurrencies : allCryptoCurrencies

    if (!searchInput) return currencies

    const query = searchInput.toLowerCase()
    return currencies.filter(c =>
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query)
    )
  }

  const filteredCurrencies = getFilteredCurrencies()
  const hasWallet = (currencyCode) => userWallets.includes(currencyCode)
  const isDisplayed = (currencyCode) => selectedCurrencies.includes(currencyCode)

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-8 border border-slate-200">
        <p className="text-slate-500 text-center text-lg">Loading currencies...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-light text-slate-900 mb-3">Manage Your Wallets</h2>
        <p className="text-base text-slate-600">
          Create wallets for your currencies. All wallets are automatically displayed on your dashboard.
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

      {/* Tabs */}
      <div className="mb-8 border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('currency')}
            className={`pb-3 px-2 font-medium text-base border-b-2 transition-colors ${
              activeTab === 'currency'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Fiat Currencies ({allFiatCurrencies.length})
          </button>
          <button
            onClick={() => setActiveTab('cryptocurrency')}
            className={`pb-3 px-2 font-medium text-base border-b-2 transition-colors ${
              activeTab === 'cryptocurrency'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Cryptocurrencies ({allCryptoCurrencies.length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Search {activeTab === 'currency' ? 'Fiat Currencies' : 'Cryptocurrencies'}
        </label>
        <input
          type="text"
          placeholder={`Search by code or name... (${activeTab === 'currency' ? 'USD, EUR, GBP' : 'BTC, ETH, SOL'}, etc.)`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </div>

      {/* Currency List */}
      <div className="mb-8 space-y-3">
        {filteredCurrencies.length === 0 ? (
          <p className="text-slate-500 text-center py-6">No currencies found</p>
        ) : (
          filteredCurrencies.map(currency => {
            const walletExists = hasWallet(currency.code)
            const isDisplayed_ = isDisplayed(currency.code)

            return (
              <div
                key={currency.code}
                className={`px-5 py-4 rounded-lg border transition-all ${
                  walletExists
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-100 border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Currency Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{currency.code}</p>
                      <p className="text-sm text-slate-600">{currency.name}</p>
                    </div>
                    <p className="text-lg font-medium text-slate-700">{currency.symbol}</p>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center gap-3">
                    {/* Wallet Status */}
                    {walletExists ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                        ✓ Wallet Created
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                        No Wallet
                      </span>
                    )}

                    {/* Actions */}
                    {!walletExists ? (
                      <button
                        onClick={() => handleCreateWallet(currency.code)}
                        disabled={creatingWallet === currency.code}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          creatingWallet === currency.code
                            ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {creatingWallet === currency.code ? 'Creating...' : 'Create Wallet'}
                      </button>
                    ) : (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                        On Dashboard
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Summary Section */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-900 font-medium">Wallets Created</p>
            <p className="text-2xl font-light text-blue-900">{userWallets.length}</p>
          </div>
          <div>
            <p className="text-blue-900 font-medium">On Dashboard</p>
            <p className="text-2xl font-light text-blue-900">{userWallets.length}</p>
          </div>
        </div>
        <p className="text-xs text-blue-700 mt-3">All your wallets are automatically displayed on your dashboard.</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors text-base font-medium"
          >
            Cancel
          </button>
        )}

        <button
          onClick={handleSavePreferences}
          disabled={saving}
          className={`px-6 py-3 text-white rounded-lg transition-colors text-base font-medium ${
            saving
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Dashboard Preferences'}
        </button>
      </div>

      {/* Wallet Initialization Modal */}
      <WalletInitializationModal
        isOpen={showInitializationModal}
        currencyCode={initializingCurrency?.code}
        currencyName={initializingCurrency?.name}
        currencySymbol={initializingCurrency?.symbol}
        userId={userId}
        onClose={handleInitializationModalClose}
        onSuccess={handleInitializationSuccess}
        onCancel={handleInitializationCancel}
      />
    </div>
  )
}
