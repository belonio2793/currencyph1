import { useCallback } from 'react'
import { supabase } from './supabaseClient'
import statusReversalService from './statusReversalService'

/**
 * React Hook for handling status changes with automatic reversal
 * 
 * When a record's status changes to 'pending', automatically reverses all
 * related transactions and maintains data integrity
 */
export function useStatusReversal() {
  /**
   * Update a record's status and handle reversals if needed
   * @param {string} tableName - Table name (loans, orders, deposits, etc.)
   * @param {string} recordId - Record ID
   * @param {string} newStatus - New status value
   * @param {object} updateData - Additional fields to update (optional)
   * @returns {Promise<{success: boolean, data: object, reversals: object|null}>}
   */
  const updateStatus = useCallback(async (tableName, recordId, newStatus, updateData = {}) => {
    try {
      // Fetch the current record first
      const { data: record, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', recordId)
        .single()

      if (fetchError) {
        throw new Error(`Failed to fetch record: ${fetchError.message}`)
      }

      // Prepare update payload
      const updatePayload = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...updateData
      }

      // Update the record
      const { data: updatedRecord, error: updateError } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq('id', recordId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update record: ${updateError.message}`)
      }

      // Handle reversals if status changed to 'pending'
      let reversals = null
      if (newStatus === 'pending' && record.status !== 'pending') {
        // Call the reversal service
        reversals = await statusReversalService.reverseStatusToPending(
          tableName,
          recordId,
          record
        )

        // Log success or warnings
        if (reversals.errors.length > 0) {
          console.warn(`[useStatusReversal] Reversal completed with errors:`, reversals.errors)
        } else {
          console.log(`[useStatusReversal] Successfully reversed ${tableName} ${recordId}`)
        }
      }

      return {
        success: true,
        data: updatedRecord,
        reversals: reversals
      }
    } catch (err) {
      console.error(`[useStatusReversal] Error updating status:`, err)
      return {
        success: false,
        error: err.message,
        data: null,
        reversals: null
      }
    }
  }, [])

  /**
   * Bulk update statuses for multiple records
   * @param {string} tableName - Table name
   * @param {Array<string>} recordIds - Array of record IDs
   * @param {string} newStatus - New status value
   * @returns {Promise<object>} - Results for each record
   */
  const bulkUpdateStatus = useCallback(async (tableName, recordIds, newStatus) => {
    const results = {
      successful: [],
      failed: [],
      reversals: []
    }

    for (const recordId of recordIds) {
      const result = await updateStatus(tableName, recordId, newStatus)
      
      if (result.success) {
        results.successful.push(recordId)
        if (result.reversals) {
          results.reversals.push({
            recordId,
            reversals: result.reversals
          })
        }
      } else {
        results.failed.push({
          recordId,
          error: result.error
        })
      }
    }

    return results
  }, [updateStatus])

  /**
   * Get reversal history for a record
   * @param {string} tableName - Table name
   * @param {string} recordId - Record ID
   * @returns {Promise<Array>} - Reversal audit log entries
   */
  const getReversalHistory = useCallback(async (tableName, recordId) => {
    try {
      const { data, error } = await supabase
        .from('status_reversal_audit_log')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('reversed_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (err) {
      console.error(`[useStatusReversal] Error fetching reversal history:`, err)
      return []
    }
  }, [])

  /**
   * Undo a reversal by marking it as cancelled
   * @param {string} auditLogId - Audit log entry ID
   * @returns {Promise<boolean>} - Success status
   */
  const undoReversal = useCallback(async (auditLogId) => {
    try {
      const { error } = await supabase
        .from('status_reversal_audit_log')
        .update({ status: 'undone' })
        .eq('id', auditLogId)

      if (error) {
        throw error
      }

      console.log(`[useStatusReversal] Reversal ${auditLogId} marked as undone`)
      return true
    } catch (err) {
      console.error(`[useStatusReversal] Error undoing reversal:`, err)
      return false
    }
  }, [])

  /**
   * Get current status and related data for a record
   * @param {string} tableName - Table name
   * @param {string} recordId - Record ID
   * @returns {Promise<object>} - Record with status and related info
   */
  const getRecordStatus = useCallback(async (tableName, recordId) => {
    try {
      const { data: record, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', recordId)
        .single()

      if (error) {
        throw error
      }

      // Get reversal history
      const reversals = await getReversalHistory(tableName, recordId)

      return {
        record,
        reversals,
        lastReversalStatus: reversals[0]?.status || null
      }
    } catch (err) {
      console.error(`[useStatusReversal] Error fetching record status:`, err)
      return null
    }
  }, [getReversalHistory])

  return {
    updateStatus,
    bulkUpdateStatus,
    getReversalHistory,
    undoReversal,
    getRecordStatus
  }
}

export default useStatusReversal
