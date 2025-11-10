import { useState } from 'react'

// Define avatar styles with optional GLTF model URLs
const AVATAR_STYLES = [
  { id: 1, name: 'Doggo', model: 'dog', model_url: 'https://threejs.org/examples/models/gltf/Flamingo.glb', model_scale: 0.03, model_offset: { x:0, y:-2, z:0 }, color: 0xd4a574, emissive: 0x6b5a3a },
  { id: 2, name: 'Kitty', model: 'cat', model_url: 'https://threejs.org/examples/models/gltf/Parrot.glb', model_scale: 0.6, model_offset: { x:0, y: -1, z:0 }, color: 0xc0c0c0, emissive: 0x808080 },
  { id: 3, name: 'Fireman', model: 'fireman', model_url: null, color: 0xcd7f32, emissive: 0x6b3410 },
  { id: 4, name: 'Waitress', model: 'waitress', model_url: null, color: 0xb87333, emissive: 0x5a3a1f },
  { id: 5, name: 'Angel', model: 'angel', model_url: null, color: 0xeaeaea, emissive: 0xb0b0b0 },
  { id: 6, name: 'Clown', model: 'clown', model_url: null, color: 0xe0115f, emissive: 0x7a0a39 },
  { id: 7, name: 'Robot', model: 'robot', model_url: 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb', color: 0x0f52ba, emissive: 0x072d5f },
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
              <button
                key={style.id}
                onClick={() => onSelect(style)}
                onMouseEnter={() => setHoveredId(style.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`relative p-4 rounded-lg border-2 transition-all ${
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

                {/* Selected indicator */}
                {selectedStyle?.id === style.id && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    ✓
                  </div>
                )}
              </button>
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
