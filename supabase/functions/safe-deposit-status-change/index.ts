import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

interface SafeDepositStatusChangeRequest {
  depositId: string
  newStatus: 'approved' | 'rejected' | 'completed' | 'pending'
  adminId: string
  adminEmail?: string
  reason?: string
  notes?: Record<string, any>
  idempotencyKey?: string
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
    const body = await req.json() as SafeDepositStatusChangeRequest

    const {
      depositId,
      newStatus,
      adminId,
      adminEmail = 'system',
      reason = '',
      notes = {},
      idempotencyKey = crypto.randomUUID()
    } = body

    // Validate inputs
    if (!depositId || !newStatus) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: depositId, newStatus' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const validStatuses = ['approved', 'rejected', 'completed', 'pending']
    if (!validStatuses.includes(newStatus)) {
      return new Response(
        JSON.stringify({ error: `Invalid status: ${newStatus}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Check for idempotency - prevent duplicate operations
    const { data: existingAudit } = await supabase
      .from('deposit_audit_log')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()
      .catch(() => ({ data: null }))

    if (existingAudit) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Operation already completed (idempotent)',
          deposit: { id: depositId },
          auditLog: existingAudit
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Fetch current deposit
    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single()

    if (fetchError || !deposit) {
      return new Response(
        JSON.stringify({ error: 'Deposit not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Validate state transition
    const validTransitions: Record<string, string[]> = {
      'pending': ['approved', 'rejected', 'cancelled'],
      'approved': ['pending', 'completed', 'rejected'],
      'completed': ['pending'],
      'rejected': ['pending'],
      'cancelled': ['pending']
    }

    const allowedTransitions = validTransitions[deposit.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      return new Response(
        JSON.stringify({
          error: `Invalid status transition: ${deposit.status} -> ${newStatus}. ` +
                 `Allowed: ${allowedTransitions.join(', ')}`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Step 4: Record status history
    const { error: historyError } = await supabase
      .from('deposit_status_history')
      .insert([{
        deposit_id: depositId,
        user_id: deposit.user_id,
        old_status: deposit.status,
        new_status: newStatus,
        changed_by: adminId,
        reason: reason || null,
        notes: notes || null
      }])

    if (historyError) {
      console.warn('[SafeDepositStatusChange] Failed to record status history:', historyError)
    }

    // Step 5: Determine wallet impact
    let walletImpact = null
    let shouldUpdateWallet = false

    if (newStatus === 'approved' && deposit.status === 'pending') {
      shouldUpdateWallet = true
      walletImpact = await calculateWalletImpact(supabase, deposit.wallet_id, deposit.amount, 'credit')
    } else if (deposit.status === 'approved' && newStatus === 'pending') {
      shouldUpdateWallet = true
      walletImpact = await calculateWalletImpact(supabase, deposit.wallet_id, deposit.amount, 'debit')
    }

    // Step 6: Update deposit with optimistic locking
    const currentVersion = deposit.version || 1
    const nextVersion = currentVersion + 1

    const updatePayload: any = {
      status: newStatus,
      version: nextVersion,
      idempotency_key: idempotencyKey,
      updated_at: new Date().toISOString()
    }

    if (newStatus === 'approved') {
      updatePayload.approved_by = adminId
      updatePayload.approved_at = new Date().toISOString()
    }

    if (newStatus === 'pending' && deposit.status === 'approved') {
      updatePayload.reversal_reason = reason
    }

    const { data: updatedDeposit, error: updateError } = await supabase
      .from('deposits')
      .update(updatePayload)
      .eq('id', depositId)
      .eq('version', currentVersion)
      .select()
      .single()

    if (updateError) {
      if (updateError.message?.includes('duplicate') || updateError.message?.includes('version')) {
        return new Response(
          JSON.stringify({
            error: 'Deposit was modified concurrently. Please refresh and try again.',
            details: updateError.message
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      throw updateError
    }

    // Step 7: Update wallet if needed
    if (shouldUpdateWallet && walletImpact) {
      await updateWalletBalance(supabase, deposit.wallet_id, walletImpact, depositId, adminId)
    }

    // Step 8: Create audit log
    const { data: auditLog, error: auditError } = await supabase
      .from('deposit_audit_log')
      .insert([{
        deposit_id: depositId,
        user_id: deposit.user_id,
        wallet_id: deposit.wallet_id,
        action: newStatus === 'pending' ? 'reverse' : newStatus,
        old_state: {
          status: deposit.status,
          amount: deposit.amount,
          version: currentVersion
        },
        new_state: {
          status: newStatus,
          amount: deposit.amount,
          version: nextVersion
        },
        wallet_impact: walletImpact,
        admin_id: adminId,
        admin_email: adminEmail,
        idempotency_key: idempotencyKey,
        status: 'success',
        network_sync_version: nextVersion,
        completed_at: new Date().toISOString()
      }])
      .select()
      .single()

    // Step 9: Create reversal registry if needed
    if (newStatus === 'pending' && deposit.status === 'approved') {
      await supabase
        .from('deposit_reversal_registry')
        .insert([{
          original_deposit_id: depositId,
          reason: reason || 'manual_revert',
          reversed_by: adminId,
          original_balance: walletImpact?.balance_before,
          reversal_balance: walletImpact?.balance_after,
          status: 'active'
        }])
        .catch(() => null)
    }

    // Step 10: Update state lock
    await supabase
      .from('deposit_state_lock')
      .upsert({
        deposit_id: depositId,
        version: nextVersion,
        locked_by: adminId,
        is_locked: false,
        last_modified_at: new Date().toISOString()
      })
      .catch(() => null)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deposit status changed from '${deposit.status}' to '${newStatus}'`,
        deposit: updatedDeposit,
        auditLog: auditLog || { idempotency_key: idempotencyKey },
        walletImpact: walletImpact
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SafeDepositStatusChange] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function calculateWalletImpact(
  supabase: any,
  walletId: string,
  amount: number | string,
  operation: 'credit' | 'debit'
): Promise<any> {
  const { data: wallet, error } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('id', walletId)
    .single()

  if (error || !wallet) {
    throw new Error(`Wallet not found: ${walletId}`)
  }

  const balanceBefore = parseFloat(wallet.balance as string)
  const amountChange = parseFloat(amount as string)
  const balanceAfter = operation === 'credit'
    ? balanceBefore + amountChange
    : balanceBefore - amountChange

  if (operation === 'debit' && balanceAfter < 0) {
    throw new Error(
      `Insufficient balance. Current: ${balanceBefore}, Required: ${amountChange}`
    )
  }

  return {
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    amount_changed: operation === 'credit' ? amountChange : -amountChange,
    operation,
    wallet_id: walletId
  }
}

async function updateWalletBalance(
  supabase: any,
  walletId: string,
  impact: any,
  depositId: string,
  adminId: string
) {
  // Update wallet balance
  const { error: balanceError } = await supabase
    .from('wallets')
    .update({
      balance: impact.balance_after,
      updated_at: new Date().toISOString()
    })
    .eq('id', walletId)

  if (balanceError) {
    throw new Error(`Failed to update wallet balance: ${balanceError.message}`)
  }

  // Record wallet transaction
  await supabase
    .from('wallet_transactions')
    .insert([{
      wallet_id: walletId,
      type: impact.operation === 'credit' ? 'deposit' : 'deposit_reversal',
      amount: impact.amount_changed,
      balance_before: impact.balance_before,
      balance_after: impact.balance_after,
      description: impact.operation === 'credit'
        ? `Deposit approved: ${impact.amount_changed}`
        : `Deposit reversed: ${-impact.amount_changed}`,
      reference_id: depositId
    }])
    .catch(() => null)

  // Record reconciliation
  await supabase
    .from('wallet_balance_reconciliation')
    .insert([{
      wallet_id: walletId,
      balance_before: impact.balance_before,
      balance_after: impact.balance_after,
      reconciliation_type: impact.operation === 'credit' ? 'deposit_approval' : 'deposit_reversal',
      admin_id: adminId,
      reason: `Deposit ${impact.operation}`,
      status: 'completed',
      completed_at: new Date().toISOString()
    }])
    .catch(() => null)
}

// Serve the handler
Deno.serve(handler)
