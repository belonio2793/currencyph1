import { supabase } from './supabaseClient'

/**
 * Simplified DIDIT service using didit-sync edge function for verification polling
 * This service only handles database operations and delegates to didit-sync for DIDIT API calls
 */
export const diditDirectService = {
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
   * Register external DIDIT session URL for a user
   */
  async registerExternalSession(userId, sessionUrl) {
    try {
      if (!userId) throw new Error('userId is required')
      if (!sessionUrl) throw new Error('sessionUrl is required')

      // Extract session ID from URL
      const sessionIdMatch = sessionUrl.match(/session\/([A-Za-z0-9_-]+)/i)
      const sessionId = sessionIdMatch ? sessionIdMatch[1] : 'unknown'

      // Store in Supabase
      const { data, error } = await supabase
        .from('user_verifications')
        .upsert(
          {
            user_id: userId,
            didit_session_id: sessionId,
            didit_session_url: sessionUrl,
            status: 'pending',
            verification_method: 'didit',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to register external session')
      }

      return { success: true, data }
    } catch (err) {
      console.error('Error registering external DIDIT session:', err)
      throw err
    }
  },

  /**
   * Mark verification status as public
   */
  async makeVerificationPublic(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .update({ is_public: true, updated_at: new Date().toISOString() })
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
        .update({ is_public: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Error making verification private:', error)
      throw error
    }
  },

  /**
   * Trigger didit-sync to check all pending verifications
   * Call this periodically to sync with DIDIT API
   */
  async triggerSync() {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_PROJECT_URL}/functions/v1/didit-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.auth.session()?.access_token || ''}`,
          },
        }
      )

      if (!response.ok) {
        console.warn('didit-sync returned:', response.status)
        return null
      }

      return await response.json()
    } catch (error) {
      console.warn('Error triggering didit-sync:', error)
      return null
    }
  },
}
