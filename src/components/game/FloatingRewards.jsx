import React, { useState, useEffect } from 'react'

const FloatingRewards = ({ reward, duration = 2000, onComplete = null }) => {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true)
      const completeTimer = setTimeout(() => {
        onComplete?.()
      }, 300)
      return () => clearTimeout(completeTimer)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onComplete])

  const getIcon = () => {
    switch (reward.type) {
      case 'money':
        return '💰'
      case 'xp':
        return '⭐'
      case 'level':
        return '🎉'
      case 'item':
        return '📦'
      case 'achievement':
        return '🏆'
      case 'property':
        return '🏠'
      default:
        return '✨'
    }
  }

  const getColor = () => {
    switch (reward.type) {
      case 'money':
        return 'from-green-400 to-emerald-600'
      case 'xp':
        return 'from-blue-400 to-cyan-600'
      case 'level':
        return 'from-yellow-400 to-orange-600'
      case 'item':
        return 'from-purple-400 to-pink-600'
      case 'achievement':
        return 'from-amber-400 to-red-600'
      case 'property':
        return 'from-orange-400 to-red-600'
      default:
        return 'from-slate-400 to-slate-600'
    }
  }

  return (
    <div
      className={`fixed pointer-events-none select-none transition-all duration-300 ${
        fadeOut ? 'opacity-0 translate-y-8' : 'opacity-100'
      }`}
      style={{
        left: reward.x ? `${reward.x}px` : 'auto',
        top: reward.y ? `${reward.y}px` : 'auto',
        transform: 'translate(-50%, -50%)',
        animation: fadeOut ? 'none' : `float-up 0.6s ease-out, scale-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`
      }}
    >
      <style>{`
        @keyframes float-up {
          to {
            transform: translate(-50%, -80px);
            opacity: 0;
          }
        }
        @keyframes scale-pop {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>

      <div className={`bg-gradient-to-b ${getColor()} text-white font-bold px-3 py-2 rounded-lg shadow-lg`}
        style={{
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          whiteSpace: 'nowrap',
          minWidth: '60px',
          textAlign: 'center'
        }}
      >
        <div className="text-sm">{getIcon()}</div>
        <div className="text-xs">
          {reward.type === 'money' && `+₱${reward.amount?.toLocaleString()}`}
          {reward.type === 'xp' && `+${reward.amount} XP`}
          {reward.type === 'level' && `Level ${reward.amount}!`}
          {reward.type === 'item' && reward.amount}
          {reward.type === 'achievement' && reward.amount}
          {reward.type === 'property' && 'Property +1'}
          {!reward.amount && reward.text}
        </div>
      </div>
    </div>
  )
}

export function RewardsContainer() {
  const [rewards, setRewards] = useState([])

  useEffect(() => {
    // Listen for reward events
    const handleReward = (event) => {
      const reward = {
        id: Date.now() + Math.random(),
        ...event.detail
      }
      setRewards(prev => [...prev, reward])
    }

    window.addEventListener('game-reward', handleReward)
    return () => window.removeEventListener('game-reward', handleReward)
  }, [])

  const removeReward = (id) => {
    setRewards(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="fixed inset-0 pointer-events-none">
      {rewards.map(reward => (
        <FloatingRewards
          key={reward.id}
          reward={reward}
          duration={reward.duration || 2000}
          onComplete={() => removeReward(reward.id)}
        />
      ))}
    </div>
  )
}

export function showReward(type, amount, options = {}) {
  const event = new CustomEvent('game-reward', {
    detail: {
      type,
      amount,
      ...options
    }
  })
  window.dispatchEvent(event)
}
