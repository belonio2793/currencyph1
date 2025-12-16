import { supabase } from './supabaseClient'

export const onboardingService = {
  // Validate if ID is a proper UUID
  isValidUUID(id) {
    if (!id) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  },

  // Fetch user addresses
  async getUserAddresses(userId) {
    try {
      // Skip database query for guest users or invalid UUIDs
      if (!this.isValidUUID(userId)) {
        return []
      }

      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching user addresses:', err?.message || String(err))
      return []
    }
  },

  // Check if user has any addresses
  async hasUserAddresses(userId) {
    try {
      const addresses = await this.getUserAddresses(userId)
      return addresses.length > 0
    } catch (err) {
      console.error('Error checking user addresses:', err?.message || String(err))
      return false
    }
  },

  // Validator: Check if user has set a preferred currency
  async hasPreferredCurrency(userId) {
    try {
      if (!this.isValidUUID(userId)) return false

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferred_currency')
        .eq('user_id', userId)
        .single()

      if (error) {
        // Handle missing column or table gracefully
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          return false
        }
        throw error
      }
      return !!(data?.preferred_currency)
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error checking preferred currency:', errMsg)
      }
      return false
    }
  },

  // Validator: Check if user has completed their profile
  async hasProfileComplete(userId) {
    try {
      if (!this.isValidUUID(userId)) return false

      // Check profiles table for full_name
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .limit(1)

      if (error) {
        // Handle missing table gracefully
        if (error.message?.includes('Could not find the table')) {
          return false
        }
        throw error
      }

      if (!data || data.length === 0) {
        return false
      }

      const profileData = data[0]
      return !!(profileData?.full_name && profileData.full_name.trim().length > 0)
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error checking profile completion:', errMsg)
      }
      return false
    }
  },

  // Validator: Check if user has verified their email
  async hasEmailVerified(userId) {
    try {
      if (!this.isValidUUID(userId)) return false

      // Check user_onboarding_state table for email_verified status
      const { data, error } = await supabase
        .from('user_onboarding_state')
        .select('email_verified')
        .eq('user_id', userId)
        .single()

      if (error) {
        // If table doesn't exist or no record, check auth metadata
        if (error.code === 'PGRST116') {
          // Try getting current user from session
          const { data: session } = await supabase.auth.getSession()
          if (session?.user?.email_confirmed_at) {
            return true
          }
          return false
        }
        throw error
      }
      return !!(data?.email_verified)
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error checking email verification:', errMsg)
      }
      return false
    }
  },

  // Create default onboarding tasks
  getDefaultTasks(userState) {
    return [
      {
        id: 'create-address',
        title: 'Create Your First Address',
        description: 'Add a location to your profile for faster transactions',
        icon: '📍',
        completed: userState?.hasAddress || false,
        category: 'essential',
        action: 'open-address-modal',
        validator: 'hasUserAddresses'
      },
      {
        id: 'complete-profile',
        title: 'Complete Your Profile',
        description: 'Fill in your profile information to build trust',
        icon: '👤',
        completed: userState?.profileComplete || false,
        category: 'important',
        action: 'navigate-profile',
        validator: 'hasProfileComplete'
      },
      {
        id: 'verify-email',
        title: 'Verify Your Email',
        description: 'Confirm your email address to secure your account',
        icon: '✉️',
        completed: userState?.emailVerified || false,
        category: 'important',
        action: 'verify-email',
        validator: 'hasEmailVerified'
      },
      {
        id: 'set-currency',
        title: 'Set Your Preferred Currency',
        description: 'Choose your display currency for better readability',
        icon: '💱',
        completed: userState?.currencySet || false,
        category: 'nice-to-have',
        action: 'set-currency',
        validator: 'hasPreferredCurrency'
      }
    ]
  },

  // Auto-detect task completion by running validators
  async autoDetectTaskCompletion(userId) {
    try {
      if (!this.isValidUUID(userId)) return false

      const tasks = this.getDefaultTasks({})
      let anyChanges = false

      // Run all validators in parallel
      const validationResults = await Promise.allSettled([
        this.hasUserAddresses(userId),
        this.hasProfileComplete(userId),
        this.hasEmailVerified(userId),
        this.hasPreferredCurrency(userId)
      ])

      // Map results to tasks
      const completionMap = {
        'create-address': validationResults[0].status === 'fulfilled' ? validationResults[0].value : false,
        'complete-profile': validationResults[1].status === 'fulfilled' ? validationResults[1].value : false,
        'verify-email': validationResults[2].status === 'fulfilled' ? validationResults[2].value : false,
        'set-currency': validationResults[3].status === 'fulfilled' ? validationResults[3].value : false
      }

      // Update database for any task that is now completed
      for (const [taskId, isCompleted] of Object.entries(completionMap)) {
        if (isCompleted) {
          const result = await this.updateTaskCompletion(userId, taskId, true)
          if (result) anyChanges = true
        }
      }

      return anyChanges
    } catch (err) {
      console.error('Error auto-detecting task completion:', err?.message || String(err))
      return false
    }
  },

  // Fetch user onboarding state
  async getUserOnboardingState(userId) {
    try {
      // Skip database query for guest users or invalid UUIDs
      if (!this.isValidUUID(userId)) {
        return null
      }

      const { data, error } = await supabase
        .from('user_onboarding_state')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        // Handle table not found or other errors gracefully
        if (error.code === 'PGRST116' || error.message?.includes('Could not find the table')) {
          // Table doesn't exist yet or record not found - this is OK, return null
          return null
        }
        throw error
      }
      return data || null
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error fetching onboarding state:', errMsg)
      }
      return null
    }
  },

  // Get complete onboarding tasks with auto-detected completion
  async getOnboardingTasks(userId) {
    try {
      // Run all validators in parallel for accurate auto-detection
      const [
        hasAddress,
        profileComplete,
        emailVerified,
        currencySet,
        onboardingState
      ] = await Promise.all([
        this.hasUserAddresses(userId),
        this.hasProfileComplete(userId),
        this.hasEmailVerified(userId),
        this.hasPreferredCurrency(userId),
        this.getUserOnboardingState(userId)
      ])

      const userState = {
        ...onboardingState,
        hasAddress,
        profileComplete,
        emailVerified,
        currencySet
      }

      const tasks = this.getDefaultTasks(userState)
      return tasks
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error getting onboarding tasks:', errMsg)
      }
      return this.getDefaultTasks({})
    }
  },

  // Update task completion status
  async updateTaskCompletion(userId, taskId, completed) {
    try {
      // Skip database write for guest users or invalid UUIDs
      if (!this.isValidUUID(userId)) {
        return false
      }

      const { error } = await supabase
        .from('user_onboarding_progress')
        .upsert({
          user_id: userId,
          task_id: taskId,
          completed: completed,
          completed_at: completed ? new Date().toISOString() : null
        }, {
          onConflict: 'user_id,task_id'
        })

      if (error) throw error
      return true
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error updating task completion:', errMsg)
      }
      return false
    }
  },

  // Get progress percentage
  async getOnboardingProgress(userId) {
    try {
      const tasks = await this.getOnboardingTasks(userId)
      const completed = tasks.filter(t => t.completed).length
      const percentage = Math.round((completed / tasks.length) * 100)
      return {
        completed,
        total: tasks.length,
        percentage
      }
    } catch (err) {
      const errMsg = err?.message || String(err)
      // Don't log network errors - they're expected and non-critical
      if (!errMsg.includes('Failed to fetch')) {
        console.error('Error getting onboarding progress:', errMsg)
      }
      return { completed: 0, total: 0, percentage: 0 }
    }
  }
}
