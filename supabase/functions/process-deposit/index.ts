// Supabase Edge Function: Process Deposits
// POST /functions/v1/process-deposit
// Handles deposits from all payment methods: Stripe, GCash, PayMaya, Crypto, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

interface DepositRequest {
  userId: string
  walletId: string
  amount: number
  currency: string
  depositMethod: string
  methodDetails: Record<string, unknown>
  userEmail: string
  userName: string
  webhookUrl: string
}

interface DepositResponse {
  success: boolean
  depositId?: string
  paymentReference?: string
  externalId?: string
  redirectUrl?: string
  qrCode?: string
  bankDetails?: Record<string, unknown>
  message: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

// Payment provider credentials
const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')
const GCASH_API_KEY = Deno.env.get('GCASH_API_KEY')
const PAYMAYA_API_KEY = Deno.env.get('PAYMAYA_API_KEY')
const WISE_API_KEY = Deno.env.get('WISE_API_KEY')
const REMITLY_API_KEY = Deno.env.get('REMITLY_API_KEY')
const OPEN_EXCHANGE_RATES_API = Deno.env.get('OPEN_EXCHANGE_RATES_API')

// Crypto to CoinGecko ID mapping
const coingeckoIds: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'DOT': 'polkadot',
  'BCH': 'bitcoin-cash',
  'LTC': 'litecoin',
  'USDC': 'usd-coin',
  'LINK': 'chainlink',
  'MATIC': 'matic-network',
  'UNI': 'uniswap',
  'AVAX': 'avalanche-2',
  'TON': 'the-open-network',
  'HBAR': 'hedera-hashgraph',
  'SUI': 'sui',
  'TRX': 'tron',
  'XLM': 'stellar'
}

// Generate unique deposit reference
function generateDepositReference(method: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${method.toUpperCase()}-${timestamp}-${random}`
}

// Get crypto price in PHP using CoinGecko API
async function getCryptoPriceInPHP(cryptoCode: string): Promise<{
  price: number
  source: string
} | null> {
  try {
    const coingeckoId = coingeckoIds[cryptoCode] || cryptoCode.toLowerCase()
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=php`,
      {
        signal: AbortSignal.timeout(5000)
      }
    )

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`)
      return null
    }

    const data = (await response.json()) as Record<string, { php: number }>
    const price = data[coingeckoId]?.php

    if (price) {
      return { price, source: 'coingecko' }
    }
    return null
  } catch (error) {
    console.error(`Failed to get crypto price from CoinGecko:`, error)
    return null
  }
}

// Convert fiat currency to PHP using Open Exchange Rates
async function convertToPhp(amount: number, fromCurrency: string): Promise<{
  convertedAmount: number
  exchangeRate: number
  source: string
} | null> {
  if (fromCurrency === 'PHP') {
    return { convertedAmount: amount, exchangeRate: 1, source: 'identity' }
  }

  try {
    if (!OPEN_EXCHANGE_RATES_API) {
      console.warn('Open Exchange Rates API key not configured')
      return null
    }

    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_RATES_API}&base=${fromCurrency}&symbols=PHP`,
      {
        signal: AbortSignal.timeout(5000)
      }
    )

    if (!response.ok) {
      console.error(`Open Exchange Rates API error: ${response.status}`)
      return null
    }

    const data = (await response.json()) as Record<string, any>
    const exchangeRate = data.rates?.PHP || 1

    return {
      convertedAmount: amount * exchangeRate,
      exchangeRate,
      source: 'openexchangerates'
    }
  } catch (error) {
    console.error(`Failed to convert ${fromCurrency} to PHP:`, error)
    return null
  }
}

