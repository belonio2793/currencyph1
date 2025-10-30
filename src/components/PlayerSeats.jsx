import React from 'react'

export default function PlayerSeats({ seats, table, userId, gameState, currentPlayerSeat, dealerSeat }) {
  const getPlayerName = (seat) => {
    if (seat.user_id === userId) return 'You'
    return `Player ${seat.seat_number}`
  }

  const getSeatStatus = (seat) => {
    if (currentPlayerSeat === seat.seat_number) {
      return 'action'
    }
    if (gameState === 'preflop' || gameState === 'flop' || gameState === 'turn' || gameState === 'river') {
      return 'active'
    }
    return 'waiting'
  }

  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: '500px', height: '400px' }}>
        {/* Poker Table SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 400" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="tableGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#1e3a1f', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#0f2310', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          {/* Table shadow */}
          <ellipse cx="250" cy="200" rx="200" ry="150" fill="#000000" opacity="0.3" />
          {/* Table surface */}
          <ellipse cx="250" cy="200" rx="180" ry="130" fill="url(#tableGradient)" stroke="#4b5563" strokeWidth="3" />
          {/* Center circle */}
          <circle cx="250" cy="200" r="25" fill="none" stroke="#6b7280" strokeWidth="2" strokeDasharray="4,4" opacity="0.6" />
        </svg>

        {/* Seats Around Table */}
        <div className="absolute inset-0 flex items-center justify-center">
          {Array.from({ length: table.max_seats || 9 }).map((_, i) => {
            const angle = (i / (table.max_seats || 9)) * Math.PI * 2 - Math.PI / 2
            const radiusX = 220
            const radiusY = 160
            const x = Math.cos(angle) * radiusX
            const y = Math.sin(angle) * radiusY

            const seat = seats?.find(s => s.seat_number === i + 1)
            const rotateDeg = (angle * 180 / Math.PI) + 90

            return (
              <div
                key={i}
                className="absolute flex flex-col items-center justify-center"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  left: '50%',
                  top: '50%',
                }}
              >
                {seat ? (
                  <div
                    className={`w-20 h-24 rounded-xl border-3 flex flex-col items-center justify-center gap-1 text-center text-xs font-semibold transition transform ${
                      getSeatStatus(seat) === 'action'
                        ? 'bg-red-500 border-red-400 shadow-2xl scale-125 animate-pulse'
                        : getSeatStatus(seat) === 'active'
                        ? 'bg-amber-600 border-amber-500 shadow-xl scale-110'
                        : 'bg-amber-700 border-amber-600 shadow-lg scale-100'
                    }`}
                    style={{
                      transform: `rotate(${-rotateDeg}deg) ${
                        getSeatStatus(seat) === 'action' ? 'scale(1.25)' :
                        getSeatStatus(seat) === 'active' ? 'scale(1.1)' : 'scale(1)'
                      }`,
                      boxShadow: getSeatStatus(seat) === 'action'
                        ? '0 0 30px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.6)'
                        : getSeatStatus(seat) === 'active'
                        ? '0 0 20px rgba(217, 119, 6, 0.6)'
                        : '0 0 10px rgba(217, 119, 6, 0.3)'
                    }}
                  >
                    <div className="text-xl">{dealerSeat === seat.seat_number ? '♠️' : '💰'}</div>
                    <div className="font-bold text-white">{getPlayerName(seat)}</div>
                    <div className="text-xs text-amber-100">Seat {seat.seat_number}</div>
                  </div>
                ) : (
                  <div
                    className="w-16 h-20 rounded-lg border-2 border-dashed border-slate-500 flex flex-col items-center justify-center text-xs text-slate-400 hover:border-slate-400 transition hover:bg-slate-800/30"
                    style={{
                      transform: `rotate(${-rotateDeg}deg)`,
                    }}
                  >
                    <div className="text-lg">○</div>
                    <div>Seat</div>
                    <div className="font-mono">{i + 1}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Game State Indicator */}
        {gameState && gameState !== 'waiting' && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2">
            <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg">
              <div className="text-xs font-semibold text-slate-300">
                {gameState === 'preflop' && '🎴 Pre-Flop'}
                {gameState === 'flop' && '📊 Flop (3 cards)'}
                {gameState === 'turn' && '🎲 Turn (4 cards)'}
                {gameState === 'river' && '🌊 River (5 cards)'}
                {gameState === 'showdown' && '🏆 Showdown'}
                {gameState === 'finished' && '✓ Hand Complete'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
