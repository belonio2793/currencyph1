import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

/**
 * Hook to fetch public user profile data including identity verification status
 * Only returns publicly visible information
 */
export function usePublicUserProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchPublicProfile = async () => {
      try {
        setLoading(true)
        setError(null)

        // Query the users_public_profile view
        const { data, error: queryError } = await supabase
          .from('users_public_profile')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (queryError) throw queryError

        setProfile(data)
      } catch (err) {
        console.error('Error fetching public profile:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPublicProfile()
  }, [userId])

  return { profile, loading, error }
}

/**
 * Hook to check if a user is publicly verified
 */
export function useUserVerificationStatus(userId) {
  const [isVerified, setIsVerified] = useState(false)
  const [verificationData, setVerificationData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchVerification = async () => {
      try {
        const { data, error } = await supabase
          .from('users_public_profile')
          .select('is_identity_verified, verified_document_type, verified_date')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setIsVerified(data.is_identity_verified || false)
          setVerificationData({
            documentType: data.verified_document_type,
            verifiedDate: data.verified_date
          })
        }
      } catch (err) {
        console.error('Error fetching verification status:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVerification()
  }, [userId])

  return { isVerified, verificationData, loading }
}
