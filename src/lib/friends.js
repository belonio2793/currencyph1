import { supabase } from './supabaseClient'

export async function sendFriendRequest(requesterId, receiverId, message = '') {
  const { data, error } = await supabase
    .from('friend_requests')
    .insert([{ requester_id: requesterId, receiver_id: receiverId, message }])
  if (error) throw error
  return data?.[0]
}

export async function acceptFriendRequest(requestId) {
  const { data: request, error: getError } = await supabase
    .from('friend_requests')
    .select('requester_id, receiver_id')
    .eq('id', requestId)
    .single()

  if (getError) throw getError

  await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)

  const { requester_id: requesterId, receiver_id: receiverId } = request
  await supabase
    .from('friends')
    .insert([
      { user_id: requesterId, friend_id: receiverId, status: 'accepted' },
      { user_id: receiverId, friend_id: requesterId, status: 'accepted' }
    ])

  return true
}

export async function rejectFriendRequest(requestId) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
  if (error) throw error
  return true
}

export async function blockUser(userId, blockedUserId) {
  const { data, error } = await supabase
    .from('friends')
    .insert([{ user_id: userId, friend_id: blockedUserId, status: 'blocked' }])
  if (error) throw error
  return data?.[0]
}

export async function unblockUser(userId, unblockedUserId) {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', unblockedUserId)
    .eq('status', 'blocked')
  if (error) throw error
  return true
}

export async function removeFriend(userId, friendId) {
  const { error: err1 } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', friendId)

  const { error: err2 } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', userId)

  if (err1 || err2) throw err1 || err2
  return true
}

export async function getFriendsList(userId) {
  const { data, error } = await supabase
    .from('friends')
    .select('friend_id, users:friend_id(id, full_name, email, phone)')
    .eq('user_id', userId)
    .eq('status', 'accepted')

  if (error) throw error
  return (data || []).map(f => ({
    ...f.users,
    status: 'accepted'
  }))
}

export async function getPendingFriendRequests(userId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, requester_id, message, created_at, users:requester_id(id, full_name, email)')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getSentFriendRequests(userId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, receiver_id, status, created_at, users:receiver_id(id, full_name, email)')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function isFriend(userId, otherUserId) {
  const { data, error } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', otherUserId)
    .eq('status', 'accepted')
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return !!data
}

export async function getBlockedUsers(userId) {
  const { data, error } = await supabase
    .from('friends')
    .select('friend_id, users:friend_id(id, full_name, email)')
    .eq('user_id', userId)
    .eq('status', 'blocked')

  if (error) throw error
  return (data || []).map(f => ({
    ...f.users,
    status: 'blocked'
  }))
}