// Process Stripe deposit
async function processStripeDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    if (!STRIPE_SECRET) {
      throw new Error('Stripe not configured')
    }

    const paymentReference = generateDepositReference('STRIPE')

    // Create Stripe payment intent
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: `${Math.round(request.amount * 100)}`,
        currency: request.currency.toLowerCase(),
        description: `Deposit for ${request.userName}`,
        metadata: JSON.stringify({
          userId: request.userId,
          walletId: request.walletId,
          depositReference: paymentReference
        })
      })
    })

    if (!stripeResponse.ok) {
      throw new Error(`Stripe API error: ${stripeResponse.statusText}`)
    }

    const stripeData = await stripeResponse.json()

    // Calculate received amount if currency is not PHP
    let receivedAmount: number | null = null
    let exchangeRate: number | null = null
    let rateSource = 'openexchangerates'

    if (request.currency !== 'PHP') {
      const conversionResult = await convertToPhp(request.amount, request.currency)
      if (conversionResult) {
        receivedAmount = conversionResult.convertedAmount
        exchangeRate = conversionResult.exchangeRate
        rateSource = conversionResult.source
      }
    }

    // Store deposit intent
    const depositData: Record<string, any> = {
      user_id: request.userId,
      wallet_id: request.walletId,
      amount: request.amount,
      currency_code: request.currency,
      deposit_method: 'stripe',
      status: 'processing',
      payment_reference: paymentReference,
      external_tx_id: stripeData.id
    }

    // Add conversion details if available
    if (receivedAmount !== null && exchangeRate !== null && request.currency !== 'PHP') {
      depositData.received_amount = receivedAmount
      depositData.exchange_rate = exchangeRate
      depositData.rate_source = rateSource
      depositData.rate_fetched_at = new Date().toISOString()
    }

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([depositData])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      externalId: stripeData.id,
      redirectUrl: `https://checkout.stripe.com/pay/${stripeData.client_secret}`,
      message: 'Stripe payment initiated. Redirect user to checkout URL.'
    }
  } catch (error) {
    console.error('Stripe deposit error:', error)
    return {
      success: false,
      message: `Stripe deposit failed: ${error.message}`
    }
  }
}

// Process GCash deposit
async function processGcashDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    if (!GCASH_API_KEY) {
      throw new Error('GCash not configured')
    }

    const phoneNumber = request.methodDetails.phoneNumber as string
    const paymentReference = generateDepositReference('GCASH')

    // Create GCash payment request
    const gcashResponse = await fetch('https://api.gcash.com/v1/payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GCASH_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: request.amount,
        currency: request.currency,
        phone: phoneNumber,
        description: `Deposit for ${request.userName}`,
        reference: paymentReference,
        callback_url: request.webhookUrl
      })
    })

    if (!gcashResponse.ok) {
      throw new Error(`GCash API error: ${gcashResponse.statusText}`)
    }

    const gcashData = await gcashResponse.json()

    // Calculate received amount if currency is not PHP
    let receivedAmount: number | null = null
    let exchangeRate: number | null = null
    let rateSource = 'openexchangerates'

    if (request.currency !== 'PHP') {
      const conversionResult = await convertToPhp(request.amount, request.currency)
      if (conversionResult) {
        receivedAmount = conversionResult.convertedAmount
        exchangeRate = conversionResult.exchangeRate
        rateSource = conversionResult.source
      }
    }

    // Store deposit
    const depositData: Record<string, any> = {
      user_id: request.userId,
      wallet_id: request.walletId,
      amount: request.amount,
      currency_code: request.currency,
      deposit_method: 'gcash',
      status: 'pending',
      payment_reference: paymentReference,
      external_tx_id: gcashData.transaction_id,
      phone_number: phoneNumber,
      qr_code_data: gcashData.qr_code || null
    }

    // Add conversion details if available
    if (receivedAmount !== null && exchangeRate !== null && request.currency !== 'PHP') {
      depositData.received_amount = receivedAmount
      depositData.exchange_rate = exchangeRate
      depositData.rate_source = rateSource
      depositData.rate_fetched_at = new Date().toISOString()
    }

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([depositData])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      externalId: gcashData.transaction_id,
      qrCode: gcashData.qr_code,
      message: 'GCash QR code generated. Show QR to user or send payment link via SMS.'
    }
  } catch (error) {
    console.error('GCash deposit error:', error)
    return {
      success: false,
      message: `GCash deposit failed: ${error.message}`
    }
  }
}

