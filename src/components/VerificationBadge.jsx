import React from 'react'

/**
 * VerificationBadge - Display user's identity verification status
 * @param {boolean} isVerified - Whether user is identity verified
 * @param {string} documentType - Type of document (passport, national_id, etc.)
 * @param {string} verifiedDate - Date of verification
 * @param {string} size - Size: 'sm', 'md', 'lg'
 * @param {boolean} showLabel - Whether to show text label
 */
export function VerificationBadge({ isVerified, documentType, verifiedDate, size = 'md', showLabel = true }) {
  if (!isVerified) return null

  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-6 h-6 text-base'
  }

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const title = `Identity verified ${verifiedDate ? `on ${new Date(verifiedDate).toLocaleDateString()}` : ''}${documentType ? ` via ${documentType}` : ''}`

  return (
    <div className="flex items-center gap-1">
      <div
        className={`${sizeClasses[size]} bg-green-100 rounded-full flex items-center justify-center flex-shrink-0`}
        title={title}
      >
        <span className="text-green-700 font-bold">✓</span>
      </div>
      {showLabel && (
        <span className={`${labelSizeClasses[size]} text-green-700 font-medium`} title={title}>
          Verified
        </span>
      )}
    </div>
  )
}

/**
 * VerificationIndicator - Inline verification status indicator
 * @param {boolean} isVerified - Whether user is identity verified
 * @param {string} variant - 'badge', 'dot', 'chip'
 */
export function VerificationIndicator({ isVerified, variant = 'badge' }) {
  if (!isVerified) return null

  switch (variant) {
    case 'dot':
      return <div className="w-2 h-2 bg-green-500 rounded-full" title="Identity verified" />
    case 'chip':
      return (
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          <span>✓</span>
          <span>Verified</span>
        </div>
      )
    case 'badge':
    default:
      return (
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
          ✓
        </div>
      )
  }
}
