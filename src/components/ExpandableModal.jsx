import React, { useState } from 'react'
import { useDevice } from '../context/DeviceContext'

/**
 * ExpandableModal Component
 * Provides a mobile-optimized modal with collapsible header
 * - On mobile: Header acts as a collapsible button when minimized
 * - Expanded state fills 100% of the viewport
 * - Smooth animations and transitions
 */
export default function ExpandableModal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  className = '',
  defaultExpanded = true,
  onMinimize,
  onExpand,
  showBadge,
  badgeContent
}) {
  const { isMobile } = useDevice()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!isOpen) return null

  const handleToggleExpand = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    
    if (newState && onExpand) onExpand()
    if (!newState && onMinimize) onMinimize()
  }

  // Minimized header for mobile
  if (isMobile && !isExpanded) {
    return (
      <>
        {/* Backdrop - lighter for minimized state */}
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-none z-40 transition-opacity"
          onClick={onClose}
        />

        {/* Minimized Header Button */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
          <button
            onClick={handleToggleExpand}
            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl active:scale-98"
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
            <svg
              className="w-5 h-5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        </div>
      </>
    )
  }

  // Full modal size classes
  const getSizeClasses = () => {
    if (isMobile) {
      return 'inset-0 rounded-t-2xl'
    }
    
    const sizeMap = {
      sm: 'w-full max-w-sm',
      md: 'w-full max-w-md',
      lg: 'w-full max-w-lg',
      xl: 'w-full max-w-2xl',
      fullscreen: 'w-full max-w-none'
    }
    
    return sizeMap[size] || sizeMap.md
  }

  const sizeClasses = getSizeClasses()
  const paddingClasses = isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
  const headerPaddingClasses = isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
  const footerPaddingClasses = isMobile ? 'p-4 sm:p-6' : 'p-6 sm:p-8'
  const titleClasses = isMobile ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Expanded Modal */}
      <div
        className={`fixed z-50 bg-white rounded-lg overflow-hidden flex flex-col transition-all ${
          isMobile
            ? 'inset-0 rounded-t-2xl rounded-b-none'
            : `top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${sizeClasses}`
        } ${className}`}
        style={{
          maxHeight: isMobile ? '100vh' : '90vh'
        }}
      >
        {/* Header with collapse button */}
        {title && (
          <div
            className={`${headerPaddingClasses} border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10`}
          >
            <div className="flex items-center gap-2 flex-1">
              {icon && <span className="text-2xl">{icon}</span>}
              <h2 className={`font-bold text-slate-900 ${titleClasses}`}>
                {title}
              </h2>
              {showBadge && badgeContent && (
                <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {badgeContent}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isMobile && isExpanded && (
                <button
                  onClick={handleToggleExpand}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Minimize"
                >
                  <svg
                    className="w-5 h-5 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </button>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                  aria-label="Close modal"
                >
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${paddingClasses}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={`${footerPaddingClasses} border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50 flex-wrap`}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
