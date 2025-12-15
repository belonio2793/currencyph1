import React from 'react'
import { useDevice } from '../../context/DeviceContext'

export function MobileSection({ 
  title, 
  subtitle, 
  children, 
  className = '',
  containerClassName = ''
}) {
  const { isMobile } = useDevice()

  return (
    <div className={`${isMobile ? 'mb-6' : 'mb-8'} ${containerClassName}`}>
      {title && (
        <div className={`mb-4 sm:mb-6 ${isMobile && 'mb-4'}`}>
          <h2 className={`font-bold text-slate-900 ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`text-slate-600 mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className={className}>
        {children}
      </div>
    </div>
  )
}

export function MobileSectionGrid({ 
  children, 
  columns = { mobile: 1, tablet: 2, desktop: 3 }
}) {
  const { isMobile, isTablet } = useDevice()

  let cols = columns.desktop
  if (isMobile) cols = columns.mobile
  else if (isTablet) cols = columns.tablet

  return (
    <div className={`grid grid-cols-${cols} gap-3 sm:gap-4`}>
      {children}
    </div>
  )
}
