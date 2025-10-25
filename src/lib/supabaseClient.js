import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
// Replace with your actual Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Utility functions for database operations
export const supabaseAPI = {
  // Users
  async getUser(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  },

  async updateUserBalance(userId, phpAmount, tokenAmount) {
    const { data, error } = await supabase
      .from('users')
      .update({
        php_balance: phpAmount,
        cph_tokens: tokenAmount,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select()
    if (error) throw error
    return data
  },

  // Projects
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getProjectById(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()
    if (error) throw error
    return data
  },

  // Contributions
  async addContribution(userId, projectId, amount, method) {
    const { data, error } = await supabase
      .from('contributions')
      .insert([
        {
          user_id: userId,
          project_id: projectId,
          amount: amount,
          payment_method: method,
          created_at: new Date()
        }
      ])
      .select()
    if (error) throw error
    return data
  },

  async getContributions(userId) {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  // Votes
  async addVote(userId, projectId, voteType) {
    const { data, error } = await supabase
      .from('votes')
      .upsert([
        {
          user_id: userId,
          project_id: projectId,
          vote_type: voteType,
          created_at: new Date()
        }
      ])
      .select()
    if (error) throw error
    return data
  },

  async getVotes(projectId) {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('project_id', projectId)
    if (error) throw error
    return data
  },

  // Tokens
  async getUserTokens(userId) {
    const { data, error } = await supabase
      .from('tokens')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return data
  },

  // Real-time subscriptions
  subscribeToBalance(userId, callback) {
    return supabase
      .from(`users:id=eq.${userId}`)
      .on('*', payload => {
        callback(payload.new)
      })
      .subscribe()
  },

  subscribeToProjects(callback) {
    return supabase
      .from('projects')
      .on('*', payload => {
        callback(payload)
      })
      .subscribe()
  }
}
