import { supabase } from './supabaseClient'

const DIDIT_API_KEY = import.meta.env.VITE_DIDIT_API_KEY
const DIDIT_API_BASE = 'https://verification.didit.me/v2'

// Your workflow_id from DIDIT Business Console
// This should be configured via environment variable in production
const DIDIT_WORKFLOW_ID = import.meta.env.VITE_DIDIT_WORKFLOW_ID || 'default-workflow'

export const diditService = {
  /**
   * Create a DIDIT verification session and return the session URL for users to visit
   */
  async createVerificationSession(userId) {
    try {
      if (!DIDIT_API_KEY) {
        throw new Error('DIDIT API credentials not configured')
      }

      // Create session with DIDIT
      const sessionResponse = await fetch(`${DIDIT_API_BASE}/session/`, {
        method: 'POST',
        headers: {
          'x-api-key': DIDIT_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflow_id: DIDIT_WORKFLOW_ID
        })
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(`DIDIT API error: ${errorData.message || sessionResponse.statusText}`)
      }

      const sessionData = await sessionResponse.json()
      const { session_id, url: sessionUrl } = sessionData

      // Store the session in database
      const { data, error } = await supabase
        .from('user_verifications')
        .upsert({
          user_id: userId,
          didit_workflow_id: DIDIT_WORKFLOW_ID,
          didit_session_id: session_id,
          didit_session_url: sessionUrl,
          status: 'pending',
          verification_method: 'didit',
          submitted_at: new Date(),
          updated_at: new Date()
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        sessionUrl: sessionUrl,
        sessionId: session_id,
        data
      }
    } catch (error) {
      console.error('Error creating DIDIT verification session:', error)
      throw error
    }
  },

  /**
   * Check the status of a DIDIT verification session
   * Usually called periodically or via webhook
   */
  async checkSessionStatus(diditSessionId) {
    try {
      if (!DIDIT_API_KEY) {
        throw new Error('DIDIT API credentials not configured')
      }

      const response = await fetch(`${DIDIT_API_BASE}/session/${diditSessionId}/decision/`, {
        method: 'GET',
        headers: {
          'x-api-key': DIDIT_API_KEY
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'not_found', decision: null }
        }
        throw new Error(`DIDIT API error: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error checking DIDIT session status:', error)
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
