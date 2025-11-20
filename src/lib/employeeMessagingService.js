import { supabase } from './supabaseClient'

export const employeeMessagingService = {
  // Create or get chat channel for an employee
  async getOrCreateChatChannel(businessId, employeeId) {
    try {
      // Check if channel already exists
      const { data, error: selectError } = await supabase
        .from('employee_chat_channels')
        .select('id')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .single()

      if (selectError && selectError.code !== 'PGRST116') throw selectError

      if (data) {
        return { data, error: null }
      }

      // Create new channel
      const { data: newChannel, error: insertError } = await supabase
        .from('employee_chat_channels')
        .insert([{
          business_id: businessId,
          employee_id: employeeId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (insertError) throw insertError
      return { data: newChannel, error: null }
    } catch (err) {
      const errorMsg = err?.message || JSON.stringify(err)
      console.error('[employeeMessagingService] getOrCreateChatChannel failed:', errorMsg)
      return { data: null, error: err }
    }
  },

  // Send a message
  async sendMessage(businessId, employeeId, userId, message) {
    try {
      const { data, error } = await supabase
        .from('employee_messages')
        .insert([{
          business_id: businessId,
          employee_id: employeeId,
          user_id: userId,
          message,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[employeeMessagingService] sendMessage failed:', err)
      return { data: null, error: err }
    }
  },

  // Get chat messages
  async getMessages(businessId, employeeId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('employee_messages')
        .select(`
          *,
          user:users(id, full_name, display_name, profile_image)
        `)
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data, error: null }
    } catch (err) {
      console.error('[employeeMessagingService] getMessages failed:', err)
      return { data: null, error: err }
    }
  },

  // Get last message timestamp for status determination
  async getLastMessageTime(businessId, employeeId) {
    try {
      const { data, error } = await supabase
        .from('employee_messages')
        .select('created_at')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return { data, error: null }
    } catch (err) {
      console.error('[employeeMessagingService] getLastMessageTime failed:', err)
      return { data: null, error: err }
    }
  },

  // Subscribe to new messages
  subscribeToEmployeeMessages(businessId, employeeId, callback) {
    try {
      const channel = supabase
        .channel(`employee-messages:${businessId}:${employeeId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_messages',
          filter: `business_id=eq.${businessId},employee_id=eq.${employeeId}`
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
      console.error('[employeeMessagingService] subscribeToEmployeeMessages failed:', err)
      return { unsubscribe: () => {} }
    }
  },

  // Determine user status based on last message time
  getStatusFromLastMessage(lastMessageTime) {
    if (!lastMessageTime) return 'offline'

    const now = new Date()
    const lastMessage = new Date(lastMessageTime)
    const diffMinutes = (now - lastMessage) / (1000 * 60)

    if (diffMinutes < 5) return 'online'
    if (diffMinutes < 30) return 'idle'
    return 'offline'
  }
}
