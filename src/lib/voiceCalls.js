import { supabase } from './supabaseClient'

export async function initiateVoiceCall(callerId, recipientId, callType = 'voice', conversationId = null) {
  try {
    const { data, error } = await supabase
      .from('voice_calls')
      .insert([{
        caller_id: callerId,
        recipient_id: recipientId,
        conversation_id: conversationId,
        call_type: callType,
        status: 'pending'
      }])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.warn('Initiate call error:', err)
    throw err
  }
}

export async function acceptVoiceCall(callId) {
  try {
    const { data, error } = await supabase
      .from('voice_calls')
      .update({
        status: 'accepted',
        started_at: new Date().toISOString()
      })
      .eq('id', callId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.warn('Accept call error:', err)
    throw err
  }
}

export async function rejectVoiceCall(callId) {
  try {
    const { data, error } = await supabase
      .from('voice_calls')
      .update({ status: 'rejected' })
      .eq('id', callId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.warn('Reject call error:', err)
    throw err
  }
}

export async function endVoiceCall(callId, durationSeconds = 0) {
  try {
    const { data, error } = await supabase
      .from('voice_calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds
      })
      .eq('id', callId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.warn('End call error:', err)
    throw err
  }
}

export async function missVoiceCall(callId) {
  try {
    const { data, error } = await supabase
      .from('voice_calls')
      .update({ status: 'missed' })
      .eq('id', callId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.warn('Miss call error:', err)
    throw err
  }
}

export async function getCallHistory(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('voice_calls')
      .select('*, caller:caller_id(id, full_name, email), recipient:recipient_id(id, full_name, email)')
      .or(`caller_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('Get call history error:', err)
    return []
  }
}

export async function subscribeToIncomingCalls(userId, onIncomingCall) {
  const channel = supabase
    .channel(`incoming_calls:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'voice_calls',
      filter: `recipient_id=eq.${userId}`
    }, (payload) => {
      onIncomingCall(payload.new)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export async function subscribeToCallUpdates(callId, onUpdate) {
  const channel = supabase
    .channel(`call_updates:${callId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'voice_calls',
      filter: `id=eq.${callId}`
    }, (payload) => {
      onUpdate(payload.new)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}
