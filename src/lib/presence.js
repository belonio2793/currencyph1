import { supabase } from './supabaseClient'

const PRESENCE_UPDATE_INTERVAL = 30000 // 30 seconds
const OFFLINE_TIMEOUT = 120000 // 2 minutes

let presenceIntervalId = null
let currentUserId = null
let currentLocation = null

// Store location globally for presence updates
function setCurrentLocation(location) {
  currentLocation = location
}

export function initializePresence(userId) {
  currentUserId = userId
  if (!userId) return

  // Fire-and-forget but handle possible rejection to avoid unhandled promise errors
  updatePresence('online').catch(err => console.debug('updatePresence initial failed (ignored):', err))

  presenceIntervalId = setInterval(() => {
    updatePresence('online').catch(err => console.debug('updatePresence interval failed (ignored):', err))
  }, PRESENCE_UPDATE_INTERVAL)

  window.addEventListener('beforeunload', () => {
    // best-effort update; don't await in unload handlers
    try { updatePresence('offline').catch(() => {}) } catch (e) {}
    clearInterval(presenceIntervalId)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      updatePresence('away').catch(() => {})
    } else {
      updatePresence('online').catch(() => {})
    }
  })
}

export function stopPresence() {
  if (presenceIntervalId) {
    clearInterval(presenceIntervalId)
  }
  if (currentUserId) {
    updatePresence('offline').catch(() => {})
  }
}

async function updatePresence(status) {
  if (!currentUserId) return

  try {
    const updateData = {
      user_id: currentUserId,
      status,
      updated_at: new Date().toISOString()
    }

    // Add location data if available
    if (currentLocation) {
      updateData.latitude = currentLocation.latitude
      updateData.longitude = currentLocation.longitude
      updateData.city = currentLocation.city || null
      updateData.location_updated_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('user_presence')
      .upsert([updateData])

    if (error) {
      if (error.code === 'PGRST116' || error.code === '404' || error.code === '42P01') {
        // Table doesn't exist, silently skip
        return
      }
      // Silently skip other errors as presence is non-critical
      // Only log at debug level to avoid noisy console warnings
      console.debug('[presence] Supabase upsert error (non-critical):', error.code || error.message)
    }
  } catch (err) {
    // Network errors, table might not exist, or other issues - silently ignore
    // Presence is non-critical, so we don't log or propagate these errors
    // Only uncomment for debugging:
    // console.debug('[presence] updatePresence failed:', err?.message)
  }
}

export function updatePresenceLocation(location) {
  setCurrentLocation(location)
  // Update immediately if online
  if (currentUserId) {
    updatePresence('online').catch(() => {})
  }
}

export async function getUserPresence(userId) {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('status, last_seen')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) return 'offline'

    const lastSeen = new Date(data.last_seen).getTime()
    const now = Date.now()

    if (data.status === 'offline' || (now - lastSeen) > OFFLINE_TIMEOUT) {
      return 'offline'
    }

    return data.status || 'offline'
  } catch (err) {
    console.warn('Get presence error:', err)
    return 'offline'
  }
}

export async function subscribeToUserPresence(userId, callback) {
  try {
    if (!supabase || typeof supabase.channel !== 'function') return () => {}
    const channel = supabase
      .channel(`user_presence:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_presence',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        try { callback(payload.new.status) } catch (e) { console.error('presence callback error', e) }
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch (e) { console.debug('Failed to remove presence channel', e) }
    }
  } catch (err) {
    console.debug('subscribeToUserPresence not available', err)
    return () => {}
  }
}

export async function subscribeToMultiplePresence(userIds, callback) {
  try {
    if (!supabase || typeof supabase.channel !== 'function') return () => {}
    const channels = userIds.map(userId =>
      supabase
        .channel(`presence:${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          try { callback(userId, payload.new.status) } catch (e) { console.error('presence callback error', e) }
        })
        .subscribe()
    )

    return () => {
      channels.forEach(channel => {
        try { supabase.removeChannel(channel) } catch (e) { console.debug('Failed to remove channel', e) }
      })
    }
  } catch (err) {
    console.debug('subscribeToMultiplePresence not available', err)
    return () => {}
  }
}

export async function getMultipleUsersPresence(userIds) {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, status')
      .in('user_id', userIds)

    if (error) throw error

    const presenceMap = {}
    userIds.forEach(id => {
      const user = (data || []).find(u => u.user_id === id)
      presenceMap[id] = user?.status || 'offline'
    })

    return presenceMap
  } catch (err) {
    console.warn('Get multiple presence error:', err)
    return userIds.reduce((acc, id) => ({ ...acc, [id]: 'offline' }), {})
  }
}

export async function getOnlineUsers() {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, status, latitude, longitude, city, updated_at')
      .eq('status', 'online')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('updated_at', { ascending: false })

    if (error && error.code !== 'PGRST116') throw error

    return data || []
  } catch (err) {
    console.warn('Get online users error:', err)
    return []
  }
}

export async function subscribeToOnlineUsers(callback) {
  try {
    if (!supabase || typeof supabase.channel !== 'function') return () => {}
    const channel = supabase
      .channel('online_users')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence'
      }, (payload) => {
        try { callback(payload.new || payload) } catch (e) { console.error('online users callback', e) }
      })
      .subscribe()

    return () => { try { supabase.removeChannel(channel) } catch (e) { console.debug('Failed to remove online_users channel', e) } }
  } catch (err) {
    console.debug('subscribeToOnlineUsers not available', err)
    return () => {}
  }
}

export async function markMessagesAsRead(messageIds, readerId) {
  if (!messageIds.length) return

  try {
    const records = messageIds.map(msgId => ({
      message_id: msgId,
      reader_id: readerId
    }))

    const { error } = await supabase
      .from('message_read_receipts')
      .upsert(records)

    if (error) console.warn('Mark read error:', error)
  } catch (err) {
    console.warn('Mark as read failed:', err)
  }
}

export async function getUnreadMessageCount(userId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('recipient_id', userId)
      .is('deleted_at', null)
      .not('message_read_receipts.reader_id', 'is', userId)

    if (error && error.code !== 'PGRST116') throw error
    return data?.length || 0
  } catch (err) {
    console.warn('Get unread count error:', err)
    return 0
  }
}
