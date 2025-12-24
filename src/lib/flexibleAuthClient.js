import { supabase } from './supabaseClient'

const getEnv = (name) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name]
    }
  } catch (e) {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name]
    }
  } catch (e) {
    // ignore
  }
  return undefined
}

const PROJECT_URL = getEnv('VITE_PROJECT_URL') || getEnv('PROJECT_URL') || window?.PROJECT_URL || ''

/**
 * Flexible authentication client that supports login by any metadata field
 * Users can login with: email, phone, username, nickname, or full name
 */
export const flexibleAuthClient = {
  /**
   * Login with flexible identifier (email, phone, username, nickname, etc.)
   * @param {string} identifier - Any field value (email, phone, username, nickname, full name)
   * @param {string} password - User's password
   * @returns {Promise<{session, user, error}>}
   */
  async signInWithIdentifier(identifier, password) {
    try {
      if (!identifier || !password) {
        return {
          session: null,
          user: null,
          error: 'Identifier and password are required'
        }
      }

      // Call the flexible-auth Edge Function
      const response = await fetch(`${PROJECT_URL}/functions/v1/flexible-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || ''}`
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          session: null,
          user: null,
          error: data.error || 'Authentication failed'
        }
      }

      // If successful, set the session in Supabase auth
      if (data.session) {
        // Manually set the session in Supabase
        await supabase.auth.setSession(data.session)

        return {
          session: data.session,
          user: data.user,
          error: null
        }
      }

      return {
        session: null,
        user: null,
        error: 'No session returned'
      }
    } catch (error) {
      console.error('Flexible auth sign in error:', error)
      return {
        session: null,
        user: null,
        error: error.message || 'Authentication failed'
      }
    }
  },

  /**
   * Register new user with flexible metadata fields
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @param {Object} metadata - User metadata (full_name, username, nickname, phone_number, etc.)
   * @returns {Promise<{user, error}>}
   */
  async signUp(email, password, metadata = {}) {
    try {
      if (!email || !password) {
        return {
          user: null,
          error: 'Email and password are required'
        }
      }

      // Sign up through Supabase auth (will auto-confirm email via trigger)
      // Only pass minimal data to auth - store full metadata in profiles table instead
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: metadata.full_name || ''
          }
        }
      })

      if (error) {
        return {
          user: null,
          error: error.message || 'Registration failed'
        }
      }

      // Create profile record immediately after auth signup
      if (data.user) {
        try {
          // Build profile data with all metadata
          const profileData = {
            user_id: data.user.id,
            full_name: metadata.full_name && metadata.full_name.trim() ? metadata.full_name.trim() : '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          // Add optional fields only if they have values
          if (metadata.username && metadata.username.trim()) {
            profileData.username = metadata.username.trim()
          }
          if (metadata.nickname && metadata.nickname.trim()) {
            profileData.nickname = metadata.nickname.trim()
          }
          if (metadata.phone_number && metadata.phone_number.trim()) {
            profileData.phone_number = metadata.phone_number.trim()
          }
          if (metadata.address && metadata.address.trim()) {
            profileData.address = metadata.address.trim()
          }
          if (metadata.country && metadata.country.trim()) {
            profileData.country = metadata.country.trim()
          }
          if (metadata.city && metadata.city.trim()) {
            profileData.city = metadata.city.trim()
          }
          if (metadata.region && metadata.region.trim()) {
            profileData.region = metadata.region.trim()
          }

          // Insert profile - use insert instead of upsert to avoid conflicts
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([profileData])

          if (profileError) {
            // If profile insert fails, log it but don't fail the signup
            console.warn('Warning: Could not create profile:', profileError.message)
            console.warn('Profile insert error code:', profileError.code)
          }
        } catch (profileError) {
          console.warn('Warning: Profile creation error:', profileError.message)
          // Don't fail signup if profile creation fails - user is already created in auth
        }
      }

      return {
        user: data.user,
        error: null
      }
    } catch (error) {
      console.error('Flexible auth sign up error:', error)
      return {
        user: null,
        error: error.message || 'Registration failed'
      }
    }
  },

  /**
   * Sign out the current user
   * @returns {Promise<{error}>}
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error: error?.message || null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error: error.message || 'Sign out failed' }
    }
  },

  /**
   * Get current session
   * @returns {Promise<{session, user, error}>}
   */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession()
      return {
        session: data?.session || null,
        user: data?.session?.user || null,
        error: error?.message || null
      }
    } catch (error) {
      console.error('Get session error:', error)
      return { session: null, user: null, error: error.message || 'Failed to get session' }
    }
  },

  /**
   * Update user profile with metadata
   * @param {string} userId - User ID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<{profile, error}>}
   */
  async updateProfile(userId, metadata = {}) {
    try {
      if (!userId) {
        return { profile: null, error: 'User ID is required' }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(metadata)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return { profile: null, error: error.message }
      }

      return { profile: data, error: null }
    } catch (error) {
      console.error('Update profile error:', error)
      return { profile: null, error: error.message || 'Failed to update profile' }
    }
  },

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Promise<{profile, error}>}
   */
  async getProfile(userId) {
    try {
      if (!userId) {
        return { profile: null, error: 'User ID is required' }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        return { profile: null, error: error.message }
      }

      return { profile: data, error: null }
    } catch (error) {
      console.error('Get profile error:', error)
      return { profile: null, error: error.message || 'Failed to get profile' }
    }
  }
}

export default flexibleAuthClient
