import { supabase } from './supabaseClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Direct DIDIT service that calls backend API to create sessions
 * Backend API acts as proxy to DIDIT for CORS compliance
 */
export const diditDirectService = {
  /**
   * Create a DIDIT verification session via backend API
   */
  async createVerificationSession(userId) {
    try {
      if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
        throw new Error('userId is required')
      }

      // Call backend API endpoint to create session
      const response = await fetch(`${API_BASE_URL}/api/didit/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API error:', response.status, errorData)
        throw new Error(
          `API returned ${response.status}: ${errorData.error || 'Unknown error'}`
        )
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to create verification session')
      }

      if (!data.sessionUrl || !data.sessionId) {
        throw new Error('Invalid response: missing sessionUrl or sessionId')
      }

      return {
        success: true,
        sessionUrl: data.sessionUrl,
        sessionId: data.sessionId,
        data: data.data,
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
   * Check DIDIT session status via backend API
   */
  async checkSessionStatus(sessionId) {
    try {
      if (!sessionId) {
        throw new Error('sessionId is required')
      }

      const response = await fetch(
        `${API_BASE_URL}/api/didit/session-status/${encodeURIComponent(sessionId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown'}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error checking DIDIT session status:', error)
      throw error
    }
  },

  /**
   * Register an externally-provided DIDIT session URL for a user
   */
  async registerExternalSession(userId, sessionUrl) {
    try {
      if (!userId) throw new Error('userId is required')
      if (!sessionUrl) throw new Error('sessionUrl is required')

      // Extract session ID from URL if possible
      const sessionIdMatch = sessionUrl.match(/session\/([A-Za-z0-9_-]+)/i)
      const sessionId = sessionIdMatch ? sessionIdMatch[1] : null

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
   * Update verification from DIDIT webhook callback
   */
  async updateVerificationFromWebhook(diditSessionId, status, decision) {
    try {
      const { data, error } = await supabase.rpc('update_verification_from_didit', {
        p_didit_session_id: diditSessionId,
        p_status: status,
        p_decision: decision,
      })

      if (error) throw error

      console.log('Verification updated from DIDIT webhook:', data)
      return { success: true, data }
    } catch (error) {
      console.error('Error updating verification from webhook:', error)
      throw error
    }
  },
}
