import { supabase } from './supabaseClient'
import { depositStatusChangeService } from './depositStatusChangeService'
import { getLatestRateWithConfirmation, buildRateConfirmationMessage } from './rateConfirmationService'

/**
 * Service for managing deposit currency conversions
 * Handles conversion flow, confirmation, and audit trails
 * Now includes rate confirmations with timestamps for user display
 */
export class DepositConversionService {
  constructor(supabaseClient = supabase) {
    this.supabase = supabaseClient
  }

  /**
   * Check if a deposit needs conversion
   * @param {object} deposit - Deposit record from database
   * @param {object} wallet - Wallet record from database
   * @returns {Promise<boolean>}
   */
  async needsConversion(deposit, wallet) {
    if (!deposit || !wallet) return false
    return deposit.currency_code !== wallet.currency_code
  }

  /**
   * Get conversion details for a deposit
   * @param {object} deposit - Deposit record
   * @param {object} wallet - Wallet record
   * @returns {Promise<object>} Conversion details or null
   */
  async getConversionDetails(deposit, wallet) {
    if (deposit.currency_code === wallet.currency_code) {
      return null
    }

    try {
      const fromCode = deposit.currency_code.toUpperCase()
      const toCode = wallet.currency_code.toUpperCase()

      // Fetch rate from public.pairs (unified source for all rates)
      const { data: rateData, error: pairsError } = await this.supabase
        .from('pairs')
        .select('rate, source_table, updated_at')
        .eq('from_currency', fromCode)
        .eq('to_currency', toCode)
        .single()

      if (pairsError || !rateData || !(typeof rateData.rate === 'number' && isFinite(rateData.rate) && rateData.rate > 0)) {
        console.warn(`No exchange rate available for ${fromCode}/${toCode}`)
        return null
      }

      const rateSource = 'pairs'

      const exchangeRate = parseFloat(rateData.rate)
      const convertedAmount = deposit.amount * exchangeRate

      return {
        fromCurrency: deposit.currency_code,
        toCurrency: wallet.currency_code,
        originalAmount: deposit.amount,
        exchangeRate: exchangeRate,
        convertedAmount: convertedAmount,
        rateSource: rateSource,
        rateUpdatedAt: rateData.updated_at,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get conversion details:', error)
      return null
    }
  }

  /**
   * Get conversion details with rate confirmation for user display
   * Includes timestamp, source, and formatted rate information
   * @param {object} deposit - Deposit record
   * @param {object} wallet - Wallet record
   * @returns {Promise<object>} Conversion with confirmation or null
   */
  async getConversionWithConfirmation(deposit, wallet) {
    if (deposit.currency_code === wallet.currency_code) {
      return null
    }

    try {
      // Get rate confirmation with timestamp
      const rateConfirmation = await getLatestRateWithConfirmation(
        deposit.currency_code,
        wallet.currency_code
      )

      if (!rateConfirmation) {
        console.warn(`No rate confirmation available for ${deposit.currency_code}/${wallet.currency_code}`)
        return null
      }

      const convertedAmount = deposit.amount * rateConfirmation.rate
      const confirmationMessage = buildRateConfirmationMessage(rateConfirmation)

      return {
        fromCurrency: deposit.currency_code,
        toCurrency: wallet.currency_code,
        originalAmount: deposit.amount,
        exchangeRate: rateConfirmation.rate,
        convertedAmount: convertedAmount,
        rateSource: rateConfirmation.source,
        rateUpdatedAt: rateConfirmation.updated_at,
        timestamp: new Date().toISOString(),
        // New confirmation fields for user display
        confirmation: {
          rate_formatted: rateConfirmation.display.rate_formatted,
          converted_amount_formatted: `${convertedAmount.toFixed(2)} ${wallet.currency_code}`,
          timestamp_readable: rateConfirmation.timestamp.readable,
          minutes_ago: rateConfirmation.timestamp.minutes_ago,
          is_fresh: rateConfirmation.timestamp.is_current,
          confirmation_message: confirmationMessage.full_message,
          rate_source: rateConfirmation.source
        }
      }
    } catch (error) {
      console.error('Failed to get conversion with confirmation:', error)
      return null
    }
  }

  /**
   * Confirm a conversion for a deposit
   * @param {string} depositId - Deposit ID
   * @param {object} conversion - Conversion details
   * @returns {Promise<object>} Result with success status
   */
  async confirmConversion(depositId, conversion) {
    try {
      const { error } = await this.supabase
        .from('deposits')
        .update({
          received_amount: conversion.originalAmount,
          received_currency: conversion.fromCurrency,
          exchange_rate: conversion.exchangeRate,
          converted_amount: conversion.convertedAmount,
          conversion_status: 'confirmed'
        })
        .eq('id', depositId)

      if (error) {
        throw new Error(`Failed to confirm conversion: ${error.message}`)
      }

      // Record in audit trail
      await this.supabase
        .from('deposit_conversion_audit')
        .insert([{
          deposit_id: depositId,
          action: 'conversion_confirmed',
          received_amount: conversion.originalAmount,
          received_currency: conversion.fromCurrency,
          exchange_rate: conversion.exchangeRate,
          converted_amount: conversion.convertedAmount,
          wallet_currency: conversion.toCurrency,
          notes: `Rate source: ${conversion.rateSource}, Updated: ${conversion.rateUpdatedAt}`
        }])

      return { success: true }
    } catch (error) {
      console.error('Conversion confirmation failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Reject a conversion for a deposit
   * @param {string} depositId - Deposit ID
   * @param {string} reason - Reason for rejection
   * @returns {Promise<object>}
   */
  async rejectConversion(depositId, reason = 'User rejected conversion') {
    try {
      const { error } = await this.supabase
        .from('deposits')
        .update({
          conversion_status: 'rejected'
        })
        .eq('id', depositId)

      if (error) {
        throw new Error(`Failed to reject conversion: ${error.message}`)
      }

      // Record rejection in audit trail
      await this.supabase
        .from('deposit_conversion_audit')
        .insert([{
          deposit_id: depositId,
          action: 'conversion_rejected',
          notes: reason
        }])

      return { success: true }
    } catch (error) {
      console.error('Conversion rejection failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get conversion audit history for a deposit
   * @param {string} depositId - Deposit ID
   * @returns {Promise<array>}
   */
  async getConversionAudit(depositId) {
    try {
      const { data, error } = await this.supabase
        .from('deposit_conversion_audit')
        .select('*')
        .eq('deposit_id', depositId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to fetch conversion audit:', error)
      return []
    }
  }

  /**
   * Get deposits that need conversion (for admin dashboard)
   * @param {number} limit - Number of records to fetch
   * @returns {Promise<array>}
   */
  async getDepositsNeedingConversion(limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('deposits')
        .select(`
          id,
          user_id,
          wallet_id,
          amount,
          currency_code,
          deposit_method,
          status,
          created_at,
          wallets:wallet_id(
            id,
            currency_code,
            user_id
          )
        `)
        .eq('status', 'pending')
        .eq('conversion_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Filter only those with currency mismatch
      const needsConversion = (data || []).filter(d =>
        d.wallets && d.wallets.length > 0 && d.currency_code !== d.wallets[0].currency_code
      )

      return needsConversion
    } catch (error) {
      console.error('Failed to fetch deposits needing conversion:', error)
      return []
    }
  }

  /**
   * Batch update conversions (for admin)
   * @param {array} conversions - Array of { depositId, approved: boolean, conversion: object }
   * @returns {Promise<object>}
   */
  async batchUpdateConversions(conversions) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    }

    for (const item of conversions) {
      try {
        if (item.approved) {
          const result = await this.confirmConversion(item.depositId, item.conversion)
          if (result.success) {
            results.successful++
          } else {
            results.failed++
            results.errors.push({ depositId: item.depositId, error: result.error })
          }
        } else {
          const result = await this.rejectConversion(item.depositId, 'Bulk rejected by admin')
          if (result.success) {
            results.successful++
          } else {
            results.failed++
            results.errors.push({ depositId: item.depositId, error: result.error })
          }
        }
      } catch (error) {
        results.failed++
        results.errors.push({ depositId: item.depositId, error: error.message })
      }
    }

    return results
  }
}

// Export singleton
export const depositConversionService = new DepositConversionService(supabase)

export default DepositConversionService
