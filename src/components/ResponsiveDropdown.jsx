import React, { useRef, useEffect } from 'react'
import { useDevice } from '../context/DeviceContext'

/**
 * Responsive Dropdown Component
 * Features:
 * - Mobile: full-width dropdown that opens below or above based on available space
 * - Desktop: positioned dropdown that respects available space
 * - Auto-positioning to stay in viewport
 * - Touch-friendly spacing
 */
export default function ResponsiveDropdown({
  isOpen,
  onClose,
  trigger,
  children,
  align = 'left', // left or right
  className = '',
  maxHeight = true
}) {
  const { isMobile, isTablet } = useDevice()
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Auto-close when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose?.()
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen, onClose])

  // Auto-position to stay in viewport
  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !containerRef.current) return

    const dropdown = dropdownRef.current
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const dropdownRect = dropdown.getBoundingClientRect()

    // Check if dropdown would go below viewport
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const dropdownHeight = dropdownRect.height

    // Position dropdown
    if (spaceBelow < dropdownHeight + 10 && spaceAbove > dropdownHeight + 10) {
      // Position above
      dropdown.style.bottom = '100%'
      dropdown.style.top = 'auto'
      dropdown.style.marginBottom = '8px'
    } else {
      // Position below (default)
      dropdown.style.top = '100%'
      dropdown.style.bottom = 'auto'
      dropdown.style.marginTop = '8px'
    }

    // Handle alignment on mobile - full width
    if (isMobile) {
      dropdown.style.left = '0'
      dropdown.style.right = '0'
      dropdown.style.width = '100%'
    } else {
      // Desktop alignment
      if (align === 'right') {
        dropdown.style.right = '0'
        dropdown.style.left = 'auto'
      } else {
        dropdown.style.left = '0'
        dropdown.style.right = 'auto'
      }
    }
  }, [isOpen, isMobile, align])

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {trigger}

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden transition-all ${
            isMobile ? 'w-full left-0 right-0' : ''
          } ${maxHeight ? 'max-h-[300px] sm:max-h-[400px] overflow-y-auto' : ''}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
