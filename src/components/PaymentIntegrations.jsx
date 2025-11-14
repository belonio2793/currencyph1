import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function PaymentIntegrations({ businessId, userId }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [formData, setFormData] = useState({
    provider: 'gcash',
    provider_account_id: '',
    status: 'connected'
  })

  const providers = [
    {
      id: 'gcash',
      name: 'GCash',
      icon: '₱',
      color: 'bg-blue-50 border-blue-200',
      description: 'Mobile wallet for quick transfers',
      features: ['P2P Transfers', 'Bill Payments', 'Cash In/Out']
    },
    {
      id: 'paymaya',
      name: 'PayMaya',
      icon: '₱',
      color: 'bg-red-50 border-red-200',
      description: 'Digital payment platform',
      features: ['Online Payments', 'Card Payments', 'Cash Advance']
    },
    {
      id: 'bank-transfer',
      name: 'Bank Transfer',
      icon: '🏦',
      color: 'bg-green-50 border-green-200',
      description: 'Direct bank transactions',
      features: ['Local Transfers', 'International', 'ACH']
    },
    {
      id: 'stripe',
      name: 'Stripe',
      icon: '💳',
      color: 'bg-purple-50 border-purple-200',
      description: 'Global payment processing',
      features: ['Card Payments', 'Subscription', 'Invoicing']
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: '🌐',
      color: 'bg-yellow-50 border-yellow-200',
      description: 'International payments',
      features: ['Express Checkout', 'Invoicing', 'Disputes']
    },
    {
      id: 'wise',
      name: 'Wise (TransferWise)',
      icon: '✈️',
      color: 'bg-indigo-50 border-indigo-200',
      description: 'International transfers',
      features: ['Low Fees', 'Multi-currency', 'Fast Transfers']
    }
  ]

  useEffect(() => {
    loadPaymentMethods()
  }, [businessId])

  const loadPaymentMethods = async () => {
    if (!businessId) return

    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('business_payments')
        .select('*')
        .eq('business_id', businessId)

      if (fetchError) throw fetchError

      setPayments(data || [])
      setError('')
    } catch (err) {
      console.error('Error loading payment methods:', err)
      setError('Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()

    if (!formData.provider_account_id) {
      setError('Please enter a payment account ID or username')
      return
    }

    try {
      if (editingId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('business_payments')
          .update({
            provider: formData.provider,
            provider_account_id: formData.provider_account_id,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)

        if (updateError) throw updateError
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('business_payments')
          .insert([{
            business_id: businessId,
            user_id: userId,
            provider: formData.provider,
            provider_account_id: formData.provider_account_id,
            status: formData.status
          }])

        if (insertError) throw insertError
      }

      setFormData({
        provider: 'gcash',
        provider_account_id: '',
        status: 'connected'
      })
      setEditingId(null)
      setShowAddForm(false)
      setError('')
      loadPaymentMethods()
    } catch (err) {
      console.error('Error saving payment method:', err)
      setError('Failed to save payment method')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payment method?')) return

    try {
      const { error: deleteError } = await supabase
        .from('business_payments')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      loadPaymentMethods()
    } catch (err) {
      console.error('Error deleting payment method:', err)
      setError('Failed to delete payment method')
    }
  }

  const handleEdit = (payment) => {
    setFormData({
      provider: payment.provider,
      provider_account_id: payment.provider_account_id,
      status: payment.status
    })
    setEditingId(payment.id)
    setShowAddForm(true)
  }

  if (loading) {
    return <div className="text-center py-12">Loading payment methods...</div>
  }

  const getProviderInfo = (providerId) => providers.find(p => p.id === providerId)

  const connectedProviders = payments.map(p => p.provider)
  const availableProviders = providers.filter(p => !connectedProviders.includes(p.id))

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Payment Integrations</h3>
        <p className="text-slate-600">Connect payment methods to receive and send payments through various providers</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">Connected Payment Methods: <span className="font-bold text-blue-600">{payments.length}</span></p>
          <button
            onClick={() => {
              setEditingId(null)
              setFormData({
                provider: 'gcash',
                provider_account_id: '',
                status: 'connected'
              })
              setShowAddForm(!showAddForm)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            {showAddForm ? 'Cancel' : '+ Add Payment Method'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={handleAddPayment} className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {editingId ? 'Edit Payment Method' : 'Add Payment Method'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Provider</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({...formData, provider: e.target.value})}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                {editingId ? (
                  <option value={formData.provider}>
                    {getProviderInfo(formData.provider)?.name}
                  </option>
                ) : (
                  <>
                    <option value="">Select a provider</option>
                    {availableProviders.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Account ID / Username / Email</label>
              <input
                type="text"
                value={formData.provider_account_id}
                onChange={(e) => setFormData({...formData, provider_account_id: e.target.value})}
                placeholder="e.g., 09123456789 or user@email.com"
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                <option value="connected">Connected</option>
                <option value="pending">Pending Verification</option>
                <option value="disconnected">Disconnected</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {editingId ? 'Update' : 'Add'} Payment Method
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setEditingId(null)
              }}
              className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Connected Payments */}
      {payments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Connected Payment Methods</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {payments.map(payment => {
              const provider = getProviderInfo(payment.provider)
              return (
                <div key={payment.id} className={`rounded-lg border-2 p-6 ${provider?.color}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-3xl mb-2">{provider?.icon}</div>
                      <h4 className="text-lg font-semibold text-slate-900">{provider?.name}</h4>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'connected'
                        ? 'bg-green-100 text-green-700'
                        : payment.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-4">{provider?.description}</p>

                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-1">Account:</p>
                    <p className="text-sm font-mono text-slate-700">{payment.provider_account_id}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-slate-500">Features:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {provider?.features.map(feature => (
                        <span key={feature} className="text-xs px-2 py-1 bg-white bg-opacity-60 rounded text-slate-700">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(payment)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(payment.id)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mt-3">
                    Connected {new Date(payment.connected_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Providers */}
      {availableProviders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Available Payment Providers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProviders.map(provider => (
              <div key={provider.id} className={`rounded-lg border-2 p-6 ${provider.color} opacity-75`}>
                <div className="text-3xl mb-2">{provider.icon}</div>
                <h4 className="text-lg font-semibold text-slate-900 mb-1">{provider.name}</h4>
                <p className="text-sm text-slate-600 mb-3">{provider.description}</p>
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Key Features:</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {provider.features.map(feature => (
                      <li key={feature} className="flex items-center gap-1">
                        <span>✓</span> {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setFormData({
                      provider: provider.id,
                      provider_account_id: '',
                      status: 'connected'
                    })
                    setEditingId(null)
                    setShowAddForm(true)
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
                >
                  Connect {provider.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length === 0 && !showAddForm && (
        <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-slate-600 mb-4">No payment methods connected yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Add Your First Payment Method
          </button>
        </div>
      )}
    </div>
  )
}
