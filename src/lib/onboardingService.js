import { supabase } from './supabaseClient'

export const onboardingService = {
  // Fetch user addresses
  async getUserAddresses(userId) {
    try {
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
        action: 'open-address-modal'
      },
      {
        id: 'complete-profile',
        title: 'Complete Your Profile',
        description: 'Fill in your profile information to build trust',
        icon: '👤',
        completed: userState?.profileComplete || false,
        category: 'important',
        action: 'navigate-profile'
      },
      {
        id: 'verify-email',
        title: 'Verify Your Email',
        description: 'Confirm your email address to secure your account',
        icon: '✉️',
        completed: userState?.emailVerified || false,
        category: 'important',
        action: 'verify-email'
      },
      {
        id: 'set-currency',
        title: 'Set Your Preferred Currency',
        description: 'Choose your display currency for better readability',
        icon: '💱',
        completed: userState?.currencySet || false,
        category: 'nice-to-have',
        action: 'set-currency'
      }
    ]
  },

  // Fetch user onboarding state
  async getUserOnboardingState(userId) {
    try {
      const { data, error } = await supabase
        .from('user_onboarding_state')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data || null
    } catch (err) {
      console.error('Error fetching onboarding state:', err?.message || String(err))
      return null
    }
  },

  // Get complete onboarding tasks with auto-detected completion
  async getOnboardingTasks(userId) {
    try {
      // Fetch user state and addresses in parallel
      const [onboardingState, addresses] = await Promise.all([
        this.getUserOnboardingState(userId),
        this.getUserAddresses(userId)
      ])

      const userState = {
        ...onboardingState,
        hasAddress: addresses.length > 0
      }

      const tasks = this.getDefaultTasks(userState)
      return tasks
    } catch (err) {
      console.error('Error getting onboarding tasks:', err?.message || String(err))
      return this.getDefaultTasks({})
    }
  },

  // Update task completion status
  async updateTaskCompletion(userId, taskId, completed) {
    try {
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
      console.error('Error updating task completion:', err?.message || String(err))
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
      console.error('Error getting onboarding progress:', err?.message || String(err))
      return { completed: 0, total: 0, percentage: 0 }
    }
  }
}
