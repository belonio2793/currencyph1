import { supabase } from './supabaseClient'

const STORAGE_BUCKET = 'chat-media'

export async function uploadMediaToChat(messageId, file) {
  if (!file) throw new Error('No file provided')
  if (file.size > 50 * 1024 * 1024) throw new Error('File too large (max 50MB)')

  const timestamp = Date.now()
  const filename = `${messageId}/${timestamp}_${file.name.replace(/\s+/g, '_')}`

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, file, { upsert: false })

  if (error) throw error

  const { data: mediaData, error: mediaError } = await supabase
    .from('message_media')
    .insert([{
      message_id: messageId,
      storage_path: filename,
      mime_type: file.type,
      size: file.size
    }])
    .select()

  if (mediaError) throw mediaError
  return mediaData?.[0]
}

export async function getMessageMedia(messageId) {
  const { data, error } = await supabase
    .from('message_media')
    .select('*')
    .eq('message_id', messageId)

  if (error) throw error
  return data || []
}

export async function getMediaDownloadUrl(storagePath) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function deleteMessageMedia(mediaId, storagePath) {
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath])

  if (storageError) console.warn('Storage delete warning:', storageError)

  const { error: dbError } = await supabase
    .from('message_media')
    .delete()
    .eq('id', mediaId)

  if (dbError) throw dbError
  return true
}

export async function uploadVoiceMessage(messageId, audioBlob, duration) {
  const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
  const media = await uploadMediaToChat(messageId, file)

  const { error } = await supabase
    .from('message_media')
    .update({ metadata: { duration } })
    .eq('id', media.id)

  if (error) throw error
  return media
}

export async function getVoiceMessageDuration(mediaId) {
  const { data, error } = await supabase
    .from('message_media')
    .select('metadata')
    .eq('id', mediaId)
    .single()

  if (error) throw error
  return data?.metadata?.duration || 0
}
