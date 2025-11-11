import React, { useState, useEffect } from 'react'
import { searchUsers, sendLocationMessage } from '../lib/messages'

export default function SendLocationModal({ open, onClose, location, city, senderId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    let mounted = true
    setSearching(true)

    searchUsers(query)
      .then(r => {
        if (mounted) {
          setResults(r || [])
        }
      })
      .catch(err => {
        if (mounted) {
          console.error('Search error:', err)
          setResults([])
        }
      })
      .finally(() => {
        if (mounted) setSearching(false)
      })

    return () => { mounted = false }
  }, [query])

  if (!open) return null

  const handleSend = async () => {
    if (!selectedUser) return setError('Please select a recipient')
    if (!location) return setError('Location not available')
    if (!senderId) return setError('Sender ID not available')

    setError('')
    setSending(true)

    try {
      const mapLink = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=13/${location.latitude}/${location.longitude}`
      await sendLocationMessage({
        senderId,
        recipientId: selectedUser.id,
        location,
        city,
        mapLink
      })
      setQuery('')
      setSelectedUser(null)
      setSending(false)
      onClose()
    } catch (err) {
      console.error('Send error:', err)
      setError(err.message || 'Failed to send location')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-900">Send Location</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-slate-600 mb-4">
            Share your location with a friend. They'll receive a map link showing where you are.
          </p>

          {/* User Search */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 mb-2">Search for a friend</label>
            <div className="relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter name or email (min 2 characters)"
                disabled={sending}
              />
              {searching && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>

            {/* Search Results */}
            {results.length > 0 && (
              <ul className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                {results.map(u => (
                  <li
                    key={u.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors ${
                      selectedUser && selectedUser.id === u.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                    onClick={() => setSelectedUser(u)}
                  >
                    <div className="text-sm font-medium text-slate-900">{u.full_name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </li>
                ))}
              </ul>
            )}

            {query.length > 0 && query.length < 2 && (
              <p className="mt-2 text-xs text-slate-500">Type at least 2 characters to search</p>
            )}

            {query.length >= 2 && results.length === 0 && !searching && (
              <p className="mt-2 text-xs text-slate-500">No users found</p>
            )}
          </div>

          {/* Selected User Display */}
          {selectedUser && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-xs text-slate-600 mb-1">Sending to:</p>
              <p className="text-sm font-medium text-slate-900">{selectedUser.full_name || selectedUser.email}</p>
            </div>
          )}

          {/* Location Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
            <p className="text-xs text-slate-600 mb-2">Location to share:</p>
            <div className="text-xs space-y-1">
              <div><span className="text-slate-600">Latitude:</span> <span className="font-mono text-slate-900">{location?.latitude?.toFixed(6)}</span></div>
              <div><span className="text-slate-600">Longitude:</span> <span className="font-mono text-slate-900">{location?.longitude?.toFixed(6)}</span></div>
              {city && <div><span className="text-slate-600">City:</span> <span className="font-mono text-slate-900">{city}</span></div>}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedUser || !location}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sending && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
            {sending ? 'Sending...' : 'Send Location'}
          </button>
        </div>
      </div>
    </div>
  )
}
