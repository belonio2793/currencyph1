import React, { useState, useRef, useEffect } from 'react'
import { COSMETICS, validateCosmetics } from '../../lib/characterCosmetics'

export default function CharacterCustomizer({ cosmetics, onUpdateCosmetics, isOpen, onToggle }) {
  const panelRef = useRef(null)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState('skin')

  const handleMouseDown = (e) => {
    if (e.target.closest('[data-no-drag]')) return
    setIsDragging(true)
    const rect = panelRef.current?.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0)
    })
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-semibold shadow-lg transition-transform hover:scale-105"
      >
        🎨 Customize
      </button>
    )
  }

  const renderSkinTonePreview = () => {
    const selectedSkin = COSMETICS.skinTones.find(s => s.id === cosmetics.skinTone)
    if (!selectedSkin) return null

    const islandX = 60
    const islandY = 60

    return (
      <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
        <defs>
          <radialGradient id="headGradient" cx="40%" cy="40%">
            <stop offset="0%" stopColor={selectedSkin.hex} />
            <stop offset="100%" stopColor={selectedSkin.hex} stopOpacity="0.8" />
          </radialGradient>
        </defs>

        <circle cx={islandX} cy={islandY} r="25" fill="url(#headGradient)" stroke="#333" strokeWidth="1" />

        {cosmetics.hairStyle !== 'bald' && (
          <>
            {cosmetics.hairStyle === 'short' && (
              <path d={`M ${islandX - 20} ${islandY - 20} Q ${islandX} ${islandY - 30} ${islandX + 20} ${islandY - 20}`} fill={cosmetics.hairColor} />
            )}
            {cosmetics.hairStyle === 'medium' && (
              <ellipse cx={islandX} cy={islandY - 18} rx="23" ry="28" fill={cosmetics.hairColor} />
            )}
            {cosmetics.hairStyle === 'long' && (
              <path d={`M ${islandX - 23} ${islandY - 5} Q ${islandX} ${islandY + 20} ${islandX + 23} ${islandY - 5}`} fill={cosmetics.hairColor} stroke={cosmetics.hairColor} strokeWidth="2" />
            )}
            {cosmetics.hairStyle === 'spiky' && (
              <>
                <polygon points={`${islandX},${islandY - 35} ${islandX - 10},${islandY - 20} ${islandX + 10},${islandY - 20}`} fill={cosmetics.hairColor} />
                <polygon points={`${islandX - 15},${islandY - 28} ${islandX - 25},${islandY - 15} ${islandX - 10},${islandY - 20}`} fill={cosmetics.hairColor} />
                <polygon points={`${islandX + 15},${islandY - 28} ${islandX + 25},${islandY - 15} ${islandX + 10},${islandY - 20}`} fill={cosmetics.hairColor} />
              </>
            )}
            {cosmetics.hairStyle === 'curly' && (
              <>
                <circle cx={islandX - 18} cy={islandY - 22} r="8" fill={cosmetics.hairColor} />
                <circle cx={islandX} cy={islandY - 32} r="10" fill={cosmetics.hairColor} />
                <circle cx={islandX + 18} cy={islandY - 22} r="8" fill={cosmetics.hairColor} />
              </>
            )}
          </>
        )}

        <circle cx={islandX - 8} cy={islandY - 5} r="2" fill="#000" />
        <circle cx={islandX + 8} cy={islandY - 5} r="2" fill="#000" />
        <path d={`M ${islandX - 5} ${islandY + 5} Q ${islandX} ${islandY + 8} ${islandX + 5} ${islandY + 5}`} stroke="#000" strokeWidth="1" fill="none" />
      </svg>
    )
  }

  const renderOutfitPreview = () => {
    const selectedOutfit = COSMETICS.outfits.find(o => o.id === cosmetics.outfit)
    if (!selectedOutfit) return null

    const centerX = 70
    const centerY = 70

    return (
      <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
        <defs>
          <linearGradient id="torsoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={selectedOutfit.top} />
            <stop offset="100%" stopColor={selectedOutfit.bottom} />
          </linearGradient>
        </defs>

        <rect x={centerX - 18} y={centerY - 5} width="36" height="40" rx="3" fill="url(#torsoGradient)" stroke="#333" strokeWidth="1" />

        <rect x={centerX - 25} y={centerY + 30} width="16" height="30" fill={selectedOutfit.bottom} stroke="#333" strokeWidth="1" />
        <rect x={centerX + 9} y={centerY + 30} width="16" height="30" fill={selectedOutfit.bottom} stroke="#333" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 50,
        userSelect: isDragging ? 'none' : 'auto'
      }}
      className="w-80 bg-gradient-to-br from-slate-900 to-slate-800 border border-purple-500/30 rounded-lg shadow-2xl overflow-hidden"
    >
      <div
        onMouseDown={handleMouseDown}
        className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 flex items-center justify-between cursor-move"
      >
        <h3 className="text-lg font-bold text-white">Character Customizer</h3>
        <button
          onClick={onToggle}
          data-no-drag
          className="text-white hover:text-slate-200 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        <div className="flex gap-2 border-b border-slate-700 pb-3">
          <button
            onClick={() => setActiveTab('skin')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'skin' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            Skin
          </button>
          <button
            onClick={() => setActiveTab('hair')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'hair' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            Hair
          </button>
          <button
            onClick={() => setActiveTab('outfit')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'outfit' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            Outfit
          </button>
          <button
            onClick={() => setActiveTab('accessories')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'accessories' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            Accessories
          </button>
        </div>

        {activeTab === 'skin' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-700/50 rounded-lg">{renderSkinTonePreview()}</div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Skin Tone:</label>
              <div className="grid grid-cols-3 gap-2">
                {COSMETICS.skinTones.map(tone => (
                  <button
                    key={tone.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, skinTone: tone.id })}
                    className={`p-3 rounded transition-all border-2 ${
                      cosmetics.skinTone === tone.id
                        ? 'border-purple-500 shadow-lg shadow-purple-500/50'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: tone.hex }}
                    title={tone.name}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hair' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-700/50 rounded-lg">{renderSkinTonePreview()}</div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Hair Style:</label>
              <div className="grid grid-cols-3 gap-2">
                {COSMETICS.hairStyles.map(style => (
                  <button
                    key={style.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, hairStyle: style.id })}
                    className={`p-3 rounded transition-all border-2 flex items-center justify-center ${
                      cosmetics.hairStyle === style.id
                        ? 'border-purple-500 bg-purple-600/20 shadow-lg shadow-purple-500/50'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                    title={style.name}
                  >
                    <span className="text-lg">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Hair Color:</label>
              <div className="grid grid-cols-4 gap-2">
                {COSMETICS.hairColors.map(color => (
                  <button
                    key={color.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, hairColor: color.hex })}
                    className={`p-2 rounded transition-all border-2 ${
                      cosmetics.hairColor === color.hex
                        ? 'border-white shadow-lg'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outfit' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-700/50 rounded-lg">{renderOutfitPreview()}</div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Outfit:</label>
              <div className="space-y-2">
                {COSMETICS.outfits.map(outfit => (
                  <button
                    key={outfit.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, outfit: outfit.id })}
                    className={`w-full p-2 rounded transition-all border-2 flex items-center gap-2 ${
                      cosmetics.outfit === outfit.id
                        ? 'border-purple-500 bg-purple-600/20 shadow-lg shadow-purple-500/50'
                        : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-lg">{outfit.label}</span>
                    <span className="text-sm font-medium">{outfit.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accessories' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Customize accessories for each slot:</p>
            {['head', 'eyes', 'neck', 'back', 'hand'].map(slot => {
              const slotAccessories = COSMETICS.accessories.filter(a => a.slot === slot)
              return (
                <div key={slot} className="space-y-1">
                  <label className="text-sm font-medium text-slate-300 capitalize">{slot}:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {slotAccessories.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          const newAccessories = { ...cosmetics.accessories, [slot]: acc.id }
                          onUpdateCosmetics({ ...cosmetics, accessories: newAccessories })
                        }}
                        className={`p-2 rounded transition-all border-2 flex items-center justify-center text-sm ${
                          cosmetics.accessories?.[slot] === acc.id
                            ? 'border-purple-500 bg-purple-600/20 shadow-lg'
                            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
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
        )}

        <div className="pt-3 border-t border-slate-700 flex gap-2">
          <button
            onClick={() => onUpdateCosmetics(validateCosmetics({}))}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium text-slate-200 transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={onToggle}
            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
