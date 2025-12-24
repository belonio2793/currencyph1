/**
 * Deposit Validation Service
 * Performs all calculations and validations on the client before sending to database
 * This prevents malformed SQL queries and RLS policy violations
 */

/**
 * Validate deposit input data
 */
export function validateDepositInput(amount, selectedCurrency, selectedWallet) {
  const errors = []

  // Validate amount
  if (!amount || isNaN(parseFloat(amount))) {
    errors.push('Invalid amount - must be a number')
  } else if (parseFloat(amount) <= 0) {
    errors.push('Amount must be greater than 0')
  }

  // Validate currency
  if (!selectedCurrency || typeof selectedCurrency !== 'string' || selectedCurrency.trim() === '') {
    errors.push('Invalid currency selected')
  }

  // Validate currency code format (alphanumeric only, max 10 chars)
  if (!/^[A-Z0-9]{1,10}$/.test(selectedCurrency)) {
    errors.push('Currency code format is invalid')
  }

  // Validate wallet
  if (!selectedWallet || typeof selectedWallet !== 'string' || selectedWallet.trim() === '') {
    errors.push('No wallet selected')
  }

  // Validate wallet ID is UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(selectedWallet)) {
    errors.push('Invalid wallet ID format')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate wallet and currency compatibility
 */
export function validateWalletCurrency(wallet, selectedCurrency) {
  const errors = []

  if (!wallet) {
    errors.push('Wallet not found')
    return { isValid: false, errors }
  }

  if (!wallet.currency_code) {
    errors.push('Wallet has no currency')
    return { isValid: false, errors }
  }

  // For fiat deposits, currency must match wallet
  if (wallet.currency_type === 'fiat' && wallet.currency_code !== selectedCurrency) {
    errors.push(`Wallet currency (${wallet.currency_code}) does not match deposit currency (${selectedCurrency})`)
  }

  // For crypto deposits, currency must match wallet
  if (wallet.currency_type === 'crypto' && wallet.currency_code !== selectedCurrency) {
    errors.push(`Cannot deposit ${selectedCurrency} into ${wallet.currency_code} wallet`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate exchange rates before conversion
 */
export function validateExchangeRates(fromRate, toRate, fromCurrency, toCurrency) {
  const errors = []

  if (!fromRate || typeof fromRate !== 'number' || fromRate <= 0 || !isFinite(fromRate)) {
    errors.push(`Invalid exchange rate for ${fromCurrency}: ${fromRate}`)
  }

  if (!toRate || typeof toRate !== 'number' || toRate <= 0 || !isFinite(toRate)) {
    errors.push(`Invalid exchange rate for ${toCurrency}: ${toRate}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Calculate converted amount with validation
 * Returns { amount, isValid, error }
 */
export function calculateConvertedAmount(
  inputAmount,
  fromCurrency,
  fromRate,
  toCurrency,
  toRate,
  depositType = 'fiat'
) {
  // Validate inputs
  const numAmount = parseFloat(inputAmount)
  if (isNaN(numAmount) || numAmount <= 0) {
    return {
      amount: null,
      isValid: false,
      error: 'Invalid input amount'
    }
  }

  // Same currency - no conversion
  if (fromCurrency === toCurrency) {
    return {
      amount: Math.round(numAmount * 100) / 100,
      isValid: true,
      conversionRate: 1,
      note: 'No conversion - same currency'
    }
  }

  // Validate rates
  const rateValidation = validateExchangeRates(fromRate, toRate, fromCurrency, toCurrency)
  if (!rateValidation.isValid) {
    return {
      amount: null,
      isValid: false,
      error: rateValidation.errors[0]
    }
  }

  let convertedAmount
  let conversionRate

  try {
    if (depositType === 'cryptocurrency') {
      // For crypto to fiat: amount * rate
      // For crypto to crypto: (amount / fromRate) * toRate
      if (isFiatCurrency(toCurrency)) {
        // Crypto to fiat: use fromRate directly as it's price in fiat
        convertedAmount = numAmount * fromRate
        conversionRate = fromRate / toRate
      } else {
        // Crypto to crypto: (amount / fromRate) * toRate
        convertedAmount = (numAmount / fromRate) * toRate
        conversionRate = toRate / fromRate
      }
    } else {
      // Fiat to fiat (or fiat to crypto): (amount / fromRate) * toRate
      convertedAmount = (numAmount / fromRate) * toRate
      conversionRate = toRate / fromRate
    }

    // Validate converted amount
    if (!isFinite(convertedAmount) || convertedAmount <= 0) {
      return {
        amount: null,
        isValid: false,
        error: 'Conversion resulted in invalid amount',
        debug: { inputAmount: numAmount, fromRate, toRate, convertedAmount }
      }
    }

    // Round to 2 decimal places for fiat, 8 for crypto
    const decimals = isFiatCurrency(toCurrency) ? 2 : 8
    const rounded = Math.round(convertedAmount * Math.pow(10, decimals)) / Math.pow(10, decimals)

    return {
      amount: rounded,
      isValid: true,
      conversionRate: Math.round(conversionRate * 1000000) / 1000000, // 6 decimal places
      note: `1 ${fromCurrency} = ${conversionRate.toFixed(6)} ${toCurrency}`
    }
  } catch (error) {
    return {
      amount: null,
      isValid: false,
      error: `Calculation error: ${error.message}`
    }
  }
}

/**
 * Build deposit record for database insertion with all validations
 */
export function buildDepositRecord(params) {
  const {
    userId,
    walletId,
    amount,
    selectedCurrency,
    walletCurrency,
    convertedAmount,
    conversionRate,
    depositMethod,
    activeType,
    gcashReferenceNumber,
    networkInfo
  } = params

  const errors = []

  // Validate required fields
  if (!userId || typeof userId !== 'string') errors.push('Invalid user ID')
  if (!walletId || !/^[0-9a-f-]{36}$/i.test(walletId)) errors.push('Invalid wallet ID')
  if (!amount || isNaN(amount) || amount <= 0) errors.push('Invalid amount')
  if (!selectedCurrency || !/^[A-Z0-9]{1,10}$/.test(selectedCurrency)) errors.push('Invalid currency code')
  if (!walletCurrency || !/^[A-Z0-9]{1,10}$/.test(walletCurrency)) errors.push('Invalid wallet currency')
  if (!depositMethod || typeof depositMethod !== 'string') errors.push('Invalid deposit method')
  if (!activeType || !['currency', 'cryptocurrency'].includes(activeType)) errors.push('Invalid deposit type')

  if (errors.length > 0) {
    return { isValid: false, errors, record: null }
  }

  // Build the record
  const record = {
    user_id: userId,
    wallet_id: walletId,
    amount: parseFloat(amount),
    currency_code: walletCurrency,
    original_currency: selectedCurrency,
    deposit_method: depositMethod,
    status: 'pending',
    received_amount: convertedAmount ? parseFloat(convertedAmount) : parseFloat(amount),
    conversion_rate: conversionRate ? parseFloat(conversionRate) : 1,
    created_at: new Date().toISOString(),
    description: `${activeType} deposit of ${amount} ${selectedCurrency}${convertedAmount ? ` (converted to ${convertedAmount} ${walletCurrency})` : ''}`
  }

  // Add optional fields safely
  if (activeType === 'currency' && gcashReferenceNumber) {
    record.phone_number = gcashReferenceNumber.trim()
  }

  if (activeType === 'cryptocurrency' && networkInfo) {
    record.network = networkInfo.network || null
    record.provider = networkInfo.provider || null
  }

  // Build notes object
  const notes = {
    original_currency: selectedCurrency,
    wallet_currency: walletCurrency,
    deposit_type: activeType,
    converted_amount: convertedAmount,
    conversion_rate: conversionRate,
    created_at: new Date().toISOString()
  }

  if (networkInfo) {
    notes.network = networkInfo.network
    notes.provider = networkInfo.provider
  }

  record.notes = JSON.stringify(notes)

  return {
    isValid: true,
    errors: [],
    record
  }
}

/**
 * Validate GCash reference number
 */
export function validateGCashReference(reference) {
  if (!reference) return { isValid: false, error: 'GCash reference is required' }

  const trimmed = reference.trim()
  if (trimmed.length < 5 || trimmed.length > 50) {
    return { isValid: false, error: 'Invalid reference number length' }
  }

  // Basic format validation - alphanumeric and dashes/spaces
  if (!/^[A-Z0-9\s\-]{5,}$/i.test(trimmed)) {
    return { isValid: false, error: 'Invalid reference number format' }
  }

  return { isValid: true, value: trimmed }
}

/**
 * Helper: Check if currency is fiat or crypto
 */
function isFiatCurrency(currencyCode) {
  const fiatCurrencies = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'PHP', 'INR', 'AUD', 'CAD', 'SGD', 'HKD',
    'IDR', 'MYR', 'THB', 'VND', 'KRW', 'ZAR', 'BRL', 'MXN', 'NOK', 'DKK', 'AED'
  ])
  return fiatCurrencies.has(currencyCode?.toUpperCase())
}

/**
 * Sanitize string inputs to prevent injection
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input

  return input
    .trim()
    .substring(0, 255) // Limit length
    .replace(/[^\w\s\-\.@]/g, '') // Remove special characters except common ones
}

/**
 * Validate complete deposit before submission
 */
export function validateCompleteDeposit(depositData) {
  const errors = []

  // Check all required fields
  const requiredFields = [
    'userId',
    'walletId',
    'amount',
    'selectedCurrency',
    'walletCurrency',
    'depositMethod',
    'activeType'
  ]

  for (const field of requiredFields) {
    if (!depositData[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Type validations
  if (depositData.amount && (isNaN(depositData.amount) || depositData.amount <= 0)) {
    errors.push('Amount must be a positive number')
  }

  if (depositData.selectedCurrency && !/^[A-Z0-9]{1,10}$/.test(depositData.selectedCurrency)) {
    errors.push('Invalid currency format')
  }

  if (depositData.activeType === 'currency' && !depositData.depositMethod) {
    errors.push('Payment method is required for fiat deposits')
  }

  if (depositData.activeType === 'currency' && depositData.depositMethod === 'gcash') {
    if (!depositData.gcashReferenceNumber) {
      errors.push('GCash reference number is required')
    } else {
      const gcashValidation = validateGCashReference(depositData.gcashReferenceNumber)
      if (!gcashValidation.isValid) {
        errors.push(gcashValidation.error)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
