import React, { useEffect, useRef, useState } from 'react'

export default function CharacterCustomizer({ isOpen, onToggle, character }) {
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

  if (!isOpen) return null

  const itemSlots = Array.from({ length: 12 }, (_, i) => ({ id: `slot-${i}`, index: i }))
  const owned = (character && Array.isArray(character.properties)) ? character.properties : []

  const formatCurrency = (n) => `₱${Number(n || 0).toLocaleString()}`

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
      className="w-96 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl overflow-hidden"
    >
      <div
        onMouseDown={handleMouseDown}
        className="bg-gradient-to-r from-teal-700 to-teal-800 px-4 py-3 flex items-center justify-between cursor-move border-b border-teal-600"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🎒</span>
          <h3 className="text-lg font-bold text-white">Inventory</h3>
        </div>
        <button
          onClick={onToggle}
          data-no-drag
          className="text-white hover:text-slate-200 transition-colors text-xl"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 bg-slate-800/50">
        <div className="grid grid-cols-4 gap-3">
          {itemSlots.map((slot) => {
            const item = owned[slot.index]
            return (
              <div key={slot.id} className="relative aspect-square cursor-pointer group">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-900 rounded border-2 border-slate-500 hover:border-teal-500 transition-all flex items-center justify-center">
                  {item ? (
                    <div className="flex flex-col items-center justify-center text-slate-200 p-2">
                      <div className="text-3xl">🏠</div>
                      <div className="text-xs mt-1 text-center truncate w-full">{item.name}</div>
                      <div className="text-xs text-amber-300 mt-1">{formatCurrency(item.current_value || item.price)}</div>
                    </div>
                  ) : (
                    <div className="absolute inset-1 bg-gradient-to-br from-slate-700 via-slate-900 to-slate-950 rounded flex items-center justify-center text-slate-500 text-3xl transition-colors">
                      <span className="opacity-40">📦</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-20 bg-teal-500 pointer-events-none transition-opacity"></div>
              </div>
            )
          })}
        </div>

        <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-400">Gold: <span className="text-yellow-400 font-bold">{formatCurrency(character?.wealth)}</span></div>
          <button
            onClick={onToggle}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 rounded text-sm font-medium text-white transition-all shadow-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
