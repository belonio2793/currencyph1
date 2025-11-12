import { supabase } from './supabaseClient'

export const diditService = {
  /**
   * Create a DIDIT verification session via edge function (avoids CORS issues)
   */
  async createVerificationSession(userId) {
    try {
      // Call Supabase edge function to create session (server-to-server, no CORS)
      const { data, error } = await supabase.functions.invoke('didit-create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (error) {
        console.error('diditService.createVerificationSession: invoke error', error)
        throw new Error(error.message || 'Failed to create verification session')
      }

      // Edge function may return non-2xx payload with details in data
      if (data && data.error) {
        const details = data.details || data.preview || ''
        console.error('diditService.createVerificationSession: function returned error', data)
        throw new Error(`${data.error}${details ? ': ' + details : ''}`)
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create verification session')
      }

      return {
        success: true,
        sessionUrl: data.sessionUrl,
        sessionId: data.sessionId,
        data: data.data
      }
    } catch (error) {
      console.error('Error creating DIDIT verification session:', error)
      throw error
    }
  },


  /**
   * Get verification status from database
   */
  async getVerificationStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error

      return data || null
    } catch (error) {
      console.warn('Error fetching verification status:', error)
      return null
    }
  },

  /**
   * Update verification from DIDIT webhook callback
   * Called by edge function when DIDIT sends webhook notification
   */
  async updateVerificationFromWebhook(diditSessionId, status, decision) {
    try {
      // Call the database function to update verification
      const { data, error } = await supabase
        .rpc('update_verification_from_didit', {
          p_didit_session_id: diditSessionId,
          p_status: status,
          p_decision: decision
        })

      if (error) throw error

      console.log('Verification updated from DIDIT webhook:', data)
      return { success: true, data }
    } catch (error) {
      console.error('Error updating verification from webhook:', error)
      throw error
    }
  },

  /**
   * Mark verification status as public
   * Allows other users to see that this user is verified
   */
  async makeVerificationPublic(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .update({ is_public: true, updated_at: new Date() })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Error making verification public:', error)
      throw error
    }
  },

  /**
   * Hide verification status from public view
   */
  async makeVerificationPrivate(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .update({ is_public: false, updated_at: new Date() })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Error making verification private:', error)
      throw error
    }
  }
}
