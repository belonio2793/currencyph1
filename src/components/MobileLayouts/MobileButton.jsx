import React from 'react'
import { useDevice } from '../../context/DeviceContext'

export function MobileButton({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  fullWidth = false,
  className = ''
}) {
  const { isMobile } = useDevice()

  const baseClasses = 'font-semibold rounded-lg transition-colors border'
  
  const sizeClasses = {
    sm: isMobile ? 'px-4 py-2 text-xs' : 'px-4 py-2 text-sm',
    md: isMobile ? 'px-6 py-2.5 text-sm' : 'px-8 py-3 text-base',
    lg: isMobile ? 'px-6 py-3 text-base' : 'px-10 py-4 text-lg'
  }

  const variantClasses = {
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
    secondary: 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50',
    danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
    outline: 'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50'
  }

  const widthClass = fullWidth ? 'w-full' : ''

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className}`}
    >
      {children}
    </button>
  )
}
