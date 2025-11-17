import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function UserProfilePreview({ userId }) {
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalJobs: 0,
    acceptedOffers: 0,
    averageRating: 0,
    totalRatings: 0
  })

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    loadUserProfile()
  }, [userId])

  const loadUserProfile = async () => {
    try {
      // Get user profile from auth.users
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError

      if (user) {
        setUserProfile({
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata || {}
        })

        // Load user stats
        await loadUserStats(user.id)
      }
    } catch (err) {
      console.error('Error loading user profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUserStats = async (uid) => {
    try {
      // Get jobs posted by user
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact' })
        .eq('posted_by_user_id', uid)

      // Get accepted offers
      const { count: acceptedCount } = await supabase
        .from('job_offers')
        .select('id', { count: 'exact' })
        .eq('service_provider_id', uid)
        .eq('status', 'accepted')

      // Get average rating
      const { data: ratings } = await supabase
        .from('job_ratings')
        .select('rating_score')
        .eq('rated_user_id', uid)

      const avgRating = ratings && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating_score, 0) / ratings.length).toFixed(1)
        : 0

      setStats({
        totalJobs: jobCount || 0,
        acceptedOffers: acceptedCount || 0,
        averageRating: avgRating,
        totalRatings: ratings?.length || 0
      })
    } catch (err) {
      console.error('Error loading user stats:', err)
    }
  }

  if (loading) {
    return (
      <div className="user-profile-preview">
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          Loading profile...
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return null
  }

  const userName = userProfile.user_metadata?.full_name || userProfile.email?.split('@')[0] || 'User'

  return (
    <div className="user-profile-preview" style={{
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '24px',
      border: '1px solid #e0e0e0',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: '20px'
    }}>
      {/* Profile Info */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#667eea',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          {userName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '600' }}>
            {userName}
          </h3>
          <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>
            {userProfile.email}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '12px',
        alignItems: 'center',
        minWidth: '300px'
      }}>
        <div style={{
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #e0e0e0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#667eea' }}>
            {stats.totalJobs}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>
            Jobs Posted
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #e0e0e0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#667eea' }}>
            {stats.acceptedOffers}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>
            Accepted
          </div>
        </div>

        {stats.totalRatings > 0 && (
          <div style={{
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #e0e0e0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffa500' }}>
              {stats.averageRating} ★
            </div>
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '4px' }}>
              Rating ({stats.totalRatings})
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
