import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function RenameCharacterModal({ isOpen, character, onClose, onSuccess }) {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && character) {
      setNewName(character.name || '')
      setError('')
    }
  }, [isOpen, character])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!newName.trim()) {
      setError('Character name cannot be empty')
      return
    }

    if (newName.trim() === character.name) {
      setError('New name must be different from current name')
      return
    }

    try {
      setLoading(true)
      setError('')

      const { data, error: updateError } = await supabase
        .from('game_characters')
        .update({ name: newName.trim() })
        .eq('id', character.id)
        .select()
        .single()

      if (updateError) throw updateError

      onSuccess?.(data)
      onClose?.()
    } catch (err) {
      console.error('Failed to rename character:', err)
      setError(err.message || 'Failed to rename character')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onClose?.()} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100">Rename Character</h2>
          <p className="text-sm text-slate-400 mt-1">Change the name of "{character?.name}"</p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-600/10 border border-red-600/20 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">New Character Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onFocus={() => setError('')}
              placeholder="Enter new character name"
              maxLength={50}
              disabled={loading}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">{newName.length}/50 characters</p>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !newName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
