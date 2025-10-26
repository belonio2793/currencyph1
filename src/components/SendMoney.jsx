import { useState, useEffect } from 'react'
import { wisegcashAPI } from '../lib/wisegcashAPI'

export default function SendMoney({ userId }) {
  const [wallets, setWallets] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSender, setSelectedSender] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientCurrency, setRecipientCurrency] = useState('PHP')
  const [amount, setAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState(1)
  const [receiverAmount, setReceiverAmount] = useState('0')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const [step, setStep] = useState(1)

  const currencies = ['PHP', 'USD', 'EUR', 'GBP']

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      const [walletsData, beneficiariesData] = await Promise.all([
        wisegcashAPI.getWallets(userId),
        wisegcashAPI.getBeneficiaries(userId)
      ])
      setWallets(walletsData)
      setBeneficiaries(beneficiariesData)
      if (walletsData.length > 0) {
        setSelectedSender(walletsData[0].currency_code)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (amount && selectedSender) {
      calculateExchangeRate()
    }
  }, [amount, selectedSender, recipientCurrency])

  const calculateExchangeRate = async () => {
    try {
      const rate = await wisegcashAPI.getExchangeRate(selectedSender, recipientCurrency)
      if (rate) {
        setExchangeRate(rate)
        setReceiverAmount((parseFloat(amount) * rate).toFixed(2))
      }
    } catch (err) {
      console.warn('Could not fetch exchange rate:', err)
    }
  }

  const handleAddBeneficiary = async (e) => {
    e.preventDefault()
    setError('')

    if (!recipientEmail) {
      setError('Please enter recipient email')
      return
    }

    try {
      await wisegcashAPI.addBeneficiary(userId, {
        recipient_email: recipientEmail,
        recipient_name: recipientEmail.split('@')[0],
        country_code: 'PH'
      })
      setSuccess('Beneficiary added!')
      loadData()
      setRecipientEmail('')
    } catch (err) {
      setError(err.message || 'Failed to add beneficiary')
    }
  }

  const handleSendMoney = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      if (!selectedSender || !recipientEmail || !amount) {
        throw new Error('Please fill in all fields')
      }

      await wisegcashAPI.sendMoney(
        userId,
        recipientEmail,
        selectedSender,
        recipientCurrency,
        parseFloat(amount),
        exchangeRate
      )

      setSuccess('Money sent successfully!')
      setAmount('')
      setReceiverAmount('0')
      setRecipientEmail('')
      setStep(1)
      setTimeout(() => {
        setSuccess('')
        loadData()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to send money')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">📤 Send Money</h2>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Send Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            <form onSubmit={handleSendMoney} className="space-y-6">
              {/* Step Indicator */}
              <div className="flex items-center space-x-4 mb-8">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  1
                </div>
                <div className="flex-1 h-1 bg-gray-200"></div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  2
                </div>
                <div className="flex-1 h-1 bg-gray-200"></div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  3
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Select Sender Account</h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">From Account</label>
                    <select
                      value={selectedSender}
                      onChange={e => setSelectedSender(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {wallets.map(wallet => (
                        <option key={wallet.id} value={wallet.currency_code}>
                          {wallet.currency_code} - Balance: {wallet.balance.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Next
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Recipient & Currency</h3>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Email</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Currency</label>
                    <select
                      value={recipientCurrency}
                      onChange={e => setRecipientCurrency(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {currencies.map(curr => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Enter Amount</h3>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Amount ({selectedSender})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-lg"
                    />
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Recipient Receives</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {receiverAmount} {recipientCurrency}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Exchange Rate: 1 {selectedSender} = {exchangeRate.toFixed(4)} {recipientCurrency}
                    </p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-semibold text-gray-700">Fee</p>
                    <p className="text-lg font-bold text-gray-900">1% + {selectedSender}</p>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                    >
                      {sending ? 'Sending...' : 'Send Money'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Beneficiaries Sidebar */}
        <div className="space-y-6">
          {/* Quick Beneficiaries */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Recipients</h3>
            <div className="space-y-2">
              {beneficiaries.length === 0 ? (
                <p className="text-gray-500 text-sm">No saved beneficiaries yet</p>
              ) : (
                beneficiaries.slice(0, 5).map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setRecipientEmail(b.recipient_email)
                      setStep(2)
                    }}
                    className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <p className="font-semibold text-gray-900 text-sm">{b.recipient_name}</p>
                    <p className="text-xs text-gray-500">{b.recipient_email}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Add New Beneficiary */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Beneficiary</h3>
            <form onSubmit={handleAddBeneficiary} className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
