import React from 'react'
import { useDevice } from '../../context/DeviceContext'

export function MobilePageContainer({ 
  children, 
  className = '',
  maxWidth = 'max-w-7xl'
}) {
  const { isMobile } = useDevice()

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ${isMobile ? 'py-8 px-3' : 'py-12 px-4'}`}>
      <div className={`${isMobile ? 'mx-auto' : maxWidth + ' mx-auto'} ${className}`}>
        {children}
      </div>
    </div>
  )
}

export function MobilePageHeader({ 
  title, 
  subtitle,
  children
}) {
  const { isMobile } = useDevice()

  return (
    <div className={`text-center mb-8 sm:mb-12 ${isMobile && 'mb-8'}`}>
      {title && (
        <h1 className={`font-bold text-slate-900 mb-4 ${isMobile ? 'text-2xl' : 'text-4xl'}`}>
          {title}
        </h1>
      )}
      {subtitle && (
        <p className={`text-slate-600 mb-6 ${isMobile ? 'text-xs' : 'text-sm'}`}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  )
}
