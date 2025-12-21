import React, { useState } from 'react'
import { useDevice } from '../context/DeviceContext'

/**
 * MobileOptimizedModalWrapper
 * Wraps existing modal components to add mobile optimization
 * - Fullscreen on mobile with rounded top corners
 * - Collapsible header that minimizes to a button
 * - Proper spacing and responsive behavior
 */
export function MobileOptimizedModalWrapper({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  size = 'md',
  className = '',
  showCloseButton = true,
  defaultExpanded = true,
  showBadge,
  badgeContent
}) {
  const { isMobile } = useDevice()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!isOpen) return null

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Minimized header state for mobile
  if (isMobile && !isExpanded) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-none z-40"
          onClick={onClose}
        />
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
          <button
            onClick={handleToggleExpand}
            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center gap-3">
              {icon && <span className="text-lg">{icon}</span>}
              <span className="font-semibold text-sm sm:text-base">{title}</span>
              {showBadge && badgeContent && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                  {badgeContent}
                </span>
              )}
            </div>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      </>
    )
  }

  // Desktop/expanded modal
  const getSizeClasses = () => {
    if (isMobile) return 'inset-0 rounded-t-2xl'
    
    const sizeMap = {
      sm: 'w-full max-w-sm',
      md: 'w-full max-w-md',
      lg: 'w-full max-w-lg',
      xl: 'w-full max-w-2xl',
      fullscreen: 'w-full max-w-none'
    }
    return sizeMap[size] || sizeMap.md
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div
        className={`fixed z-50 bg-white rounded-lg overflow-hidden flex flex-col ${
          isMobile
            ? 'inset-0 rounded-t-2xl rounded-b-none'
            : `top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${getSizeClasses()}`
        } ${className}`}
        style={{ maxHeight: isMobile ? '100vh' : '90vh' }}
      >
        {/* Header */}
        {title && (
          <div className={`border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10 ${
            isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
          }`}>
            <div className="flex items-center gap-2 flex-1">
              {icon && <span className="text-2xl">{icon}</span>}
              <h2 className={`font-bold text-slate-900 ${isMobile ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>
                {title}
              </h2>
              {showBadge && badgeContent && (
                <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {badgeContent}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isMobile && (
                <button
                  onClick={handleToggleExpand}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Minimize"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 flex-wrap ${
            isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
          }`}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

export default MobileOptimizedModalWrapper
