import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AvatarCreatorRPM({ open, onClose, characterId, userId, onExport, onSaved, showCloseButton = true }) {
  const iframeRef = useRef(null)
  const [status, setStatus] = useState('Initializing…')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(null)
  const [iframeReady, setIframeReady] = useState(false)

  // Load saved avatar URL when editing an existing character
  useEffect(() => {
    if (!open || !characterId) return

    const loadSavedAvatar = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('game_characters')
          .select('appearance')
          .eq('id', characterId)
          .single()

        if (fetchErr) throw fetchErr

        if (data?.appearance?.rpm?.model_url) {
          setSavedAvatarUrl(data.appearance.rpm.model_url)
          setStatus('Loading saved avatar…')
        } else {
          setStatus('No previous avatar found')
        }
      } catch (e) {
        console.warn('Failed to load saved avatar:', e.message)
        setStatus('Ready to create new avatar')
      }
    }

    loadSavedAvatar()
  }, [open, characterId])

  useEffect(() => {
    if (!open) return

    const handleMessage = async (event) => {
      if (!event.data || event.data.source !== 'readyplayerme') return
      const { eventName, data } = event.data
      if (eventName === 'v1.frame.ready') {
        setStatus(savedAvatarUrl ? 'Avatar loaded' : 'Creator ready')
        setIframeReady(true)
        // subscribe to exported event
        iframeRef.current?.contentWindow?.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' }, '*')

        // If we have a saved avatar, load it in the editor
        if (savedAvatarUrl && iframeRef.current) {
          try {
            iframeRef.current.contentWindow.postMessage({
              target: 'readyplayerme',
              type: 'loadAvatar',
              url: savedAvatarUrl
            }, '*')
          } catch (e) {
            console.warn('Could not pre-load saved avatar:', e.message)
          }
        }
      }
      if (eventName === 'v1.avatar.exported') {
        try {
          const modelUrl = data?.url || data?.avatarUrl || ''
          const meta = data || {}

          if (characterId) {
            setStatus('Avatar exported, saving…')
            setSaving(true)
            // Merge into appearance JSON to avoid schema changes
            const { data: existing, error: fetchErr } = await supabase
              .from('game_characters')
              .select('appearance,user_id')
              .eq('id', characterId)
              .single()
            if (fetchErr) throw fetchErr
            const existingAppearance = existing?.appearance || {}

            // upload thumbnail to storage if present
            let thumbnailUrl = existingAppearance.rpm?.thumbnail || existingAppearance.rpm_meta?.imageUrl || meta?.imageUrl || null
            try {
              if (meta?.imageUrl) {
                const res = await fetch(meta.imageUrl)
                if (res.ok) {
                  const blob = await res.blob()
                  const ext = blob.type?.split('/')?.[1] || 'png'
                  const path = `${existing.user_id || 'user'}/${characterId}-${Date.now()}.${ext}`
                  const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob)
                  if (!upErr) {
                    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
                    thumbnailUrl = publicData.publicUrl
                  } else {
                    console.warn('Thumbnail upload failed', upErr.message)
                  }
                }
              }
            } catch (e) {
              console.warn('Thumbnail save failed', e.message)
            }

            const nextAppearance = {
              ...(existingAppearance || {}),
              rpm: {
                model_url: modelUrl || existingAppearance.rpm?.model_url || null,
                thumbnail: thumbnailUrl || existingAppearance.rpm?.thumbnail || null,
                meta: meta || existingAppearance.rpm?.meta || null
              }
            }

            // extract common fields
            nextAppearance.hair_color = nextAppearance.hair_color || meta?.hairColor || nextAppearance.hair_color || null
            nextAppearance.skin_color = nextAppearance.skin_color || meta?.skinColor || nextAppearance.skin_color || null
            nextAppearance.height = nextAppearance.height || nextAppearance.height || 175
            nextAppearance.build = nextAppearance.build || 'average'

            const { error: upErr } = await supabase
              .from('game_characters')
              .update({ appearance: nextAppearance, updated_at: new Date() })
              .eq('id', characterId)
            if (upErr) throw upErr
            // fetch updated character
            const { data: updatedChar } = await supabase
              .from('game_characters')
              .select('*')
              .eq('id', characterId)
              .single()
            setStatus('Saved. You can close this window.')
            setSaving(false)
            if (typeof onSaved === 'function') {
              try { onSaved(updatedChar) } catch(e) { console.warn('onSaved handler error', e) }
            }
          } else if (typeof onExport === 'function') {
            // If no characterId provided, call onExport with exported data
            setStatus('Avatar exported — ready to create character')
            try { onExport({ rpm_model_url: modelUrl, rpm_meta: meta }) } catch(e) { console.warn('onExport handler error', e) }
            if (typeof onSaved === 'function') {
              try { onSaved({ rpm_model_url: modelUrl, rpm_meta: meta }) } catch(e) { console.warn('onSaved handler error', e) }
            }
          } else {
            setStatus('Avatar exported — no handler to receive it')
          }
        } catch (e) {
          console.error('RPM save failed', e)
          setError(e.message || String(e))
        } finally {
          setSaving(false)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [open, characterId, userId, onExport])

  if (!open) return null

  return (
    <div className="w-full h-full">
      <div className="absolute top-2 left-3 text-xs text-slate-300 bg-black/40 px-2 py-1 rounded z-30">
        {saving ? 'Saving…' : status}
        {error ? <span className="text-red-400 ml-2">{error}</span> : null}
      </div>
      {showCloseButton ? (
        <button onClick={onClose} className="absolute top-2 right-2 z-30 bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1 text-xs">Close</button>
      ) : null}
      <iframe
        ref={iframeRef}
        title="Ready Player Me"
        src={`https://readyplayer.me/avatar?frameApi=1&clearCache=1&bodyType=fullbody`}
        allow="camera *; clipboard-write"
        className="w-full h-full border-0"
      />
    </div>
  )
}
