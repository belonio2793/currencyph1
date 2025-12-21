/**
 * Responsive Utility Functions
 * Helper functions for consistent responsive behavior
 */

// Responsive spacing scale
export const spacing = {
  xs: {
    mobile: '0.5rem',
    tablet: '0.75rem',
    desktop: '1rem'
  },
  sm: {
    mobile: '0.75rem',
    tablet: '1rem',
    desktop: '1.25rem'
  },
  md: {
    mobile: '1rem',
    tablet: '1.25rem',
    desktop: '1.5rem'
  },
  lg: {
    mobile: '1.25rem',
    tablet: '1.5rem',
    desktop: '2rem'
  },
  xl: {
    mobile: '1.5rem',
    tablet: '2rem',
    desktop: '2.5rem'
  }
}

// Responsive typography scale
export const typography = {
  h1: {
    mobile: 'text-2xl sm:text-3xl md:text-4xl',
    weight: 'font-bold'
  },
  h2: {
    mobile: 'text-xl sm:text-2xl md:text-3xl',
    weight: 'font-bold'
  },
  h3: {
    mobile: 'text-lg sm:text-xl md:text-2xl',
    weight: 'font-semibold'
  },
  body: {
    mobile: 'text-sm sm:text-base md:text-base',
    weight: 'font-normal'
  },
  small: {
    mobile: 'text-xs sm:text-sm',
    weight: 'font-normal'
  }
}

// Touch target size (minimum 44px for accessibility)
export const TOUCH_TARGET_SIZE = '44px'

// Modal responsive constraints
export const modalConstraints = {
  mobile: {
    maxWidth: '100vw',
    maxHeight: '100vh',
    borderRadius: '1.5rem 1.5rem 0 0'
  },
  tablet: {
    maxWidth: '90vw',
    maxHeight: '90vh',
    borderRadius: '0.5rem'
  },
  desktop: {
    maxWidth: '80vw',
    maxHeight: '90vh',
    borderRadius: '0.5rem'
  }
}

// Breakpoint values
export const breakpoints = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
}

/**
 * Get responsive class string for common patterns
 */
export function getResponsivePadding(size = 'md') {
  const paddingMap = {
    xs: 'p-2 sm:p-3 md:p-4',
    sm: 'p-3 sm:p-4 md:p-6',
    md: 'p-4 sm:p-6 md:p-8',
    lg: 'p-6 sm:p-8 md:p-10'
  }
  return paddingMap[size] || paddingMap.md
}

/**
 * Get responsive gap classes
 */
export function getResponsiveGap(size = 'md') {
  const gapMap = {
    xs: 'gap-1.5 sm:gap-2 md:gap-3',
    sm: 'gap-2 sm:gap-3 md:gap-4',
    md: 'gap-3 sm:gap-4 md:gap-6',
    lg: 'gap-4 sm:gap-6 md:gap-8'
  }
  return gapMap[size] || gapMap.md
}

/**
 * Get responsive font size classes
 */
export function getResponsiveFontSize(variant = 'body') {
  const fontMap = {
    h1: 'text-2xl sm:text-3xl md:text-4xl font-bold',
    h2: 'text-xl sm:text-2xl md:text-3xl font-bold',
    h3: 'text-lg sm:text-xl md:text-2xl font-semibold',
    body: 'text-sm sm:text-base md:text-base',
    small: 'text-xs sm:text-sm',
    caption: 'text-xs sm:text-xs'
  }
  return fontMap[variant] || fontMap.body
}

/**
 * Get responsive grid columns class
 */
export function getResponsiveGrid(cols = 2, gap = 'md') {
  const gapClass = getResponsiveGap(gap)
  const colMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
  }
  return `grid ${colMap[cols] || colMap[2]} ${gapClass}`
}

/**
 * Check if should stack on mobile
 */
export function shouldStackOnMobile(isMobile, forceStack = false) {
  return isMobile || forceStack
}

/**
 * Create responsive container constraints
 */
export function getContainerConstraints(type = 'default') {
  const constraintMap = {
    default: 'max-w-7xl mx-auto',
    narrow: 'max-w-4xl mx-auto',
    wide: 'w-full',
    modal: 'max-w-2xl mx-auto'
  }
  return constraintMap[type] || constraintMap.default
}
