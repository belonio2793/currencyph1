import React, { useState, useEffect } from 'react'

import React, { useState, useEffect } from 'react'

// Define avatar styles with optional GLTF model URLs
const AVATAR_STYLES = [
  { id: 1, name: 'Doggo', model: 'dog', model_url: 'https://threejs.org/examples/models/gltf/Flamingo.glb', model_scale: 0.03, model_offset: { x:0, y:-2, z:0 }, color: 0xd4a574, emissive: 0x6b5a3a },
  { id: 2, name: 'Kitty', model: 'cat', model_url: 'https://threejs.org/examples/models/gltf/Parrot.glb', model_scale: 0.6, model_offset: { x:0, y: -1, z:0 }, color: 0xc0c0c0, emissive: 0x808080 },
  { id: 3, name: 'Fireman', model: 'fireman', model_url: null, color: 0xcd7f32, emissive: 0x6b3410 },
  { id: 4, name: 'Waitress', model: 'waitress', model_url: null, color: 0xb87333, emissive: 0x5a3a1f },
  { id: 5, name: 'Angel', model: 'angel', model_url: null, color: 0xeaeaea, emissive: 0xb0b0b0 },
  { id: 6, name: 'Clown', model: 'clown', model_url: null, color: 0xe0115f, emissive: 0x7a0a39 },
  { id: 7, name: 'Robot', model: 'robot', model_url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb', model_scale: 0.45, model_offset: { x:0, y:-1, z:0 }, color: 0x0f52ba, emissive: 0x072d5f },
  { id: 8, name: 'Superhero', model: 'superhero', model_url: null, color: 0x50c878, emissive: 0x2a6d48 },
  { id: 9, name: 'Wizard', model: 'wizard', model_url: null, color: 0x9966cc, emissive: 0x5a3e80 },
  { id: 10, name: 'Pirate', model: 'pirate', model_url: null, color: 0xffd700, emissive: 0xaa8c00 },
  { id: 11, name: 'Alien', model: 'alien', model_url: null, color: 0x36454f, emissive: 0x1a2229 },
  { id: 12, name: 'Ninja', model: 'ninja', model_url: null, color: 0x2c3e50, emissive: 0x16202a },
  { id: 13, name: 'Fairy', model: 'fairy', model_url: null, color: 0x36393f, emissive: 0x1a1d1f },
  { id: 14, name: 'Detective', model: 'detective', model_url: null, color: 0x001f3f, emissive: 0x00101f },
  { id: 15, name: 'Chef', model: 'chef', model_url: null, color: 0x1c1c1c, emissive: 0x0a0a0a },
  { id: 16, name: 'Unicorn', model: 'unicorn', model_url: null, color: 0xff10f0, emissive: 0x8a0580 },
  { id: 17, name: 'Knight', model: 'knight', model_url: null, color: 0x00ffff, emissive: 0x008080 },
  { id: 18, name: 'Doctor', model: 'doctor', model_url: null, color: 0x00ff00, emissive: 0x008000 },
  { id: 19, name: 'Teacher', model: 'teacher', model_url: null, color: 0xff6600, emissive: 0x993300 },
  { id: 20, name: 'Detective Dog', model: 'detective_dog', model_url: null, color: 0xcc00ff, emissive: 0x660080 },
]

const AVATAR_PREVIEWS = {1:'🐶',2:'🐱',3:'👨‍🚒',4:'🧑‍🍳',5:'😇',6:'🤡',7:'🤖',8:'🦸',9:'🧙',10:'🏴‍☠️',11:'👽',12:'🥷',13:'🧚',14:'🕵️',15:'👩‍🍳',16:'🦄',17:'🛡️',18:'👩‍⚕️',19:'🧑‍🏫',20:'🐕‍🦺'}

export default function AvatarCustomizer({ selectedStyle, onSelect, onClose }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editFields, setEditFields] = useState({ model_url: '', model_scale: 1, model_offset_x: 0, model_offset_y: 0, model_offset_z: 0 })
  const [brokenMap, setBrokenMap] = useState({})

  // validate model urls on mount
  useEffect(() => {
    let active = true
    const check = async () => {
      const map = {}
      await Promise.all(AVATAR_STYLES.map(async (s) => {
        if (!s.model_url) return
        try {
          const controller = new AbortController()
          const id = setTimeout(() => controller.abort(), 5000)
          await fetch(s.model_url, { method: 'HEAD', signal: controller.signal })
          clearTimeout(id)
          map[s.id] = false
        } catch (e) {
          map[s.id] = true
        }
      }))
      if (active) setBrokenMap(map)
    }
    check()
    return () => { active = false }
  }, [])

  const startEdit = (style) => {
    setEditing(style.id)
    setEditFields({
      model_url: style.model_url || '',
      model_scale: style.model_scale || 1,
      model_offset_x: (style.model_offset && style.model_offset.x) || 0,
      model_offset_y: (style.model_offset && style.model_offset.y) || 0,
      model_offset_z: (style.model_offset && style.model_offset.z) || 0,
    })
  }

  const validateUrl = async (url) => {
    if (!url) return true
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 5000)
      await fetch(url, { method: 'HEAD', signal: controller.signal })
      clearTimeout(id)
      return true
    } catch (e) {
      return false
    }
  }

  const applyPreview = async (style) => {
    const url = editFields.model_url || style.model_url
    if (url) {
      const ok = await validateUrl(url)
      if (!ok) return alert('Model URL not reachable — please fix or remove it before previewing.')
    }
    // merge edits into style and preview without closing
    const updated = { ...style, model_url: editFields.model_url || null, model_scale: Number(editFields.model_scale) || 1, model_offset: { x: Number(editFields.model_offset_x)||0, y: Number(editFields.model_offset_y)||0, z: Number(editFields.model_offset_z)||0 } }
    if (typeof onSelect === 'function') onSelect(updated, { close: false })
  }

  const applySave = async (style) => {
    const url = editFields.model_url || style.model_url
    if (url) {
      const ok = await validateUrl(url)
      if (!ok) return alert('Model URL not reachable — please fix or remove it before saving.')
    }
    const updated = { ...style, model_url: editFields.model_url || null, model_scale: Number(editFields.model_scale) || 1, model_offset: { x: Number(editFields.model_offset_x)||0, y: Number(editFields.model_offset_y)||0, z: Number(editFields.model_offset_z)||0 } }
    if (typeof onSelect === 'function') onSelect(updated, { close: true })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Choose Your Avatar Style</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Grid of avatars */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {AVATAR_STYLES.map((style) => (
              <div key={style.id} className={`relative p-0 rounded-lg transition-all ${selectedStyle?.id === style.id ? 'ring-2 ring-emerald-400' : ''}`}>
                <button
                  onClick={() => { setHoveredId(style.id); if (!editing) { const updated = style; if (typeof onSelect === 'function') onSelect(updated, { close: false }) } }}
                  onMouseEnter={() => setHoveredId(style.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedStyle?.id === style.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : hoveredId === style.id
                      ? 'border-slate-500 bg-slate-700'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  {/* Avatar preview (emoji if available, fallback to color) */}
                  <div className="w-full aspect-square rounded-lg mb-2 shadow-lg flex items-center justify-center text-4xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.06))' }}>
                    <span>{(typeof AVATAR_PREVIEWS !== 'undefined' && AVATAR_PREVIEWS[style.id]) || '🙂'}</span>
                  </div>

                  {/* Style name */}
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-100 truncate">{style.name}</p>
                    <p className="text-xs text-slate-400">#{style.id}</p>
                  </div>
                </button>

                {/* Edit button */}
                <button onClick={() => startEdit(style)} title="Edit model" className="absolute top-2 right-2 bg-slate-700/60 hover:bg-slate-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">✎</button>

                {/* Broken model badge */}
                {brokenMap[style.id] && (
                  <div title="Model URL unreachable" className="absolute top-2 right-11 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">!</div>
                )}

                {/* Selected indicator */}
                {selectedStyle?.id === style.id && (
                  <div className="absolute top-2 left-2 bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</div>
                )}

                {/* Inline editor */}
                {editing === style.id && (
                  <div className="mt-2 p-3 bg-slate-800 border border-slate-700 rounded">
                    <label className="text-xs text-slate-300">Model URL (GLB/GLTF)</label>
                    <input value={editFields.model_url} onChange={(e) => setEditFields({...editFields, model_url: e.target.value})} className="w-full mt-1 mb-2 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" placeholder="https://cdn.example.com/models/dog.glb" />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-300">Scale</label>
                        <input type="number" step="0.01" value={editFields.model_scale} onChange={(e) => setEditFields({...editFields, model_scale: e.target.value})} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-300">Offset Y</label>
                        <input type="number" step="0.1" value={editFields.model_offset_y} onChange={(e) => setEditFields({...editFields, model_offset_y: e.target.value})} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-300">Offset X</label>
                        <input type="number" step="0.1" value={editFields.model_offset_x} onChange={(e) => setEditFields({...editFields, model_offset_x: e.target.value})} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-xs text-slate-300">Offset Z</label>
                        <input type="number" step="0.1" value={editFields.model_offset_z} onChange={(e) => setEditFields({...editFields, model_offset_z: e.target.value})} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                      <div className="flex items-end gap-2">
                        <button onClick={() => applyPreview(style)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white">Preview</button>
                        <button onClick={() => applySave(style)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-xs text-white">Save & Apply</button>
                        <button onClick={() => setEditing(null)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white">Close</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800 border-t border-slate-700 p-4 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Selected: <span className="text-emerald-400 font-semibold">{selectedStyle?.name || 'None'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
