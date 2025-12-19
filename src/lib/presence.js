import { supabase, isSupabaseHealthy } from './supabaseClient'

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

  // Only initialize presence if Supabase is healthy
  if (!isSupabaseHealthy()) {
    return
  }

  // Skip presence if offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return
  }

  // Fire-and-forget; silently ignore all errors since presence is non-critical
  updatePresence('online').catch(() => {})

  presenceIntervalId = setInterval(() => {
    // Skip updates if Supabase is not healthy or if offline
    if (isSupabaseHealthy() && navigator.onLine) {
      updatePresence('online').catch(() => {})
    }
  }, PRESENCE_UPDATE_INTERVAL)

  // Handle online/offline transitions
  const handleOnline = () => {
    if (isSupabaseHealthy()) {
      updatePresence('online').catch(() => {})
    }
  }

  const handleOffline = () => {
    if (presenceIntervalId) {
      clearInterval(presenceIntervalId)
      presenceIntervalId = null
    }
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  window.addEventListener('beforeunload', () => {
    // best-effort update; don't await in unload handlers
    if (isSupabaseHealthy() && navigator.onLine) {
      try { updatePresence('offline').catch(() => {}) } catch (e) {}
    }
    clearInterval(presenceIntervalId)
  })

  document.addEventListener('visibilitychange', () => {
    // Only update presence if Supabase is healthy and online
    if (!isSupabaseHealthy() || !navigator.onLine) return

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
  if (currentUserId && isSupabaseHealthy()) {
    updatePresence('offline').catch(() => {})
  }
}

async function updatePresence(status) {
  if (!currentUserId) return

  // Skip presence updates if Supabase is not healthy
  if (!isSupabaseHealthy()) return

  // Skip if browser is offline - check multiple ways to detect offline
  if (typeof navigator !== 'undefined') {
    if (!navigator.onLine) return

    // Additional offline detection: if we can't reach basic connectivity, skip
    try {
      if (typeof navigator.connection !== 'undefined' && navigator.connection.saveData) {
        // Skip on save-data mode
        return
      }
    } catch (e) {
      // Ignore connection check errors
    }
  }

  try {
    // Guard against supabase being undefined or not having the expected methods
    if (!supabase || typeof supabase.from !== 'function') {
      return
    }

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

    // Set a timeout for the presence update to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Presence update timeout')), 8000)
    )

    try {
      // Race the update against the timeout
      const updatePromise = supabase
        .from('user_presence')
        .upsert([updateData])

      const result = await Promise.race([updatePromise, timeoutPromise])
      const { error } = result

      if (error) {
        if (error.code === 'PGRST116' || error.code === '404' || error.code === '42P01') {
          // Table doesn't exist, silently skip
          return
        }
        // Silently skip other errors as presence is non-critical
      }
    } catch (innerErr) {
      // Network errors, fetch failures, timeouts - silently skip
      // Presence is non-critical functionality
      // Covers: TypeError: Failed to fetch, CORS errors, connection timeouts, etc.
    }
  } catch (err) {
    // Network errors, fetch failures, table might not exist, or other issues - silently ignore
    // Presence is non-critical functionality and should not produce console errors
    // This covers: TypeError: Failed to fetch, CORS errors, connection timeouts, etc.
    // No logging needed as this is expected in offline or misconfigured environments
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
    // Silently return offline state on any error (table missing, network issues, etc.)
    console.debug('[presence] getUserPresence failed, returning offline:', err?.message)
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
        try { callback(payload.new.status) } catch (e) {
          // Silently ignore callback errors
          console.debug('[presence] callback error (ignored):', e?.message)
        }
      })
      .subscribe()

    return () => {
      try { channel.unsubscribe() } catch (e) { /* silently ignore */ }
    }
  } catch (err) {
    // Silently ignore subscription errors (table may not exist, network issues, etc.)
    // Presence is non-critical
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
          try { callback(userId, payload.new.status) } catch (e) {
            // Silently ignore callback errors
            console.debug('[presence] callback error (ignored):', e?.message)
          }
        })
        .subscribe()
    )

    return () => {
      channels.forEach(channel => {
        try { channel.unsubscribe() } catch (e) { /* silently ignore */ }
      })
    }
  } catch (err) {
    // Silently ignore subscription errors
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
    // Silently return offline for all users on error
    console.debug('[presence] getMultipleUsersPresence failed, returning all offline:', err?.message)
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
    // Silently return empty array on error
    console.debug('[presence] getOnlineUsers failed, returning empty list:', err?.message)
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
        try { callback(payload.new || payload) } catch (e) {
          // Silently ignore callback errors
          console.debug('[presence] online users callback error (ignored):', e?.message)
        }
      })
      .subscribe()

    return () => { try { supabase.removeChannel(channel) } catch (e) { /* silently ignore */ } }
  } catch (err) {
    // Silently ignore subscription errors
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

    if (error) {
      // Silently ignore errors - read receipts are non-critical
      console.debug('[presence] Mark as read error (non-critical):', error.code || error.message)
    }
  } catch (err) {
    // Silently ignore errors - read receipts are non-critical
    console.debug('[presence] markMessagesAsRead failed (non-critical):', err?.message)
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
    // Silently return 0 on error
    console.debug('[presence] getUnreadMessageCount failed, returning 0:', err?.message)
    return 0
  }
}
