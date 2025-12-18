import { useState, useEffect, Suspense, lazy } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatNumber } from '../lib/currency'

const WalletDetailPanel = lazy(() => import('./Wallets/WalletDetailPanel'))

export default function Wallet({ userId, globalCurrency = 'PHP' }) {
  const [allCurrencies, setAllCurrencies] = useState([])
  const [userWallets, setUserWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creatingWallet, setCreatingWallet] = useState(null)
  const [selectedWalletDetail, setSelectedWalletDetail] = useState(null)

  // Filter options
  const [showFiatOnly, setShowFiatOnly] = useState(false)
  const [showCryptoOnly, setShowCryptoOnly] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      // Check if user is authenticated
      if (!userId || userId === 'null' || userId === 'undefined' || userId.includes('guest-local')) {
        setAllCurrencies([])
        setUserWallets([])
        setLoading(false)
        return
      }

      // Fetch all active currencies
      const { data: currencies, error: currError } = await supabase
        .from('currencies')
        .select('*')
        .eq('active', true)
        .order('type')
        .order('code')

      if (currError) {
        console.error('Error fetching currencies:', currError)
        setError('Failed to load currencies')
        return
      }

      setAllCurrencies(currencies || [])

      // Fetch user's existing wallets
      const { data: wallets, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (walletError) {
        console.error('Error fetching wallets:', walletError)
        // Not a critical error - user just has no wallets yet
      }

      setUserWallets(wallets || [])
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load wallet data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWallet = async (currency) => {
    try {
      setCreatingWallet(currency.code)
      setError('')

      if (!userId || userId === 'null' || userId === 'undefined') {
        setError('Please log in to create a wallet')
        return
      }

      // Check if wallet already exists
      const exists = userWallets.find(w => w.currency_code === currency.code)
      if (exists) {
        setError(`You already have a ${currency.name} wallet`)
        return
      }

      // Create the wallet
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert([
          {
            user_id: userId,
            currency_code: currency.code,
            balance: 0,
            total_deposited: 0,
            total_withdrawn: 0,
            is_active: true
          }
        ])
        .select()
        .single()

      if (createError) {
        console.error('Error creating wallet:', createError)
        setError(`Failed to create ${currency.name} wallet`)
        return
      }

      setSuccess(`✓ ${currency.name} wallet created!`)
      
      // Refresh wallets list
      await loadData()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred')
    } finally {
      setCreatingWallet(null)
    }
  }

  const getFilteredCurrencies = () => {
    let filtered = allCurrencies

    // Filter by type
    if (showFiatOnly) {
      filtered = filtered.filter(c => c.type === 'fiat')
    } else if (showCryptoOnly) {
      filtered = filtered.filter(c => c.type === 'crypto')
    }

    // Filter by search
    if (searchInput) {
      const query = searchInput.toLowerCase()
      filtered = filtered.filter(c =>
        c.code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center text-slate-500">Loading currencies...</div>
      </div>
    )
  }

  const filteredCurrencies = getFilteredCurrencies()
  const fiatCurrencies = filteredCurrencies.filter(c => c.type === 'fiat')
  const cryptoCurrencies = filteredCurrencies.filter(c => c.type === 'crypto')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="w-full px-4 sm:px-6 py-6 flex-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight mb-4">
            My Wallets
          </h1>
          <p className="text-slate-600">
            Create wallets for the currencies you want to use. Each wallet will be linked to your account.
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Controls */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search */}
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search currencies..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowFiatOnly(!showFiatOnly)
                setShowCryptoOnly(false)
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                showFiatOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Fiat
            </button>
            <button
              onClick={() => {
                setShowCryptoOnly(!showCryptoOnly)
                setShowFiatOnly(false)
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                showCryptoOnly
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Crypto
            </button>
          </div>
        </div>

        {/* Fiat Currencies Section */}
        {!showCryptoOnly && fiatCurrencies.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-light text-slate-900 tracking-tight">Fiat Currencies</h2>
              <p className="text-sm text-slate-500">{fiatCurrencies.length} available</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {fiatCurrencies.map(currency => {
                const wallet = userWallets.find(w => w.currency_code === currency.code)
                const isCreating = creatingWallet === currency.code

                return (
                  <div
                    key={currency.code}
                    className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-slate-300"
                  >
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Fiat Currency
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-light text-slate-900">{currency.code}</p>
                        <p className="text-sm text-slate-500">{currency.symbol}</p>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{currency.name}</p>
                    </div>

                    {wallet ? (
                      <>
                        <div className="mb-4 pb-4 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-3">
                            Balance
                          </p>
                          <p className="text-lg font-light text-slate-900 font-mono">
                            {formatNumber(wallet.balance || 0)}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Created {new Date(wallet.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedWalletDetail(wallet)}
                          className="w-full py-2 px-3 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors text-xs font-medium"
                        >
                          View Details
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCreateWallet(currency)}
                        disabled={isCreating}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                          isCreating
                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isCreating ? 'Creating...' : 'Create Wallet'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Crypto Currencies Section */}
        {!showFiatOnly && cryptoCurrencies.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-light text-slate-900 tracking-tight">Cryptocurrencies</h2>
              <p className="text-sm text-slate-500">{cryptoCurrencies.length} available</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cryptoCurrencies.map(currency => {
                const wallet = userWallets.find(w => w.currency_code === currency.code)
                const isCreating = creatingWallet === currency.code

                return (
                  <div
                    key={currency.code}
                    className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-all hover:border-slate-300"
                  >
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Cryptocurrency
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-light text-slate-900">{currency.code}</p>
                        <p className="text-sm text-slate-500">{currency.symbol}</p>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{currency.name}</p>
                    </div>

                    {wallet ? (
                      <>
                        <div className="mb-4 pb-4 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-3">
                            Balance
                          </p>
                          <p className="text-lg font-light text-slate-900 font-mono">
                            {formatNumber(wallet.balance || 0)}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Created {new Date(wallet.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedWalletDetail(wallet)}
                          className="w-full py-2 px-3 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors text-xs font-medium"
                        >
                          View Details
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCreateWallet(currency)}
                        disabled={isCreating}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                          isCreating
                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                      >
                        {isCreating ? 'Creating...' : 'Create Wallet'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredCurrencies.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-slate-500">No currencies found matching your filters</p>
          </div>
        )}

        {/* Wallet Detail Panel */}
        {selectedWalletDetail && (
          <Suspense
            fallback={
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="text-white text-center">Loading details...</div>
              </div>
            }
          >
            <WalletDetailPanel
              wallet={selectedWalletDetail}
              userId={userId}
              globalCurrency={globalCurrency}
              onClose={() => setSelectedWalletDetail(null)}
              ratesMap={{}}
              convertAmount={() => selectedWalletDetail.balance}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
