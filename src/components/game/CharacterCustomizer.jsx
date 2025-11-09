import React, { useState, useRef } from 'react'
import { COSMETICS, getCosmeticOption } from '../../lib/characterCosmetics'

export default function CharacterCustomizer({ cosmetics, onUpdateCosmetics, isOpen, onToggle }) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 20, y: 100 })
  const panelRef = useRef(null)

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-shadow z-40 flex items-center gap-2"
      >
        <span>⚙️</span> Customize
      </button>
    )
  }

  const handleMouseDown = (e) => {
    if (e.target.closest('.panel-header')) {
      setIsDragging(true)
      const rect = panelRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const handleCosmeticChange = (category, value) => {
    onUpdateCosmetics({
      ...cosmetics,
      [category]: value,
    })
  }

  const handleAccessoryChange = (slot, value) => {
    onUpdateCosmetics({
      ...cosmetics,
      accessories: {
        ...cosmetics.accessories,
        [slot]: value,
      },
    })
  }

  const skinTone = getCosmeticOption('skinTones', cosmetics.skinTone)
  const hairColor = getCosmeticOption('hairColors', cosmetics.hairColor)

  return (
    <div
      ref={panelRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500 rounded-lg shadow-2xl w-96 text-white z-50"
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="panel-header bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 rounded-t-md flex items-center justify-between cursor-move hover:from-purple-700 hover:to-blue-700">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span>🎨</span> Customize Character
        </h2>
        <button
          onClick={onToggle}
          className="text-white hover:text-yellow-300 font-bold text-xl"
        >
          ✕
        </button>
      </div>

      {/* Preview */}
      <div className="bg-slate-900/50 mx-4 mt-4 p-4 rounded-lg border border-purple-400/30 text-center">
        <div className="text-sm text-slate-300 mb-2">Preview</div>
        <div className="flex justify-center items-center h-24 bg-slate-800/30 rounded mb-2">
          <div className="text-5xl">👤</div>
        </div>
        <div className="text-xs text-slate-400">
          {skinTone?.name} • {COSMETICS.hairStyles.find(h => h.id === cosmetics.hairStyle)?.name}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-4 max-h-96 overflow-y-auto">
        {/* Skin Tone */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-yellow-300">Skin Tone</label>
          <div className="grid grid-cols-3 gap-2">
            {COSMETICS.skinTones.map(tone => (
              <button
                key={tone.id}
                onClick={() => handleCosmeticChange('skinTone', tone.id)}
                className={`p-3 rounded-lg font-medium text-sm transition-all ${
                  cosmetics.skinTone === tone.id
                    ? 'ring-2 ring-yellow-400 scale-105'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: tone.hex, color: '#000' }}
                title={tone.name}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Style */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-yellow-300">Hair Style</label>
          <div className="grid grid-cols-3 gap-2">
            {COSMETICS.hairStyles.map(style => (
              <button
                key={style.id}
                onClick={() => handleCosmeticChange('hairStyle', style.id)}
                className={`p-3 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 transition-all ${
                  cosmetics.hairStyle === style.id ? 'ring-2 ring-yellow-400 scale-105' : ''
                }`}
                title={style.name}
              >
                {style.label} {style.name}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-yellow-300">Hair Color</label>
          <div className="grid grid-cols-4 gap-2">
            {COSMETICS.hairColors.map(color => (
              <button
                key={color.id}
                onClick={() => handleCosmeticChange('hairColor', color.id)}
                className={`p-3 rounded-lg font-medium text-sm transition-all border-2 ${
                  cosmetics.hairColor === color.id
                    ? 'border-yellow-400 scale-105'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {color.name.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Outfit */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-yellow-300">Outfit</label>
          <div className="grid grid-cols-2 gap-2">
            {COSMETICS.outfits.map(outfit => (
              <button
                key={outfit.id}
                onClick={() => handleCosmeticChange('outfit', outfit.id)}
                className={`p-3 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 transition-all flex items-center gap-2 ${
                  cosmetics.outfit === outfit.id ? 'ring-2 ring-yellow-400 scale-105' : ''
                }`}
                title={outfit.name}
              >
                <div
                  style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    backgroundColor: outfit.top,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <div
                  style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    backgroundColor: outfit.bottom,
                    borderRadius: '0 0 4px 4px',
                  }}
                />
                <span className="text-xs">{outfit.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Accessories */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-yellow-300">Accessories</label>
          <div className="space-y-2">
            {['head', 'eyes', 'neck', 'back', 'hand'].map(slot => {
              const slotAccessories = COSMETICS.accessories.filter(a => a.slot === slot)
              return (
                <div key={slot}>
                  <div className="text-xs text-slate-400 mb-1 capitalize">{slot}:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {slotAccessories.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => handleAccessoryChange(slot, acc.id)}
                        className={`p-2 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 transition-all ${
                          cosmetics.accessories[slot] === acc.id
                            ? 'ring-2 ring-yellow-400 scale-105'
                            : ''
                        }`}
                        title={acc.name}
                      >
                        {acc.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-900/50 border-t border-purple-400/30 rounded-b-md text-xs text-slate-400">
        Drag to move • Changes saved automatically
      </div>
    </div>
  )
}
