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

// Generate unique deposit reference
function generateDepositReference(method: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${method.toUpperCase()}-${timestamp}-${random}`
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

    // Store deposit intent
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
        user_id: request.userId,
        wallet_id: request.walletId,
        amount: request.amount,
        currency_code: request.currency,
        deposit_method: 'stripe',
        status: 'processing',
        payment_reference: paymentReference,
        external_tx_id: stripeData.id
      }])
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

    // Store deposit
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
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
      }])
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

    // Store deposit
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
        user_id: request.userId,
        wallet_id: request.walletId,
        amount: request.amount,
        currency_code: request.currency,
        deposit_method: 'paymaya',
        status: 'pending',
        payment_reference: paymentReference,
        external_tx_id: paymayaData.checkoutId
      }])
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

    // Store deposit
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
        user_id: request.userId,
        wallet_id: request.walletId,
        amount: request.amount,
        currency_code: cryptoSymbol as string,
        deposit_method: 'crypto_direct',
        status: 'pending',
        payment_reference: paymentReference,
        payment_address: depositAddress,
        description: `Direct ${cryptoSymbol} transfer expected`
      }])
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
        memo: paymentReference
      },
      message: `Send ${request.amount} ${cryptoSymbol} to provided address. Include memo for tracking.`
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

    // Store deposit
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert([{
        user_id: request.userId,
        wallet_id: request.walletId,
        amount: request.amount,
        currency_code: request.currency,
        deposit_method: 'bank_transfer',
        status: 'pending',
        payment_reference: paymentReference,
        description: `Bank transfer deposit of ${request.amount} ${request.currency}`
      }])
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
      return await processBankTransferDeposit(request) // Use bank transfer for now
    case 'remitly':
      return await processBankTransferDeposit(request) // Use bank transfer for now
    case 'coins_ph':
      return await processBankTransferDeposit(request) // Use bank transfer for now
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
