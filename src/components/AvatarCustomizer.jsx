import React, { useEffect, useRef, useState } from 'react'
import { World3D } from '../lib/world3D'

// Avatar definitions with optional GLTF model URLs and default scale/offset
const AVATAR_STYLES = [
  { id: 1, name: 'Doggo', model: 'dog', model_url: null, model_scale: 1, model_offset: { x: 0, y: 0, z: 0 }, color: 0xd4a574, emissive: 0x6b5a3a },
  { id: 2, name: 'Kitty', model: 'cat', model_url: null, model_scale: 1, model_offset: { x: 0, y: 0, z: 0 }, color: 0xc0c0c0, emissive: 0x808080 },
  { id: 3, name: 'Fireman', model: 'fireman', model_url: null, color: 0xcd7f32, emissive: 0x6b3410 },
  { id: 4, name: 'Waitress', model: 'waitress', model_url: null, color: 0xb87333, emissive: 0x5a3a1f },
  { id: 5, name: 'Angel', model: 'angel', model_url: null, color: 0xeaeaea, emissive: 0xb0b0b0 },
  { id: 6, name: 'Clown', model: 'clown', model_url: null, color: 0xe0115f, emissive: 0x7a0a39 },
  { id: 7, name: 'Robot', model: 'robot', model_url: null, model_scale: 1, model_offset: { x: 0, y: 0, z: 0 }, color: 0x0f52ba, emissive: 0x072d5f },
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

const AVATAR_PREVIEWS = { 1: '🐶', 2: '🐱', 3: '👨‍🚒', 4: '🧑‍🍳', 5: '😇', 6: '🤡', 7: '🤖', 8: '🦸', 9: '🧙', 10: '🏴‍☠️', 11: '👽', 12: '🥷', 13: '🧚', 14: '🕵️', 15: '👩‍🍳', 16: '🦄', 17: '🛡️', 18: '👩‍⚕️', 19: '🧑‍🏫', 20: '🐕‍🦺' }

export default function AvatarCustomizer({ selectedStyle, onSelect, onClose }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editFields, setEditFields] = useState({ model_url: '', model_scale: 1, model_offset_x: 0, model_offset_y: 0, model_offset_z: 0 })
  const [brokenMap, setBrokenMap] = useState({})
  const [visibleMap, setVisibleMap] = useState(() => AVATAR_STYLES.reduce((m, s) => (m[s.id] = true, m), {}))
  const previewRef = useRef(null)
  const worldRef = useRef(null)
  const previewPlayerId = 'avatar-preview'

  useEffect(() => {
    let active = true
    const check = async () => {
      const map = {}
      await Promise.all(
        AVATAR_STYLES.map(async (s) => {
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
        })
      )
      if (active) setBrokenMap(map)
    }
    check()
    return () => { active = false }
  }, [])

  useEffect(() => {
    // create small World3D preview when previewRef is available
    if (!previewRef.current) return
    const container = previewRef.current
    const world = new World3D(container)
    // align preview camera with main world view for accurate preview
    try {
      world.cameraConfig.mode = 'freecam'
      world.camera.position.set(0, 57, 114)
      world.camera.lookAt(0, 0, 0)
    } catch(e) {}
    world.start()
    worldRef.current = world

    return () => {
      try { world.destroy() } catch (e) {}
      worldRef.current = null
    }
  }, [])

  // Update preview when hovered or selected style changes
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    const style = AVATAR_STYLES.find(s => s.id === (hoveredId || (selectedStyle && selectedStyle.id)))
    // clear previous
    try { world.removePlayer(previewPlayerId) } catch (e) {}

    if (!style) return

    ;(async () => {
      try {
        // Pass an options object so the preview uses the style color and model URL
        const playerGroup = await world.addPlayer(previewPlayerId, style.name, { model_url: style.model_url || null, color: style.color || 0x00a8ff }, 0, 0)
        // apply scale and offset if model is present
        try {
          if (playerGroup && playerGroup.children && playerGroup.children[0]) {
            const model = playerGroup.children[0]
            const scale = (style.model_scale != null) ? style.model_scale : 1
            model.scale.setScalar(scale)
            const offset = style.model_offset || { x: 0, y: 0, z: 0 }
            model.position.x = offset.x || 0
            model.position.y = offset.y || 0
            model.position.z = offset.z || 0
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // failed to load model for preview, fallback handled inside World3D
      }
    })()
  }, [hoveredId, selectedStyle])

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
    // Force color-only preview: ignore any model_url entered
    const updated = { ...style, model_url: null, model_scale: 1, model_offset: { x: 0, y: 0, z: 0 }, color: style.color || 0x00a8ff }
    if (typeof onSelect === 'function') onSelect(updated, { close: false })
  }

  const applySave = async (style) => {
    // Force color-only save: ignore any model_url entered
    const updated = { ...style, model_url: null, model_scale: 1, model_offset: { x: 0, y: 0, z: 0 }, color: style.color || 0x00a8ff }
    if (typeof onSelect === 'function') onSelect(updated, { close: true })
  }

  const toggleVisibility = (id) => {
    setVisibleMap(prev => {
      const next = { ...prev, [id]: !prev[id] }
      // if currently selected style is the one toggled, notify parent so it can persist visibility
      if (selectedStyle && selectedStyle.id === id && typeof onSelect === 'function') {
        const updated = { ...selectedStyle, visible: !!next[id] }
        try { onSelect(updated, { close: false }) } catch(e) {}
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex">

        <div className="w-3/5 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {AVATAR_STYLES.map((style) => (
              <div key={style.id} className={`relative p-0 rounded-lg transition-all transform ${selectedStyle?.id === style.id ? 'ring-2 ring-emerald-400 scale-105' : hoveredId === style.id ? 'scale-105' : ''}`}>
                <button
                  onClick={() => { setHoveredId(style.id); if (!editing) { const updated = style; if (typeof onSelect === 'function') onSelect(updated, { close: false }) } }}
                  onMouseEnter={() => setHoveredId(style.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full p-3 rounded-lg border-2 transition-all shadow-md hover:shadow-xl hover:scale-105 ${selectedStyle?.id === style.id ? 'border-emerald-500 bg-emerald-500/6' : hoveredId === style.id ? 'border-slate-500 bg-slate-700' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}`}>

                  <div className="w-full aspect-square rounded-lg mb-2 shadow-inner flex items-center justify-center text-4xl" style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.06)), conic-gradient(from 200deg, #0000 0%, #0000 100%)` }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `#${(style.color || 0x666666).toString(16).padStart(6,'0')}`, boxShadow: 'inset 0 -6px 12px rgba(0,0,0,0.3)' }}>
                      <span style={{ fontSize: 28 }}>{AVATAR_PREVIEWS[style.id] || '🙂'}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-100 truncate">{style.name}</p>
                    <p className="text-xs text-slate-400">#{style.id}</p>
                  </div>
                </button>

                <button onClick={() => startEdit(style)} title="Edit model" className="absolute top-2 right-2 bg-slate-700/60 hover:bg-slate-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">✎</button>

                <button onClick={() => toggleVisibility(style.id)} title={visibleMap[style.id] ? 'Hide in world' : 'Show in world'} className={`absolute top-2 left-2 rounded-full w-8 h-8 flex items-center justify-center text-sm ${visibleMap[style.id] ? 'bg-slate-800 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                  {visibleMap[style.id] ? '👁️' : '🙈'}
                </button>

                {brokenMap[style.id] && <div title="Model URL unreachable" className="absolute top-2 right-11 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">!</div>}
                {style.model_url && <div title="Has 3D model" className="absolute bottom-2 right-2 bg-slate-700 text-white rounded px-2 py-1 text-xs">3D</div>}
                {selectedStyle?.id === style.id && <div className="absolute top-2 left-12 bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</div>}

                {editing === style.id && (
                  <div className="mt-2 p-3 bg-slate-800 border border-slate-700 rounded">
                    <label className="text-xs text-slate-300">Model URL (GLB/GLTF)</label>
                    <input value={editFields.model_url} onChange={(e) => setEditFields({ ...editFields, model_url: e.target.value })} className="w-full mt-1 mb-2 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" placeholder="https://cdn.example.com/models/dog.glb" />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-300">Scale</label>
                        <input type="number" step="0.01" value={editFields.model_scale} onChange={(e) => setEditFields({ ...editFields, model_scale: e.target.value })} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-300">Offset Y</label>
                        <input type="number" step="0.1" value={editFields.model_offset_y} onChange={(e) => setEditFields({ ...editFields, model_offset_y: e.target.value })} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-300">Offset X</label>
                        <input type="number" step="0.1" value={editFields.model_offset_x} onChange={(e) => setEditFields({ ...editFields, model_offset_x: e.target.value })} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-xs text-slate-300">Offset Z</label>
                        <input type="number" step="0.1" value={editFields.model_offset_z} onChange={(e) => setEditFields({ ...editFields, model_offset_z: e.target.value })} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white" />
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

        <div className="w-2/5 border-l border-slate-700 p-4 flex flex-col">
          <div className="text-white font-semibold mb-2">Preview</div>
          <div ref={previewRef} className="flex-1 rounded bg-[#071022] shadow-inner" style={{ minHeight: 300 }} />
          <div className="mt-3 text-xs text-slate-400">Hover a style to preview it in 3D. Use the edit button to attach a GLB/GLTF model for richer outfits. Visibility toggles will affect whether that outfit is visible in the game world.</div>
        </div>

      </div>

      <div className="fixed bottom-8 right-8 bg-slate-800 border border-slate-700 p-3 rounded shadow-lg flex items-center gap-3">
        <div className="text-sm text-slate-300">Selected: <span className="text-emerald-400 font-semibold">{selectedStyle?.name || 'None'}</span></div>
        <button onClick={onClose} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-white font-medium">Done</button>
      </div>
    </div>
  )
}
