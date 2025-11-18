import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './RidesHistoryView.css'

export default function RidesHistoryView({ userId, userRole }) {
  const [rides, setRides] = useState([])
  const [filteredRides, setFilteredRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')
  const [expandedRideId, setExpandedRideId] = useState(null)
  const [networkStats, setNetworkStats] = useState({
    totalRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    disputedRides: 0,
    averageRating: 0,
    totalDistance: 0,
    totalEarnings: 0,
    todayRides: 0,
    yesterdayRides: 0
  })
  const [selectedRide, setSelectedRide] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(5)

  useEffect(() => {
    loadRides()
    const unsubscribe = subscribeToRidesUpdates()
    return () => unsubscribe?.()
  }, [userId])

  useEffect(() => {
    filterAndCategorizeRides()
  }, [rides, selectedTab])

  const loadRides = async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const userIdFilter = userRole === 'driver'
        ? `driver_id.eq.${userId}`
        : `rider_id.eq.${userId}`

      const { data, error: fetchError } = await supabase
        .from('rides')
        .select(`
          *,
          driver:driver_id(id, full_name, average_rating, vehicle_type),
          rider:rider_id(id, full_name, average_rating),
          ride_ratings(rating, feedback, created_at)
        `)
        .eq(userRole === 'driver' ? 'driver_id' : 'rider_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (fetchError) throw fetchError

      setRides(data || [])
      calculateNetworkStats(data || [])
    } catch (err) {
      console.error('Error loading rides:', err)
      setError('Failed to load ride history')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToRidesUpdates = () => {
    if (!userId) return

    try {
      const userIdFilter = userRole === 'driver'
        ? `driver_id=eq.${userId}`
        : `rider_id=eq.${userId}`

      const subscription = supabase
        .channel(`rides-history:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: userIdFilter
        }, (payload) => {
          loadRides()
        })
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    } catch (err) {
      console.warn('Subscription error:', err)
    }
  }

  const calculateNetworkStats = (ridesList) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let totalDistance = 0
    let totalEarnings = 0
    let totalRating = 0
    let ratingCount = 0
    let todayCount = 0
    let yesterdayCount = 0
    let completedCount = 0
    let cancelledCount = 0
    let disputedCount = 0

    ridesList.forEach(ride => {
      if (ride.status === 'completed') {
        completedCount++
        totalEarnings += parseFloat(ride.final_price || 0)
        if (ride.ride_ratings?.length > 0) {
          ride.ride_ratings.forEach(rating => {
            totalRating += rating.rating
            ratingCount++
          })
        }
      }

      if (ride.status === 'cancelled') {
        cancelledCount++
      }

      if (ride.status === 'disputed') {
        disputedCount++
      }

      totalDistance += parseFloat(ride.actual_distance_km || 0)

      const rideDate = new Date(ride.created_at)
      const rideDateOnly = new Date(rideDate.getFullYear(), rideDate.getMonth(), rideDate.getDate())

      if (rideDateOnly.getTime() === today.getTime()) {
        todayCount++
      } else if (rideDateOnly.getTime() === yesterday.getTime()) {
        yesterdayCount++
      }
    })

    setNetworkStats({
      totalRides: ridesList.length,
      completedRides: completedCount,
      cancelledRides: cancelledCount,
      disputedRides: disputedCount,
      averageRating: ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0,
      totalDistance: totalDistance.toFixed(1),
      totalEarnings: totalEarnings.toFixed(2),
      todayRides: todayCount,
      yesterdayRides: yesterdayCount
    })
  }

  const filterAndCategorizeRides = () => {
    let filtered = rides

    switch (selectedTab) {
      case 'completed':
        filtered = rides.filter(r => r.status === 'completed')
        break
      case 'cancelled':
        filtered = rides.filter(r => r.status === 'cancelled')
        break
      case 'disputed':
        filtered = rides.filter(r => r.status === 'disputed')
        break
      case 'recent':
        filtered = rides.slice(0, 20)
        break
      default:
        filtered = rides
    }

    setFilteredRides(filtered)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed'
      case 'cancelled':
        return 'status-cancelled'
      case 'disputed':
        return 'status-disputed'
      case 'in-progress':
        return 'status-in-progress'
      case 'accepted':
        return 'status-accepted'
      case 'requested':
        return 'status-requested'
      default:
        return 'status-default'
    }
  }

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const formatDistance = (km) => {
    return km ? `${parseFloat(km).toFixed(1)} km` : 'N/A'
  }

  const formatPrice = (price) => {
    return price ? `₱${parseFloat(price).toFixed(2)}` : 'N/A'
  }

  const handleLeaveFeedback = async (rideId, otherUserId) => {
    if (!feedbackText.trim()) {
      setError('Please enter feedback')
      return
    }

    try {
      const { error: saveError } = await supabase
        .from('ride_ratings')
        .insert({
          ride_id: rideId,
          rater_id: userId,
          rated_user_id: otherUserId,
          rating: feedbackRating,
          feedback: feedbackText,
          created_at: new Date().toISOString()
        })

      if (saveError) throw saveError

      setShowFeedbackModal(false)
      setFeedbackText('')
      setFeedbackRating(5)
      setSelectedRide(null)
      loadRides()
    } catch (err) {
      console.error('Error saving feedback:', err)
      setError('Failed to save feedback')
    }
  }

  const renderRideCard = (ride) => {
    const isExpanded = expandedRideId === ride.id
    const otherUserProfile = userRole === 'driver' ? ride.rider : ride.driver
    const hasLeftFeedback = ride.ride_ratings?.some(r => r.created_at)

    return (
      <div key={ride.id} className={`ride-card ${getStatusColor(ride.status)}`}>
        <div className="ride-card-header" onClick={() => setExpandedRideId(isExpanded ? null : ride.id)}>
          <div className="ride-card-main">
            <div className="ride-status-badge">{getStatusLabel(ride.status)}</div>
            <div className="ride-route">
              <div className="location">
                <span className="location-label">From</span>
                <span className="location-value">{ride.start_address || `${ride.start_latitude.toFixed(4)}, ${ride.start_longitude.toFixed(4)}`}</span>
              </div>
              <div className="route-arrow">→</div>
              <div className="location">
                <span className="location-label">To</span>
                <span className="location-value">{ride.end_address || `${ride.end_latitude.toFixed(4)}, ${ride.end_longitude.toFixed(4)}`}</span>
              </div>
            </div>
          </div>

          <div className="ride-card-stats">
            <div className="stat">
              <span className="stat-label">Distance</span>
              <span className="stat-value">{formatDistance(ride.actual_distance_km || ride.estimated_distance_km)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Price</span>
              <span className="stat-value">{formatPrice(ride.final_price || ride.estimated_total_price)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Date</span>
              <span className="stat-value">{new Date(ride.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="expand-icon">{isExpanded ? '▼' : '▶'}</div>
        </div>

        {isExpanded && (
          <div className="ride-card-details">
            <div className="detail-section">
              <h4>Other User</h4>
              <div className="user-profile">
                <div className="user-info">
                  <p className="user-name">{otherUserProfile?.full_name || 'User'}</p>
                  <div className="user-rating">
                    {'★'.repeat(Math.floor(otherUserProfile?.average_rating || 0))}
                    {'☆'.repeat(5 - Math.floor(otherUserProfile?.average_rating || 0))}
                    {otherUserProfile?.average_rating && <span className="rating-number">{otherUserProfile.average_rating.toFixed(1)}</span>}
                  </div>
                </div>
              </div>
            </div>

            {ride.status === 'completed' && (
              <div className="detail-section">
                <h4>Ride Details</h4>
                <div className="details-grid">
                  <div>
                    <span className="label">Started</span>
                    <span className="value">{ride.pickup_time ? formatTime(ride.pickup_time) : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="label">Completed</span>
                    <span className="value">{ride.dropoff_time ? formatTime(ride.dropoff_time) : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="label">Duration</span>
                    <span className="value">{ride.actual_duration_minutes ? `${ride.actual_duration_minutes} min` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="label">Payment</span>
                    <span className="value">{ride.payment_method?.charAt(0).toUpperCase() + ride.payment_method?.slice(1)}</span>
                  </div>
                </div>

                {ride.ride_ratings?.length > 0 && (
                  <div className="feedback-section">
                    <h5>Feedback Left</h5>
                    {ride.ride_ratings.map((feedback, idx) => (
                      <div key={idx} className="feedback-item">
                        <div className="feedback-rating">
                          {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                        </div>
                        <p className="feedback-text">{feedback.feedback}</p>
                        <span className="feedback-date">{new Date(feedback.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!hasLeftFeedback && (
                  <button
                    className="btn-leave-feedback"
                    onClick={() => {
                      setSelectedRide(ride)
                      setShowFeedbackModal(true)
                    }}
                  >
                    Leave Feedback
                  </button>
                )}
              </div>
            )}

            {ride.status === 'disputed' && (
              <div className="detail-section disputed-section">
                <h4>Dispute Details</h4>
                <p className="dispute-reason">{ride.cancellation_reason || 'Dispute raised with driver and rider'}</p>
              </div>
            )}

            {ride.status === 'cancelled' && (
              <div className="detail-section cancelled-section">
                <h4>Cancellation Details</h4>
                <div className="details-grid">
                  <div>
                    <span className="label">Cancelled By</span>
                    <span className="value">{ride.cancelled_by?.charAt(0).toUpperCase() + ride.cancelled_by?.slice(1)}</span>
                  </div>
                  {ride.cancellation_fee && (
                    <div>
                      <span className="label">Cancellation Fee</span>
                      <span className="value">{formatPrice(ride.cancellation_fee)}</span>
                    </div>
                  )}
                </div>
                {ride.cancellation_reason && (
                  <p className="cancellation-reason">{ride.cancellation_reason}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rides-history-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading ride history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rides-history-container">
      <div className="history-header">
        <h2>Ride History & Network Statistics</h2>
      </div>

      <div className="network-stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{networkStats.totalRides}</div>
            <div className="stat-label">Total Rides</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{networkStats.completedRides}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{networkStats.cancelledRides}</div>
            <div className="stat-label">Cancelled</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{networkStats.disputedRides}</div>
            <div className="stat-label">Disputed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{networkStats.averageRating || 'N/A'}</div>
            <div className="stat-label">Avg Rating</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{networkStats.totalDistance}</div>
            <div className="stat-label">Total km</div>
          </div>
          {userRole === 'driver' && (
            <div className="stat-card">
              <div className="stat-value">₱{networkStats.totalEarnings}</div>
              <div className="stat-label">Total Earnings</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-value">{networkStats.todayRides}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{networkStats.yesterdayRides}</div>
            <div className="stat-label">Yesterday</div>
          </div>
        </div>
      </div>

      <div className="rides-filter-tabs">
        <button
          className={`filter-tab ${selectedTab === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedTab('all')}
        >
          All Rides ({rides.length})
        </button>
        <button
          className={`filter-tab ${selectedTab === 'recent' ? 'active' : ''}`}
          onClick={() => setSelectedTab('recent')}
        >
          Most Recent
        </button>
        <button
          className={`filter-tab ${selectedTab === 'completed' ? 'active' : ''}`}
          onClick={() => setSelectedTab('completed')}
        >
          Completed ({networkStats.completedRides})
        </button>
        <button
          className={`filter-tab ${selectedTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setSelectedTab('cancelled')}
        >
          Cancelled ({networkStats.cancelledRides})
        </button>
        <button
          className={`filter-tab ${selectedTab === 'disputed' ? 'active' : ''}`}
          onClick={() => setSelectedTab('disputed')}
        >
          Disputed ({networkStats.disputedRides})
        </button>
      </div>

      <div className="rides-list">
        {filteredRides.length === 0 ? (
          <div className="empty-state">
            <p>No rides found in this category</p>
          </div>
        ) : (
          filteredRides.map(ride => renderRideCard(ride))
        )}
      </div>

      {showFeedbackModal && selectedRide && (
        <div className="modal-overlay" onClick={() => setShowFeedbackModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Leave Feedback</h3>
              <button className="modal-close" onClick={() => setShowFeedbackModal(false)}>×</button>
            </div>

            <div className="feedback-form">
              <div className="form-group">
                <label>Rating</label>
                <div className="rating-selector">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      className={`star-btn ${star <= feedbackRating ? 'active' : ''}`}
                      onClick={() => setFeedbackRating(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Feedback</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share your experience..."
                  rows={4}
                />
              </div>

              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowFeedbackModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-submit"
                  onClick={() => handleLeaveFeedback(selectedRide.id, userRole === 'driver' ? selectedRide.rider_id : selectedRide.driver_id)}
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
    </div>
  )
}
