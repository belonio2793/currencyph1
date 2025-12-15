import React from 'react'
import { useDevice } from '../context/DeviceContext'

/**
 * ResponsiveLayout - Smart container that handles responsive layouts
 * Shows mobile layout on mobile, desktop layout on desktop
 */
export function ResponsiveLayout({ 
  children, 
  mobileChildren,
  className = ''
}) {
  const { isMobile } = useDevice()

  if (isMobile && mobileChildren) {
    return <div className={className}>{mobileChildren}</div>
  }

  return <div className={className}>{children}</div>
}

/**
 * MobileOnly - Render only on mobile devices
 */
export function MobileOnly({ children, className = '' }) {
  const { isMobile } = useDevice()
  return isMobile ? <div className={className}>{children}</div> : null
}

/**
 * DesktopOnly - Render only on desktop devices
 */
export function DesktopOnly({ children, className = '' }) {
  const { isDesktop } = useDevice()
  return isDesktop ? <div className={className}>{children}</div> : null
}

/**
 * TabletOnly - Render only on tablet devices
 */
export function TabletOnly({ children, className = '' }) {
  const { isTablet } = useDevice()
  return isTablet ? <div className={className}>{children}</div> : null
}

/**
 * ResponsiveContainer - Container that adapts padding and width based on device
 */
export function ResponsiveContainer({ children, className = '' }) {
  const { isMobile, isTablet } = useDevice()

  let responsiveClass = 'max-w-7xl mx-auto'
  if (isMobile) {
    responsiveClass = 'w-full'
  } else if (isTablet) {
    responsiveClass = 'max-w-3xl mx-auto'
  }

  return (
    <div className={`${responsiveClass} ${className}`}>
      {children}
    </div>
  )
}

/**
 * MobileMenu - Conditional mobile navigation menu
 */
export function MobileMenu({ isOpen, onClose, children }) {
  const { isMobile } = useDevice()

  if (!isMobile) return null

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      {/* Menu Panel */}
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 bg-white z-50 overflow-y-auto transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {children}
      </div>
    </>
  )
}

/**
 * Grid layout that adapts column count based on device
 */
export function ResponsiveGrid({ children, className = '', columns = { mobile: 1, tablet: 2, desktop: 3 } }) {
  const { isMobile, isTablet } = useDevice()

  let colClass = `grid-cols-${columns.desktop}`
  if (isMobile) colClass = `grid-cols-${columns.mobile}`
  else if (isTablet) colClass = `grid-cols-${columns.tablet}`

  return (
    <div className={`grid gap-4 ${colClass} ${className}`}>
      {children}
    </div>
  )
}
