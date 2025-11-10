import { useState } from 'react'

// Define 50 different avatar styles with color and material variations
const AVATAR_STYLES = [
  // Classic colors
  { id: 1, name: 'Golden Classic', color: 0xd4a574, emissive: 0x6b5a3a },
  { id: 2, name: 'Silver Shine', color: 0xc0c0c0, emissive: 0x808080 },
  { id: 3, name: 'Bronze Steel', color: 0xcd7f32, emissive: 0x6b3410 },
  { id: 4, name: 'Copper Glow', color: 0xb87333, emissive: 0x5a3a1f },
  { id: 5, name: 'Pearl White', color: 0xeaeaea, emissive: 0xb0b0b0 },
  
  // Vibrant colors
  { id: 6, name: 'Ruby Red', color: 0xe0115f, emissive: 0x7a0a39 },
  { id: 7, name: 'Sapphire Blue', color: 0x0f52ba, emissive: 0x072d5f },
  { id: 8, name: 'Emerald Green', color: 0x50c878, emissive: 0x2a6d48 },
  { id: 9, name: 'Amethyst Purple', color: 0x9966cc, emissive: 0x5a3e80 },
  { id: 10, name: 'Citrine Yellow', color: 0xffd700, emissive: 0xaa8c00 },
  
  // Dark metallic
  { id: 11, name: 'Dark Iron', color: 0x36454f, emissive: 0x1a2229 },
  { id: 12, name: 'Gunmetal Gray', color: 0x2c3e50, emissive: 0x16202a },
  { id: 13, name: 'Charcoal Black', color: 0x36393f, emissive: 0x1a1d1f },
  { id: 14, name: 'Deep Navy', color: 0x001f3f, emissive: 0x00101f },
  { id: 15, name: 'Obsidian', color: 0x1c1c1c, emissive: 0x0a0a0a },
  
  // Neon/Bright
  { id: 16, name: 'Neon Pink', color: 0xff10f0, emissive: 0x8a0580 },
  { id: 17, name: 'Neon Cyan', color: 0x00ffff, emissive: 0x008080 },
  { id: 18, name: 'Neon Green', color: 0x00ff00, emissive: 0x008000 },
  { id: 19, name: 'Neon Orange', color: 0xff6600, emissive: 0x993300 },
  { id: 20, name: 'Neon Purple', color: 0xcc00ff, emissive: 0x660080 },
  
  // Pastel colors
  { id: 21, name: 'Pastel Pink', color: 0xffc0cb, emissive: 0x997673 },
  { id: 22, name: 'Pastel Blue', color: 0xb0e0e6, emissive: 0x6b8896 },
  { id: 23, name: 'Pastel Green', color: 0x98ff98, emissive: 0x5a985a },
  { id: 24, name: 'Pastel Yellow', color: 0xffffe0, emissive: 0x999980 },
  { id: 25, name: 'Pastel Purple', color: 0xe6d5fa, emissive: 0x8a7f9e },
  
  // Metallic variants
  { id: 26, name: 'Rose Gold', color: 0xb76e79, emissive: 0x5a3739 },
  { id: 27, name: 'Champagne', color: 0xf7e7ce, emissive: 0x9a8f7f },
  { id: 28, name: 'Platinum', color: 0xe5e4e2, emissive: 0x8a8986 },
  { id: 29, name: 'Titanium Gray', color: 0xcccccf, emissive: 0x7a7a7f },
  { id: 30, name: 'Chrome', color: 0xe8e8e8, emissive: 0x999999 },
  
  // Nature-inspired
  { id: 31, name: 'Forest Green', color: 0x228b22, emissive: 0x114511 },
  { id: 32, name: 'Ocean Blue', color: 0x006994, emissive: 0x00344a },
  { id: 33, name: 'Sunset Orange', color: 0xff7f50, emissive: 0x993f2a },
  { id: 34, name: 'Midnight Blue', color: 0x191970, emissive: 0x0c0d38 },
  { id: 35, name: 'Forest Brown', color: 0x8b4513, emissive: 0x452209 },
  
  // Cool tones
  { id: 36, name: 'Ice Blue', color: 0xb0e0e6, emissive: 0x5a7072 },
  { id: 37, name: 'Frost White', color: 0xf0f8ff, emissive: 0x7f8c8f },
  { id: 38, name: 'Cyan Cool', color: 0x00bfff, emissive: 0x005f7f },
  { id: 39, name: 'Arctic Silver', color: 0xdfe4ea, emissive: 0x6f7275 },
  { id: 40, name: 'Cool Purple', color: 0x8b7ba8, emissive: 0x453d54 },
  
  // Warm tones
  { id: 41, name: 'Warm Peach', color: 0xffb347, emissive: 0x995a28 },
  { id: 42, name: 'Coral Red', color: 0xff6f61, emissive: 0x993a38 },
  { id: 43, name: 'Terracotta', color: 0xe2725b, emissive: 0x714139 },
  { id: 44, name: 'Burnt Sienna', color: 0xe97451, emissive: 0x753a28 },
  { id: 45, name: 'Warm Tan', color: 0xcd9b7f, emissive: 0x664d40 },
  
  // Exotic
  { id: 46, name: 'Holographic', color: 0x00ffff, emissive: 0xff00ff },
  { id: 47, name: 'Gradient Spectrum', color: 0xff00ff, emissive: 0x00ffff },
  { id: 48, name: 'Iridescent', color: 0xffd700, emissive: 0xff69b4 },
  { id: 49, name: 'Luminescent', color: 0xffff33, emissive: 0xff00ff },
  { id: 50, name: 'Prismatic', color: 0x00ff7f, emissive: 0xff007f },
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
