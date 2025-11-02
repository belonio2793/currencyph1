import React, { useState, useEffect } from 'react'

export default function GameCombat({ combatData, onClose }) {
  const [animating, setAnimating] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setAnimating(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!combatData) return null

  const { won, xpGain, itemsDropped, combatLog } = combatData
  const enemy = combatLog.enemy_type

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-opacity ${animating ? 'opacity-100' : 'opacity-0'}`}>
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg max-w-md w-full p-8 border-2 border-yellow-500">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">
            {won ? '⚔️' : '💥'}
          </div>
          
          <h2 className={`text-3xl font-bold mb-4 ${won ? 'text-green-400' : 'text-red-400'}`}>
            {won ? 'Victory!' : 'Defeated!'}
          </h2>

          <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
            <p className="text-slate-400 text-sm">You fought a</p>
            <p className="text-2xl font-bold capitalize">{enemy}</p>
            <p className="text-slate-400 text-sm mt-1">Level {combatLog.enemy_level}</p>
          </div>

          {won && (
            <>
              <div className="space-y-3 mb-6">
                {xpGain > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                    <p className="text-slate-400 text-sm">Experience Gained</p>
                    <p className="text-2xl font-bold text-green-400">+{xpGain} XP</p>
                  </div>
                )}

                {itemsDropped.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                    <p className="text-slate-400 text-sm">Items Dropped</p>
                    <div className="mt-2 space-y-1">
                      {itemsDropped.map((item, idx) => (
                        <p key={idx} className="text-blue-400">🎁 {item.name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!won && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-4 mb-6">
              <p className="text-slate-400">You were defeated. Recover and try again!</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-bold"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
