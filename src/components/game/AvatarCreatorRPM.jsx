import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AvatarCreatorRPM({ open, onClose, characterId, userId, onExport }) {
  const iframeRef = useRef(null)
  const [status, setStatus] = useState('Initializing…')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    const handleMessage = async (event) => {
      if (!event.data || event.data.source !== 'readyplayerme') return
      const { eventName, data } = event.data
      if (eventName === 'v1.frame.ready') {
        setStatus('Creator ready')
        // subscribe to exported event
        iframeRef.current?.contentWindow?.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' }, '*')
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
              .select('appearance')
              .eq('id', characterId)
              .single()
            if (fetchErr) throw fetchErr
            const nextAppearance = { ...(existing?.appearance || {}), rpm_model_url: modelUrl, rpm_meta: meta }
            const { error: upErr } = await supabase
              .from('game_characters')
              .update({ appearance: nextAppearance, updated_at: new Date() })
              .eq('id', characterId)
            if (upErr) throw upErr
            setStatus('Saved. You can close this window.')
            setSaving(false)
          } else if (typeof onExport === 'function') {
            // If no characterId provided, call onExport with exported data
            setStatus('Avatar exported — ready to create character')
            try { onExport({ rpm_model_url: modelUrl, rpm_meta: meta }) } catch(e) { console.warn('onExport handler error', e) }
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
      <button onClick={onClose} className="absolute top-2 right-2 z-30 bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1 text-xs">Close</button>
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
