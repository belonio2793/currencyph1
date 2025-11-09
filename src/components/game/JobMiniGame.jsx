import React, { useState, useEffect, useRef } from 'react'
import { JOB_MINIGAMES } from '../../lib/gameJobMiniGames'

export default function JobMiniGame({ job, onComplete, onCancel }) {
  const [gameState, setGameState] = useState(null)
  const [result, setResult] = useState(null)
  const [animationFrame, setAnimationFrame] = useState(0)
  const gameLoopRef = useRef(null)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    if (!job || !job.minigame) return
    const initialState = job.minigame.generate()
    setGameState(initialState)
    startTimeRef.current = Date.now()
  }, [job])

  useEffect(() => {
    if (!gameState || result) return

    const animate = () => {
      const now = Date.now()
      const dt = now - startTimeRef.current

      setGameState(prevState => {
        const updated = job.minigame.update({ ...prevState }, dt)
        if (updated.timeRemaining <= 0 && !result) {
          handleGameEnd(updated)
        }
        return updated
      })

      setAnimationFrame(f => f + 1)
      gameLoopRef.current = requestAnimationFrame(animate)
    }

    gameLoopRef.current = requestAnimationFrame(animate)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, result, job])

  const handleGameEnd = (finalState) => {
    const reward = job.minigame.calculateReward(finalState)
    setResult(reward)
  }

  const handleClick = () => {
    if (!gameState || result) return
    setGameState(prevState => job.minigame.onClick({ ...prevState }))
  }

  const handleCardClick = (cardId) => {
    if (!gameState || result || !job.minigame.onCardClick) return
    setGameState(prevState => job.minigame.onCardClick({ ...prevState }, cardId))
  }

  const handleType = (e) => {
    if (!gameState || result || !job.minigame.onType) return
    const char = e.key
    if (char.length === 1) {
      setGameState(prevState => job.minigame.onType({ ...prevState }, char))
    }
  }

  if (!gameState) {
    return <div className="flex items-center justify-center h-96">Loading game...</div>
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-yellow-500/50 rounded-lg p-8 max-w-2xl w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-300 mb-2">{job.minigame.name}</h2>
          <p className="text-slate-300">{job.minigame.description}</p>
        </div>

        {/* Game Area */}
        <div
          className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-6 mb-6 min-h-96 flex items-center justify-center"
          onClick={handleClick}
          onKeyDown={handleType}
          tabIndex={0}
        >
          {job.minigame.id === 'rapidClick' && (
            <div className="text-center">
              <div className="text-6xl font-bold text-emerald-400 mb-4">
                {gameState.clicks}
              </div>
              <div className="text-xl text-slate-300">
                Target: {gameState.targetClicks} clicks
              </div>
              <div className="text-lg text-slate-400 mt-4">
                Click anywhere to count clicks
              </div>
            </div>
          )}

          {job.minigame.id === 'memoryMatch' && (
            <div className="grid grid-cols-4 gap-3 w-full">
              {gameState.cards.map(card => (
                <button
                  key={card.id}
                  onClick={(e) => { e.stopPropagation(); handleCardClick(card.id) }}
                  className={`p-8 rounded-lg font-bold text-2xl transition-all ${
                    card.matched
                      ? 'bg-emerald-500 text-white'
                      : card.revealed
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {card.revealed || card.matched ? card.pair + 1 : '?'}
                </button>
              ))}
            </div>
          )}

          {job.minigame.id === 'fastTyping' && (
            <div className="w-full">
              <div className="bg-slate-800 p-4 rounded-lg mb-4">
                <div className="text-slate-300 text-lg tracking-wider font-mono">
                  {gameState.targetPhrase}
                </div>
              </div>
              <div className="bg-slate-700 p-4 rounded-lg">
                <input
                  type="text"
                  autoFocus
                  value={gameState.userInput}
                  onChange={() => {}}
                  onKeyDown={handleType}
                  placeholder="Start typing here..."
                  className="w-full bg-transparent text-white outline-none font-mono text-lg"
                />
              </div>
              <div className="text-slate-400 text-sm mt-2">
                {gameState.correctChars}/{gameState.userInput.length} correct • WPM: {gameState.wpm}
              </div>
            </div>
          )}

          {job.minigame.id === 'rhythmClick' && (
            <div className="text-center w-full">
              <div className="text-6xl font-bold text-cyan-400 mb-8">
                {gameState.currentBeat}/{gameState.beats.length}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-6">
                {gameState.beats.map((beat, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg font-bold text-2xl ${
                      beat.hit
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="text-lg text-slate-300">
                Click to the beat! Score: {gameState.score}
              </div>
            </div>
          )}
        </div>

        {/* Timer and Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 p-3 rounded text-center">
            <div className="text-xs text-slate-400">Time</div>
            <div className="text-2xl font-bold text-cyan-400">
              {Math.ceil(gameState.timeRemaining)}s
            </div>
          </div>
          <div className="bg-slate-800/50 p-3 rounded text-center">
            <div className="text-xs text-slate-400">Progress</div>
            <div className="text-2xl font-bold text-emerald-400">
              {Math.floor((gameState.clicks || gameState.matches || 0) / (gameState.targetClicks || gameState.cards?.length || 1) * 100)}%
            </div>
          </div>
          <div className="bg-slate-800/50 p-3 rounded text-center">
            <div className="text-xs text-slate-400">Difficulty</div>
            <div className="text-2xl font-bold text-yellow-400">
              {'⭐'.repeat(job.difficulty)}
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-emerald-500/20 border border-yellow-500/50 rounded-lg p-6 mb-6 text-center">
            <h3 className="text-2xl font-bold text-yellow-300 mb-4">Job Complete!</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-400">Reward</div>
                <div className="text-3xl font-bold text-emerald-400">₱{result.money}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Experience</div>
                <div className="text-3xl font-bold text-blue-400">{result.xp} XP</div>
              </div>
            </div>
            {result.accuracy && (
              <div className="mt-4 text-cyan-300">
                Accuracy: {result.accuracy}%
              </div>
            )}
            {result.wpm && (
              <div className="text-cyan-300">
                Speed: {result.wpm} WPM
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4">
          {result ? (
            <button
              onClick={() => onComplete(result)}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold text-white transition-colors"
            >
              Claim Reward
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-white transition-colors"
              >
                Cancel
              </button>
              {result === null && (
                <div className="flex-1 text-center text-sm text-slate-400 flex items-center justify-center">
                  Time remaining: {Math.ceil(gameState.timeRemaining)}s
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
