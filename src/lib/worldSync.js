import { supabase } from './supabaseClient'

import { reverseGeocode } from './geocode'
import { worldToLatLng } from './mapUtils'
import { supabase } from './supabaseClient'

// Manage real-time player position sync
export class WorldSync {
  constructor(userId, characterId, cityName) {
    this.userId = userId
    this.characterId = characterId
    this.cityName = cityName
    this.subscription = null
    this.lastSyncTime = 0
    this.syncInterval = 500 // ms between syncs
    this.otherPlayers = new Map()
    this.callbacks = {
      onPlayerUpdate: null,
      onPlayerJoined: null,
      onPlayerLeft: null,
      onChatMessage: null
    }
  }

  // Initialize real-time subscriptions
  async connect() {
    try {
      // Subscribe to player position updates
      this.subscription = supabase
        .channel(`world:${this.cityName}`)
        .on('broadcast', { event: 'player_move' }, (payload) => {
          this.handlePlayerMove(payload)
        })
        .on('broadcast', { event: 'player_chat' }, (payload) => {
          this.handlePlayerChat(payload)
        })
        .on('presence', { event: 'sync' }, (payload) => {
          this.handlePresenceSync(payload)
        })
        .on('presence', { event: 'join' }, (payload) => {
          this.handlePlayerJoined(payload)
        })
        .on('presence', { event: 'leave' }, (payload) => {
          this.handlePlayerLeft(payload)
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('World sync connected to', this.cityName)
            this.updatePresence()
          }
        })

      return true
    } catch (error) {
      console.error('World sync connection error:', error)
      return false
    }
  }

  // Update player presence
  async updatePresence(playerData = {}) {
    try {
      if (!this.subscription) return

      const x = playerData.x || 0
      const y = playerData.y || 0

      const presence = {
        user_id: this.userId,
        character_id: this.characterId,
        character_name: playerData.name || 'Player',
        city: this.cityName,
        x,
        y,
        direction: playerData.direction || 'down',
        rpm_avatar: playerData.rpm_avatar || playerData.avatarUrl || null,
        timestamp: Date.now()
      }

      // Compute lat/lng from world coordinates if possible (assume ground plane 6000x6000 for World3D)
      try {
        const { lat, lng } = worldToLatLng(6000, 6000, x, y)
        presence.lat = lat
        presence.lng = lng

        // Reverse geocode to get street and locality (best-effort)
        try {
          const geo = await reverseGeocode(lat, lng)
          if (geo) {
            presence.street = geo.street || geo.road || geo.name || null
            presence.locality = geo.city || geo.town || geo.village || geo.county || null
            presence.display_name = geo.display_name || null
          }
        } catch (gerr) {
          console.warn('Reverse geocode failed:', gerr)
        }
      } catch (coordErr) {
        // ignore coordinate conversion errors
      }

      // track presence in realtime channel
      await this.subscription.track(presence)

      // remember last presence for disconnect/save
      this.lastPresence = presence

      // Persist position server-side via WorldDB edge function (best-effort)
      try {
        await WorldDB.saveWorldEvent(this.userId, this.characterId, this.cityName, 'position_update', {
          x, y, lat: presence.lat || null, lng: presence.lng || null, street: presence.street || null, locality: presence.locality || null
        })
      } catch (perr) {
        console.warn('Failed to persist position:', perr)
      }

    } catch (error) {
      console.error('Presence update error:', error)
    }
  }

  // Broadcast player movement
  async broadcastMove(x, y, direction = 'down', rpm_avatar = null) {
    const now = Date.now()
    if (now - this.lastSyncTime < this.syncInterval) return

    try {
      await this.subscription?.send({
        type: 'broadcast',
        event: 'player_move',
        payload: {
          user_id: this.userId,
          character_id: this.characterId,
          x,
          y,
          direction,
          rpm_avatar: rpm_avatar || null,
          timestamp: now
        }
      })

      this.lastSyncTime = now
    } catch (error) {
      console.error('Move broadcast error:', error)
    }
  }

  // Broadcast chat message
  async broadcastChat(message, targetNpcId = null) {
    try {
      await this.subscription?.send({
        type: 'broadcast',
        event: 'player_chat',
        payload: {
          user_id: this.userId,
          character_id: this.characterId,
          character_name: 'Player',
          message,
          targetNpcId,
          city: this.cityName,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Chat broadcast error:', error)
    }
  }

  // Handle incoming player movement
  handlePlayerMove(payload) {
    if (payload.payload.user_id === this.userId) return

    const playerId = payload.payload.user_id
    this.otherPlayers.set(playerId, {
      ...payload.payload,
      characterId: payload.payload.character_id
    })

    if (this.callbacks.onPlayerUpdate) {
      this.callbacks.onPlayerUpdate(Array.from(this.otherPlayers.values()))
    }
  }

  // Handle incoming chat
  handlePlayerChat(payload) {
    if (this.callbacks.onChatMessage) {
      this.callbacks.onChatMessage(payload.payload)
    }
  }

  // Handle presence sync
  handlePresenceSync(payload) {
    this.otherPlayers.clear()

    // Normalize payload to array of presence metas
    let presArray = []
    try {
      if (Array.isArray(payload)) {
        presArray = payload
      } else if (payload && payload.presence_state) {
        // payload.presence_state is an object mapping keys -> { metas: [...] }
        Object.values(payload.presence_state).forEach(v => {
          if (v && v.metas) presArray.push(...v.metas)
          else if (Array.isArray(v)) presArray.push(...v)
          else presArray.push(v)
        })
      } else if (payload && payload.state) {
        // some versions use state
        Object.values(payload.state).forEach(v => {
          if (v && v.metas) presArray.push(...v.metas)
          else if (Array.isArray(v)) presArray.push(...v)
          else presArray.push(v)
        })
      } else if (payload && typeof payload === 'object') {
        // fallback: object of presences
        Object.values(payload).forEach(v => {
          if (v && v.metas) presArray.push(...v.metas)
          else if (Array.isArray(v)) presArray.push(...v)
          else if (v && v.user_id) presArray.push(v)
        })
      }
    } catch (e) {
      console.warn('Error normalizing presence payload', e, payload)
    }

    presArray.forEach(presence => {
      const uid = presence?.user_id || presence?.user?.id || presence?.user?.uid || presence?.id
      if (!uid) return
      if (uid !== this.userId) {
        this.otherPlayers.set(uid, presence)
      }
    })

    if (this.callbacks.onPlayerUpdate) {
      this.callbacks.onPlayerUpdate(Array.from(this.otherPlayers.values()))
    }
  }

  // Helper to normalize presence event payloads
  normalizePresenceEvent(payload) {
    if (!payload) return null
    if (payload.presence_event) return payload.presence_event
    if (payload.event && payload.event.presence_event) return payload.event.presence_event
    if (payload.new_presences) return payload.new_presences[0] || null
    if (payload.new_presence) return payload.new_presence
    if (payload.user_id) return payload
    if (Array.isArray(payload) && payload.length > 0) return payload[0]
    return null
  }

  // Handle player joined
  handlePlayerJoined(payload) {
    const ev = this.normalizePresenceEvent(payload)
    if (!ev) return
    const uid = ev.user_id || ev.user?.id || ev.user?.uid || ev.id
    if (!uid || uid === this.userId) return

    this.otherPlayers.set(uid, ev)

    if (this.callbacks.onPlayerJoined) {
      this.callbacks.onPlayerJoined(ev)
    }
  }

  // Handle player left
  handlePlayerLeft(payload) {
    const ev = this.normalizePresenceEvent(payload)
    const uid = ev?.user_id || ev?.user?.id || ev?.user?.uid || ev?.id
    if (!uid) return

    this.otherPlayers.delete(uid)

    if (this.callbacks.onPlayerLeft) {
      this.callbacks.onPlayerLeft(uid)
    }
  }

  // Register callback
  on(event, callback) {
    if (event === 'playerUpdate') {
      this.callbacks.onPlayerUpdate = callback
    } else if (event === 'playerJoined') {
      this.callbacks.onPlayerJoined = callback
    } else if (event === 'playerLeft') {
      this.callbacks.onPlayerLeft = callback
    } else if (event === 'chatMessage') {
      this.callbacks.onChatMessage = callback
    }
  }

  // Disconnect
  async disconnect() {
    // persist last known presence into world_positions if available
    try {
      if (this.lastPresence && this.characterId) {
        const p = this.lastPresence
        await supabase.from('world_positions').insert([{
          character_id: this.characterId,
          x: p.x || 0,
          z: p.y || 0,
          lat: p.lat || null,
          lng: p.lng || null,
          street: p.street || p.display_name || null,
          city: p.locality || p.city || this.cityName || null,
          recorded_at: new Date()
        }])
        console.log('Persisted last presence for', this.characterId)
      }
    } catch (err) {
      console.warn('Failed to persist last presence on disconnect:', err)
    }

    if (this.subscription) {
      try { this.subscription.unsubscribe() } catch(e){}
      this.subscription = null
    }
    this.otherPlayers.clear()
  }

  getOtherPlayers() {
    return Array.from(this.otherPlayers.values())
  }
}

// Database operations for persistence
export const WorldDB = {
  async saveWorldEvent(userId, characterId, city, eventType, data) {
    try {
      // Use edge function for event persistence
      const response = await supabase.functions.invoke('world-events', {
        body: {
          action: 'save_event',
          userId,
          characterId,
          city,
          data: { type: eventType, ...data }
        }
      })

      if (response.error) throw response.error
      return true
    } catch (error) {
      console.error('World event save error:', error)
      return false
    }
  },

  async getNearbyPlayers(characterId, city) {
    try {
      const response = await supabase.functions.invoke('world-events', {
        body: {
          action: 'get_nearby_players',
          characterId,
          city
        }
      })

      if (response.error) throw response.error
      return response.data?.players || []
    } catch (error) {
      console.error('Nearby players fetch error:', error)
      return []
    }
  },

  async getNPCInteractions(npcId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('world_events')
        .select('*')
        .eq('event_type', 'npc_chat')
        .filter('event_data->>npcId', 'eq', npcId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('NPC interactions fetch error:', error)
      return []
    }
  }
}
