import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

interface SafeDepositApprovalRequest {
  depositId: string
  adminId?: string
  adminEmail?: string
  reason?: string
  receivedAmount?: number
  exchangeRate?: number
}

interface SafeDepositApprovalResponse {
  success: boolean
  deposit?: any
  transaction?: any
  stateTransition?: any
  reconciliation?: any
  warnings?: string[]
  message: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function handler(req: Request): Promise<Response> {
  // Handle CORS
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
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: SafeDepositApprovalRequest = await req.json()
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
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        }
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
        {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 2: Validate deposit state
    if (deposit.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: `Cannot approve deposit with status: ${deposit.status}`,
          deposit
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 3: Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance, currency_code, user_id')
      .eq('id', deposit.wallet_id)
      .single()

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        }
      )
    }

    // Step 4: Calculate credit amount
    const creditAmount = receivedAmount ? parseFloat(String(receivedAmount)) : parseFloat(String(deposit.amount))
    const newWalletBalance = parseFloat(String(wallet.balance)) + creditAmount

    // Step 5: Update deposit status
    const { data: updatedDeposit, error: updateError } = await supabase
      .from('deposits')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        received_amount: creditAmount,
        exchange_rate: exchangeRate,
        completed_at: new Date().toISOString()
      })
      .eq('id', depositId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update deposit: ${updateError.message}`)
    }

    // Step 6: Update wallet balance
    const { error: balanceError } = await supabase
      .from('wallets')
      .update({
        balance: newWalletBalance,
        total_deposited: (parseFloat(String(wallet.balance)) > 0 ? parseFloat(String(wallet.balance)) : 0) + creditAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet.id)

    if (balanceError) {
      throw new Error(`Failed to update wallet balance: ${balanceError.message}`)
    }

    // Step 7: Record state transition
    const { data: stateTransition, error: stateError } = await supabase
      .from('deposit_state_transitions')
      .insert([{
        deposit_id: depositId,
        user_id: deposit.user_id,
        wallet_id: wallet.id,
        previous_state: 'pending',
        new_state: 'approved',
        reason: reason,
        admin_id: adminId,
        admin_email: adminEmail,
        amount_usd: deposit.amount,
        exchange_rate: exchangeRate,
        balance_before: wallet.balance,
        balance_after: newWalletBalance,
        balance_adjustment: creditAmount
      }])
      .select()
      .single()

    if (stateError) {
      console.error('Warning: Failed to record state transition:', stateError)
    }

    // Step 8: Create wallet transaction
    const { data: walletTx, error: txError } = await supabase
      .from('wallet_transactions')
      .insert([{
        wallet_id: wallet.id,
        user_id: deposit.user_id,
        type: 'deposit',
        amount: creditAmount,
        balance_before: wallet.balance,
        balance_after: newWalletBalance,
        currency_code: deposit.currency_code,
        description: `Deposit approved: ${creditAmount} ${deposit.currency_code}${exchangeRate !== 1 ? ` (rate: ${exchangeRate})` : ''}`,
        reference_id: depositId,
        metadata: {
          original_amount: deposit.amount,
          original_currency: deposit.currency_code,
          exchange_rate: exchangeRate,
          admin_id: adminId,
          admin_email: adminEmail
        }
      }])
      .select()
      .single()

    if (txError) {
      console.error('Warning: Failed to record wallet transaction:', txError)
    }

    // Step 9: Create transaction mapping
    if (walletTx) {
      await supabase
        .from('deposit_transaction_mapping')
        .insert([{
          deposit_id: depositId,
          wallet_transaction_id: walletTx.id,
          transaction_type: 'approval',
          transaction_state: 'approved',
          amount: creditAmount,
          currency_code: deposit.currency_code
        }])
        .catch(err => console.error('Warning: Failed to create transaction mapping:', err))
    }

    // Step 10: Create audit log
    const { error: auditError } = await supabase
      .from('deposit_audit_log')
      .insert([{
        deposit_id: depositId,
        user_id: deposit.user_id,
        operation: 'deposit_approved',
        status: 'success',
        previous_state: { status: 'pending' },
        new_state: { status: 'approved' },
        wallet_impact: {
          balance_before: wallet.balance,
          balance_after: newWalletBalance,
          credited_amount: creditAmount
        },
        admin_id: adminId,
        admin_email: adminEmail
      }])
      .catch(err => console.error('Warning: Failed to create audit log:', err))

    // Step 11: Reconcile wallet balance
    const { data: deposits_for_calc } = await supabase
      .from('deposits')
      .select('amount, received_amount, status')
      .eq('wallet_id', wallet.id)
      .catch(() => ({ data: [] }))

    let expectedBalance = 0
    deposits_for_calc?.forEach((dep: any) => {
      if (dep.status === 'approved' || dep.status === 'completed') {
        expectedBalance += dep.received_amount || dep.amount
      } else if (dep.status === 'reversed') {
        expectedBalance -= dep.received_amount || dep.amount
      }
    })

    const discrepancy = newWalletBalance - expectedBalance
    const isBalanced = Math.abs(discrepancy) < 0.01

    const { error: reconError } = await supabase
      .from('wallet_balance_audit')
      .insert([{
        wallet_id: wallet.id,
        user_id: deposit.user_id,
        audit_type: 'automatic',
        balance_before: wallet.balance,
        balance_after: newWalletBalance,
        expected_balance: expectedBalance,
        calculation_method: 'sum_of_approved_deposits',
        status: isBalanced ? 'resolved' : 'pending',
        approved_by: adminId,
        metadata: {
          discrepancy: discrepancy,
          is_balanced: isBalanced
        }
      }])
      .catch(err => console.error('Warning: Failed to record reconciliation:', err))

    // Return success response
    const response: SafeDepositApprovalResponse = {
      success: true,
      deposit: updatedDeposit,
      transaction: walletTx,
      stateTransition: stateTransition,
      reconciliation: {
        isBalanced: isBalanced,
        actualBalance: newWalletBalance,
        expectedBalance: expectedBalance,
        discrepancy: discrepancy
      },
      warnings: [
        stateError ? 'Failed to record state transition' : null,
        txError ? 'Failed to record wallet transaction' : null,
        auditError ? 'Failed to create audit log' : null
      ].filter(Boolean) as string[],
      message: 'Deposit approved and wallet credited with full reconciliation'
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Deposit approval error:', error)
    const errorResponse = {
      success: false,
      message: 'Deposit approval failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      warnings: []
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
}

Deno.serve(handler)
