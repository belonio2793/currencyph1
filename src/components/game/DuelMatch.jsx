import React, { useState, useEffect, useRef } from 'react'

export default function DuelMatch({ sessionId, player, opponent, onEnd, userId, userEmail }) {
  const [playerHealth, setPlayerHealth] = useState(100)
  const [opponentHealth, setOpponentHealth] = useState(100)
  const [turn, setTurn] = useState('player')
  const [gameLog, setGameLog] = useState(['Duel started!'])
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState(null)
  const [selectedAction, setSelectedAction] = useState(null)
  const timeoutIdsRef = useRef([])
  const MAX_LOG_ENTRIES = 50

  const actions = [
    { id: 'attack', name: 'Attack', damage: { min: 15, max: 25 }, icon: '⚔️' },
    { id: 'heavy', name: 'Heavy Attack', damage: { min: 25, max: 35 }, icon: '💥' },
    { id: 'defend', name: 'Defend', damage: { min: -10, max: 0 }, icon: '🛡️' },
    { id: 'heal', name: 'Heal', damage: { min: -20, max: 0 }, icon: '💚' }
  ]

  useEffect(() => {
    if (playerHealth <= 0) {
      setGameOver(true)
      setWinner(opponent.name)
      setGameLog(prev => [...prev, `${opponent.name} wins!`])
    } else if (opponentHealth <= 0) {
      setGameOver(true)
      setWinner(player.name)
      setGameLog(prev => [...prev, `${player.name} wins!`])
    }
  }, [playerHealth, opponentHealth, player.name, opponent.name])

  const executeAction = (action) => {
    if (gameOver || selectedAction) return

    const damage = Math.floor(Math.random() * (action.damage.max - action.damage.min + 1)) + action.damage.min
    const actualDamage = action.id === 'defend' ? Math.max(0, -damage) : Math.max(0, damage)
    const isHealing = damage < 0

    if (turn === 'player') {
      const newOpponentHealth = Math.max(0, opponentHealth - actualDamage)
      setOpponentHealth(newOpponentHealth)
      setGameLog(prev => {
        const newLog = [...prev, `${player.name} uses ${action.name}! ${isHealing ? 'Heals' : 'Deals'} ${actualDamage} ${isHealing ? 'HP' : 'damage'}!`]
        return newLog.length > MAX_LOG_ENTRIES ? newLog.slice(-MAX_LOG_ENTRIES) : newLog
      })
      setSelectedAction(action.id)

      const timeoutId = setTimeout(() => {
        setTurn('opponent')
        setSelectedAction(null)
      }, 800)
      timeoutIdsRef.current.push(timeoutId)
    } else {
      const newPlayerHealth = Math.max(0, playerHealth - actualDamage)
      setPlayerHealth(newPlayerHealth)
      setGameLog(prev => {
        const newLog = [...prev, `${opponent.name} uses ${action.name}! ${isHealing ? 'Heals' : 'Deals'} ${actualDamage} ${isHealing ? 'HP' : 'damage'}!`]
        return newLog.length > MAX_LOG_ENTRIES ? newLog.slice(-MAX_LOG_ENTRIES) : newLog
      })
      setSelectedAction(action.id)

      const timeoutId = setTimeout(() => {
        setTurn('player')
        setSelectedAction(null)
      }, 800)
      timeoutIdsRef.current.push(timeoutId)
    }
  }

  // Opponent AI turn
  useEffect(() => {
    if (turn === 'opponent' && !gameOver && !selectedAction) {
      const opponentDelay = setTimeout(() => {
        const randomAction = actions[Math.floor(Math.random() * actions.length)]
        executeAction(randomAction)
      }, 1200)

      timeoutIdsRef.current.push(opponentDelay)
      return () => clearTimeout(opponentDelay)
    }
  }, [turn, gameOver, selectedAction])

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(id => clearTimeout(id))
      timeoutIdsRef.current = []
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-w-2xl w-full mx-4 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500 rounded-lg overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">⚔️ Duel Match</h2>
          <div className="text-sm text-slate-200">Session: {sessionId.slice(0, 8)}</div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-100">{player.name}</h3>
                <p className="text-xs text-slate-400">You</p>
              </div>
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-3xl font-bold text-green-400">{Math.max(0, playerHealth)}</span>
                  <span className="text-slate-400"> / 100 HP</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${playerHealth > 50 ? 'bg-green-500' : playerHealth > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${playerHealth}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                <div className="text-6xl mb-2">🧑</div>
                <p className="text-xs text-slate-400">Your character</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-100">{opponent.name}</h3>
                <p className="text-xs text-slate-400">Opponent</p>
              </div>
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-3xl font-bold text-green-400">{Math.max(0, opponentHealth)}</span>
                  <span className="text-slate-400"> / 100 HP</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${opponentHealth > 50 ? 'bg-green-500' : opponentHealth > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${opponentHealth}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                <div className="text-6xl mb-2">🧑</div>
                <p className="text-xs text-slate-400">Opponent's character</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 h-32 overflow-y-auto space-y-1">
            {gameLog.map((log, idx) => (
              <div key={idx} className="text-xs text-slate-300 py-1 border-b border-slate-700/30">
                {log}
              </div>
            ))}
          </div>

          {!gameOver ? (
            <div className="space-y-3">
              <div className="text-center text-sm font-medium text-slate-300">
                {turn === 'player' ? "Your turn - Choose an action:" : `${opponent.name}'s turn...`}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {actions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => executeAction(action)}
                    disabled={turn !== 'player' || selectedAction !== null || gameOver}
                    className={`p-3 rounded-lg font-medium transition-all border-2 ${
                      turn === 'player' && selectedAction === null && !gameOver
                        ? 'border-purple-500 bg-purple-600/30 hover:bg-purple-600/50 text-white cursor-pointer'
                        : 'border-slate-600 bg-slate-700/30 text-slate-400 cursor-not-allowed opacity-50'
                    } ${selectedAction === action.id ? 'ring-2 ring-yellow-400' : ''}`}
                  >
                    <div className="text-2xl mb-1">{action.icon}</div>
                    <div className="text-sm">{action.name}</div>
                    <div className="text-xs opacity-75">
                      {action.damage.min > 0 ? `+${action.damage.min}-${action.damage.max}` : `${action.damage.min}-${action.damage.max}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-600/10 border border-emerald-500/50 rounded-lg p-6 text-center space-y-4">
              <div className="text-4xl">🏆</div>
              <h3 className="text-2xl font-bold text-emerald-300">{winner} wins!</h3>
              <p className="text-slate-300">Match completed. You've earned rewards for participating!</p>
              <button
                onClick={() => onEnd({ winner })}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors"
              >
                Return to Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
