import React, { useState, useEffect } from 'react'
import { searchUsers, sendLocationMessage } from '../lib/messages'

export default function SendLocationModal({ open, onClose, location, city, senderId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query) return setResults([])
    let mounted = true
    searchUsers(query).then(r => { if (mounted) setResults(r) }).catch(() => {})
    return () => { mounted = false }
  }, [query])

  if (!open) return null

  const handleSend = async () => {
    if (!selectedUser) return setError('Select a recipient')
    setError('')
    setSending(true)
    try {
      const mapLink = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=13/${location.latitude}/${location.longitude}`
      await sendLocationMessage({ senderId, recipientId: selectedUser.id, location, city, mapLink })
      setSending(false)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to send')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Send Location</h3>
          <button onClick={onClose} className="text-slate-600">Close</button>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-600 mb-3">Send your current location to another user. Recipient will receive a link to view the map.</p>

          <div className="mb-3">
            <label className="text-xs text-slate-500">Find user by name or email</label>
            <input value={query} onChange={e => setQuery(e.target.value)} className="w-full px-3 py-2 border rounded mt-1" placeholder="Type name or email" />
            {results.length > 0 && (
              <ul className="border mt-2 max-h-40 overflow-auto">
                {results.map(u => (
                  <li key={u.id} className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${selectedUser && selectedUser.id === u.id ? 'bg-slate-100' : ''}`} onClick={() => setSelectedUser(u)}>
                    <div className="text-sm font-medium">{u.full_name || u.email}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

          <div className="flex items-center gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button onClick={handleSend} disabled={sending} className="px-4 py-2 bg-blue-600 text-white rounded">
              {sending ? 'Sending...' : 'Send Location'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
