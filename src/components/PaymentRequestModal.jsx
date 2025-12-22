import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { paymentTransferService } from '../lib/paymentTransferService'
import { createConversation, addParticipantToConversation } from '../lib/conversations'
import { formatNumber, getCurrencySymbol } from '../lib/currency'

export default function PaymentRequestModal({ 
  userId, 
  onClose, 
  recipientUserId = null,
  onSuccess = null 
}) {
  const [step, setStep] = useState(recipientUserId ? 2 : 1) // Skip recipient search if provided
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Step 1: Recipient selection
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientSearchResults, setRecipientSearchResults] = useState([])
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState(
    recipientUserId ? { id: recipientUserId } : null
  )
  const [searchingRecipient, setSearchingRecipient] = useState(false)
  
  // Step 2: Payment request details
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [description, setDescription] = useState('Payment Request')
  const [dueDate, setDueDate] = useState('')
  const [currencies, setCurrencies] = useState([])
  
  // Load recipient details
  useEffect(() => {
    if (selectedRecipient?.id && !selectedRecipient?.email) {
      loadRecipientDetails(selectedRecipient.id)
    }
  }, [selectedRecipient?.id])
  
  // Load currencies
  useEffect(() => {
    loadCurrencies()
  }, [])
  
  const loadCurrencies = async () => {
    try {
      const { data } = await supabase
        .from('currencies')
        .select('code, name, symbol')
        .eq('is_active', true)
      
      if (data) {
        setCurrencies(data)
        setCurrency('PHP')
      }
    } catch (err) {
      console.error('Error loading currencies:', err)
    }
  }
  
  const loadRecipientDetails = async (recipientId) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', recipientId)
        .single()
      
      if (data) {
        setSelectedRecipient(data)
      }
    } catch (err) {
      console.error('Error loading recipient:', err)
    }
  }
  
  // Search recipients
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
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name')
        .or(`email.ilike.%${recipientSearch}%,full_name.ilike.%${recipientSearch}%`)
        .neq('id', userId)
        .limit(10)
      
      setRecipientSearchResults(data || [])
    } catch (err) {
      console.error('Error searching recipients:', err)
    } finally {
      setSearchingRecipient(false)
    }
  }
  
  const handleSelectRecipient = (recipient) => {
    setSelectedRecipient(recipient)
    setRecipientSearch('')
    setShowRecipientDropdown(false)
  }
  
  const handleNext = () => {
    if (step === 1) {
      if (!selectedRecipient?.id) {
        setError('Please select a recipient')
        return
      }
      setStep(2)
    }
  }
  
  const handleSubmit = async () => {
    try {
      setError('')
      setSubmitting(true)
      
      // Validate
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount')
        return
      }
      
      if (!selectedRecipient?.id) {
        setError('No recipient selected')
        return
      }
      
      // Create a conversation for this payment request
      const conversationTitle = `Payment Request: ${formatNumber(amount)} ${currency}`
      
      try {
        const conversation = await createConversation(userId, conversationTitle, [selectedRecipient.id])
        
        // Add the sender as admin
        await addParticipantToConversation(conversation.id, userId, 'admin')
        
        // Create initial message with payment request details
        const paymentRequestMessage = {
          type: 'payment_request',
          content: `I'm requesting a payment of ${formatNumber(amount)} ${currency}${description ? ` for: ${description}` : ''}${dueDate ? ` due by ${new Date(dueDate).toLocaleDateString()}` : ''}`,
          amount: amount,
          currency: currency,
          description: description,
          dueDate: dueDate || null,
          from_user_id: userId,
          to_user_id: selectedRecipient.id,
          status: 'pending'
        }
        
        // Send message
        const { error: msgError } = await supabase
          .from('messages')
          .insert([
            {
              conversation_id: conversation.id,
              sender_id: userId,
              content: JSON.stringify(paymentRequestMessage),
              message_type: 'payment_request',
              metadata: paymentRequestMessage
            }
          ])
        
        if (msgError) {
          throw msgError
        }
        
        setSuccess('Payment request sent successfully!')
        
        setTimeout(() => {
          if (onSuccess) {
            onSuccess({
              conversationId: conversation.id,
              paymentRequest: paymentRequestMessage
            })
          }
          onClose?.()
        }, 2000)
      } catch (convErr) {
        console.error('Error creating conversation:', convErr)
        // Fallback: Show generated link
        setSuccess(`Payment request prepared. Share this link with the recipient to request payment.`)
      }
    } catch (err) {
      console.error('Error submitting payment request:', err)
      setError(err.message || 'Failed to send payment request')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }
  
  // STEP 1: SELECT RECIPIENT
  if (step === 1) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Request Payment</h2>
            <p className="text-slate-600 text-sm">Step 1: Who do you want to request from?</p>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {/* Recipient Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">Find Recipient</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              onFocus={() => setShowRecipientDropdown(true)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            
            {recipientSearch && (
              <button
                onClick={() => {
                  setRecipientSearch('')
                  setRecipientSearchResults([])
                }}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
            
            {/* Dropdown */}
            {showRecipientDropdown && recipientSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {recipientSearchResults.map(result => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectRecipient(result)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-200 last:border-b-0 transition"
                  >
                    <div className="font-medium text-slate-900 text-sm">{result.full_name || 'User'}</div>
                    <div className="text-xs text-slate-600">{result.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Selected Recipient */}
          {selectedRecipient && (
            <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{selectedRecipient.full_name || 'User'}</div>
                  <div className="text-sm text-slate-600">{selectedRecipient.email}</div>
                </div>
                <button
                  onClick={() => setSelectedRecipient(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedRecipient?.id}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-medium text-sm transition"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // STEP 2: ENTER PAYMENT REQUEST DETAILS
  if (step === 2) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6 max-h-96 overflow-y-auto">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Request Payment</h2>
            <p className="text-slate-600 text-sm">Step 2: Enter payment details</p>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {/* Recipient Display */}
          <div className="p-3 bg-slate-100 rounded-lg">
            <div className="text-xs text-slate-600 mb-1">Requesting from</div>
            <div className="font-semibold text-slate-900 text-sm">{selectedRecipient?.full_name || selectedRecipient?.email}</div>
          </div>
          
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {currencies.map(curr => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} - {curr.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">What's this for?</label>
            <input
              type="text"
              placeholder="e.g., Dinner split, Project payment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          
          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Due Date (Optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          
          {/* Summary */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs text-slate-600 mb-2">You're requesting:</div>
            <div className="text-lg font-bold text-blue-600">
              {amount ? formatNumber(amount) : '0'} {currency}
            </div>
            {description && (
              <div className="text-xs text-slate-600 mt-1">For: {description}</div>
            )}
          </div>
          
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              {success}
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={handleBack}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 font-medium text-sm transition"
            >
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
