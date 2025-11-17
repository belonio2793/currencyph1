import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './UserProfilePreview.css'

export default function UserProfilePreview({ userId }) {
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    postedJobs: 0,
    acceptedOffers: 0,
    completedJobs: 0,
    averageRating: 0,
    totalRatings: 0,
    totalEarnings: 0,
    memberSince: null
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
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError

      if (user) {
        // Fetch full user profile from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, username, email, display_name_type, profile_picture_url, created_at')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        setUserProfile({
          id: user.id,
          email: userData?.email || user.email,
          full_name: userData?.full_name || user.user_metadata?.full_name,
          username: userData?.username,
          display_name_type: userData?.display_name_type || 'full_name',
          profile_picture_url: userData?.profile_picture_url,
          created_at: userData?.created_at || user.created_at
        })

        await loadUserStats(user.id, userData?.created_at || user.created_at)
      }
    } catch (err) {
      console.error('Error loading user profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUserStats = async (uid, createdAt) => {
    try {
      const [
        { count: postedCount },
        { count: acceptedCount },
        { count: completedCount },
        { data: ratings },
        { data: jobHistory }
      ] = await Promise.all([
        supabase
          .from('jobs')
          .select('id', { count: 'exact' })
          .eq('posted_by_user_id', uid),
        supabase
          .from('job_offers')
          .select('id', { count: 'exact' })
          .eq('service_provider_id', uid)
          .eq('status', 'accepted'),
        supabase
          .from('job_history')
          .select('id', { count: 'exact' })
          .eq('service_provider_id', uid)
          .eq('completion_status', 'completed'),
        supabase
          .from('job_ratings')
          .select('rating_score')
          .eq('rated_user_id', uid),
        supabase
          .from('job_history')
          .select('final_amount_paid')
          .eq('service_provider_id', uid)
          .eq('completion_status', 'completed')
      ])

      const avgRating = ratings && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating_score, 0) / ratings.length).toFixed(1)
        : 0

      const totalEarnings = jobHistory && jobHistory.length > 0
        ? jobHistory.reduce((sum, h) => sum + (h.final_amount_paid || 0), 0)
        : 0

      const memberDate = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'

      setStats({
        postedJobs: postedCount || 0,
        acceptedOffers: acceptedCount || 0,
        completedJobs: completedCount || 0,
        averageRating: avgRating,
        totalRatings: ratings?.length || 0,
        totalEarnings: totalEarnings || 0,
        memberSince: memberDate
      })
    } catch (err) {
      console.error('Error loading user stats:', err)
    }
  }

  if (loading) {
    return (
      <div className="user-profile-preview">
        <div className="profile-loading">Loading profile...</div>
      </div>
    )
  }

  if (!userProfile) {
    return null
  }

  const getDisplayName = (profile) => {
    if (!profile) return 'User'
    const displayType = profile.display_name_type || 'full_name'

    switch (displayType) {
      case 'username':
        return profile.username || profile.full_name || 'User'
      case 'first_name':
        return profile.full_name?.split(' ')[0] || 'User'
      case 'last_name':
        return profile.full_name?.split(' ').pop() || 'User'
      case 'full_name':
      default:
        return profile.full_name || 'User'
    }
  }

  const userName = getDisplayName(userProfile)
  const avatarBg = `hsl(${userName.charCodeAt(0) * 10}, 70%, 55%)`

  return (
    <div className="user-profile-preview">
      {/* Main Profile Card */}
      <div className="profile-main">
        {/* Avatar and Basic Info */}
        <div className="profile-header">
          <div className="profile-avatar" style={{ backgroundColor: avatarBg }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{userName}</h2>
            <p className="profile-email">{userProfile.email}</p>
            <span className="profile-member">Member since {stats.memberSince}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-box">
            <div className="stat-icon" data-icon="briefcase"></div>
            <div className="stat-data">
              <div className="stat-value">{stats.postedJobs}</div>
              <div className="stat-label">Jobs Posted</div>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon" data-icon="check"></div>
            <div className="stat-data">
              <div className="stat-value">{stats.acceptedOffers}</div>
              <div className="stat-label">Accepted Offers</div>
            </div>
          </div>

          <div className="stat-box">
            <div className="stat-icon" data-icon="trophy"></div>
            <div className="stat-data">
              <div className="stat-value">{stats.completedJobs}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>

          {stats.totalRatings > 0 && (
            <div className="stat-box">
              <div className="stat-icon" data-icon="star"></div>
              <div className="stat-data">
                <div className="stat-value">{stats.averageRating}</div>
                <div className="stat-label">Rating ({stats.totalRatings})</div>
              </div>
            </div>
          )}

          {stats.totalEarnings > 0 && (
            <div className="stat-box">
              <div className="stat-icon" data-icon="currency"></div>
              <div className="stat-data">
                <div className="stat-value">₱{stats.totalEarnings.toFixed(0)}</div>
                <div className="stat-label">Total Earnings</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
