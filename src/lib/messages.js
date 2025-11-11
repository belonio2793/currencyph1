import { supabase } from './supabaseClient'

// Basic user search for typeahead
export async function searchUsers(query, limit = 10) {
  if (!query || query.trim().length === 0) return []

  const trimmedQuery = query.trim().toLowerCase()

  try {
    // Try searching in both full_name and email fields
    const { data, error } = await supabase
      .from('users')
      .select('id,full_name,email')
      .or(`full_name.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%`)
      .limit(limit)

    if (error) {
      console.warn('User search error:', error)
      return []
    }

    // Filter out duplicates by id
    const seen = new Set()
    return (data || []).filter(u => {
      if (seen.has(u.id)) return false
      seen.add(u.id)
      return true
    })
  } catch (err) {
    console.error('Search users exception:', err)
    return []
  }
}

// Client-side key stored in localStorage to allow basic encryption
const LOCAL_KEY_NAME = 'currency_ph_msg_key'

async function getClientKey() {
  const existing = localStorage.getItem(LOCAL_KEY_NAME)
  if (existing) {
    const raw = Uint8Array.from(atob(existing), c => c.charCodeAt(0))
    return await window.crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
  }
  // generate new key
  const key = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const raw = new Uint8Array(await window.crypto.subtle.exportKey('raw', key))
  const b64 = btoa(String.fromCharCode(...raw))
  localStorage.setItem(LOCAL_KEY_NAME, b64)
  return key
}

async function encryptPayload(payloadObj) {
  const key = await getClientKey()
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const data = enc.encode(JSON.stringify(payloadObj))
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const cipherArr = new Uint8Array(cipher)
  return {
    ciphertext: btoa(String.fromCharCode(...cipherArr)),
    iv: btoa(String.fromCharCode(...iv))
  }
}

async function decryptPayload(ciphertextB64, ivB64) {
  try {
    const key = await getClientKey()
    const cipherArr = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
    const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherArr)
    const dec = new TextDecoder()
    return JSON.parse(dec.decode(plain))
  } catch (err) {
    console.warn('Decrypt error', err)
    return null
  }
}

export async function sendLocationMessage({ senderId, recipientId, location, city, mapLink }) {
  try {
    if (!senderId || !recipientId) {
      throw new Error('Sender and recipient IDs are required')
    }
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new Error('Valid location with latitude and longitude is required')
    }

    // Build payload
    const payload = { type: 'location', location, city, mapLink }
    const { ciphertext, iv } = await encryptPayload(payload)

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: senderId,
          recipient_id: recipientId,
          ciphertext,
          iv,
          metadata: { type: 'location', city },
        },
      ])
      .select()

    if (error) {
      console.error('Message insert error:', error)
      throw new Error(`Failed to send location: ${error.message}`)
    }

    if (!data || data.length === 0) {
      throw new Error('No data returned from message insert')
    }

    return data[0]
  } catch (err) {
    console.error('sendLocationMessage exception:', err)
    throw err
  }
}

export async function deleteMessage(messageId) {
  const { data, error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', messageId)
  if (error) throw error
  return data
}

export async function fetchRecentMessagesForUser(userId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  // try decrypting payloads where possible
  return Promise.all((data || []).map(async (m) => {
    if (m.ciphertext && m.iv) {
      const payload = await decryptPayload(m.ciphertext, m.iv)
      return { ...m, payload }
    }
    return m
  }))
}