// Process PayMaya deposit
async function processPaymayaDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    if (!PAYMAYA_API_KEY) {
      throw new Error('PayMaya not configured')
    }

    const paymentReference = generateDepositReference('PAYMAYA')

    // Create PayMaya checkout
    const paymayaResponse = await fetch('https://pg.paymaya.com/api/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(PAYMAYA_API_KEY + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        totalAmount: {
          value: request.amount,
          currency: request.currency
        },
        buyer: {
          email: request.userEmail,
          firstName: request.userName.split(' ')[0],
          lastName: request.userName.split(' ')[1] || 'User'
        },
        metadata: {
          deposit_id: paymentReference
        },
        redirectUrl: {
          success: `${Deno.env.get('VITE_PROJECT_URL')}/deposit-success?ref=${paymentReference}`,
          failure: `${Deno.env.get('VITE_PROJECT_URL')}/deposit-failed?ref=${paymentReference}`,
          cancel: `${Deno.env.get('VITE_PROJECT_URL')}/deposit-cancelled?ref=${paymentReference}`
        }
      })
    })

    if (!paymayaResponse.ok) {
      throw new Error(`PayMaya API error: ${paymayaResponse.statusText}`)
    }

    const paymayaData = await paymayaResponse.json()

    // Calculate received amount if currency is not PHP
    let receivedAmount: number | null = null
    let exchangeRate: number | null = null
    let rateSource = 'openexchangerates'

    if (request.currency !== 'PHP') {
      const conversionResult = await convertToPhp(request.amount, request.currency)
      if (conversionResult) {
        receivedAmount = conversionResult.convertedAmount
        exchangeRate = conversionResult.exchangeRate
        rateSource = conversionResult.source
      }
    }

    // Store deposit
    const depositData: Record<string, any> = {
      user_id: request.userId,
      wallet_id: request.walletId,
      amount: request.amount,
      currency_code: request.currency,
      deposit_method: 'paymaya',
      status: 'pending',
      payment_reference: paymentReference,
      external_tx_id: paymayaData.checkoutId
    }

    // Add conversion details if available
    if (receivedAmount !== null && exchangeRate !== null && request.currency !== 'PHP') {
      depositData.received_amount = receivedAmount
      depositData.exchange_rate = exchangeRate
      depositData.rate_source = rateSource
      depositData.rate_fetched_at = new Date().toISOString()
    }

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([depositData])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      externalId: paymayaData.checkoutId,
      redirectUrl: paymayaData.redirectUrl,
      message: 'PayMaya checkout created. Redirect user to payment page.'
    }
  } catch (error) {
    console.error('PayMaya deposit error:', error)
    return {
      success: false,
      message: `PayMaya deposit failed: ${error.message}`
    }
  }
}

