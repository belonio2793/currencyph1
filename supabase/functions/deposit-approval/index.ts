import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

interface DepositApprovalRequest {
  depositId: string
  adminId?: string
  adminEmail?: string
  reason?: string
  receivedAmount?: number
  exchangeRate?: number
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing environment variables' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: DepositApprovalRequest = await req.json()
    const {
      depositId,
      adminId = null,
      adminEmail = 'system',
      reason = 'Admin approval',
      receivedAmount = null,
      exchangeRate = 1
    } = body

    if (!depositId) {
      return new Response(
        JSON.stringify({ error: 'Missing depositId' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Fetch deposit
    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single()

    if (fetchError || !deposit) {
      return new Response(
        JSON.stringify({ error: 'Deposit not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Validate state
    if (deposit.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: `Cannot approve deposit with status: ${deposit.status}`,
          deposit
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Calculate credit amount
    const creditAmount = receivedAmount ? parseFloat(String(receivedAmount)) : parseFloat(String(deposit.amount))

    // Step 4: Update deposit status
    const { data: updatedDeposit, error: updateError } = await supabase
      .from('deposits')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        received_amount: creditAmount,
        exchange_rate: exchangeRate
      })
      .eq('id', depositId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update deposit: ${updateError.message}`)
    }

    // Step 5: Create approval transaction in wallet_transactions
    // This will trigger the auto-credit function in the database
    const { data: transaction, error: txError } = await supabase
      .from('wallet_transactions')
      .insert([{
        wallet_id: deposit.wallet_id,
        user_id: deposit.user_id,
        type: 'deposit_approved',
        amount: creditAmount,
        currency_code: deposit.currency_code,
        note: 'approved',
        status: 'approved',
        reference_id: depositId,
        description: `Deposit approved: ${creditAmount} ${deposit.currency_code}`,
        metadata: {
          original_amount: deposit.amount,
          original_currency: deposit.currency_code,
          exchange_rate: exchangeRate,
          admin_id: adminId,
          admin_email: adminEmail,
          reason: reason,
          approved_at: new Date().toISOString()
        }
      }])
      .select()
      .single()

    if (txError) {
      throw new Error(`Failed to record approval transaction: ${txError.message}`)
    }

    // Step 6: Verify wallet balance
    const { data: verification } = await supabase
      .rpc('verify_wallet_balance', { p_wallet_id: deposit.wallet_id })
      .catch(() => ({ data: null }))

    // Return success response
    const response = {
      success: true,
      deposit: updatedDeposit,
      transaction: transaction,
      balanceVerification: verification?.[0] || null,
      message: 'Deposit approved and wallet credited'
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Deposit approval error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
}

Deno.serve(handler)
