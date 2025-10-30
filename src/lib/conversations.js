import { supabase } from './supabaseClient'
import { generateSymmetricKey, exportKeyToBase64, importKeyFromBase64 } from './crypto'

export async function createConversation(createdBy, title = null, participantIds = []) {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert([{ created_by: createdBy, title }])
    .select()
    .single()

  if (convError) throw convError

  const memberRecords = [
    { conversation_id: conv.id, user_id: createdBy, role: 'admin' },
    ...participantIds.map(pid => ({ conversation_id: conv.id, user_id: pid, role: 'member' }))
  ]

  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert(memberRecords)

  if (memberError) throw memberError

  const conversationKey = await generateSymmetricKey()
  const keyB64 = await exportKeyToBase64(conversationKey)
  localStorage.setItem(`conv_key_${conv.id}`, keyB64)

  return conv
}

export async function addParticipantToConversation(conversationId, userId, role = 'member') {
  const { data, error } = await supabase
    .from('conversation_members')
    .insert([{ conversation_id: conversationId, user_id: userId, role }])
  if (error) throw error
  return data?.[0]
}

export async function removeParticipantFromConversation(conversationId, userId) {
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  if (error) throw error
  return true
}

export async function getConversationsByUser(userId) {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations(id, created_by, title, created_at)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(cm => cm.conversations).filter(Boolean)
}

export async function getConversationMembers(conversationId) {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, role, users(id, full_name, email, phone)')
    .eq('conversation_id', conversationId)

  if (error) throw error
  return (data || []).map(cm => ({
    ...cm.users,
    role: cm.role
  }))
}

export async function updateConversationTitle(conversationId, title) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteConversation(conversationId) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (error) throw error
  localStorage.removeItem(`conv_key_${conversationId}`)
  return true
}

export async function getConversationKey(conversationId) {
  const keyB64 = localStorage.getItem(`conv_key_${conversationId}`)
  if (keyB64) {
    return importKeyFromBase64(keyB64)
  }

  const key = await generateSymmetricKey()
  const newKeyB64 = await exportKeyToBase64(key)
  localStorage.setItem(`conv_key_${conversationId}`, newKeyB64)
  return key
}

export async function getOrCreateDirectConversation(userId1, userId2) {
  const sortedIds = [userId1, userId2].sort()
  const title = `direct_${sortedIds.join('_')}`

  const { data: existing, error: existError } = await supabase
    .from('conversations')
    .select('id, title')
    .eq('title', title)
    .maybeSingle()

  if (existError && existError.code !== 'PGRST116') throw existError

  if (existing) {
    return existing.id
  }

  const conv = await createConversation(userId1, title, [userId2])
  return conv.id
}

export async function getConversationMessages(conversationId, limit = 100) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, users:sender_id(id, full_name, email)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function sendConversationMessage(conversationId, senderId, plaintext, type = 'text') {
  const key = await getConversationKey(conversationId)
  
  const { encryptString } = await import('./crypto')
  const { ciphertext, iv } = await encryptString(key, plaintext)

  const { data, error } = await supabase
    .from('messages')
    .insert([{
      sender_id: senderId,
      conversation_id: conversationId,
      ciphertext,
      iv,
      metadata: { type, via: 'conversation' }
    }])
    .select()

  if (error) throw error
  return data?.[0]
}

export async function deleteConversationMessage(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) throw error
  return true
}

export async function editConversationMessage(messageId, newPlaintext) {
  const { data: message, error: getError } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('id', messageId)
    .single()

  if (getError) throw getError

  const key = await getConversationKey(message.conversation_id)
  const { encryptString } = await import('./crypto')
  const { ciphertext, iv } = await encryptString(key, newPlaintext)

  const { error } = await supabase
    .from('messages')
    .update({ ciphertext, iv, metadata: { edited_at: new Date().toISOString() } })
    .eq('id', messageId)

  if (error) throw error
  return true
}
