import React from 'react'

/**
 * Responsive Form Grid Component
 * Automatically handles responsive column layouts
 * Usage: <ResponsiveFormGrid columns={2}> for 2 columns on desktop, 1 on mobile
 */
export function ResponsiveFormGrid({ children, columns = 2, gap = 3 }) {
  const colMap = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }

  const gapMap = {
    2: 'gap-2 sm:gap-3',
    3: 'gap-3 sm:gap-4',
    4: 'gap-4 sm:gap-6',
    6: 'gap-4 sm:gap-6',
  }

  return (
    <div className={`grid grid-cols-1 ${colMap[columns] || colMap[2]} ${gapMap[gap] || gapMap[3]}`}>
      {children}
    </div>
  )
}

/**
 * Form Section - wraps form fields with consistent spacing
 */
export function FormSection({ children, title, description }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {title && (
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-xs sm:text-sm text-slate-600">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Form Group - single form field wrapper
 */
export function FormGroup({ label, required, error, help, children }) {
  return (
    <div className="flex flex-col">
      {label && (
        <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 sm:mt-1.5">{error}</p>
      )}
      {help && !error && (
        <p className="text-xs text-slate-500 mt-1 sm:mt-1.5">{help}</p>
      )}
    </div>
  )
}

/**
 * Form Actions - button container at bottom of forms
 */
export function FormActions({ children, justify = 'end' }) {
  const justifyMap = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  }

  return (
    <div
      className={`flex gap-2 sm:gap-3 ${justifyMap[justify]} flex-wrap pt-4 sm:pt-6 border-t border-slate-200`}
    >
      {children}
    </div>
  )
}
