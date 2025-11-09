import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DeleteCharacterConfirmModal({ isOpen, character, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type "DELETE" to confirm')
      return
    }

    try {
      setLoading(true)
      setError('')

      const { error: deleteError } = await supabase
        .from('game_characters')
        .delete()
        .eq('id', character.id)

      if (deleteError) throw deleteError

      onSuccess?.(character.id)
      onClose?.()
    } catch (err) {
      console.error('Failed to delete character:', err)
      setError(err.message || 'Failed to delete character')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const isConfirmed = confirmText === 'DELETE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onClose?.()} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-red-600/30 rounded-lg shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-red-600/30 bg-red-600/5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-100">Delete Character</h2>
              <p className="text-sm text-slate-400 mt-1">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-600/10 border border-red-600/20 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Character Info */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-300 mb-2">
              You are about to permanently delete:
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-700 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                {character?.appearance?.thumbnail ? (
                  <img src={character.appearance.thumbnail} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xs text-slate-400">No avatar</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-100 truncate">{character?.name}</p>
                <p className="text-xs text-slate-400">Level {character?.level || 0}</p>
              </div>
            </div>
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Type <span className="font-mono font-bold text-red-400">"DELETE"</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setError('')
              }}
              placeholder="Type DELETE here"
              disabled={loading}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              autoFocus
            />
          </div>

          {/* Warning */}
          <div className="p-3 bg-amber-600/10 border border-amber-600/20 rounded text-amber-300 text-xs">
            <p className="font-medium mb-1">⚠️ Warning:</p>
            <p>All associated data including inventory, properties, and achievements will be permanently deleted.</p>
          </div>
        </div>

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
            onClick={handleDelete}
            disabled={loading || !isConfirmed}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Deleting...' : 'Delete Character'}
          </button>
        </div>
      </div>
    </div>
  )
}
