import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { gameAPI } from '../lib/gameAPI'
import CharacterCreation from './game/CharacterCreation'

export default function CharactersPanel({ userId, currentCharacter, onSelectCharacter, onClose }) {
  const [loading, setLoading] = useState(false)
  const [characters, setCharacters] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')
  const [exportedData, setExportedData] = useState(null)
  const [newName, setNewName] = useState('')
  const [newHomeCity, setNewHomeCity] = useState('Manila')
  const [editingCharacter, setEditingCharacter] = useState(null)
  const [showEditor, setShowEditor] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchCharacters()
  }, [userId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose() }
    window.addEventListener('keyup', onKey)
    return () => window.removeEventListener('keyup', onKey)
  }, [onClose])

  async function fetchCharacters() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('game_characters')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (error) throw error
      setCharacters(data || [])
    } catch (err) {
      console.error('Failed to fetch characters', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this character? This action cannot be undone.')) return
    try {
      setLoading(true)
      const { error } = await supabase.from('game_characters').delete().eq('id', id)
      if (error) throw error
      setCharacters(prev => prev.filter(c => c.id !== id))
      if (currentCharacter && currentCharacter.id === id) {
        onSelectCharacter(null)
      }
    } catch (err) {
      console.error('Failed to delete character', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(name, appearance, homeCity) {
    try {
      setLoading(true)
      const char = await gameAPI.createCharacter(userId, name, appearance, homeCity)
      setCharacters(prev => [...prev, char])
      setShowCreate(false)
      // auto-select new char
      onSelectCharacter(char)
    } catch (err) {
      console.error('Create failed', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => onClose && onClose()} />
      <div className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Characters</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowCreate(!showCreate) }} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm">{showCreate ? 'Close' : 'New'}</button>
            <button onClick={fetchCharacters} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-sm">Refresh</button>
            <button onClick={() => onClose && onClose()} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-sm">Close</button>
          </div>
        </div>

        {error && <div className="mb-2 p-2 bg-red-600/10 border border-red-600/20 text-red-300 text-sm rounded">{error}</div>}

        {showCreate ? (
          <div className="mb-3 h-[70vh] flex flex-col">
            <div className="flex-1 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 p-4">
              <div className="text-sm text-slate-400 mb-3">ReadyPlayer.me support removed. Provide a simple avatar image URL below (optional) or skip to create a character with a default icon.</div>
              <div className="mb-3">
                <label className="block text-sm text-slate-300 mb-1">Avatar Image URL (optional)</label>
                <input value={exportedData?.thumbnail || ''} onChange={(e)=>setExportedData({ ...(exportedData || {}), thumbnail: e.target.value })} placeholder="https://.../avatar.jpg" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100" />
              </div>
            </div>

            <div className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">Character Name</label>
                  <input value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="Enter character name" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100" />

                  <label className="block text-sm text-slate-300 mt-3 mb-1">Home City</label>
                  <select value={newHomeCity} onChange={(e)=>setNewHomeCity(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100">
                    <option>Manila</option>
                    <option>Quezon City</option>
                    <option>Cebu</option>
                    <option>Davao</option>
                  </select>

                  <div className="flex gap-2 mt-3">
                    <button onClick={async () => {
                      if (!newName.trim()) {
                        alert('Please enter a character name')
                        return
                      }
                      const appearance = {
                        ...(exportedData || {}),
                        gender: 'male',
                        skin_tone: 'medium',
                        height: 175,
                        build: 'average'
                      }
                      await handleCreate(newName, appearance, newHomeCity)
                      setExportedData(null)
                      setNewName('')
                      setNewHomeCity('Manila')
                    }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">Create Character</button>
                    <button onClick={() => { setExportedData(null) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-100">Reset</button>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-28 h-28 bg-slate-700 rounded overflow-hidden flex items-center justify-center">
                    {exportedData?.thumbnail ? (
                      <img src={exportedData.thumbnail} className="w-full h-full object-cover" alt="preview" />
                    ) : (
                      <div className="text-xs text-slate-400">No preview</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loading && <div className="text-sm text-slate-400">Loading…</div>}
            {!loading && characters.length === 0 && <div className="text-sm text-slate-400">No characters found. Click New to create one.</div>}
            {characters.map(c => (
              <div key={c.id} className={`p-2 rounded border ${currentCharacter && currentCharacter.id === c.id ? 'border-blue-500 bg-blue-500/6' : 'border-slate-700 bg-slate-800'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-700 rounded overflow-hidden flex items-center justify-center">
                    {
                      (() => {
                        const url = c.appearance?.thumbnail || c.appearance?.avatar_url || c.appearance?.rpm?.thumbnail || c.appearance?.rpm?.meta?.imageUrl || c.appearance?.rpm?.model_url || null
                        if (url) return <img src={url} alt={c.name} className="w-full h-full object-cover" />
                        return <div className="text-xs text-slate-400">No avatar</div>
                      })()
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-xs text-slate-400">Level {c.level || 0} • {c.current_location || c.home_city || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingCharacter(c); setShowEditor(true) }} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-xs text-white">Edit</button>
                        <button onClick={() => handleDelete(c.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      {showEditor && editingCharacter && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setShowEditor(false); setEditingCharacter(null) }} />
          <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden p-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Avatar Image URL</label>
                <input value={editingCharacter?.appearance?.thumbnail || ''} onChange={(e)=>setEditingCharacter({...editingCharacter, appearance: {...(editingCharacter.appearance||{}), thumbnail: e.target.value }})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100" />
              </div>
              <div className="flex gap-2">
                <button onClick={async () => {
                  try {
                    const updated = await gameAPI.updateCharacterAppearance(editingCharacter.id, editingCharacter.appearance || {})
                    await fetchCharacters()
                    if (typeof onSelectCharacter === 'function') onSelectCharacter(updated)
                    setShowEditor(false)
                    setEditingCharacter(null)
                  } catch(e) { console.warn('Save avatar failed', e); alert('Failed to save avatar') }
                }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white">Save</button>
                <button onClick={() => { setShowEditor(false); setEditingCharacter(null) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-100">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
