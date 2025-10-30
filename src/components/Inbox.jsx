import React, { useEffect, useState } from 'react'
import { fetchRecentMessagesForUser, deleteMessage } from '../lib/messages'

export default function Inbox({ userId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!userId) return setLoading(false)
    // If userId is not a UUID, skip server fetch (guest-local or similar)
    const isUuid = typeof userId === 'string' && /^[0-9a-fA-F-]{36}$/.test(userId)
    if (!isUuid) {
      setLoading(false)
      setMessages([])
      return
    }
    let mounted = true
    fetchRecentMessagesForUser(userId).then(items => {
      if (!mounted) return
      setMessages(items)
      setLoading(false)
    }).catch(err => { if (mounted) { setError(err.message||String(err)); setLoading(false) } })
    return () => { mounted = false }
  }, [userId])

  const handleDelete = async (id) => {
    try {
      await deleteMessage(id)
      setMessages(messages.filter(m => m.id !== id))
      setSelected(null)
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h2 className="text-xl font-semibold mb-4">Inbox</h2>
      {loading && <div className="text-sm text-slate-500">Loading messages...</div>}
      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1">
          <ul className="border rounded divide-y max-h-[60vh] overflow-auto">
            {messages.map(m => (
              <li key={m.id} className="p-3 hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(m)}>
                <div className="text-sm font-medium">{m.metadata?.type || 'Message'}</div>
                <div className="text-xs text-slate-500">From: {m.sender_id}</div>
                <div className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString()}</div>
              </li>
            ))}
            {messages.length === 0 && !loading && <li className="p-3 text-sm text-slate-500">No messages</li>}
          </ul>
        </div>

        <div className="col-span-2">
          {selected ? (
            <div className="bg-white border rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Message</div>
                  <div className="text-xs text-slate-500">{new Date(selected.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDelete(selected.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Delete</button>
                </div>
              </div>

              <div className="text-sm text-slate-700">
                {selected.payload ? (
                  <div>
                    {selected.payload.type === 'location' ? (
                      <div className="space-y-3">
                        <div>Location: {selected.payload.location.latitude.toFixed(4)}, {selected.payload.location.longitude.toFixed(4)}</div>
                        {selected.payload.city && <div>City: {selected.payload.city}</div>}
                        {selected.payload.mapLink && (
                          <a href={selected.payload.mapLink} target="_blank" rel="noreferrer" className="text-blue-600">Open map link</a>
                        )}
                      </div>
                    ) : (
                      <pre className="text-xs bg-slate-50 p-2 rounded">{JSON.stringify(selected.payload, null, 2)}</pre>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Encrypted or unavailable</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Select a message to view details</div>
          )}
        </div>
      </div>
    </div>
  )
}
