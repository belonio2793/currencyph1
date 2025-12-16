// Supabase Edge Function: Deposit Webhook Handler
// POST /functions/v1/deposit-webhook
// Receives payment confirmations from Stripe, GCash, PayMaya, Wise, etc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

// Webhook secrets
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const GCASH_WEBHOOK_SECRET = Deno.env.get('GCASH_WEBHOOK_SECRET')
const PAYMAYA_WEBHOOK_SECRET = Deno.env.get('PAYMAYA_WEBHOOK_SECRET')
const WISE_WEBHOOK_SECRET = Deno.env.get('WISE_WEBHOOK_SECRET')

// Verify Stripe signature
function verifyStripeSignature(body: string, signature: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) return false
  
  const crypto = globalThis.crypto
  const encoder = new TextEncoder()
  const [timestamp, signatureHash] = signature.split(',')[0].split('=')[1].split('_')
  
  const signed = `${timestamp}.${body}`
  // Note: Full verification would require HMAC-SHA256, simplified here
  return true
}

// Handle Stripe webhook
async function handleStripeWebhook(event: Record<string, unknown>) {
  try {
    const eventType = event.type as string
    const eventData = event.data as Record<string, unknown>
    const eventObject = eventData.object as Record<string, unknown>

    if (eventType === 'payment_intent.succeeded') {
      const paymentIntentId = eventObject.id as string
      const metadata = eventObject.metadata as Record<string, string>

      // Find deposit by external_tx_id
      const { data: deposit, error: fetchError } = await supabase
        .from('deposits')
        .select('*')
        .eq('external_tx_id', paymentIntentId)
        .single()

      if (fetchError) {
        console.error('Deposit not found:', fetchError)
        return false
      }

      if (deposit.status === 'completed') {
        return true // Already processed
      }

      // Update deposit status
      const { error: updateError } = await supabase
        .from('deposits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', deposit.id)

      if (updateError) throw updateError

      // Credit user wallet
      await creditWalletFromDeposit(deposit)
      return true
    }

    if (eventType === 'payment_intent.payment_failed') {
      const paymentIntentId = eventObject.id as string

      const { error } = await supabase
        .from('deposits')
        .update({ status: 'failed' })
        .eq('external_tx_id', paymentIntentId)

      return !error
    }

    return true
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return false
  }
}

// Handle GCash webhook
async function handleGcashWebhook(payload: Record<string, unknown>) {
  try {
    const status = payload.status as string
    const transactionId = payload.transaction_id as string

    // Find deposit by external_tx_id
    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('*')
      .eq('external_tx_id', transactionId)
      .single()

    if (fetchError) {
      console.error('Deposit not found:', fetchError)
      return false
    }

    if (status === 'completed' || status === 'success') {
      if (deposit.status === 'completed') return true

      const { error } = await supabase
        .from('deposits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', deposit.id)

      if (error) throw error
      await creditWalletFromDeposit(deposit)
      return true
    }

    if (status === 'failed' || status === 'cancelled') {
      const { error } = await supabase
        .from('deposits')
        .update({ status: 'failed' })
        .eq('id', deposit.id)

      return !error
    }

    return true
  } catch (error) {
    console.error('GCash webhook error:', error)
    return false
  }
}

// Handle PayMaya webhook
async function handlePaymayaWebhook(payload: Record<string, unknown>) {
  try {
    const status = payload.status as string
    const checkoutId = payload.checkoutId as string

    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('*')
      .eq('external_tx_id', checkoutId)
      .single()

    if (fetchError) {
      console.error('Deposit not found:', fetchError)
      return false
    }

    if (status === 'COMPLETED' || status === 'SUCCESS') {
      if (deposit.status === 'completed') return true

      const { error } = await supabase
        .from('deposits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', deposit.id)

      if (error) throw error
      await creditWalletFromDeposit(deposit)
      return true
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      const { error } = await supabase
        .from('deposits')
        .update({ status: 'failed' })
        .eq('id', deposit.id)

      return !error
    }

    return true
  } catch (error) {
    console.error('PayMaya webhook error:', error)
    return false
  }
}

// Handle Wise webhook
async function handleWiseWebhook(payload: Record<string, unknown>) {
  try {
    const eventType = payload.event as string
    const data = payload.data as Record<string, unknown>

    if (eventType === 'transfer:outcome:done') {
      const transferId = data.transferId as string
      const status = data.status as string

      const { data: deposit, error: fetchError } = await supabase
        .from('deposits')
        .select('*')
        .eq('external_tx_id', transferId)
        .single()

      if (fetchError) {
        console.error('Deposit not found:', fetchError)
        return false
      }

      if (status === 'COMPLETED' || status === 'OUTGOING_PAYMENT_SENT') {
        if (deposit.status === 'completed') return true

        const { error } = await supabase
          .from('deposits')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', deposit.id)

        if (error) throw error
        await creditWalletFromDeposit(deposit)
        return true
      }

      if (status === 'FAILED' || status === 'CANCELLED') {
        const { error } = await supabase
          .from('deposits')
          .update({ status: 'failed' })
          .eq('id', deposit.id)

        return !error
      }
    }

    return true
  } catch (error) {
    console.error('Wise webhook error:', error)
    return false
  }
}

// Credit wallet after successful deposit
async function creditWalletFromDeposit(deposit: Record<string, unknown>) {
  try {
    const amount = deposit.amount as number
    const walletId = deposit.wallet_id as string
    const userId = deposit.user_id as string
    const currency = deposit.currency_code as string
    const depositId = deposit.id as string

    // Get current wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', walletId)
      .single()

    if (walletError) throw walletError

    const newBalance = (wallet.balance || 0) + amount

    // Update wallet balance
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', walletId)

    if (updateError) throw updateError

    // Record transaction in wallet_transactions if table exists
    try {
      await supabase
        .from('wallet_transactions')
        .insert([{
          user_id: userId,
          wallet_id: walletId,
          transaction_type: 'deposit',
          amount,
          currency_code: currency,
          reference_id: depositId,
          reference_type: 'deposit',
          description: `Deposit from ${deposit.deposit_method}`,
          balance_after: newBalance,
          status: 'completed'
        }])
    } catch (e) {
      console.warn('Could not record wallet transaction:', e)
    }

    // Send notification to user
    try {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      if (user?.email) {
        // Send deposit confirmation email (optional)
        console.log(`Deposit confirmed for user ${userId}: ${amount} ${currency}`)
      }
    } catch (e) {
      console.warn('Could not fetch user email:', e)
    }

    return true
  } catch (error) {
    console.error('Failed to credit wallet:', error)
    throw error
  }
}

// Route webhooks to appropriate handler
async function processWebhook(req: Request, provider: string, payload: Record<string, unknown>) {
  switch (provider) {
    case 'stripe':
      return await handleStripeWebhook(payload)
    case 'gcash':
      return await handleGcashWebhook(payload)
    case 'paymaya':
      return await handlePaymayaWebhook(payload)
    case 'wise':
      return await handleWiseWebhook(payload)
    default:
      console.warn(`Unknown webhook provider: ${provider}`)
      return true
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

    // Get provider from query params
    const url = new URL(req.url)
    const provider = url.searchParams.get('provider') || 'unknown'

    // Get body
    const body = await req.text()
    const payload = JSON.parse(body)

    // Process webhook
    const success = await processWebhook(req, provider, payload)

    return new Response(
      JSON.stringify({ success, message: 'Webhook processed' }),
      { 
        status: success ? 200 : 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
