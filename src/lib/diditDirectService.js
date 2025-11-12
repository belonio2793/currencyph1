import { supabase } from './supabaseClient'

/**
 * Direct DIDIT service that calls DIDIT API without edge functions
 * Stores session data directly in Supabase
 */
export const diditDirectService = {
  /**
   * Create a DIDIT verification session directly via DIDIT API
   * Then store session data in Supabase
   */
  async createVerificationSession(userId) {
    try {
      if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
        throw new Error('userId is required')
      }

      const DIDIT_API_KEY = import.meta.env.VITE_DIDIT_API_KEY || process.env.DIDIT_API_KEY
      const DIDIT_WORKFLOW_ID = import.meta.env.VITE_DIDIT_WORKFLOW_ID || process.env.DIDIT_WORKFLOW_ID
      const DIDIT_APP_ID = import.meta.env.VITE_DIDIT_APP_ID || process.env.DIDIT_APP_ID

      if (!DIDIT_API_KEY) {
        throw new Error('VITE_DIDIT_API_KEY environment variable is not set')
      }

      if (!DIDIT_WORKFLOW_ID) {
        throw new Error('VITE_DIDIT_WORKFLOW_ID environment variable is not set')
      }

      // Call DIDIT API directly to create a session
      const diditBody = { workflow_id: DIDIT_WORKFLOW_ID }
      if (DIDIT_APP_ID) {
        diditBody.app_id = DIDIT_APP_ID
      }

      const diditResponse = await fetch('https://verification.didit.me/v2/session/', {
        method: 'POST',
        headers: {
          'x-api-key': DIDIT_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(diditBody),
      })

      if (!diditResponse.ok) {
        const errorText = await diditResponse.text()
        console.error('DIDIT API error:', diditResponse.status, errorText)
        throw new Error(
          `DIDIT API returned ${diditResponse.status}: ${errorText.slice(0, 200)}`
        )
      }

      const sessionData = await diditResponse.json()
      const { session_id, url: sessionUrl } = sessionData

      if (!session_id || !sessionUrl) {
        throw new Error('Invalid DIDIT session response: missing session_id or url')
      }

      // Store session in Supabase database
      try {
        const { data, error } = await supabase
          .from('user_verifications')
          .upsert(
            {
              user_id: userId,
              didit_workflow_id: DIDIT_WORKFLOW_ID,
              didit_session_id: session_id,
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
          console.error('Error storing DIDIT session in database:', error)
          // Session was created in DIDIT, but we couldn't store it - still return it
          return {
            success: true,
            sessionUrl: sessionUrl,
            sessionId: session_id,
            data: null,
            storageWarning: 'Session created but database storage failed',
          }
        }

        return {
          success: true,
          sessionUrl: sessionUrl,
          sessionId: session_id,
          data: data,
        }
      } catch (dbErr) {
        console.error('Database error when storing session:', dbErr)
        // Still return the session even if database storage fails
        return {
          success: true,
          sessionUrl: sessionUrl,
          sessionId: session_id,
          data: null,
          storageWarning: 'Session created but database storage failed',
        }
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
   * Check DIDIT session status directly via DIDIT API
   */
  async checkSessionStatus(sessionId) {
    try {
      const DIDIT_API_KEY = import.meta.env.VITE_DIDIT_API_KEY || process.env.DIDIT_API_KEY

      if (!DIDIT_API_KEY) {
        throw new Error('DIDIT_API_KEY not configured')
      }

      if (!sessionId) {
        throw new Error('sessionId is required')
      }

      const response = await fetch(
        `https://verification.didit.me/v2/session/${encodeURIComponent(sessionId)}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': DIDIT_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DIDIT API error: ${response.status} - ${errorText}`)
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
