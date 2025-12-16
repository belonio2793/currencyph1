import React, { useState, useEffect } from 'react'
import { useSupabaseContext } from '../context/SupabaseContext'
import DepositService, { DEPOSIT_METHODS, CURRENCY_CODES } from '../lib/depositService'
import './UniversalDeposit.css'

export default function UniversalDeposit({ onSuccess, onClose }) {
  // State management
  const { supabase } = useSupabaseContext()
  const [step, setStep] = useState('method') // method, amount, confirm, processing
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [userCountry, setUserCountry] = useState('US')
  const [availableMethods, setAvailableMethods] = useState([])
  const [otherMethods, setOtherMethods] = useState([])
  const [depositService, setDepositService] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [depositResult, setDepositResult] = useState(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [showOtherMethodsDropdown, setShowOtherMethodsDropdown] = useState(false)
  const [otherMethodsSearch, setOtherMethodsSearch] = useState('')
  const [filteredOtherMethods, setFilteredOtherMethods] = useState([])

  // Initialize service
  useEffect(() => {
    const initializeService = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')

        const service = new DepositService(supabase)
        await service.initialize(user.id)
        setDepositService(service)

        // Load available methods
        const methodsData = service.getAvailableMethods(userCountry, currency)
        setAvailableMethods(methodsData.methods)
        setOtherMethods(methodsData.otherMethods)
        setFilteredOtherMethods(methodsData.otherMethods)
      } catch (err) {
        setError(err.message)
      }
    }

    initializeService()
  }, [supabase, userCountry, currency])

  // Get method details
  const getMethodDetails = (methodId) => {
    return depositService?.getMethodDetails(methodId, currency) || null
  }

  // Handle method selection
  const handleSelectMethod = async (methodId) => {
    const methodDetail = getMethodDetails(methodId)

    if (methodDetail?.comingSoon) {
      setError(`${methodDetail.name} is coming soon! We'll notify you when it's available.`)
      return
    }

    setSelectedMethod(methodId)
    setError(null)
    setShowOtherMethodsDropdown(false)
    setStep('amount')
  }

  // Handle search in other methods
  const handleOtherMethodsSearch = (query) => {
    setOtherMethodsSearch(query)

    if (!query.trim()) {
      setFilteredOtherMethods(otherMethods)
      return
    }

    const filtered = otherMethods.filter(method =>
      method.name.toLowerCase().includes(query.toLowerCase()) ||
      method.description.toLowerCase().includes(query.toLowerCase()) ||
      (method.regions && method.regions.some(r => r.toLowerCase().includes(query.toLowerCase())))
    )

    setFilteredOtherMethods(filtered)
  }

  // Handle amount submission
  const handleSubmitAmount = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    const methodDetails = getMethodDetails(selectedMethod)
    if (!methodDetails) {
      setError('Invalid payment method')
      return
    }

    if (parseFloat(amount) < methodDetails.minAmount || parseFloat(amount) > methodDetails.maxAmount) {
      setError(`Amount must be between ${methodDetails.minAmount} and ${methodDetails.maxAmount}`)
      return
    }

    // Validate deposit
    const validation = await depositService.validateDeposit(
      parseFloat(amount),
      currency,
      selectedMethod
    )

    if (!validation.valid) {
      setError(`Deposit limit exceeded. Daily: ${validation.dailyUsed}/${validation.limits.daily}, Monthly: ${validation.monthlyUsed}/${validation.limits.monthly}`)
      return
    }

    setError(null)
    setStep('confirm')
  }

  // Handle deposit confirmation and processing
  const handleConfirmDeposit = async () => {
    if (!depositService || !selectedMethod) {
      setError('Service not initialized')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const methodDetails = {
        phoneNumber,
        bankCode,
        accountNumber,
        amount: parseFloat(amount),
        currency
      }

      const result = await depositService.initiateDeposit(
        parseFloat(amount),
        currency,
        selectedMethod,
        methodDetails
      )

      if (result.success) {
        setDepositResult(result)
        setSuccess(`Deposit initiated successfully! Reference: ${result.paymentReference}`)
        setStep('processing')

        // Redirect to payment URL if applicable
        if (result.redirectUrl) {
          setTimeout(() => {
            window.location.href = result.redirectUrl
          }, 2000)
        }
      } else {
        setError(result.message || 'Failed to initiate deposit')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Render method selection step
  const renderMethodSelection = () => (
    <div className="deposit-step">
      <h2>Choose Payment Method</h2>
      <div className="method-grid">
        {availableMethods.map((method) => (
          <div
            key={method.id}
            className="method-card"
            onClick={() => handleSelectMethod(method.id)}
          >
            <div className="method-icon">{method.icon}</div>
            <div className="method-name">{method.name}</div>
            <div className="method-description">{method.description}</div>
            <div className="method-time">{method.processingTime}</div>
            <div className="method-fee">{method.fees}</div>
          </div>
        ))}
      </div>

      <div className="other-methods-section">
        <h3>Other Payment Methods</h3>
        <p className="section-description">Modern fintech & crypto payment options</p>

        <div className="other-methods-dropdown">
          <div className="dropdown-header" onClick={() => setShowOtherMethodsDropdown(!showOtherMethodsDropdown)}>
            <span className="dropdown-title">🌍 Browse All Options (8+ Methods)</span>
            <span className={`dropdown-arrow ${showOtherMethodsDropdown ? 'open' : ''}`}>▼</span>
          </div>

          {showOtherMethodsDropdown && (
            <div className="dropdown-content">
              <input
                type="text"
                className="dropdown-search"
                placeholder="Search by name, region... (dLocal, Flutterwave, Circle, etc.)"
                value={otherMethodsSearch}
                onChange={(e) => handleOtherMethodsSearch(e.target.value)}
                autoFocus
              />

              {filteredOtherMethods.length > 0 ? (
                <div className="other-methods-list">
                  {filteredOtherMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`other-method-item ${method.comingSoon ? 'coming-soon' : ''}`}
                      onClick={() => !method.comingSoon && handleSelectMethod(method.id)}
                    >
                      <div className="method-item-header">
                        <span className="method-icon">{method.icon}</span>
                        <div className="method-info">
                          <div className="method-name">{method.name}</div>
                          {method.comingSoon && <span className="coming-soon-badge">Coming Soon</span>}
                        </div>
                      </div>
                      <div className="method-item-details">
                        <span className="fee">{method.fees}</span>
                        <span className="time">{method.processingTime}</span>
                      </div>
                      <p className="method-description">{method.description}</p>
                      {method.regions && (
                        <div className="method-regions">
                          {method.regions.map((region, idx) => (
                            <span key={idx} className="region-tag">{region}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  No payment methods found matching "{otherMethodsSearch}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="country-selector">
        <label>Country:</label>
        <select value={userCountry} onChange={(e) => setUserCountry(e.target.value)}>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="PH">Philippines</option>
          <option value="SG">Singapore</option>
          <option value="AU">Australia</option>
          <option value="GB">United Kingdom</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="MX">Mexico</option>
          <option value="BR">Brazil</option>
        </select>
      </div>
    </div>
  )

  // Render amount input step
  const renderAmountInput = () => {
    const method = getMethodDetails(selectedMethod)
    if (!method) return null

    return (
      <div className="deposit-step">
        <button className="back-button" onClick={() => setStep('method')}>← Back</button>
        <h2>{method.name}</h2>
        <p className="method-description">{method.description}</p>

        <div className="amount-form">
          <div className="form-group">
            <label>Amount ({currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${method.minAmount}, Max: ${method.maxAmount}`}
              min={method.minAmount}
              max={method.maxAmount}
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {method.currencies.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>

          {selectedMethod === DEPOSIT_METHODS.GCASH && (
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09xxxxxxxxx"
              />
            </div>
          )}

          {selectedMethod === DEPOSIT_METHODS.INSTAPAY && (
            <>
              <div className="form-group">
                <label>Bank</label>
                <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                  <option value="">Select Bank</option>
                  <option value="BPI">BPI</option>
                  <option value="BDO">BDO</option>
                  <option value="METROBANK">Metrobank</option>
                  <option value="PNB">PNB</option>
                  <option value="RCBC">RCBC</option>
                </select>
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account Number"
                />
              </div>
            </>
          )}

          <div className="fee-summary">
            <p>Processing time: <strong>{method.processingTime}</strong></p>
            <p>Fee: <strong>{method.fees}</strong></p>
            {amount && (
              <p className="total">Total you'll send: <strong>{amount} {currency}</strong></p>
            )}
          </div>

          <button
            className="continue-button"
            onClick={handleSubmitAmount}
            disabled={!amount || loading}
          >
            Continue to Confirmation
          </button>
        </div>
      </div>
    )
  }

  // Render confirmation step
  const renderConfirmation = () => {
    const method = getMethodDetails(selectedMethod)
    if (!method) return null

    return (
      <div className="deposit-step">
        <button className="back-button" onClick={() => setStep('amount')}>← Back</button>
        <h2>Confirm Deposit</h2>

        <div className="confirmation-details">
          <div className="detail-row">
            <span className="label">Payment Method:</span>
            <span className="value">{method.name}</span>
          </div>
          <div className="detail-row">
            <span className="label">Amount:</span>
            <span className="value">{amount} {currency}</span>
          </div>
          <div className="detail-row">
            <span className="label">Processing Time:</span>
            <span className="value">{method.processingTime}</span>
          </div>
          <div className="detail-row">
            <span className="label">Fees:</span>
            <span className="value">{method.fees}</span>
          </div>
        </div>

        <div className="confirmation-actions">
          <button
            className="confirm-button"
            onClick={handleConfirmDeposit}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm & Proceed'}
          </button>
          <button className="cancel-button" onClick={() => setStep('amount')} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Render processing step
  const renderProcessing = () => {
    const method = getMethodDetails(selectedMethod)
    if (!method) return null

    return (
      <div className="deposit-step processing">
        <div className="success-icon">✓</div>
        <h2>Deposit Initiated</h2>
        <p className="success-message">{success}</p>

        {depositResult?.bankDetails && (
          <div className="bank-details">
            <h3>Bank Transfer Details</h3>
            <div className="detail-row">
              <span className="label">Account Name:</span>
              <span className="value">{depositResult.bankDetails.accountName}</span>
            </div>
            <div className="detail-row">
              <span className="label">Bank:</span>
              <span className="value">{depositResult.bankDetails.bankName}</span>
            </div>
            <div className="detail-row">
              <span className="label">Account Number:</span>
              <span className="value">{depositResult.bankDetails.accountNumber}</span>
            </div>
            <div className="detail-row">
              <span className="label">Reference:</span>
              <span className="value font-mono">{depositResult.bankDetails.reference}</span>
            </div>
            <button className="copy-button" onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(depositResult.bankDetails))
              alert('Details copied!')
            }}>
              Copy Details
            </button>
          </div>
        )}

        {depositResult?.qrCode && (
          <div className="qr-code">
            <h3>Scan to Pay</h3>
            <img src={depositResult.qrCode} alt="Payment QR Code" />
          </div>
        )}

        {depositResult?.redirectUrl && (
          <p className="redirect-notice">Redirecting to payment page...</p>
        )}

        <button className="close-button" onClick={onClose || (() => setStep('method'))}>
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="universal-deposit-modal">
      <div className="deposit-container">
        <button className="close-icon" onClick={onClose}>×</button>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {step === 'method' && renderMethodSelection()}
        {step === 'amount' && renderAmountInput()}
        {step === 'confirm' && renderConfirmation()}
        {step === 'processing' && renderProcessing()}
      </div>
    </div>
  )
}
