import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

interface DepositApprovalRequest {
  depositId: string
  status: 'approved' | 'rejected'
  notes?: string
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json() as DepositApprovalRequest

    const { depositId, status, notes } = body

    if (!depositId || !status || !['approved', 'rejected'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the deposit details
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .select('id, user_id, wallet_id, amount, currency_code, status')
      .eq('id', depositId)
      .single()

    if (depositError || !deposit) {
      return new Response(
        JSON.stringify({ error: 'Deposit not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if deposit is in pending state
    if (deposit.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Cannot update deposit with status: ${deposit.status}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Update deposit status
    const newStatus = status === 'approved' ? 'completed' : 'failed'
    const { data: updatedDeposit, error: updateError } = await supabase
      .from('deposits')
      .update({
        status: status,
        notes: notes || null,
        completed_at: status === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', depositId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // If approved, credit the wallet
    if (status === 'approved') {
      // Get wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('id', deposit.wallet_id)
        .single()

      if (walletError || !wallet) {
        throw new Error('Wallet not found')
      }

      // Use received_amount (PHP equivalent) if available, otherwise use raw amount
      // This ensures crypto deposits are properly converted to PHP
      const creditAmount = deposit.received_amount
        ? parseFloat(deposit.received_amount)
        : parseFloat(deposit.amount)

      const depositAmountForDisplay = deposit.received_amount
        ? `${deposit.amount} ${deposit.currency_code} (${creditAmount} PHP)`
        : `${deposit.amount} ${deposit.currency_code}`

      // Update wallet balance
      const newBalance = parseFloat(wallet.balance) + creditAmount
      const { error: balanceError } = await supabase
        .from('wallets')
        .update({
          balance: newBalance,
          total_deposited: await getTotalDeposited(supabase, deposit.wallet_id, newBalance),
          updated_at: new Date().toISOString()
        })
        .eq('id', deposit.wallet_id)

      if (balanceError) {
        throw balanceError
      }

      // Record wallet transaction
      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: deposit.wallet_id,
          user_id: deposit.user_id,
          type: 'deposit',
          amount: creditAmount,
          balance_before: wallet.balance,
          balance_after: newBalance,
          currency_code: 'PHP',
          description: `Deposit approved: ${depositAmountForDisplay}`,
          reference_id: deposit.id,
          metadata: {
            original_amount: deposit.amount,
            original_currency: deposit.currency_code,
            exchange_rate: deposit.exchange_rate || null,
            received_amount: deposit.received_amount || null
          }
        })

      if (txError) {
        console.error('Failed to record transaction:', txError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deposit: updatedDeposit,
        message: status === 'approved' ? 'Deposit approved and wallet credited' : 'Deposit rejected'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error processing deposit approval:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

async function getTotalDeposited(
  supabase: any,
  walletId: string,
  currentBalance: number
): Promise<number> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('amount')
    .eq('wallet_id', walletId)
    .eq('type', 'deposit')

  if (error || !data) return currentBalance

  return data.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0)
}

// Serve the handler
Deno.serve(handler)
