import React, { useEffect, useState } from 'react'

// Animated stat display with pulse effect
export function AnimatedStatDisplay({ label, value, icon, color = 'cyan', trend = null }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let frames = 0
    const target = typeof value === 'number' ? value : 0
    const increment = target / 20

    const timer = setInterval(() => {
      frames++
      if (frames >= 20) {
        setDisplayValue(target)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(frames * increment))
      }
    }, 30)

    return () => clearInterval(timer)
  }, [value])

  const colorClasses = {
    cyan: 'text-cyan-300',
    green: 'text-green-300',
    yellow: 'text-yellow-300',
    red: 'text-red-300',
    purple: 'text-purple-300'
  }

  return (
    <div className="relative group">
      <style>{`
        @keyframes stat-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .stat-display:hover {
          animation: stat-pulse 0.5s ease-in-out;
        }
      `}</style>

      <div className="stat-display p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-${color}-500/50 transition-all">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">{label}</div>
          <span className="text-lg">{icon}</span>
        </div>
        <div className={`text-2xl font-bold ${colorClasses[color]}`}>
          {typeof value === 'number' && value > 1000000
            ? (displayValue / 1000000).toFixed(1) + 'M'
            : typeof value === 'number' && value > 1000
              ? (displayValue / 1000).toFixed(1) + 'K'
              : displayValue.toLocaleString()}
        </div>
        {trend && (
          <div className={`text-xs mt-1 ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {trend > 0 && `↑ +${trend}`}
            {trend < 0 && `↓ ${trend}`}
          </div>
        )}
      </div>
    </div>
  )
}

// Animated button with ripple effect
export function AnimatedButton({ children, onClick, variant = 'primary', size = 'md', disabled = false, ...props }) {
  const [ripples, setRipples] = useState([])

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ripple = {
      id: Date.now(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    setRipples([...ripples, ripple])
    setTimeout(() => {
      setRipples(r => r.filter(rip => rip.id !== ripple.id))
    }, 600)

    onClick?.(e)
  }

  const variantClasses = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white',
    success: 'bg-green-600 hover:bg-green-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    warning: 'bg-orange-600 hover:bg-orange-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white'
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded font-bold transition-all ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      {...props}
    >
      {/* Ripple effect */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ping"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '20px',
            height: '20px',
            animation: 'ripple 0.6s ease-out'
          }}
        />
      ))}
      <style>{`
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `}</style>

      {children}
    </button>
  )
}

// Animated progress bar
export function AnimatedProgressBar({ value, max = 100, label = null, color = 'cyan', animated = true }) {
  const percentage = (value / max) * 100

  const colorClasses = {
    cyan: 'from-cyan-400 to-cyan-600',
    green: 'from-green-400 to-green-600',
    red: 'from-red-400 to-red-600',
    yellow: 'from-yellow-400 to-yellow-600',
    purple: 'from-purple-400 to-purple-600'
  }

  return (
    <div>
      {label && <div className="text-xs text-slate-400 mb-1">{label}</div>}
      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden border border-slate-600/50">
        <div
          className={`h-full bg-gradient-to-r ${colorClasses[color]} transition-all ${animated ? 'duration-500' : ''} relative`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        >
          {animated && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              style={{
                animation: 'shimmer 2s infinite'
              }}
            />
          )}
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div className="text-xs text-slate-400 mt-1">
        {value} / {max}
      </div>
    </div>
  )
}

// Card component with hover effects
export function GameCard({ title, children, icon = null, onClick = null, highlighted = false }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border transition-all ${
        highlighted
          ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border-cyan-400/50 shadow-lg shadow-cyan-500/20'
          : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {title && (
        <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-xl">{icon}</span>}
          <h3 className="font-bold text-slate-200">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

// Status badge with animation
export function StatusBadge({ status, label = null }) {
  const statusConfig = {
    active: { color: 'bg-green-500', icon: '✓', label: 'Active' },
    inactive: { color: 'bg-slate-500', icon: '⊘', label: 'Inactive' },
    working: { color: 'bg-blue-500', icon: '⚙️', label: 'Working' },
    waiting: { color: 'bg-yellow-500', icon: '⏳', label: 'Waiting' },
    error: { color: 'bg-red-500', icon: '!', label: 'Error' },
    success: { color: 'bg-green-500', icon: '✓', label: 'Success' }
  }

  const config = statusConfig[status] || statusConfig.inactive
  const displayLabel = label || config.label

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold text-white ${config.color}`}>
      <span className={status === 'working' ? 'animate-spin' : ''}>{config.icon}</span>
      {displayLabel}
    </div>
  )
}

// Tooltip component
export function Tooltip({ text, children, position = 'top' }) {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2'
  }

  return (
    <div className="group relative inline-block">
      {children}
      <div className={`absolute ${positionClasses[position]} left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50`}>
        <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded whitespace-nowrap border border-slate-700">
          {text}
          <div className={`absolute ${position === 'top' ? 'top-full' : 'bottom-full'} left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-${position === 'top' ? 'b' : 't'}-slate-900`} />
        </div>
      </div>
    </div>
  )
}

// Notification popup with animation
export function NotificationPopup({ message, type = 'info', duration = 3000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => setVisible(false), duration)
      return () => clearTimeout(timer)
    }
  }, [duration])

  const typeConfig = {
    info: 'bg-blue-600 border-blue-400',
    success: 'bg-green-600 border-green-400',
    warning: 'bg-orange-600 border-orange-400',
    error: 'bg-red-600 border-red-400'
  }

  return (
    <div className={`fixed bottom-4 left-4 px-4 py-3 rounded border text-white font-bold transition-all ${typeConfig[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
      {message}
    </div>
  )
}

// Loading spinner
export function LoadingSpinner({ size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`${sizeClasses[size]} border-2 border-slate-700 border-t-cyan-500 rounded-full animate-spin`} />
  )
}

// Animated number counter
export function AnimatedCounter({ from = 0, to, duration = 1000 }) {
  const [count, setCount] = useState(from)

  useEffect(() => {
    let current = from
    const increment = (to - from) / (duration / 30)
    const timer = setInterval(() => {
      current += increment
      if ((increment > 0 && current >= to) || (increment < 0 && current <= to)) {
        setCount(to)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, 30)

    return () => clearInterval(timer)
  }, [from, to, duration])

  return <span>{count.toLocaleString()}</span>
}
