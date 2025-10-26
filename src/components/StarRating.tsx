import React from 'react'

interface StarRatingProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 22,
}

export default function StarRating({ value, size = 'md', className = '' }: StarRatingProps) {
  const px = sizeMap[size]
  const full = Math.floor(value)
  const stars = Array.from({ length: 5 })

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label={`Rating ${value.toFixed(1)} out of 5`}>
      {stars.map((_, i) => {
        const filled = i < full
        return (
          <svg
            key={i}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            fill={filled ? '#fbbf24' : 'none'}
            stroke={filled ? '#f59e0b' : '#cbd5e1'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        )
      })}
    </div>
  )
}
