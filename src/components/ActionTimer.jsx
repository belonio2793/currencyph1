import React, { useState, useEffect } from 'react'

export default function ActionTimer({ actionRequired, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(60)

  useEffect(() => {
    if (!actionRequired) {
      setTimeLeft(60)
      return
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onExpired?.()
          return 60
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [actionRequired, onExpired])

  if (!actionRequired) return null

  const isWarning = timeLeft <= 15
  const isCritical = timeLeft <= 5

  return (
    <div className={`rounded-xl border p-6 text-center transition ${
      isCritical ? 'bg-red-900/30 border-red-600' :
      isWarning ? 'bg-yellow-900/30 border-yellow-600' :
      'bg-slate-800 border-slate-700'
    }`}>
      <div className="text-sm text-slate-300 mb-2">Your Action</div>
      <div className={`text-5xl font-bold font-mono transition ${
        isCritical ? 'text-red-400 animate-pulse' :
        isWarning ? 'text-yellow-400' :
        'text-white'
      }`}>
        {timeLeft}s
      </div>
      <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isCritical ? 'bg-red-500' :
            isWarning ? 'bg-yellow-500' :
            'bg-emerald-500'
          }`}
          style={{ width: `${(timeLeft / 60) * 100}%` }}
        />
      </div>
    </div>
  )
}
