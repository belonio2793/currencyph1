import { supabase } from './supabaseClient'

import { supabase } from './supabaseClient'

// Basic user search for typeahead
export async function searchUsers(query, limit = 10) {
  if (!query) return []
  const q = `%${query}%`
  const { data, error } = await supabase
    .from('users')
    .select('id,full_name,email')
    .or(`full_name.ilike.${q},email.ilike.${q}`)
    .limit(limit)
  if (error) {
    console.warn('User search error', error)
    return []
  }
  return data || []
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
  // Build payload
  const payload = { type: 'location', location, city, mapLink }
  const { ciphertext, iv } = await encryptPayload(payload)
  const { data, error } = await supabase.from('messages').insert([
    {
      sender_id: senderId,
      recipient_id: recipientId,
      ciphertext,
      iv,
      metadata: { type: 'location', city },
    },
  ])
  if (error) throw error
  return data && data[0]
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
