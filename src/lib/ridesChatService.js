import { supabase } from './supabaseClient'

export const ridesChatService = {
  // Create or get chat channel for a match
  async getOrCreateChatChannel(matchId, userId, otherUserId) {
    try {
      // Check if channel already exists
      const { data, error: selectError } = await supabase
        .from('ride_match_chats')
        .select('id')
        .eq('match_id', matchId)
        .single()

      if (selectError && selectError.code !== 'PGRST116') throw selectError

      if (data) {
        return { data, error: null }
      }

      // Create new channel
      const { data: newChannel, error: insertError } = await supabase
        .from('ride_match_chats')
        .insert([{
          match_id: matchId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (insertError) throw insertError
      return { data: newChannel, error: null }
    } catch (err) {
      console.error('[ridesChatService] getOrCreateChatChannel failed:', err)
      return { data: null, error: err }
    }
  },

  // Send a message in a match chat
  async sendMessage(matchId, userId, message) {
    try {
      const { data, error } = await supabase
        .from('ride_match_messages')
        .insert([{
          match_id: matchId,
          user_id: userId,
          message,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesChatService] sendMessage failed:', err)
      return { data: null, error: err }
    }
  },

  // Get chat messages for a match
  async getMessages(matchId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('ride_match_messages')
        .select(`
          *,
          user:users(id, full_name, display_name, profile_image)
        `)
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[ridesChatService] getMessages failed:', err)
      return { data: null, error: err }
    }
  },

  // Subscribe to new messages for a match
  subscribeToMatchMessages(matchId, callback) {
    try {
      const channel = supabase
        .channel(`match-messages:${matchId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_match_messages',
          filter: `match_id=eq.${matchId}`
        }, (payload) => {
          callback(payload.new)
        })
        .subscribe()

      return {
        unsubscribe: () => {
          channel.unsubscribe()
        }
      }
    } catch (err) {
      console.error('[ridesChatService] subscribeToMatchMessages failed:', err)
      return { unsubscribe: () => {} }
    }
  }
}
