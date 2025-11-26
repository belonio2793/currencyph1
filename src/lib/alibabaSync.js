/**
 * Service for managing Alibaba product syncs
 * Handles triggering syncs and monitoring status
 */

import { supabase } from './supabaseClient'

/**
 * Trigger a full sync of Alibaba products
 * @param {string} businessId - Optional business ID to sync for
 * @returns {Promise<Object>} Sync result
 */
export async function triggerFullAlibabaSync(businessId = null) {
  try {
    const { data, error } = await supabase.functions.invoke('alibaba-sync', {
      body: {
        action: 'trigger-full',
        businessId
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Full Alibaba sync failed:', error)
    throw error
  }
}

/**
 * Trigger an incremental sync
 * @param {string} businessId - Optional business ID
 * @returns {Promise<Object>} Sync result
 */
export async function triggerIncrementalAlibabaSync(businessId = null) {
  try {
    const { data, error } = await supabase.functions.invoke('alibaba-sync', {
      body: {
        action: 'sync',
        syncType: 'incremental',
        businessId
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Incremental Alibaba sync failed:', error)
    throw error
  }
}

/**
 * Manually sync specific Alibaba products
 * @param {string[]} alibabaProductIds - Array of Alibaba product IDs to sync
 * @param {string} businessId - Optional business ID
 * @returns {Promise<Object>} Sync result
 */
export async function triggerManualAlibabaSync(
  alibabaProductIds,
  businessId = null
) {
  if (!alibabaProductIds || alibabaProductIds.length === 0) {
    throw new Error('At least one Alibaba product ID is required')
  }

  try {
    const { data, error } = await supabase.functions.invoke('alibaba-sync', {
      body: {
        action: 'manual',
        alibabaProductIds,
        businessId
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Manual Alibaba sync failed:', error)
    throw error
  }
}

/**
 * Add products to sync queue
 * @param {string[]} alibabaProductIds - Array of Alibaba product IDs
 * @returns {Promise<Object>} Queue result
 */
export async function queueAlibabaProductsForSync(alibabaProductIds) {
  if (!alibabaProductIds || alibabaProductIds.length === 0) {
    throw new Error('At least one product ID is required')
  }

  try {
    const { data, error } = await supabase.functions.invoke('alibaba-sync', {
      body: {
        action: 'queue-sync',
        alibabaProductIds
      }
    })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Queue Alibaba products failed:', error)
    throw error
  }
}

/**
 * Get current sync status and statistics
 * @returns {Promise<Object>} Status data
 */
export async function getAlibabaSyncStatus() {
  try {
    const { data, error } = await supabase.functions.invoke('alibaba-sync', {
      body: {
        action: 'get-status'
      }
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Failed to get Alibaba sync status:', error)
    throw error
  }
}

/**
 * Get Alibaba configuration
 * @returns {Promise<Object>} Configuration object
 */
export async function getAlibabaConfig() {
  try {
    const { data, error } = await supabase
      .from('alibaba_config')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  } catch (error) {
    console.error('Failed to get Alibaba config:', error)
    throw error
  }
}

/**
 * Update Alibaba configuration
 * @param {Object} updates - Configuration updates
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateAlibabaConfig(updates) {
  try {
    const { data: existing } = await supabase
      .from('alibaba_config')
      .select('id')
      .single()

    let result
    if (existing) {
      result = await supabase
        .from('alibaba_config')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('alibaba_config')
        .insert([updates])
        .select()
        .single()
    }

    const { data, error } = result
    if (error) throw error
    return data
  } catch (error) {
    console.error('Failed to update Alibaba config:', error)
    throw error
  }
}

/**
 * Get recent sync logs
 * @param {number} limit - Number of logs to fetch (default: 10)
 * @returns {Promise<Array>} Array of sync logs
 */
export async function getAlibabaSyncLogs(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('alibaba_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Failed to get Alibaba sync logs:', error)
    throw error
  }
}

/**
 * Get alibabaaa sync queue status
 * @returns {Promise<Object>} Queue statistics
 */
export async function getAlibabaSyncQueueStatus() {
  try {
    const { data, error } = await supabase
      .from('alibaba_sync_queue')
      .select('status')

    if (error) throw error

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }

    ;(data || []).forEach((item) => {
      if (item.status in stats) {
        stats[item.status]++
      }
    })

    return stats
  } catch (error) {
    console.error('Failed to get queue status:', error)
    throw error
  }
}

/**
 * Get imported products count
 * @returns {Promise<number>} Count of imported products
 */
export async function getImportedProductsCount() {
  try {
    const { count, error } = await supabase
      .from('alibaba_product_mapping')
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Failed to get imported products count:', error)
    throw error
  }
}

/**
 * Subscribe to sync log updates
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAlibabaSyncLogs(callback) {
  const subscription = supabase
    .from('alibaba_sync_log')
    .on('*', (payload) => {
      callback(payload)
    })
    .subscribe()

  return () => subscription.unsubscribe()
}

/**
 * Subscribe to queue updates
 * @param {Function} callback - Callback function for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAlibabaQueueUpdates(callback) {
  const subscription = supabase
    .from('alibaba_sync_queue')
    .on('*', (payload) => {
      callback(payload)
    })
    .subscribe()

  return () => subscription.unsubscribe()
}
