import { supabase } from './supabaseClient'

export const diditService = {
  /**
   * Create a DIDIT verification session via edge function (avoids CORS issues)
   */
  async createVerificationSession(userId) {
    try {
      if (!userId || (typeof userId === 'string' && userId.trim() === '')) {
        throw new Error('userId is required')
      }
      // Call Supabase edge function to create session (server-to-server, no CORS)
      // Build headers: prefer current session access token, fall back to anon key
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-User-Id': userId }
      try {
        const sessionResp = await supabase.auth.getSession()
        const accessToken = sessionResp?.data?.session?.access_token || sessionResp?.data?.access_token || null
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      } catch (e) {
        // ignore
      }

      if (!headers['Authorization']) {
        const anonKey = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) || (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) || null
        if (anonKey) headers['Authorization'] = `Bearer ${anonKey}`
      }

      const { data, error } = await supabase.functions.invoke('didit-create-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId })
      })

      // If invoke returned a transport-level error
      if (error) {
        console.error('diditService.createVerificationSession: invoke error', error)
        // Try fallback: if an external session URL is configured, register it and return it
        const externalLink = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_DIDIT_EXTERNAL_SESSION_URL || import.meta.env.VITE_DIDIT_SESSION_URL)) || null
        if (externalLink) {
          console.info('diditService: using external DIDIT session URL fallback')
          await this.registerExternalSession(userId, externalLink)
          return { success: true, sessionUrl: externalLink, sessionId: (externalLink.match(/session\/([A-Za-z0-9_-]+)/i) || [null, null])[1], data: null }
        }

        // Provide as much detail as possible in the thrown error
        const errMsg = (error && (error.message || JSON.stringify(error))) || 'Failed to create verification session (invoke error)'
        throw new Error(errMsg)
      }

      // Edge function may return non-2xx payload with details in data
      if (data && data.error) {
        const details = data.details || data.preview || ''
        console.error('diditService.createVerificationSession: function returned error', data)

        // fallback to external link if configured
        const externalLink = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_DIDIT_EXTERNAL_SESSION_URL || import.meta.env.VITE_DIDIT_SESSION_URL)) || null
        if (externalLink) {
          console.info('diditService: using external DIDIT session URL fallback after function error')
          await this.registerExternalSession(userId, externalLink)
          return { success: true, sessionUrl: externalLink, sessionId: (externalLink.match(/session\/([A-Za-z0-9_-]+)/i) || [null, null])[1], data: null }
        }

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

  // Register an externally-provided DIDIT session URL for a user (upserts a pending verification row)
  async registerExternalSession(userId, sessionUrl) {
    try {
      if (!userId) throw new Error('userId is required')
      if (!sessionUrl) throw new Error('sessionUrl is required')

      // Build headers: prefer current session access token, fall back to anon key
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-User-Id': userId }
      try {
        const sessionResp = await supabase.auth.getSession()
        const accessToken = sessionResp?.data?.session?.access_token || sessionResp?.data?.access_token || null
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      } catch (e) {
        // ignore
      }

      if (!headers['Authorization']) {
        const anonKey = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) || (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) || null
        if (anonKey) headers['Authorization'] = `Bearer ${anonKey}`
      }

      const body = JSON.stringify({ userId, sessionUrl })
      const { data, error } = await supabase.functions.invoke('didit-initiate', { method: 'POST', headers, body })

      if (error) {
        console.error('diditService.registerExternalSession: invoke error', error)
        throw new Error(error.message || 'Failed to register external session')
      }

      if (data && data.error) {
        throw new Error(data.error)
      }

      return { success: true, data }
    } catch (err) {
      console.error('Error registering external DIDIT session:', err)
      throw err
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