// Process direct cryptocurrency deposit
async function processCryptoDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    const paymentReference = generateDepositReference('CRYPTO')
    const { cryptoSymbol, chainId } = request.methodDetails

    // Generate or get user's deposit address for this chain
    const { data: cryptoWallet, error: walletError } = await supabase
      .from('wallets_crypto')
      .select('address')
      .eq('user_id', request.userId)
      .eq('chain_id', chainId)
      .single()

    if (walletError && walletError.code !== 'PGRST116') {
      throw walletError
    }

    let depositAddress = cryptoWallet?.address

    if (!depositAddress) {
      // Create new crypto wallet for this chain
      const { data: newWallet, error: createError } = await supabase
        .from('wallets_crypto')
        .insert([{
          user_id: request.userId,
          chain: request.methodDetails.chain || 'ethereum',
          chain_id: chainId,
          provider: 'system_generated'
        }])
        .select('address')
        .single()

      if (createError) throw createError
      depositAddress = newWallet.address
    }

    // Get crypto price in PHP to calculate received amount
    let receivedAmount: number | null = null
    let exchangeRate: number | null = null
    let rateSource = 'coingecko'

    const priceData = await getCryptoPriceInPHP(cryptoSymbol as string)
    if (priceData) {
      exchangeRate = priceData.price
      receivedAmount = request.amount * exchangeRate
      rateSource = priceData.source
    }

    // Store deposit with conversion details
    const depositData: Record<string, any> = {
      user_id: request.userId,
      wallet_id: request.walletId,
      amount: request.amount,
      currency_code: cryptoSymbol as string,
      deposit_method: 'crypto_direct',
      status: 'pending',
      payment_reference: paymentReference,
      payment_address: depositAddress,
      description: `Direct ${cryptoSymbol} transfer expected`
    }

    // Add conversion details if available
    if (receivedAmount !== null && exchangeRate !== null) {
      depositData.received_amount = receivedAmount
      depositData.exchange_rate = exchangeRate
      depositData.rate_source = rateSource
      depositData.rate_fetched_at = new Date().toISOString()
    }

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([depositData])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      bankDetails: {
        depositAddress,
        chainId,
        cryptoSymbol,
        amount: request.amount,
        memo: paymentReference,
        estimatedPhpValue: receivedAmount ? Math.floor(receivedAmount) : 'Unknown',
        exchangeRate: exchangeRate || 'Unknown'
      },
      message: receivedAmount
        ? `Send ${request.amount} ${cryptoSymbol} to provided address (≈ ${Math.floor(receivedAmount).toLocaleString()} PHP at current rate). Include memo for tracking.`
        : `Send ${request.amount} ${cryptoSymbol} to provided address. Include memo for tracking.`
    }
  } catch (error) {
    console.error('Crypto deposit error:', error)
    return {
      success: false,
      message: `Crypto deposit failed: ${error.message}`
    }
  }
}

// Process bank transfer deposit
async function processBankTransferDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    const paymentReference = generateDepositReference('BANK')

    // Get system bank account details (from settings or hardcoded)
    const bankDetails = {
      accountName: 'Currency PH Inc.',
      bankName: request.currency === 'PHP' ? 'BPI' : 'SWIFT Bank',
      accountNumber: '1234567890',
      routingNumber: '000000000',
      swiftCode: 'BPIBPHMMXXX',
      iban: 'PH00BPIB0001234567890',
      reference: paymentReference,
      memo: `Deposit: ${request.userName} - ${paymentReference}`
    }

    // Calculate received amount if currency is not PHP
    let receivedAmount: number | null = null
    let exchangeRate: number | null = null
    let rateSource = 'openexchangerates'

    if (request.currency !== 'PHP') {
      const conversionResult = await convertToPhp(request.amount, request.currency)
      if (conversionResult) {
        receivedAmount = conversionResult.convertedAmount
        exchangeRate = conversionResult.exchangeRate
        rateSource = conversionResult.source
      }
    }

    // Store deposit
    const depositData: Record<string, any> = {
      user_id: request.userId,
      wallet_id: request.walletId,
      amount: request.amount,
      currency_code: request.currency,
      deposit_method: 'bank_transfer',
      status: 'pending',
      payment_reference: paymentReference,
      description: `Bank transfer deposit of ${request.amount} ${request.currency}`
    }

    // Add conversion details if available and currency is not PHP
    if (receivedAmount !== null && exchangeRate !== null && request.currency !== 'PHP') {
      depositData.received_amount = receivedAmount
      depositData.exchange_rate = exchangeRate
      depositData.rate_source = rateSource
      depositData.rate_fetched_at = new Date().toISOString()
    }

    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([depositData])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      bankDetails,
      message: 'Bank transfer details provided. Send payment and include reference for tracking.'
    }
  } catch (error) {
    console.error('Bank transfer deposit error:', error)
    return {
      success: false,
      message: `Bank transfer setup failed: ${error.message}`
    }
  }
}

