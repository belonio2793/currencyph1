/**
 * Crypto Deposits Sync Service
 * Synchronizes cryptocurrency deposit addresses between database and frontend
 */

import { supabase } from './supabaseClient'
import { CRYPTOCURRENCY_DEPOSITS, validateCryptoDeposits } from '../data/cryptoDeposits'

export class CryptoDepositsSync {
  /**
   * Fetch crypto deposits from database
   */
  static async fetchFromDatabase() {
    try {
      const { data, error } = await supabase
        .from('wallets_house')
        .select('*')
        .eq('wallet_type', 'crypto')
        .eq('provider', 'internal')
        .order('currency, network')

      if (error) {
        console.error('Error fetching crypto deposits:', error)
        return null
      }

      return data || []
    } catch (error) {
      console.error('Unexpected error fetching crypto deposits:', error)
      return null
    }
  }

  /**
   * Verify database matches frontend configuration
   */
  static async verifySync() {
    const dbDeposits = await this.fetchFromDatabase()
    if (!dbDeposits) return { status: 'error', message: 'Failed to fetch database' }

    const frontendValidation = validateCryptoDeposits()
    if (!frontendValidation.valid) {
      return {
        status: 'invalid',
        message: 'Frontend data has errors',
        errors: frontendValidation.errors
      }
    }

    // Build maps for comparison
    const dbMap = new Map()
    const feMap = new Map()

    dbDeposits.forEach(d => {
      const key = `${d.currency}|${d.network}`
      dbMap.set(key, d)
    })

    CRYPTOCURRENCY_DEPOSITS.forEach(d => {
      const key = `${d.currency}|${d.network}`
      feMap.set(key, d)
    })

    // Find differences
    const onlyInDb = []
    const onlyInFrontend = []
    const mismatchedAddresses = []

    // Check for entries only in database
    for (const [key, dbEntry] of dbMap) {
      if (!feMap.has(key)) {
        onlyInDb.push(key)
      } else {
        const feEntry = feMap.get(key)
        if (dbEntry.address !== feEntry.address) {
          mismatchedAddresses.push({
            key,
            dbAddress: dbEntry.address,
            feAddress: feEntry.address
          })
        }
      }
    }

    // Check for entries only in frontend
    for (const key of feMap.keys()) {
      if (!dbMap.has(key)) {
        onlyInFrontend.push(key)
      }
    }

    const isInSync = onlyInDb.length === 0 && onlyInFrontend.length === 0 && mismatchedAddresses.length === 0

    return {
      status: isInSync ? 'in-sync' : 'out-of-sync',
      inSync: isInSync,
      counts: {
        database: dbDeposits.length,
        frontend: CRYPTOCURRENCY_DEPOSITS.length
      },
      differences: {
        onlyInDb,
        onlyInFrontend,
        mismatchedAddresses
      }
    }
  }

  /**
   * Sync frontend data to database
   * WARNING: This operation will update/insert database entries based on frontend config
   */
  static async syncToDatabase() {
    try {
      const validation = validateCryptoDeposits()
      if (!validation.valid) {
        return {
          status: 'error',
          message: 'Frontend data validation failed',
          errors: validation.errors
        }
      }

      // Prepare data for upsert
      const dataToSync = CRYPTOCURRENCY_DEPOSITS.map(d => ({
        wallet_type: 'crypto',
        currency: d.currency,
        network: d.network,
        address: d.address,
        provider: 'internal',
        balance: 0,
        metadata: d.metadata || {}
      }))

      // Upsert all entries
      const { data, error } = await supabase
        .from('wallets_house')
        .upsert(dataToSync, {
          onConflict: 'currency,network,address',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        console.error('Error syncing to database:', error)
        return {
          status: 'error',
          message: error.message,
          error
        }
      }

      return {
        status: 'success',
        message: `Successfully synced ${data.length} entries to database`,
        count: data.length
      }
    } catch (error) {
      console.error('Unexpected error during sync:', error)
      return {
        status: 'error',
        message: error.message,
        error
      }
    }
  }

  /**
   * Get deposit address for a specific currency/network
   */
  static async getDepositAddress(currency, network, useDatabase = false) {
    if (useDatabase) {
      const deposits = await this.fetchFromDatabase()
      if (!deposits) return null
      return deposits.find(d => d.currency === currency && d.network === network) || null
    } else {
      return CRYPTOCURRENCY_DEPOSITS.find(d => d.currency === currency && d.network === network) || null
    }
  }

  /**
   * Get all networks for a currency
   */
  static getNetworksForCurrency(currency) {
    return CRYPTOCURRENCY_DEPOSITS
      .filter(d => d.currency === currency)
      .map(d => ({ network: d.network, address: d.address, metadata: d.metadata }))
  }

  /**
   * Get all unique currencies
   */
  static getAllCurrencies() {
    const seen = new Set()
    return CRYPTOCURRENCY_DEPOSITS
      .filter(d => {
        if (seen.has(d.currency)) return false
        seen.add(d.currency)
        return true
      })
      .map(d => d.currency)
  }

  /**
   * Format deposit for display
   */
  static formatDeposit(deposit) {
    return {
      currency: deposit.currency,
      network: deposit.network,
      address: deposit.address,
      displayAddress: this.truncateAddress(deposit.address),
      metadata: deposit.metadata,
      canCopy: !!deposit.address,
      hasTag: !!(deposit.metadata?.tag),
      hasMemo: !!(deposit.metadata?.memo)
    }
  }

  /**
   * Truncate long addresses for display
   */
  static truncateAddress(address, chars = 12) {
    if (!address) return 'N/A'
    if (address.length <= chars * 2) return address
    return `${address.slice(0, chars)}...${address.slice(-chars)}`
  }
}

export default CryptoDepositsSync
