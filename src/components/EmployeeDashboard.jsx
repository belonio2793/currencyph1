import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { employeeInvitationService } from '../lib/employeeInvitationService'
import { attendanceTimerService } from '../lib/attendanceTimerService'
import JobInvitationCard from './JobInvitationCard'
import MyBusinessEmployeeCard from './MyBusinessEmployeeCard'
import './EmployeeDashboard.css'

export default function EmployeeDashboard({ userId }) {
  const [activeTab, setActiveTab] = useState('my-businesses')
  const [myBusinesses, setMyBusinesses] = useState([])
  const [jobInvitations, setJobInvitations] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [selectedBusinessForAttendance, setSelectedBusinessForAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invitationCounts, setInvitationCounts] = useState({
    myBusinesses: 0,
    invitations: 0
  })

  // Load employee data
  useEffect(() => {
    if (userId) {
      loadEmployeeData()
    }
  }, [userId])

  const loadEmployeeData = async () => {
    setLoading(true)
    setError('')

    try {
      const [businessesRes, invitationsRes] = await Promise.all([
        employeeInvitationService.getEmployeeBusinesses(userId),
        employeeInvitationService.getPendingInvitations(userId)
      ])

      if (businessesRes.error) {
        console.error('Error loading businesses:', businessesRes.error)
      } else {
        setMyBusinesses(businessesRes.data || [])
      }

      if (invitationsRes.error) {
        console.error('Error loading invitations:', invitationsRes.error)
      } else {
        setJobInvitations(invitationsRes.data || [])
      }

      setInvitationCounts({
        myBusinesses: businessesRes.data?.length || 0,
        invitations: invitationsRes.data?.length || 0
      })
    } catch (err) {
      console.error('Error loading employee data:', err)
      setError('Failed to load employee information')
    } finally {
      setLoading(false)
    }
  }

  const handleInvitationAccepted = async (invitationId) => {
    try {
      setError('')
      // Reload data to reflect changes
      await loadEmployeeData()
      setError('Invitation accepted successfully!')
      setTimeout(() => setError(''), 3000)
    } catch (err) {
      console.error('Error after accepting invitation:', err)
      setError('Invitation accepted but there was an issue updating the view')
    }
  }

  const handleInvitationRejected = async (invitationId) => {
    try {
      setError('')
      // Reload data to reflect changes
      await loadEmployeeData()
      setError('Invitation rejected')
      setTimeout(() => setError(''), 2000)
    } catch (err) {
      console.error('Error after rejecting invitation:', err)
      setError('Invitation rejected but there was an issue updating the view')
    }
  }

  const handleInvitationHidden = async (invitationId) => {
    try {
      setError('')
      // Remove from local state
      setJobInvitations(prev => prev.filter(inv => inv.id !== invitationId))
      setInvitationCounts(prev => ({
        ...prev,
        invitations: prev.invitations - 1
      }))
      setError('Invitation hidden')
      setTimeout(() => setError(''), 2000)
    } catch (err) {
      console.error('Error hiding invitation:', err)
      setError('Failed to hide invitation')
    }
  }

  const handleBusinessUpdated = async () => {
    try {
      // Reload businesses after any changes
      const res = await employeeInvitationService.getEmployeeBusinesses(userId)
      if (!res.error) {
        setMyBusinesses(res.data || [])
        setInvitationCounts(prev => ({
          ...prev,
          myBusinesses: res.data?.length || 0
        }))
      }
    } catch (err) {
      console.error('Error reloading businesses:', err)
    }
  }

  if (loading) {
    return (
      <div className="employee-dashboard">
        <div className="loading">Loading your employment information...</div>
      </div>
    )
  }

  // If user has no businesses and no invitations, show empty state
  if (myBusinesses.length === 0 && jobInvitations.length === 0) {
    return (
      <div className="employee-dashboard">
        <div className="empty-state">
          <h3>No Active Employment</h3>
          <p>You are not currently employed at any businesses.</p>
          <p>Businesses can send you job invitations, and they will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="employee-dashboard">
      {/* Error Message */}
      {error && (
        <div className={`error-message ${error.toLowerCase().includes('success') ? 'success' : ''}`}>
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="employee-tabs">
        <button
          className={`tab ${activeTab === 'my-businesses' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-businesses')}
        >
          My Businesses
          <span className="tab-badge">{invitationCounts.myBusinesses}</span>
        </button>
        <button
          className={`tab ${activeTab === 'invitations' ? 'active' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          Job Invitations
          <span className="tab-badge">{invitationCounts.invitations}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-businesses' ? (
        <div className="my-businesses-content">
          {myBusinesses.length === 0 ? (
            <div className="empty-state">
              <h3>No Active Employment</h3>
              <p>You are not currently employed at any businesses.</p>
            </div>
          ) : (
            <div className="businesses-list">
              {myBusinesses.map(assignment => (
                <MyBusinessEmployeeCard
                  key={assignment.id}
                  assignment={assignment}
                  userId={userId}
                  onUpdate={handleBusinessUpdated}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="invitations-content">
          {jobInvitations.length === 0 ? (
            <div className="empty-state">
              <h3>No Pending Invitations</h3>
              <p>You don't have any pending job invitations at this time.</p>
            </div>
          ) : (
            <div className="invitations-list">
              {jobInvitations.map(invitation => (
                <JobInvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  userId={userId}
                  onAccepted={() => handleInvitationAccepted(invitation.id)}
                  onRejected={() => handleInvitationRejected(invitation.id)}
                  onHidden={() => handleInvitationHidden(invitation.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