// Process Wise transfer
async function processWiseDeposit(
  request: DepositRequest
): Promise<DepositResponse> {
  try {
    if (!WISE_API_KEY) {
      throw new Error('Wise not configured')
    }

    const paymentReference = generateDepositReference('WISE')

    // Create Wise quote
    const quoteResponse = await fetch('https://api.wise.com/v1/quotes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WISE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceCurrency: request.currency,
        targetCurrency: request.currency,
        sourceAmount: request.amount
      })
    })

    if (!quoteResponse.ok) {
      throw new Error(`Wise API error: ${quoteResponse.statusText}`)
    }

    const quoteData = await quoteResponse.json()

    // Store deposit
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
        user_id: request.userId,
        wallet_id: request.walletId,
        amount: request.amount,
        currency_code: request.currency,
        deposit_method: 'wise',
        status: 'pending',
        payment_reference: paymentReference,
        external_tx_id: quoteData.id
      }])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      externalId: quoteData.id,
      message: 'Wise quote created. User can proceed with transfer.'
    }
  } catch (error) {
    console.error('Wise deposit error:', error)
    return {
      success: false,
      message: `Wise deposit failed: ${error.message}`
    }
  }
}

// Process modern fintech method (stub - coming soon)
async function processModernFintechDeposit(
  request: DepositRequest,
  providerName: string
): Promise<DepositResponse> {
  try {
    const paymentReference = generateDepositReference(providerName.toUpperCase())

    // Store deposit with "coming_soon" status
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
        user_id: request.userId,
        wallet_id: request.walletId,
        amount: request.amount,
        currency_code: request.currency,
        deposit_method: request.depositMethod,
        status: 'pending',
        payment_reference: paymentReference,
        description: `${providerName} deposit (Coming Soon) - ${request.amount} ${request.currency}`
      }])
      .select()
      .single()

    if (depositError) throw depositError

    return {
      success: true,
      depositId: deposit.id,
      paymentReference,
      message: `${providerName} integration is coming soon! We'll notify you when it's ready. Your deposit request has been saved.`
    }
  } catch (error) {
    console.error(`${providerName} deposit error:`, error)
    return {
      success: false,
      message: `${providerName} deposit setup failed: ${error.message}`
    }
  }
}

// Route to appropriate processor based on method
async function processDeposit(request: DepositRequest): Promise<DepositResponse> {
  switch (request.depositMethod) {
    case 'stripe':
      return await processStripeDeposit(request)
    case 'gcash':
      return await processGcashDeposit(request)
    case 'paymaya':
      return await processPaymayaDeposit(request)
    case 'crypto_direct':
      return await processCryptoDeposit(request)
    case 'bank_transfer':
      return await processBankTransferDeposit(request)
    case 'wise':
      return await processWiseDeposit(request)
    case 'instapay':
      return await processBankTransferDeposit(request)
    case 'remitly':
      return await processBankTransferDeposit(request)
    case 'coins_ph':
      return await processBankTransferDeposit(request)

    // Modern Fintech Methods (Coming Soon)
    case 'dlocal':
      return await processModernFintechDeposit(request, 'dLocal')
    case 'circle':
      return await processModernFintechDeposit(request, 'Circle')
    case 'flutterwave':
      return await processModernFintechDeposit(request, 'Flutterwave')
    case 'checkout':
      return await processModernFintechDeposit(request, 'Checkout.com')
    case 'moonpay':
      return await processModernFintechDeposit(request, 'MoonPay')
    case 'ramp':
      return await processModernFintechDeposit(request, 'Ramp')
    case 'binance_pay':
      return await processModernFintechDeposit(request, 'Binance Pay')
    case 'crypto_com_pay':
      return await processModernFintechDeposit(request, 'Crypto.com Pay')

    default:
      return {
        success: false,
        message: `Unsupported deposit method: ${request.depositMethod}`
      }
  }
}

// Main handler
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: CORS_HEADERS }
      )
    }

    const depositRequest = (await req.json()) as DepositRequest

    // Validate required fields
    if (!depositRequest.userId || !depositRequest.walletId || !depositRequest.amount || !depositRequest.currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Process deposit
    const result = await processDeposit(depositRequest)

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Deposit processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
