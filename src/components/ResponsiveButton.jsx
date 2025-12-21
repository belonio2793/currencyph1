import React from 'react'
import { useDevice } from '../context/DeviceContext'

/**
 * Responsive Button Component
 * Features:
 * - Touch-friendly sizing (min 44px height on mobile)
 * - Responsive text sizing
 * - Full-width option for mobile
 * - Multiple variants and sizes
 */
export default function ResponsiveButton({
  children,
  variant = 'primary', // primary, secondary, danger, ghost
  size = 'md', // sm, md, lg
  fullWidth = false,
  disabled = false,
  loading = false,
  icon = null,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  const { isMobile } = useDevice()

  // Size mappings
  const sizeClasses = {
    sm: 'px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm',
    md: 'px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base',
    lg: 'px-5 sm:px-8 py-3 sm:py-4 text-base sm:text-lg',
  }

  // Variant mappings
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 active:bg-slate-400 disabled:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-400',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400',
  }

  const baseClasses = 'rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2'
  const disabledClasses = disabled || loading ? 'opacity-60 cursor-not-allowed' : ''
  const widthClasses = fullWidth ? 'w-full' : ''

  // Ensure minimum touch target size on mobile
  const touchSize = isMobile && size !== 'lg' ? 'min-h-11' : ''

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${widthClasses} ${touchSize} ${className}`}
      {...props}
    >
      {icon && !loading && <span className="flex items-center">{icon}</span>}
      {loading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  )
}
