import React, { useState, useRef, useEffect } from 'react'

export default function CharacterCustomizer({ isOpen, onToggle }) {
  const panelRef = useRef(null)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

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
    return null
  }

  const itemSlots = [
    { id: 'head', label: '👤', name: 'Head' },
    { id: 'chest', label: '👕', name: 'Chest' },
    { id: 'hands', label: '🧤', name: 'Hands' },
    { id: 'legs', label: '👖', name: 'Legs' },
    { id: 'feet', label: '👞', name: 'Feet' },
    { id: 'accessory1', label: '✨', name: 'Accessory 1' },
    { id: 'accessory2', label: '💎', name: 'Accessory 2' },
    { id: 'weapon', label: '⚔️', name: 'Weapon' }
  ]

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

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Item Slots:</label>
          <div className="grid grid-cols-4 gap-3">
            {itemSlots.map(slot => (
              <div
                key={slot.id}
                className="aspect-square bg-slate-700/50 border-2 border-slate-600 rounded-lg hover:border-purple-500 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 p-2"
                title={slot.name}
              >
                <span className="text-2xl">{slot.label}</span>
                <span className="text-xs text-slate-400 text-center">{slot.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-700 flex gap-2">
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
