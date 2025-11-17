import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

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
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, username, email, display_name_type, profile_picture_url, created_at')
          .eq('id', user.id)
          .single()

        if (userError && userError.code !== 'PGRST116') throw userError

        setUserProfile({
          id: user.id,
          email: userData?.email || user.email,
          full_name: userData?.full_name || user.user_metadata?.full_name || 'User',
          username: userData?.username,
          display_name_type: userData?.display_name_type || 'full_name',
          profile_picture_url: userData?.profile_picture_url,
          created_at: userData?.created_at || user.created_at
        })

        await loadUserStats(user.id, userData?.created_at || user.created_at)
      }
    } catch (err) {
      console.error('Error loading user profile:', err)
      setLoading(false)
    }
  }

  const loadUserStats = async (uid, createdAt) => {
    try {
      const [
        postedJobsResult,
        acceptedOffersResult,
        completedJobsResult,
        ratingsResult
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
          .eq('rated_user_id', uid)
      ])

      const postedCount = postedJobsResult.count || 0
      const acceptedCount = acceptedOffersResult.count || 0
      const completedCount = completedJobsResult.count || 0
      const ratings = ratingsResult.data || []

      const avgRating = ratings && ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + (r.rating_score || 0), 0) / ratings.length).toFixed(1)
        : 0

      const memberDate = createdAt 
        ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'N/A'

      setStats({
        postedJobs: postedCount,
        acceptedOffers: acceptedCount,
        completedJobs: completedCount,
        averageRating: avgRating,
        totalRatings: ratings.length,
        totalEarnings: 0,
        memberSince: memberDate
      })
    } catch (err) {
      console.error('Error loading user stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        background: '#667eea',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '30px',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.15)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem' }}>
          Loading profile...
        </div>
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

  const blurEmail = (email) => {
    if (!email) return ''
    const [localPart, domain] = email.split('@')
    const visibleChars = Math.ceil(localPart.length / 3)
    const blurred = localPart.substring(0, visibleChars) + '*'.repeat(localPart.length - visibleChars)
    return `${blurred}@${domain}`
  }

  const handleSendMessage = () => {
    window.dispatchEvent(new CustomEvent('openChat', { detail: { userId } }))
  }

  const handleViewProfile = () => {
    window.dispatchEvent(new CustomEvent('viewUserProfile', { detail: { userId } }))
  }

  return (
    <div style={{
      background: '#667eea',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '30px',
      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.15)',
      color: 'white',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Profile Header */}
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          width: '100%'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: '700',
            color: 'white',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            backgroundColor: avatarBg,
            position: 'relative',
            zIndex: 2
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>

          <div style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{
              margin: '0 0 4px 0',
              fontSize: '1.4rem',
              fontWeight: '700',
              color: 'white',
              wordBreak: 'break-word',
              lineHeight: '1.2'
            }}>
              {userName}
            </h2>
            <p style={{
              margin: '0 0 6px 0',
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.9)',
              wordBreak: 'break-all',
              lineHeight: '1.3'
            }}>
              {blurEmail(userProfile.email)}
            </p>
            <span style={{
              display: 'inline-block',
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.9)',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              alignSelf: 'flex-start'
            }}>
              Member since {stats.memberSince}
            </span>
          </div>

          <button
            onClick={handleSendMessage}
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            💬 Send Message
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '16px',
          width: '100%'
        }}>
          {/* Jobs Posted */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            minHeight: '60px'
          }}>
            <div style={{
              fontSize: '24px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '6px',
              fontWeight: '700',
              color: 'white',
              position: 'relative',
              minWidth: '40px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              □
            </div>
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: 'white',
                marginBottom: '2px',
                lineHeight: '1.2'
              }}>
                {stats.postedJobs}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '500',
                lineHeight: '1.2'
              }}>
                Jobs Posted
              </div>
            </div>
          </div>

          {/* Accepted Offers */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            minHeight: '60px'
          }}>
            <div style={{
              fontSize: '24px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '6px',
              fontWeight: '700',
              color: 'white',
              position: 'relative',
              minWidth: '40px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              ✓
            </div>
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: 'white',
                marginBottom: '2px',
                lineHeight: '1.2'
              }}>
                {stats.acceptedOffers}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '500',
                lineHeight: '1.2'
              }}>
                Accepted Offers
              </div>
            </div>
          </div>

          {/* Completed */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            minHeight: '60px'
          }}>
            <div style={{
              fontSize: '24px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '6px',
              fontWeight: '700',
              color: 'white',
              position: 'relative',
              minWidth: '40px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              ▲
            </div>
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: 'white',
                marginBottom: '2px',
                lineHeight: '1.2'
              }}>
                {stats.completedJobs}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '500',
                lineHeight: '1.2'
              }}>
                Completed
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
