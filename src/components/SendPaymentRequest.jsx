import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/payments'
import { paymentTransferService } from '../lib/paymentTransferService'
import { formatNumber, getCurrencySymbol } from '../lib/currency'

export default function SendPaymentRequest({ userId, onClose }) {
  // Step management
  const [currentStep, setCurrentStep] = useState(1)
  
  // Step 1: Amount & Currency
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('PHP')
  const [senderWallets, setSenderWallets] = useState([])
  const [selectedSenderWallet, setSelectedSenderWallet] = useState(null)
  
  // Conversion
  const [recipientCurrency, setRecipientCurrency] = useState('PHP')
  const [convertedAmount, setConvertedAmount] = useState(null)
  const [exchangeRate, setExchangeRate] = useState(1)
  const [conversionLoading, setConversionLoading] = useState(false)
  
  // Step 2: Recipient selection
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientSearchResults, setRecipientSearchResults] = useState([])
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [recipientWallets, setRecipientWallets] = useState([])
  const [selectedRecipientWallet, setSelectedRecipientWallet] = useState(null)
  const [showRecipientSearch, setShowRecipientSearch] = useState(false)
  const [searchingRecipient, setSearchingRecipient] = useState(false)
  
  // Step 3: Finalization
  const [userProfile, setUserProfile] = useState(null)
  const [description, setDescription] = useState('Payment')
  
  // Processing
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currencies, setCurrencies] = useState([])
  
  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [userId])
  
  const loadInitialData = async () => {
    try {
      setLoading(true)
      
      // Load user wallets
      const wallets = await currencyAPI.getWallets(userId)
      setSenderWallets(wallets || [])
      
      if (wallets && wallets.length > 0) {
        const phpWallet = wallets.find(w => w.currency_code === 'PHP') || wallets[0]
        setSelectedSenderWallet(phpWallet.id)
        setSelectedCurrency(phpWallet.currency_code)
        setRecipientCurrency(phpWallet.currency_code)
      }
      
      // Load user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (profile) {
        setUserProfile(profile)
      }
      
      // Load available currencies
      const { data: currencyData } = await supabase
        .from('currencies')
        .select('code, name, symbol')
        .eq('is_active', true)
      
      if (currencyData) {
        setCurrencies(currencyData)
      }
    } catch (err) {
      console.error('Error loading initial data:', err)
      setError('Failed to load wallet data')
    } finally {
      setLoading(false)
    }
  }
  
  // Calculate conversion when amount or currency changes
  useEffect(() => {
    if (amount && selectedCurrency && recipientCurrency) {
      calculateConversion()
    }
  }, [amount, selectedCurrency, recipientCurrency])
  
  const calculateConversion = async () => {
    try {
      setConversionLoading(true)
      const rate = await paymentTransferService.getExchangeRate(selectedCurrency, recipientCurrency)
      setExchangeRate(rate)
      setConvertedAmount(parseFloat(amount) * rate)
    } catch (err) {
      console.warn('Error calculating conversion:', err)
    } finally {
      setConversionLoading(false)
    }
  }
  
  // Search for recipients
  useEffect(() => {
    if (recipientSearch.trim().length >= 2) {
      searchRecipients()
    } else {
      setRecipientSearchResults([])
    }
  }, [recipientSearch])
  
  const searchRecipients = async () => {
    try {
      setSearchingRecipient(true)
      const { data: results } = await supabase
        .from('users')
        .select('id, email, full_name')
        .or(`email.ilike.%${recipientSearch}%,full_name.ilike.%${recipientSearch}%`)
        .neq('id', userId)
        .limit(10)
      
      setRecipientSearchResults(results || [])
    } catch (err) {
      console.error('Error searching recipients:', err)
    } finally {
      setSearchingRecipient(false)
    }
  }
  
  const handleSelectRecipient = async (recipient) => {
    setSelectedRecipient(recipient)
    setRecipientSearch('')
    setShowRecipientSearch(false)
    
    // Load recipient wallets
    const wallets = await paymentTransferService.getRecipientWallets(recipient.id)
    setRecipientWallets(wallets)
    
    // Auto-select same currency wallet if available
    const sameCurrencyWallet = wallets.find(w => w.currency_code === selectedCurrency)
    if (sameCurrencyWallet) {
      setSelectedRecipientWallet(sameCurrencyWallet.id)
    } else if (wallets.length > 0) {
      setSelectedRecipientWallet(wallets[0].id)
    }
  }
  
  const handleSubmit = async () => {
    try {
      setError('')
      setSubmitting(true)
      
      if (currentStep === 1) {
        // Validate step 1
        if (!amount || parseFloat(amount) <= 0) {
          setError('Please enter a valid amount')
          return
        }
        if (!selectedSenderWallet) {
          setError('Please select a sender wallet')
          return
        }
        setCurrentStep(2)
      } else if (currentStep === 2) {
        // Validate step 2
        if (!selectedRecipient) {
          setError('Please select a recipient')
          return
        }
        if (!selectedRecipientWallet) {
          setError('Recipient has no compatible wallets')
          return
        }
        setCurrentStep(3)
      } else if (currentStep === 3) {
        // Validate and submit
        if (!description.trim()) {
          setError('Please enter a description')
          return
        }
        
        // Get wallet details
        const senderWallet = senderWallets.find(w => w.id === selectedSenderWallet)
        const recipientWallet = recipientWallets.find(w => w.id === selectedRecipientWallet)
        
        if (!senderWallet || !recipientWallet) {
          setError('Invalid wallet selection')
          return
        }
        
        // Create transfer
        const result = await paymentTransferService.createTransferRequest(
          userId,
          selectedRecipient.id,
          {
            senderAmount: parseFloat(amount),
            senderCurrency: selectedCurrency,
            recipientAmount: convertedAmount || parseFloat(amount),
            recipientCurrency: recipientCurrency || selectedCurrency,
            senderWalletId: selectedSenderWallet,
            recipientWalletId: selectedRecipientWallet,
            description: description,
            exchangeRate: exchangeRate,
            rateSource: 'system',
            metadata: {
              sender_name: userProfile?.full_name || userProfile?.email,
              recipient_name: selectedRecipient.full_name || selectedRecipient.email
            }
          }
        )
        
        if (result.success) {
          // Generate payment link
          const paymentLink = paymentTransferService.generatePaymentLink(result.transfer.id)
          
          setSuccess(`Payment request created! Link: ${paymentLink}`)
          setTimeout(() => {
            onClose?.()
          }, 3000)
        }
      }
    } catch (err) {
      console.error('Error in payment flow:', err)
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-slate-200 h-32 rounded-lg"></div>
      </div>
    )
  }
  
  const getCurrencySymbol = (code) => {
    const currency = currencies.find(c => c.code === code)
    return currency?.symbol || code
  }
  
  // STEP 1: ENTER AMOUNT WITH CONVERSION
  if (currentStep === 1) {
    return (
      <div className="space-y-6 p-6 bg-gradient-to-b from-blue-50 to-white rounded-xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Send Money</h2>
          <p className="text-slate-600">Step 1 of 3: Enter Amount</p>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {/* Sender Wallet Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">From Wallet</label>
          <select
            value={selectedSenderWallet || ''}
            onChange={(e) => {
              const wallet = senderWallets.find(w => w.id === e.target.value)
              setSelectedSenderWallet(e.target.value)
              if (wallet) {
                setSelectedCurrency(wallet.currency_code)
                setRecipientCurrency(wallet.currency_code)
              }
            }}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select wallet</option>
            {senderWallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.currency_code} - {formatNumber(wallet.balance)} {getCurrencySymbol(wallet.currency_code)}
              </option>
            ))}
          </select>
        </div>
        
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Amount ({selectedCurrency})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>
        
        {/* Currency Conversion */}
        {selectedCurrency !== recipientCurrency && convertedAmount && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-slate-600 mb-2">Conversion Rate</div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">
                {formatNumber(amount)} {selectedCurrency}
              </span>
              <span className="text-slate-600">→</span>
              <span className="font-semibold text-slate-900">
                {formatNumber(convertedAmount)} {recipientCurrency}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              1 {selectedCurrency} = {formatNumber(exchangeRate)} {recipientCurrency}
            </div>
          </div>
        )}
        
        {/* Recipient Currency Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Currency</label>
          <select
            value={recipientCurrency}
            onChange={(e) => setRecipientCurrency(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {currencies.map(currency => (
              <option key={currency.code} value={currency.code}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !amount || !selectedSenderWallet}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-medium transition"
          >
            {submitting ? 'Loading...' : 'Continue'}
          </button>
        </div>
      </div>
    )
  }
  
  // STEP 2: SELECT RECIPIENT
  if (currentStep === 2) {
    return (
      <div className="space-y-6 p-6 bg-gradient-to-b from-purple-50 to-white rounded-xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Send Money</h2>
          <p className="text-slate-600">Step 2 of 3: Select Recipient</p>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {/* Amount Summary */}
        <div className="p-4 bg-slate-100 rounded-lg">
          <div className="text-sm text-slate-600 mb-1">Sending</div>
          <div className="text-2xl font-bold text-slate-900">
            {formatNumber(amount)} {selectedCurrency}
          </div>
          {convertedAmount && selectedCurrency !== recipientCurrency && (
            <div className="text-sm text-slate-600 mt-2">
              ≈ {formatNumber(convertedAmount)} {recipientCurrency}
            </div>
          )}
        </div>
        
        {/* Recipient Search */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-2">Find Recipient</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              onFocus={() => setShowRecipientSearch(true)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {recipientSearch && (
              <button
                onClick={() => {
                  setRecipientSearch('')
                  setRecipientSearchResults([])
                }}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showRecipientSearch && recipientSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {recipientSearchResults.map(result => (
                <button
                  key={result.id}
                  onClick={() => handleSelectRecipient(result)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-200 last:border-b-0 transition"
                >
                  <div className="font-medium text-slate-900">{result.full_name || 'User'}</div>
                  <div className="text-sm text-slate-600">{result.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Selected Recipient */}
        {selectedRecipient && (
          <div className="p-4 border-2 border-purple-300 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{selectedRecipient.full_name || 'User'}</div>
                <div className="text-sm text-slate-600">{selectedRecipient.email}</div>
              </div>
              <button
                onClick={() => setSelectedRecipient(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            
            {recipientWallets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Wallet</label>
                <select
                  value={selectedRecipientWallet || ''}
                  onChange={(e) => setSelectedRecipientWallet(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select wallet</option>
                  {recipientWallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.currency_code} Wallet
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={handleBack}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedRecipient}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 font-medium transition"
          >
            {submitting ? 'Loading...' : 'Continue'}
          </button>
        </div>
      </div>
    )
  }
  
  // STEP 3: FINALIZATION WITH PROFILE
  if (currentStep === 3) {
    return (
      <div className="space-y-6 p-6 bg-gradient-to-b from-emerald-50 to-white rounded-xl max-h-96 overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Confirm Payment</h2>
          <p className="text-slate-600">Step 3 of 3: Review & Send</p>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {/* Payment Summary */}
        <div className="space-y-3 p-4 bg-slate-100 rounded-lg">
          <div className="flex justify-between">
            <span className="text-slate-600">From:</span>
            <span className="font-semibold text-slate-900">{userProfile?.full_name || userProfile?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">To:</span>
            <span className="font-semibold text-slate-900">{selectedRecipient?.full_name || selectedRecipient?.email}</span>
          </div>
          <div className="border-t border-slate-300 my-2"></div>
          <div className="flex justify-between">
            <span className="text-slate-600">Amount:</span>
            <span className="font-bold text-lg text-emerald-600">
              {formatNumber(amount)} {selectedCurrency}
            </span>
          </div>
          {convertedAmount && selectedCurrency !== recipientCurrency && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Recipient receives:</span>
              <span className="font-semibold text-slate-900">
                {formatNumber(convertedAmount)} {recipientCurrency}
              </span>
            </div>
          )}
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Payment Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Lunch reimbursement"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        
        {/* User Profile Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-slate-700 mb-3">Your Profile</div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-600">Email:</span>
              <span className="ml-2 font-medium text-slate-900">{userProfile?.email}</span>
            </div>
            {userProfile?.full_name && (
              <div>
                <span className="text-slate-600">Name:</span>
                <span className="ml-2 font-medium text-slate-900">{userProfile.full_name}</span>
              </div>
            )}
            {userProfile?.phone && (
              <div>
                <span className="text-slate-600">Phone:</span>
                <span className="ml-2 font-medium text-slate-900">{userProfile.phone}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Terms & Conditions */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-slate-600">
          By confirming, you authorize this payment transfer. The recipient will receive a payment notification.
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={handleBack}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 font-medium transition"
          >
            {submitting ? 'Processing...' : 'Confirm & Send'}
          </button>
        </div>
        
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
            {success}
          </div>
        )}
      </div>
    )
  }
}
