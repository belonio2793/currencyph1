import React from 'react'
import { useUserVerificationStatus } from '../lib/usePublicUserProfile'
import { VerificationIndicator } from './VerificationBadge'

/**
 * Component to display a lender's verification status
 * Handles loading and fetching public verification data
 */
export function LenderVerificationDisplay({ lenderId, variant = 'badge' }) {
  const { isVerified, loading } = useUserVerificationStatus(lenderId)

  if (loading || !isVerified) return null

  return <VerificationIndicator isVerified={isVerified} variant={variant} />
}
