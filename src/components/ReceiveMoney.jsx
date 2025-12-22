import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { formatNumber, getCurrencySymbol } from '../lib/currency'
import { CRYPTOCURRENCY_DEPOSITS } from '../data/cryptoDeposits'
import FiatCryptoToggle from './FiatCryptoToggle'
import receiveMoneyService from '../lib/receiveMoneyService'
import customPaymentService from '../lib/customPaymentService'
import { walletService } from '../lib/walletService'

// List of common cryptocurrencies that we accept
const CRYPTO_CURRENCY_CODES = [
  'BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'XRP', 'DOGE', 'ADA', 'LINK', 'UNI',
  'BNB', 'TRX', 'DOT', 'AVAX', 'HBAR', 'LITECOIN', 'BCH', 'XLM', 'TON', 'AAVE',
  'SHIB', 'PYUSD', 'WLD', 'XAUT', 'PEPE', 'ASTER', 'ENA', 'SKY', 'HYPE', 'Sui'
]

export default function ReceiveMoney({ userId, globalCurrency = 'PHP' }) {
  // State: Recipient selection
  const [isRequestMode, setIsRequestMode] = useState(!userId || userId.includes('guest'))
  const [guestSearch, setGuestSearch] = useState('')
  const [guestSearchResults, setGuestSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedGuestProfile, setSelectedGuestProfile] = useState(null)

  const [wallets, setWallets] = useState([])
  const [selectedWallet, setSelectedWallet] = useState(null)
  
  // State: User profile
  const [userProfile, setUserProfile] = useState(null)

  // State: Amount & Currency with conversion
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(globalCurrency)
  const [convertedAmount, setConvertedAmount] = useState(null)
  const [conversionRate, setConversionRate] = useState(null)
  const [conversionLoading, setConversionLoading] = useState(false)
  const [conversionError, setConversionError] = useState('')
  const [cryptoConversionRate, setCryptoConversionRate] = useState(null)
  const [cryptoConversionLoading, setCryptoConversionLoading] = useState(false)

  // State: Flow control
  const [step, setStep] = useState(1) // 1: recipient+amount, 2: method, 3: finalization
  const [activeType, setActiveType] = useState('fiat')
  const [requestMode, setRequestMode] = useState('recipient') // 'recipient' or 'custom_payment'

  // State: Payment method
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState(null)
  const [selectedDepositAddress, setSelectedDepositAddress] = useState(null)

  // State: Exchange rates and crypto
  const [exchangeRates, setExchangeRates] = useState({})
  const [ratesLoading, setRatesLoading] = useState(false)
  const [cryptoAddresses, setCryptoAddresses] = useState({})
  const [availableMethods, setAvailableMethods] = useState({ fiat: [], crypto: [] })

  // State: Processing
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [transferRecord, setTransferRecord] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [deposits, setDeposits] = useState([])
  const [sendChatMessage, setSendChatMessage] = useState(true) // Optional setting for step 3
  const [recipientOnlineStatus, setRecipientOnlineStatus] = useState(null)

  // State: Custom Payment
  const [customPaymentLink, setCustomPaymentLink] = useState(null)
  const [customPaymentDescription, setCustomPaymentDescription] = useState('')
  const [customPaymentEmail, setCustomPaymentEmail] = useState('')
  const [generatingPayment, setGeneratingPayment] = useState(false)
  const [authStatus, setAuthStatus] = useState(null)
  const [showDiagnostics, setShowDiagnostics] = useState(true)

  // State: Wallet search
  const [walletSearch, setWalletSearch] = useState('')
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const [filteredWallets, setFilteredWallets] = useState([])

  const searchInputRef = useRef(null)
  const walletDropdownRef = useRef(null)

  // Helper function to extract crypto code from currency name
  const extractCryptoCode = (currencyName) => {
    // Try to extract from parentheses first (e.g., "Bitcoin (BTC)" -> "BTC")
    const match = currencyName.match(/\(([A-Z]+)\)/)
    if (match) return match[1]
    // Fallback to first word (e.g., "Ethereum" -> "Ethereum")
    return currencyName.split(' ')[0]
  }

  // Load initial data
  useEffect(() => {
    const addressesByCode = {}
    try {
      if (CRYPTOCURRENCY_DEPOSITS && CRYPTOCURRENCY_DEPOSITS.length > 0) {
        CRYPTOCURRENCY_DEPOSITS.forEach(deposit => {
          const code = extractCryptoCode(deposit.currency)
          if (!addressesByCode[code]) {
            addressesByCode[code] = {
              currency: deposit.currency,
              networks: []
            }
          }
          addressesByCode[code].networks.push({
            network: deposit.network,
            address: deposit.address,
            metadata: deposit.metadata || {}
          })
        })
      }
    } catch (err) {
      console.warn('Error organizing crypto addresses:', err)
    }

    setCryptoAddresses(addressesByCode)
    const firstCryptoCode = Object.keys(addressesByCode)[0]
    if (firstCryptoCode) {
      setSelectedCryptoNetwork(firstCryptoCode)
    }

    loadDepositMethods()
    loadData()
  }, [userId])

  // Search profiles
  useEffect(() => {
    if (guestSearch.trim().length >= 2) {
      searchUserProfiles()
    } else {
      setGuestSearchResults([])
      setShowSearchResults(false)
    }
  }, [guestSearch])

  // Fetch conversion rate when amount or currency changes
  useEffect(() => {
    if (amount && selectedWallet) {
      const selectedWalletData = wallets.find(w => w.id === selectedWallet)
      if (selectedWalletData && selectedWalletData.currency_code !== selectedCurrency) {
        // Check if it's a crypto currency conversion
        const isCryptoCurrency = CRYPTO_CURRENCY_CODES.includes(selectedCurrency.toUpperCase())
        if (isCryptoCurrency) {
          fetchCryptoConversionRate(selectedCurrency, selectedWalletData.currency_code)
        } else {
          fetchConversionRate(selectedCurrency, selectedWalletData.currency_code)
        }
      } else if (selectedWalletData) {
        setConvertedAmount(parseFloat(amount))
        setConversionRate(1)
      }
    }
  }, [amount, selectedCurrency, selectedWallet])

  const fetchConversionRate = async (from, to) => {
    setConversionLoading(true)
    setConversionError('')
    try {
      const rate = await currencyAPI.getExchangeRate(from, to)
      if (rate && rate > 0) {
        setConversionRate(rate)
        if (amount) {
          setConvertedAmount(parseFloat(amount) * rate)
        }
        setConversionError('')
      } else {
        console.warn(`Conversion rate from ${from} to ${to} not available`)
        setConversionError('Service temporarily unavailable - conversion rate could not be loaded')
      }
    } catch (err) {
      console.warn('Error fetching conversion rate:', err)
      setConversionError('Failed to fetch conversion rate - please try again')
    } finally {
      setConversionLoading(false)
    }
  }

  const fetchCryptoConversionRate = async (from, to) => {
    setCryptoConversionLoading(true)
    setConversionError('')
    try {
      // Try to get crypto rate
      const rate = await currencyAPI.getExchangeRate(from, to)
      if (rate && rate > 0) {
        setCryptoConversionRate(rate)
        setConversionRate(rate)
        if (amount) {
          setConvertedAmount(parseFloat(amount) * rate)
        }
        setConversionError('')
      } else {
        // If rate not available, show conversion as pending
        console.warn(`Conversion rate from ${from} to ${to} not available`)
        setConversionError('Service temporarily unavailable - conversion rate could not be loaded')
      }
    } catch (err) {
      console.warn('Error fetching crypto conversion rate:', err)
      setConversionError('Failed to fetch conversion rate - please try again')
    } finally {
      setCryptoConversionLoading(false)
    }
  }

  const searchUserProfiles = async () => {
    try {
      const results = await receiveMoneyService.searchProfiles(guestSearch)
      setGuestSearchResults(results)
      setShowSearchResults(true)
    } catch (err) {
      console.error('Error searching profiles:', err)
      setGuestSearchResults([])
    }
  }

  const loadDepositMethods = async () => {
    try {
      const fiat = [
        { id: 'gcash', name: 'GCash', description: 'Mobile wallet' }
      ]
      const crypto = [
        { id: 'crypto', name: 'Cryptocurrency', description: '50+ cryptocurrencies' }
      ]

      setAvailableMethods({ fiat, crypto })
    } catch (err) {
      console.warn('Error loading deposit methods:', err)
      setAvailableMethods({ fiat: [{ id: 'gcash', name: 'GCash', description: 'Mobile wallet' }], crypto: [] })
    }
  }

  const loadUserProfile = async () => {
    try {
      if (!userId || userId.includes('guest')) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && profile) {
        setUserProfile(profile)
      }
    } catch (err) {
      console.warn('Error loading user profile:', err)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')

      console.debug('ReceiveMoney loadData started:', { userId, isGuest: userId?.includes('guest') })

      // Check authentication status
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Auth session error:', sessionError)
        setAuthStatus({ authenticated: false, reason: 'Session check failed' })
      } else if (!session) {
        console.warn('No active auth session')
        setAuthStatus({ authenticated: false, reason: 'No active session' })
      } else {
        console.debug('Auth session found:', session.user.id)
        setAuthStatus({ authenticated: true, userId: session.user.id, email: session.user.email })
      }

      if (userId && !userId.includes('guest')) {
        try {
          console.debug('Loading wallets for user:', userId)
          const userWallets = await walletService.getUserWalletsWithDetails(userId)
          console.debug('Wallets loaded:', { count: userWallets?.length || 0, wallets: userWallets })
          if (userWallets && userWallets.length > 0) {
            setWallets(userWallets)
            setSelectedWallet(userWallets[0].id)
          } else {
            console.warn('No wallets found for user:', userId)
          }
        } catch (err) {
          console.warn('Error loading wallets:', err)
          setError('Failed to load wallets: ' + (err?.message || 'Unknown error'))
        }

        await loadUserProfile()

        try {
          const { data: userDeposits, error: depositsError } = await supabase
            .from('deposits')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)

          if (depositsError) {
            console.warn('Error loading deposits:', depositsError)
          } else if (userDeposits) {
            setDeposits(userDeposits)
          }
        } catch (err) {
          console.warn('Error loading deposits:', err)
        }
      } else {
        console.debug('Skipping data load - user is guest or no userId')
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Some data could not be loaded, but you can still use the page')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectGuestProfile = (profile) => {
    setSelectedGuestProfile(profile)
    setGuestSearch('')
    setShowSearchResults(false)
    // Check if recipient is online
    checkRecipientStatus(profile.id)
  }

  const checkRecipientStatus = async (recipientUserId) => {
    try {
      const { data: presence } = await supabase
        .from('presence')
        .select('is_online')
        .eq('user_id', recipientUserId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (presence) {
        setRecipientOnlineStatus(presence.is_online)
      }
    } catch (err) {
      console.warn('Could not check recipient status:', err)
      setRecipientOnlineStatus(null)
    }
  }

  const handleGenerateCustomPayment = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!userId) {
      setError('You must be logged in to generate payment links')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (!selectedMethod) {
      setError('Please select a payment method')
      return
    }

    if (selectedMethod === 'crypto' && !selectedCryptoNetwork) {
      setError('Please select a cryptocurrency')
      return
    }

    setGeneratingPayment(true)
    try {
      const result = await customPaymentService.generatePaymentLink({
        from_user_id: userId,
        to_email: customPaymentEmail || null,
        amount: parseFloat(amount),
        currency: selectedCurrency,
        payment_method: selectedMethod,
        crypto_network: selectedCryptoNetwork || null,
        description: customPaymentDescription || `Payment request for ${getCurrencySymbol(selectedCurrency)}${formatNumber(amount)}`
      })

      if (result.success) {
        setCustomPaymentLink(result)
        setStep(3) // Show finalization/success screen
        setSuccess('Custom payment link generated successfully!')
      }
    } catch (err) {
      console.error('Error generating payment link:', err)
      setError(`Failed to generate payment link: ${err.message}`)
    } finally {
      setGeneratingPayment(false)
    }
  }

  const handleCreateTransfer = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedWallet && !selectedGuestProfile) {
      setError('Please select a wallet or profile')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setSubmitting(true)
    try {
      const selectedWalletData = wallets.find(w => w.id === selectedWallet)
      const finalAmount = convertedAmount || parseFloat(amount)
      const finalCurrency = selectedWalletData?.currency_code || selectedCurrency
      const recipientUserId = selectedGuestProfile?.id || selectedWallet

      // Determine recipient - either guest profile or wallet user
      const toUserId = selectedGuestProfile?.id || (selectedWalletData?.user_id || userId)
      const fromUserId = userId || null

      // Create transfer record with proper schema columns
      const transferData = {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        from_wallet_id: selectedWallet || null,
        to_wallet_id: selectedWallet || null,
        sender_amount: parseFloat(amount),
        sender_currency: selectedCurrency,
        recipient_amount: finalAmount,
        recipient_currency: finalCurrency,
        exchange_rate: conversionRate || 1,
        rate_source: 'manual',
        rate_fetched_at: new Date().toISOString(),
        status: 'pending',
        fee: 0,
        description: selectedMethod === 'crypto' ? `Crypto deposit via ${selectedCryptoNetwork}` : `Payment via ${selectedMethod}`,
        metadata: {
          payment_method: selectedMethod,
          crypto_network: selectedCryptoNetwork || null,
          crypto_address: selectedDepositAddress?.address || null,
          guest_name: selectedGuestProfile?.name || null,
          guest_profile_id: selectedGuestProfile?.id || null
        }
      }

      // Insert into public.transfers
      const { data: insertedTransfer, error: transferError } = await supabase
        .from('transfers')
        .insert([transferData])
        .select()

      if (transferError) {
        throw new Error(transferError.message || 'Failed to create transfer')
      }

      const transfer = insertedTransfer?.[0]
      setTransferRecord(transfer)

      // Send chat message to the other user (if request mode AND user enabled it)
      if (selectedGuestProfile && sendChatMessage) {
        try {
          await sendPaymentRequestMessage(selectedGuestProfile, transfer, finalAmount, finalCurrency)
        } catch (chatErr) {
          console.warn('Could not send chat message:', chatErr)
        }
      }

      setSuccess('Transfer request created!')
    } catch (err) {
      console.error('Error creating transfer:', err)
      setError('Failed to create transfer: ' + (err.message || 'Unknown error'))
    } finally {
      setSubmitting(false)
    }
  }

  const sendPaymentRequestMessage = async (recipient, transfer, amount, currency) => {
    try {
      if (!userId) {
        console.warn('Cannot send message - no authenticated user')
        return
      }

      // Import conversations helper
      const { createConversation, addParticipantToConversation } = await import('../lib/conversations')

      const paymentLink = `${window.location.origin}/payment/${transfer.id}`
      const messageContent = `Payment Request: ${getCurrencySymbol(currency)}${formatNumber(amount)} from ${userProfile?.full_name || userProfile?.email || 'User'}. View and confirm: ${paymentLink}`

      try {
        // Create conversation with recipient
        const conversation = await createConversation(
          userId,
          `Payment Request: ${getCurrencySymbol(currency)}${formatNumber(amount)}`,
          [recipient.id]
        )

        // Send payment request message
        const { error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              conversation_id: conversation.id,
              sender_id: userId,
              content: messageContent,
              message_type: 'payment_request',
              metadata: {
                payment_request: {
                  transfer_id: transfer.id,
                  amount: amount,
                  currency: currency,
                  from_user_id: userId,
                  to_user_id: recipient.id,
                  payment_link: paymentLink,
                  created_at: new Date().toISOString()
                }
              }
            }
          ])

        if (messageError) {
          console.warn('Could not send message:', messageError)
        } else {
          console.log('Payment request message sent successfully')
        }
      } catch (convErr) {
        console.warn('Could not create conversation:', convErr)
      }
    } catch (err) {
      console.warn('Error sending payment request message:', err)
    }
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(label)
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch (err) {
      setError('Could not copy to clipboard')
      setTimeout(() => setError(''), 3000)
    }
  }

  const selectedWalletData = wallets.find(w => w.id === selectedWallet)
  const availableCryptos = Object.entries(cryptoAddresses).map(([code, data]) => ({
    code,
    currency: data.currency,
    networks: data.networks || []
  }))
  const selectedCryptoAddresses = selectedCryptoNetwork && cryptoAddresses[selectedCryptoNetwork]
    ? cryptoAddresses[selectedCryptoNetwork].networks || []
    : []

  const checkoutLink = transferRecord ? `${window.location.origin}/checkout?transferId=${transferRecord.id}` : null

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        {!authStatus?.authenticated && userId && !userId.includes('guest') ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
            <p className="text-amber-800 font-medium mb-4">Loading authentication status...</p>
            <p className="text-sm text-amber-700 mb-6">Please wait while we verify your session.</p>
            <button
              onClick={() => {
                setShowDiagnostics(!showDiagnostics)
              }}
              className="text-xs text-amber-700 underline"
            >
              {showDiagnostics ? 'Hide' : 'Show'} details
            </button>
            {showDiagnostics && (
              <div className="mt-4 text-xs text-amber-700 font-mono text-left bg-white p-3 rounded border border-amber-100 inline-block">
                <div>Auth Status: {authStatus?.authenticated ? 'Authenticated' : 'Not Authenticated'}</div>
                <div>User ID: {userId}</div>
              </div>
            )}
          </div>
        ) : !authStatus?.authenticated ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <p className="text-blue-800 font-medium mb-4">You need to be logged in</p>
            <p className="text-sm text-blue-700 mb-6">Create an account or log in to use the receive money feature.</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.href = '/login'}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Log In
              </button>
              <button
                onClick={() => window.location.href = '/register'}
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                Create Account
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500">Loading...</div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-3xl font-light text-slate-900 mb-6 tracking-tight">Receive Money</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            {customPaymentLink && isRequestMode && requestMode === 'custom_payment' ? (
              // Custom Payment Link Success Screen
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-green-700">✓</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">Payment Link Generated</h3>
                  <p className="text-slate-600">Share this link to collect payments from anyone</p>
                </div>

                {/* Payment Details */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Amount:</span>
                    <span className="font-semibold text-slate-900">
                      {getCurrencySymbol(selectedCurrency)}{formatNumber(amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Method:</span>
                    <span className="text-slate-600">
                      {selectedMethod === 'gcash' && '💰 GCash'}
                      {selectedMethod === 'crypto' && `🪙 ${selectedCryptoNetwork}`}
                    </span>
                  </div>
                  {customPaymentDescription && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-700">Description:</span>
                      <span className="text-slate-600 text-right">{customPaymentDescription}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Payment Code:</span>
                    <span className="font-mono text-sm text-slate-600">{customPaymentLink.paymentCode}</span>
                  </div>
                </div>

                {/* Payment Link */}
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-green-700">🔗 Payment Link</p>
                  <div className="bg-white border border-slate-300 rounded p-3">
                    <div className="text-xs font-mono text-slate-900 break-all mb-3">{customPaymentLink.paymentLink}</div>
                    <button
                      onClick={() => copyToClipboard(customPaymentLink.paymentLink, 'Link copied!')}
                      className="w-full text-xs px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium"
                    >
                      {copyFeedback === 'Link copied!' ? '✓ Copied' : 'Copy Payment Link'}
                    </button>
                  </div>
                </div>

                {/* QR Code Section - Optional */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">💡 Tip: Share this link via email, WhatsApp, or QR code</p>
                  <p className="text-xs text-slate-600">Payment link expires in 7 days if not completed</p>
                </div>

                <button
                  onClick={() => {
                    setCustomPaymentLink(null)
                    setCustomPaymentDescription('')
                    setCustomPaymentEmail('')
                    setAmount('')
                    setSelectedCryptoNetwork(null)
                    setSelectedMethod(null)
                    setRequestMode('recipient')
                    setStep(1)
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Generate Another Link
                </button>
              </div>
            ) : transferRecord ? (
              // Success Screen for regular request
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-emerald-700">✓</span>
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">Payment Request Sent</h3>
                  <p className="text-slate-600">Shared via chat message and payment link</p>
                </div>

                {/* Transfer Details */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  {transferRecord.id && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-700">Request ID:</span>
                      <span className="font-mono text-sm text-slate-600 text-right break-all">{transferRecord.id}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Amount:</span>
                    <span className="font-semibold text-slate-900">
                      {getCurrencySymbol(transferRecord.currency)}{formatNumber(transferRecord.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-slate-700">Method:</span>
                    <span className="text-slate-600">
                      {transferRecord.method === 'gcash' && 'GCash'}
                      {transferRecord.method === 'bank' && 'Bank Transfer'}
                      {transferRecord.method === 'crypto' && transferRecord.crypto_network}
                    </span>
                  </div>
                </div>

                {/* Payment Link */}
                {checkoutLink && (
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-blue-700">Payment Link</p>
                    <div className="bg-white border border-slate-300 rounded p-3">
                      <div className="text-xs font-mono text-slate-900 break-all mb-3">{checkoutLink}</div>
                      <button
                        onClick={() => copyToClipboard(checkoutLink, 'Link copied!')}
                        className="w-full text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        {copyFeedback === 'Link copied!' ? 'Copied' : 'Copy Payment Link'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setTransferRecord(null)
                    setAmount('')
                    setSelectedWallet(null)
                    setSelectedGuestProfile(null)
                    setSelectedMethod(null)
                    setStep(1)
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Another Request
                </button>
              </div>
            ) : (
              // Form Steps
              <>
                {/* Step Indicator */}
                <div className="flex items-center space-x-4 mb-8">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          s <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {s}
                      </div>
                      {s < 3 && <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
                    </div>
                  ))}
                </div>

                <form onSubmit={isRequestMode && requestMode === 'custom_payment' ? handleGenerateCustomPayment : handleCreateTransfer} className="space-y-6">
                  {/* Step 1: Select Recipient & Enter Amount */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">Who is receiving funds and how much?</h3>

                      {/* Toggle */}
                      <div className="flex gap-4 mb-6">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRequestMode(false)
                            setSelectedGuestProfile(null)
                            setRequestMode('recipient')
                          }}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            !isRequestMode
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          My Wallets
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRequestMode(true)
                            setSelectedWallet(null)
                            setRequestMode('recipient')
                          }}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            isRequestMode
                              ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          Request Money
                        </button>
                      </div>

                      {/* Request Money Submode Selection */}
                      {isRequestMode && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-slate-700">Choose request type:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setRequestMode('recipient')}
                              className={`p-3 rounded-lg border-2 transition-all text-center ${
                                requestMode === 'recipient'
                                  ? 'border-blue-600 bg-white text-blue-700 font-medium'
                                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              👤 To Specific User
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRequestMode('custom_payment')
                                setSelectedGuestProfile(null)
                              }}
                              className={`p-3 rounded-lg border-2 transition-all text-center ${
                                requestMode === 'custom_payment'
                                  ? 'border-green-600 bg-white text-green-700 font-medium'
                                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              🔗 Generate Payment Link
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Custom Payment Form */}
                      {isRequestMode && requestMode === 'custom_payment' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Description</label>
                            <input
                              type="text"
                              value={customPaymentDescription}
                              onChange={e => setCustomPaymentDescription(e.target.value)}
                              placeholder="e.g., Invoice #123, Service payment"
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Guest Email (Optional)</label>
                            <input
                              type="email"
                              value={customPaymentEmail}
                              onChange={e => setCustomPaymentEmail(e.target.value)}
                              placeholder="guest@example.com"
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                            />
                            <p className="text-xs text-slate-500 mt-1">Leave blank for anonymous checkout</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!amount || loading}
                            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next: Select Payment Method
                          </button>
                        </div>
                      )}

                      {/* Recipient Selection */}
                      {!isRequestMode && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-3">Select Wallet</label>
                          {wallets.length === 0 ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <p className="text-sm text-amber-800">
                                No wallets found.{' '}
                                <a href="/wallets" className="font-medium underline">
                                  Create a wallet
                                </a>{' '}
                                first.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {wallets.map(wallet => (
                                <button
                                  key={wallet.id}
                                  type="button"
                                  onClick={() => setSelectedWallet(wallet.id)}
                                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                    selectedWallet === wallet.id
                                      ? 'border-blue-600 bg-blue-50'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="font-medium text-slate-900 mb-2">{wallet.currency_code}</div>
                                  <div className="text-sm text-slate-600 mb-3">
                                    Balance: {getCurrencySymbol(wallet.currency_code)}{formatNumber(wallet.balance)}
                                  </div>
                                  <div className="bg-white/50 rounded p-2 mb-2 border border-slate-200">
                                    <p className="text-xs text-slate-600 font-semibold mb-1">Wallet ID</p>
                                    <p className="text-xs font-mono text-slate-900 break-all">{wallet.id}</p>
                                  </div>
                                  {wallet.account_number && (
                                    <div className="text-xs text-slate-600">
                                      Account: {wallet.account_number}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {isRequestMode && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Search User Profile</label>
                          <div className="relative">
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={guestSearch}
                              onChange={e => setGuestSearch(e.target.value)}
                              onFocus={() => guestSearch.length > 0 && setShowSearchResults(true)}
                              placeholder="Search by name, email, or phone"
                              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                            />

                            {showSearchResults && guestSearchResults.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                {guestSearchResults.map((profile, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectGuestProfile(profile)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="font-medium text-slate-900">{profile.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {profile.email}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {selectedGuestProfile && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-slate-900">{selectedGuestProfile.name}</p>
                                  <p className="text-sm text-slate-600 mt-1">{selectedGuestProfile.email}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedGuestProfile(null)}
                                  className="text-xs px-3 py-1 border border-slate-300 rounded hover:bg-slate-100"
                                >
                                  Change
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Amount Input with Conversion */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Amount to Receive</label>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          />
                          <select
                            value={selectedCurrency}
                            onChange={e => setSelectedCurrency(e.target.value)}
                            className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                          >
                            <optgroup label="Fiat Currencies">
                              <option value="PHP">PHP</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                              <option value="GBP">GBP</option>
                              <option value="JPY">JPY</option>
                              <option value="AUD">AUD</option>
                              <option value="CAD">CAD</option>
                              <option value="SGD">SGD</option>
                              <option value="HKD">HKD</option>
                              <option value="INR">INR</option>
                            </optgroup>
                            <optgroup label="Cryptocurrencies">
                              {availableCryptos.map(crypto => (
                                <option key={crypto.code} value={crypto.code}>
                                  {crypto.code} - {crypto.currency}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        {/* Conversion Display */}
                        {selectedWalletData && selectedCurrency !== selectedWalletData.currency_code && amount && (
                          <div className={`rounded-lg p-3 border ${
                            CRYPTO_CURRENCY_CODES.includes(selectedCurrency.toUpperCase())
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-blue-50 border-blue-200'
                          }`}>
                            <p className={`text-xs font-medium mb-2 ${
                              CRYPTO_CURRENCY_CODES.includes(selectedCurrency.toUpperCase())
                                ? 'text-orange-700'
                                : 'text-blue-700'
                            }`}>
                              Conversion
                            </p>
                            {conversionError ? (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700 font-medium">Service Unavailable</p>
                                <p className="text-xs text-red-600 mt-1">{conversionError}</p>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-sm text-slate-700">
                                    {amount} {selectedCurrency} equals
                                  </span>
                                  <span className={`text-lg font-semibold ${
                                    CRYPTO_CURRENCY_CODES.includes(selectedCurrency.toUpperCase())
                                      ? 'text-orange-600'
                                      : 'text-blue-600'
                                  }`}>
                                    {cryptoConversionLoading || conversionLoading ? 'Loading...' : formatNumber(convertedAmount)} {selectedWalletData.currency_code}
                                  </span>
                                </div>
                                {conversionRate && (
                                  <p className="text-xs text-slate-600 mt-2">
                                    Rate: 1 {selectedCurrency} = {formatNumber(conversionRate)} {selectedWalletData.currency_code}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={(!selectedWallet && !selectedGuestProfile) || !amount || loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next: Select Payment Method
                      </button>
                    </div>
                  )}

                  {/* Step 2: Payment Method */}
                  {step === 2 && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium text-slate-900">
                        {isRequestMode && requestMode === 'custom_payment' ? 'How will guests pay?' : 'How will the payment be sent?'}
                      </h3>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setActiveType('fiat')}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                            activeType === 'fiat'
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          💰 Fiat & Mobile
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveType('crypto')}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                            activeType === 'crypto'
                              ? 'border-orange-600 bg-orange-50 text-orange-700'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          🪙 Cryptocurrency
                        </button>
                      </div>

                      {/* Fiat Payment Methods */}
                      {activeType === 'fiat' && (
                        <div className="space-y-3">
                          <p className="text-sm text-slate-600 font-medium">Select a fiat payment method</p>
                          {availableMethods.fiat.map(method => (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setSelectedMethod(method.id)}
                              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                selectedMethod === method.id
                                  ? 'border-blue-600 bg-blue-50 shadow-md'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="font-semibold text-slate-900">{method.name}</div>
                              <div className="text-sm text-slate-600 mt-1">{method.description}</div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Crypto Payment Method */}
                      {activeType === 'crypto' && (
                        <div className="space-y-4">
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-orange-900 mb-2">Cryptocurrency Transfer</p>
                            <p className="text-sm text-orange-800">Send cryptocurrency directly from any wallet. Supports {availableCryptos.length}+ cryptocurrencies.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedMethod('crypto')}
                            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                              selectedMethod === 'crypto'
                                ? 'border-orange-600 bg-orange-50 shadow-md'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="font-semibold text-slate-900">₿ Direct Cryptocurrency</div>
                            <div className="text-sm text-slate-600 mt-1">Send any supported cryptocurrency</div>
                          </button>
                        </div>
                      )}

                      {/* Crypto Selection with Enhanced Display */}
                      {selectedMethod === 'crypto' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">
                              Select Cryptocurrency
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto p-1">
                              {availableCryptos.map(crypto => (
                                <button
                                  key={crypto.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCryptoNetwork(crypto.code)
                                    if (crypto.networks.length > 0) {
                                      setSelectedDepositAddress(crypto.networks[0])
                                    }
                                  }}
                                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                                    selectedCryptoNetwork === crypto.code
                                      ? 'border-blue-600 bg-blue-50 shadow-md'
                                      : 'border-slate-200 hover:border-slate-300 bg-white'
                                  }`}
                                >
                                  <div className="font-semibold text-slate-900 text-sm">{crypto.code}</div>
                                  <div className="text-xs text-slate-600 mt-1">
                                    {crypto.networks.length} network{crypto.networks.length !== 1 ? 's' : ''}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Show crypto details when selected */}
                          {selectedCryptoNetwork && cryptoAddresses[selectedCryptoNetwork] && (
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <p className="text-sm font-semibold text-slate-900 mb-3">
                                {cryptoAddresses[selectedCryptoNetwork].currency}
                              </p>
                              <div className="space-y-2 text-xs text-slate-600">
                                <p>✓ Available on {cryptoAddresses[selectedCryptoNetwork].networks.length} network{cryptoAddresses[selectedCryptoNetwork].networks.length !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Crypto Network/Address Selection */}
                      {selectedMethod === 'crypto' && selectedCryptoNetwork && selectedCryptoAddresses.length > 0 && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-3">
                              Select Network ({selectedCryptoAddresses.length} available)
                            </label>
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                              {selectedCryptoAddresses.map((addr, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedDepositAddress(addr)}
                                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                                    selectedDepositAddress === addr
                                      ? 'border-orange-600 bg-orange-50 shadow-md'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="text-sm font-semibold text-slate-900 mb-2">{addr.network}</div>
                                  <div className="text-xs font-mono text-slate-700 break-all bg-white/50 p-2 rounded mb-2">
                                    {addr.address}
                                  </div>
                                  {addr.metadata?.tag && (
                                    <div className="text-xs text-slate-600">
                                      <span className="font-medium">Memo/Tag:</span> {addr.metadata.tag}
                                    </div>
                                  )}
                                  {addr.metadata?.memo && (
                                    <div className="text-xs text-slate-600">
                                      <span className="font-medium">Memo:</span> {addr.metadata.memo}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          disabled={!selectedMethod || (selectedMethod === 'crypto' && !selectedDepositAddress)}
                          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next: Review & Finalize
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Finalization with Profile & Payment Link */}
                  {step === 3 && !customPaymentLink && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-slate-900">
                        {isRequestMode && requestMode === 'custom_payment' ? 'Review Payment Link' : 'Finalize Request'}
                      </h3>

                      {/* Your Profile - Show for both modes */}
                      {userProfile && !customPaymentLink && (
                        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-lg p-6 space-y-3">
                          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            {isRequestMode && requestMode === 'custom_payment' ? 'Your Business/Profile' : 'Your Profile'}
                          </p>
                          <div>
                            <p className="text-2xl font-light text-slate-900 mb-2">{userProfile.full_name || userProfile.email || 'User'}</p>
                            {userProfile.email && <p className="text-sm text-slate-600">Email: {userProfile.email}</p>}
                            {userProfile.phone && <p className="text-sm text-slate-600">Phone: {userProfile.phone}</p>}
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      <div className={`rounded-lg p-4 space-y-3 border ${
                        selectedMethod === 'crypto'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <p className={`text-sm font-medium ${
                          selectedMethod === 'crypto'
                            ? 'text-orange-900'
                            : 'text-slate-900'
                        }`}>
                          Payment Details
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-700">From:</span>
                            <span className="font-medium text-slate-900">{userProfile?.full_name || 'You'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-700">Amount:</span>
                            <span className={`font-medium ${
                              selectedMethod === 'crypto' ? 'text-orange-600' : 'text-blue-600'
                            }`}>
                              {getCurrencySymbol(selectedWalletData?.currency_code || selectedCurrency)}{formatNumber(convertedAmount || amount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-700">Method:</span>
                            <span className="font-medium text-slate-900">
                              {selectedMethod === 'gcash' && '💰 GCash'}
                              {selectedMethod === 'crypto' && `🪙 ${selectedCryptoNetwork}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Crypto Address Display */}
                      {selectedMethod === 'crypto' && selectedDepositAddress && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-semibold text-orange-900 mb-2">📬 Send {selectedCryptoNetwork} to this address:</p>
                          <div className="bg-white border border-orange-300 rounded p-4 space-y-3">
                            <div>
                              <div className="text-xs font-semibold text-slate-700 mb-2">Network</div>
                              <div className="text-sm font-semibold text-slate-900">{selectedDepositAddress.network}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-700 mb-2">Address</div>
                              <div className="text-xs font-mono text-slate-900 break-all bg-slate-100 p-3 rounded border border-slate-200">
                                {selectedDepositAddress.address}
                              </div>
                            </div>
                            {selectedDepositAddress.metadata?.tag && (
                              <div>
                                <div className="text-xs font-semibold text-slate-700 mb-2">Destination Tag</div>
                                <div className="text-xs font-mono text-slate-900 bg-slate-100 p-3 rounded border border-slate-200">
                                  {selectedDepositAddress.metadata.tag}
                                </div>
                              </div>
                            )}
                            {selectedDepositAddress.metadata?.memo && (
                              <div>
                                <div className="text-xs font-semibold text-slate-700 mb-2">Memo</div>
                                <div className="text-xs font-mono text-slate-900 bg-slate-100 p-3 rounded border border-slate-200">
                                  {selectedDepositAddress.metadata.memo}
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selectedDepositAddress.address, 'Address copied!')}
                              className="w-full text-xs px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors font-medium"
                            >
                              {copyFeedback === 'Address copied!' ? '✓ Copied' : 'Copy Address'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Optional Chat Message Setting - Only for regular requests */}
                      {selectedGuestProfile && !(isRequestMode && requestMode === 'custom_payment') && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sendChatMessage}
                              onChange={(e) => setSendChatMessage(e.target.checked)}
                              className="w-5 h-5 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">Send payment request via chat</p>
                              <p className="text-xs text-slate-600 mt-1">
                                Notify {selectedGuestProfile.full_name || selectedGuestProfile.email} about this payment request
                                {recipientOnlineStatus ? ' (Currently online)' : recipientOnlineStatus === false ? ' (Offline)' : ''}
                              </p>
                            </div>
                          </label>
                        </div>
                      )}

                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || generatingPayment}
                          className={`flex-1 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors ${
                            isRequestMode && requestMode === 'custom_payment'
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {submitting || generatingPayment ? 'Creating...' : (
                            <>
                              {isRequestMode && requestMode === 'custom_payment' ? (
                                <>
                                  Generate Payment Link
                                </>
                              ) : (
                                <>
                                  Create Payment Request
                                  {selectedGuestProfile && sendChatMessage && ' + Send Chat'}
                                </>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* How It Works */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">How It Works</h3>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                <span>Select recipient, amount & currency (fiat or crypto)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                <span>Choose payment method with auto-rate conversion</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                <span>Review details and send payment request</span>
              </li>
            </ol>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800 font-medium">💡 <span className="font-semibold">Pro Tip:</span> Automatic rate conversions apply when currency differs from wallet.</p>
            </div>
          </div>

          {/* Recent Deposits */}
          {deposits.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-medium text-slate-900">Recent Deposits</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {deposits.slice(0, 5).map(deposit => (
                  <div key={deposit.id} className="border-b border-slate-100 pb-3 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {getCurrencySymbol(deposit.currency_code)}{formatNumber(deposit.amount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(deposit.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          deposit.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : deposit.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {deposit.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted Methods */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Accepted Methods</h3>

            {/* Fiat Methods */}
            <div className="pb-4 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Fiat & Mobile</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-700">G</div>
                  <div>
                    <p className="font-medium text-slate-900">GCash</p>
                    <p className="text-xs text-slate-600">Mobile wallet</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Crypto Methods */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Cryptocurrency</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-semibold text-orange-700">🪙</div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{availableCryptos.length}+ Cryptocurrencies</p>
                    <p className="text-xs text-slate-600">Bitcoin, Ethereum, USDT, USDC & more</p>
                  </div>
                </div>
                {availableCryptos.slice(0, 5).map(crypto => (
                  <div key={crypto.code} className="text-xs text-slate-600 flex gap-2 ml-10">
                    <span>✓</span>
                    <span>{crypto.code}</span>
                  </div>
                ))}
                {availableCryptos.length > 5 && (
                  <div className="text-xs text-slate-600 ml-10 font-medium">+ {availableCryptos.length - 5} more</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
