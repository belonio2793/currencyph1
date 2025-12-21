import { supabase } from './supabaseClient'

/**
 * Universal Status Reversal Service
 * 
 * When a record's status reverts to 'pending', all associated transactions,
 * balance changes, and related records are automatically reversed to maintain
 * a source of truth across the system.
 */

export const statusReversalService = {
  /**
   * Reverse all changes when status reverts to 'pending'
   * @param {string} tableName - Table name (loans, orders, deposits, etc.)
   * @param {string} recordId - Record ID
   * @param {object} record - Full record data with previous state
   * @returns {Promise<object>} - Reversal results
   */
  async reverseStatusToPending(tableName, recordId, record) {
    const reversals = {
      reversed: true,
      table: tableName,
      recordId: recordId,
      operations: [],
      errors: []
    }

    try {
      switch (tableName) {
        case 'loans':
          reversals.operations.push(
            ...(await this.reverseLoanToPending(recordId, record))
          )
          break

        case 'orders':
        case 'shop_orders':
        case 'industrial_product_orders':
          reversals.operations.push(
            ...(await this.reverseOrderToPending(recordId, record))
          )
          break

        case 'deposits':
        case 'crypto_deposits':
          reversals.operations.push(
            ...(await this.reverseDepositsToPending(recordId, record))
          )
          break

        case 'payments':
        case 'shop_orders':
          reversals.operations.push(
            ...(await this.reversePaymentsToPending(recordId, record))
          )
          break

        case 'ride_requests':
        case 'ride_matches':
          reversals.operations.push(
            ...(await this.reverseRideToPending(recordId, record))
          )
          break

        case 'job_applications':
          reversals.operations.push(
            ...(await this.reverseJobApplicationToPending(recordId, record))
          )
          break

        case 'addresses_shipment_labels':
        case 'shipments':
          reversals.operations.push(
            ...(await this.reverseShipmentToPending(recordId, record))
          )
          break

        default:
          reversals.errors.push(`Unknown table: ${tableName}`)
      }

      // Log the reversal operation for audit trail
      await this.logReversalOperation(tableName, recordId, reversals)

      return reversals
    } catch (err) {
      console.error(`[StatusReversalService] Error reversing ${tableName}:`, err)
      reversals.errors.push(err.message)
      return reversals
    }
  },

  /**
   * Reverse loan disbursements, interest accrual, and payments
   */
  async reverseLoanToPending(loanId, loan) {
    const operations = []

    try {
      // 1. Revert disbursements - reverse wallet balance changes
      const { data: disbursements } = await supabase
        .from('loan_disbursements')
        .select('*')
        .eq('loan_id', loanId)
        .eq('status', 'completed')

      if (disbursements && disbursements.length > 0) {
        for (const disburse of disbursements) {
          // Reverse wallet transaction
          await supabase
            .from('wallet_transactions')
            .insert([{
              user_id: loan.user_id,
              wallet_id: disburse.wallet_id,
              transaction_type: 'reversal',
              amount: -disburse.amount,
              currency_code: disburse.currency_code,
              description: `Reversal of loan disbursement for loan ${loanId}`,
              reference_id: disburse.id
            }])

          // Update wallet balance
          await supabase.rpc('update_wallet_balance', {
            p_wallet_id: disburse.wallet_id,
            p_amount_change: -disburse.amount
          })

          operations.push({
            type: 'disbursement_reversal',
            amount: disburse.amount,
            walletId: disburse.wallet_id
          })
        }
      }

      // 2. Revert interest accrual
      const { data: interest } = await supabase
        .from('loan_interest_accrual')
        .select('*')
        .eq('loan_id', loanId)
        .neq('status', 'reversed')

      if (interest && interest.length > 0) {
        await supabase
          .from('loan_interest_accrual')
          .update({ status: 'reversed' })
          .eq('loan_id', loanId)

        operations.push({
          type: 'interest_accrual_reversal',
          count: interest.length
        })
      }

      // 3. Revert payments
      const { data: payments } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('loan_id', loanId)
        .eq('status', 'completed')

      if (payments && payments.length > 0) {
        for (const payment of payments) {
          // Reverse wallet transaction
          await supabase
            .from('wallet_transactions')
            .insert([{
              user_id: loan.user_id,
              wallet_id: payment.payment_wallet_id,
              transaction_type: 'reversal',
              amount: payment.amount,
              currency_code: loan.currency || 'PHP',
              description: `Reversal of loan payment for loan ${loanId}`,
              reference_id: payment.id
            }])

          // Update wallet balance
          if (payment.payment_wallet_id) {
            await supabase.rpc('update_wallet_balance', {
              p_wallet_id: payment.payment_wallet_id,
              p_amount_change: payment.amount
            })
          }
        }

        // Mark payments as reversed
        await supabase
          .from('loan_payments')
          .update({ status: 'reversed' })
          .eq('loan_id', loanId)

        operations.push({
          type: 'payment_reversal',
          count: payments.length
        })
      }

      // 4. Reset loan status fields
      await supabase
        .from('loans')
        .update({
          status: 'pending',
          amount_disbursed: 0,
          amount_paid: 0,
          total_interest: 0
        })
        .eq('id', loanId)

      operations.push({
        type: 'loan_reset',
        loanId: loanId
      })

    } catch (err) {
      console.error('[StatusReversalService] Error reversing loan:', err)
      throw err
    }

    return operations
  },

  /**
   * Reverse order inventory and payment changes
   */
  async reverseOrderToPending(orderId, order) {
    const operations = []

    try {
      // 1. Get order items and reverse inventory
      const { data: items } = await supabase
        .from('shop_order_items')
        .select('*')
        .eq('order_id', orderId)

      if (items && items.length > 0) {
        for (const item of items) {
          // Add inventory back
          await supabase.rpc('adjust_inventory', {
            p_product_id: item.product_id,
            p_quantity_change: item.quantity
          }).catch(() => {
            // If rpc doesn't exist, do manual update
            return supabase
              .from('shop_product_inventory')
              .update({
                available_quantity: supabase.raw(`available_quantity + ${item.quantity}`)
              })
              .eq('product_id', item.product_id)
          })

          operations.push({
            type: 'inventory_reversal',
            productId: item.product_id,
            quantity: item.quantity
          })
        }
      }

      // 2. Reverse payment if exists
      if (order.payment_status === 'completed') {
        await supabase
          .from('shop_orders')
          .update({ payment_status: 'pending' })
          .eq('id', orderId)

        operations.push({
          type: 'payment_status_reversal',
          orderId: orderId
        })
      }

      // 3. Reset order status
      await supabase
        .from('shop_orders')
        .update({ status: 'pending' })
        .eq('id', orderId)

      operations.push({
        type: 'order_reset',
        orderId: orderId
      })

    } catch (err) {
      console.error('[StatusReversalService] Error reversing order:', err)
      throw err
    }

    return operations
  },

  /**
   * Reverse deposit balance changes
   */
  async reverseDepositsToPending(depositId, deposit) {
    const operations = []

    try {
      // 1. Reverse wallet balance
      if (deposit.status === 'confirmed' || deposit.status === 'completed') {
        await supabase
          .from('wallet_transactions')
          .insert([{
            user_id: deposit.user_id,
            wallet_id: deposit.wallet_id,
            transaction_type: 'reversal',
            amount: -deposit.amount,
            currency_code: deposit.currency_code || 'PHP',
            description: `Reversal of deposit ${depositId}`,
            reference_id: depositId
          }])

        // Update wallet balance
        await supabase.rpc('update_wallet_balance', {
          p_wallet_id: deposit.wallet_id,
          p_amount_change: -deposit.amount
        }).catch(() => {
          // Fallback to direct update
          return supabase
            .from('wallets')
            .update({
              balance: supabase.raw(`balance - ${deposit.amount}`)
            })
            .eq('id', deposit.wallet_id)
        })

        operations.push({
          type: 'deposit_balance_reversal',
          amount: deposit.amount,
          walletId: deposit.wallet_id
        })
      }

      // 2. Reset deposit status
      await supabase
        .from('crypto_deposits')
        .update({ status: 'pending' })
        .eq('id', depositId)

      operations.push({
        type: 'deposit_reset',
        depositId: depositId
      })

    } catch (err) {
      console.error('[StatusReversalService] Error reversing deposit:', err)
      throw err
    }

    return operations
  },

  /**
   * Reverse payment transactions
   */
  async reversePaymentsToPending(paymentId, payment) {
    const operations = []

    try {
      // Only reverse if payment was actually completed
      if (payment.status === 'succeeded' || payment.status === 'completed') {
        // Create reversal transaction record
        await supabase
          .from('payments')
          .insert([{
            reference_number: `REVERSAL-${paymentId}`,
            guest_name: payment.guest_name,
            guest_email: payment.guest_email,
            amount: -payment.amount,
            fee_amount: payment.fee_amount,
            payment_type: 'reversal',
            payment_method: payment.payment_method,
            status: 'completed',
            customer_id: payment.customer_id,
            metadata: {
              original_payment_id: paymentId,
              reversal_reason: 'status_reverted_to_pending'
            }
          }])

        operations.push({
          type: 'payment_reversal_created',
          paymentId: paymentId,
          amount: payment.amount
        })
      }

      // Mark original as pending
      await supabase
        .from('payments')
        .update({ status: 'pending' })
        .eq('id', paymentId)

      operations.push({
        type: 'payment_status_reset',
        paymentId: paymentId
      })

    } catch (err) {
      console.error('[StatusReversalService] Error reversing payment:', err)
      throw err
    }

    return operations
  },

  /**
   * Reverse ride match and payment
   */
  async reverseRideToPending(rideId, ride) {
    const operations = []

    try {
      // 1. Revert payment if completed
      if (ride.payment_status === 'completed') {
        await supabase
          .from('ride_requests')
          .update({ payment_status: 'pending' })
          .eq('id', rideId)

        operations.push({
          type: 'ride_payment_reversal',
          rideId: rideId
        })
      }

      // 2. Reset match status if exists
      const { data: matches } = await supabase
        .from('ride_matches')
        .select('*')
        .eq('ride_id', rideId)
        .neq('status', 'cancelled')

      if (matches && matches.length > 0) {
        await supabase
          .from('ride_matches')
          .update({ status: 'pending' })
          .eq('ride_id', rideId)

        operations.push({
          type: 'ride_match_reset',
          count: matches.length
        })
      }

      // 3. Reset ride status
      await supabase
        .from('ride_requests')
        .update({ status: 'pending' })
        .eq('id', rideId)

      operations.push({
        type: 'ride_reset',
        rideId: rideId
      })

    } catch (err) {
      console.error('[StatusReversalService] Error reversing ride:', err)
      throw err
    }

    return operations
  },

  /**
   * Reverse job application status
   */
  async reverseJobApplicationToPending(applicationId, application) {
    const operations = []

    try {
      // Reset application status
      await supabase
        .from('job_applications')
        .update({
          status: 'pending',
          accepted_at: null
        })
        .eq('id', applicationId)

      operations.push({
        type: 'application_reset',
        applicationId: applicationId
      })

      // If job offer was accepted, revert that too
      if (application.job_offer_id) {
        await supabase
          .from('job_offers')
          .update({ status: 'pending' })
          .eq('id', application.job_offer_id)

        operations.push({
          type: 'job_offer_reset',
          jobOfferId: application.job_offer_id
        })
      }

    } catch (err) {
      console.error('[StatusReversalService] Error reversing job application:', err)
      throw err
    }

    return operations
  },

  /**
   * Reverse shipment status and tracking changes
   */
  async reverseShipmentToPending(shipmentId, shipment) {
    const operations = []

    try {
      // 1. Reset shipment status
      await supabase
        .from('addresses_shipment_labels')
        .update({ status: 'pending' })
        .eq('id', shipmentId)

      // 2. Clear tracking history for this shipment
      await supabase
        .from('addresses_shipment_tracking')
        .update({ status: 'reversed' })
        .eq('label_id', shipmentId)
        .neq('status', 'reversed')

      // 3. Restore cost to pending state
      if (shipment.cost_amount) {
        await supabase
          .from('addresses_route_cost_aggregates')
          .update({
            pending_amount: supabase.raw(`pending_amount + ${shipment.cost_amount}`)
          })
          .eq('route_id', shipment.route_id)
      }

      operations.push({
        type: 'shipment_reset',
        shipmentId: shipmentId
      })

    } catch (err) {
      console.error('[StatusReversalService] Error reversing shipment:', err)
      throw err
    }

    return operations
  },

  /**
   * Log all reversal operations for audit trail
   */
  async logReversalOperation(tableName, recordId, reversals) {
    try {
      await supabase
        .from('status_reversal_audit_log')
        .insert([{
          table_name: tableName,
          record_id: recordId,
          operations: reversals.operations,
          errors: reversals.errors,
          reversed_at: new Date().toISOString(),
          status: reversals.errors.length === 0 ? 'success' : 'partial_success'
        }]).catch(() => {
          // If audit table doesn't exist, just log to console
          console.log('[StatusReversalService] Audit log:', {
            table: tableName,
            recordId: recordId,
            operations: reversals.operations
          })
        })
    } catch (err) {
      console.warn('[StatusReversalService] Could not log reversal:', err)
    }
  }
}

export default statusReversalService
