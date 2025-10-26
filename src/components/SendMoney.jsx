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
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center text-slate-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h2 className="text-3xl font-light text-slate-900 mb-12 tracking-tight">Send Money</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Send Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <form onSubmit={handleSendMoney} className="space-y-8">
              {/* Step Indicator */}
              <div className="flex items-center space-x-4">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      s <= step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {s}
                    </div>
                    {s < 3 && <div className={`flex-1 h-1 mx-2 ${s < step ? 'bg-blue-600' : 'bg-slate-200'}`}></div>}
                  </div>
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Select Sender Account</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">From Account</label>
                    <select
                      value={selectedSender}
                      onChange={e => setSelectedSender(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Next
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Recipient & Currency</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Email</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Currency</label>
                    <select
                      value={recipientCurrency}
                      onChange={e => setRecipientCurrency(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                      className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-900">Enter Amount</h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Amount ({selectedSender})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg"
                    />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-xs text-slate-600 font-medium uppercase tracking-wider mb-1">Recipient Receives</p>
                    <p className="text-3xl font-light text-slate-900">
                      {receiverAmount} {recipientCurrency}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Rate: 1 {selectedSender} = {exchangeRate.toFixed(4)} {recipientCurrency}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <p className="text-sm font-medium text-slate-700">Transfer Fee</p>
                    <p className="text-lg font-light text-slate-900 mt-1">1% of amount</p>
                  </div>

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
                      disabled={sending}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
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
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Recent Recipients</h3>
            <div className="space-y-2">
              {beneficiaries.length === 0 ? (
                <p className="text-slate-500 text-sm">No saved recipients yet</p>
              ) : (
                beneficiaries.slice(0, 5).map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setRecipientEmail(b.recipient_email)
                      setStep(2)
                    }}
                    className="w-full text-left p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors text-sm"
                  >
                    <p className="font-medium text-slate-900">{b.recipient_name}</p>
                    <p className="text-xs text-slate-500 mt-1">{b.recipient_email}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Add Recipient</h3>
            <form onSubmit={handleAddBeneficiary} className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
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
